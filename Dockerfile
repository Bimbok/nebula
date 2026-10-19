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

# Expose ports for both local (3000) and Render cloud hosting (10000)
ENV PORT=3000
EXPOSE 3000
EXPOSE 10000

# Run the production streaming server
CMD ["node", "server.js"]
