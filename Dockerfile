# Stage 1: Builder
FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies
# (If needed for native modules, though typically handled by prebuilds)
# RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install

COPY . .

# Build Client (CSS + Angular)
RUN npm run build:css
# Note: Ensure base-href is / for web deployment
RUN npx ng build --configuration production --base-href /

# Build Server
RUN npm run build:server

# Stage 2: Runner
FROM node:20-slim AS runner

WORKDIR /app

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Install runtime dependencies for better-sqlite3 (if native build needed)
# simpler to often just include them or rely on prebuilds.
# RUN apk add --no-cache python3 make g++ 

COPY package*.json ./
# Clean install production dependencies only
RUN npm install --production

# Copy built artifacts from builder
COPY --from=builder /app/dist/nalamdesk /app/dist/nalamdesk
COPY --from=builder /app/dist/server /app/dist/server

# Environment Variables
ENV PORT=3000
ENV HOST=0.0.0.0
# Define Volume for Data Persistence
VOLUME ["/data"]
ENV DB_PATH=/data/nalamdesk.db

EXPOSE 3000

CMD ["npm", "run", "start:server"]
