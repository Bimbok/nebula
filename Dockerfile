FROM node:20-bookworm-slim

# Install FFmpeg, FFprobe, and system certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application code
COPY . .

# Build frontend and production streaming server
RUN npm run build

# Render injects the PORT environment variable
ENV PORT=10000
EXPOSE 10000

# Run the production streaming server
CMD ["node", "server.js"]
