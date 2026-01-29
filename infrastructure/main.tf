terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {}
}

provider "aws" {
  region = "ap-south-1" # Change to desired region
}

# 1. Lightsail Instance
resource "aws_lightsail_instance" "server" {
  name              = "nalamdesk-server"
  availability_zone = "ap-south-1a"
  blueprint_id      = "ubuntu_22_04"
  bundle_id         = "nano_3_0" # $3.50 instance (check bundle availability in region)
  # key_pair_name     = "your-key-pair" # Optional if you use default
  
  user_data = <<-EOF
              #!/bin/bash
              # Install Docker
              apt-get update
              apt-get install -y ca-certificates curl gnupg
              install -m 0755 -d /etc/apt/keyrings
              curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
              chmod a+r /etc/apt/keyrings/docker.gpg
              echo \
                "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
                "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
                tee /etc/apt/sources.list.d/docker.list > /dev/null
              apt-get update
              apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
              
              # Allow ubuntu user to use docker
              usermod -aG docker ubuntu
              
              # Create data directory
              mkdir -p /data
              chown ubuntu:ubuntu /data
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

# 3. Firewall (Public Ports)
resource "aws_lightsail_instance_public_ports" "firewall" {
  instance_name = aws_lightsail_instance.server.name

  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
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

output "public_ip" {
  value = aws_lightsail_static_ip.static_ip.ip_address
}
