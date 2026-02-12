terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source = "hashicorp/random"
      version = "~> 3.0"
    }
  }
  backend "s3" {
    # Backend config is populated dynamically during 'terraform init' in CI/CD.
  }
}

variable "ssh_allowed_cidrs" {
  description = "List of CIDR blocks allowed to connect/SSH to port 22."
  type        = list(string)
}

provider "aws" {
  region = "ap-south-1"
}

resource "random_id" "bucket_suffix" {
  byte_length = 4
}

# 1. Lightsail Instance (Application Server / API)
resource "aws_lightsail_instance" "server" {
  name              = "nalamdesk-server"
  availability_zone = "ap-south-1a"
  blueprint_id      = "ubuntu_22_04"
  bundle_id         = "nano_3_0"
  
  # Dual-stack networking (IPv4 + IPv6)
  ip_address_type   = "dualstack" 

  user_data = <<-EOF
              #!/bin/bash
              # 1. Install Docker & AWS CLI
              apt-get update
              apt-get install -y ca-certificates curl gnupg awscli
              install -m 0755 -d /etc/apt/keyrings
              curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
              chmod a+r /etc/apt/keyrings/docker.gpg
              echo \
                "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
                "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
                tee /etc/apt/sources.list.d/docker.list > /dev/null
              apt-get update
              apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
              
              # 2. Allow ubuntu user to use docker
              usermod -aG docker ubuntu
              
              # 3. Create data directory
              mkdir -p /data
              chown ubuntu:ubuntu /data

              # 4. Create Backup Script
              cat <<'SCRIPT' > /home/ubuntu/backup_db.sh
              #!/bin/bash
              TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
              # Assuming container name 'nalamdesk-api'
              docker exec nalamdesk-api sqlite3 /data/nalamdesk.db ".backup '/data/backup_$TIMESTAMP.db'"
              aws s3 cp /data/backup_$TIMESTAMP.db s3://${aws_s3_bucket.backups.bucket}/
              rm /data/backup_$TIMESTAMP.db
              SCRIPT
              chmod +x /home/ubuntu/backup_db.sh
              
              # 5. Schedule Backup (Daily at 2 AM)
              (crontab -l 2>/dev/null; echo "0 2 * * * /home/ubuntu/backup_db.sh >> /var/log/backup.log 2>&1") | crontab -
              EOF
}

# 2. Static IP
resource "aws_lightsail_static_ip" "static_ip" {
  name = "nalamdesk-static-ip"
}

resource "aws_lightsail_static_ip_attachment" "attachment" {
  static_ip_name = aws_lightsail_static_ip.static_ip.name
  instance_name  = aws_lightsail_instance.server.name
}

# 3. Firewall
resource "aws_lightsail_instance_public_ports" "firewall" {
  instance_name = aws_lightsail_instance.server.name

  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
    cidrs     = var.ssh_allowed_cidrs
  }

  port_info {
    protocol  = "tcp"
    from_port = 80
    to_port   = 80
  }

  port_info {
    protocol  = "tcp"
    from_port = 443
    to_port   = 443
  }
}

# 4. S3 Buckets

# Web Hosting Bucket (Private, accessed via CloudFront)
resource "aws_s3_bucket" "web" {
  bucket = "nalamdesk-web-${random_id.bucket_suffix.hex}"
}

resource "aws_s3_bucket_website_configuration" "web" {
  bucket = aws_s3_bucket.web.id
  index_document {
    suffix = "index.html"
  }
  error_document {
    key = "index.html"
  }
}

# Documentation Bucket
resource "aws_s3_bucket" "docs" {
  bucket = "nalamdesk-docs-${random_id.bucket_suffix.hex}"
}

# Backups Bucket (Private)
resource "aws_s3_bucket" "backups" {
  bucket = "nalamdesk-backups-${random_id.bucket_suffix.hex}"
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id = "expire_old_backups"
    status = "Enabled"

    expiration {
      days = 30
    }
  }
}

# 5. CloudFront Distribution (Web App)
resource "aws_cloudfront_origin_access_control" "default" {
  name                              = "nalamdesk-oac"
  description                       = "OAC for S3"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "s3_distribution" {
  origin {
    domain_name = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id   = "S3-Web"
    origin_access_control_id = aws_cloudfront_origin_access_control.default.id
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-Web"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  price_class = "PriceClass_100" # US/Europe (Cheapest) - change if needed for India optimization

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# S3 Bucket Policy to allow CloudFront
resource "aws_s3_bucket_policy" "web_policy" {
  bucket = aws_s3_bucket.web.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.web.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.s3_distribution.arn
          }
        }
      }
    ]
  })
}

output "public_ip" {
  value = aws_lightsail_static_ip.static_ip.ip_address
}

output "cloudfront_domain" {
  value = aws_cloudfront_distribution.s3_distribution.domain_name
}

output "backup_bucket_name" {
  value = aws_s3_bucket.backups.bucket
}
