# Nebula — Cinema Streaming

A modern, high-fidelity dark minimalist web application that streams videos directly from your Google Drive in original quality without downloading.

## Features

- **Direct In-Browser HTTP Range Streaming**: Zero local downloads required. Instant playback for high-bitrate 4K / 1080p MKVs, MP4s, and webm files.
- **Multi-Track Audio Remuxing**: Switch between audio tracks (Dolby Digital, 5.1/7.1 surround, DTS) with transparent 320 kbps AAC remuxing powered by FFmpeg.
- **Embedded & Custom Subtitles**: Automatically extracts embedded Matroska SRT/ASS text subtitles to WebVTT with on-screen sync, or upload local `.srt` files.
- **LAN Sharing (Smart TV & Mobile)**: Cast or open streams on any TV, phone, or tablet on your local Wi-Fi with token-based instant authentication.
- **Modern Minimalist Cinema UI**: Frosted glass controls overlay, interactive timestamp scrubber with hover preview, auto-hiding controls, and aspect ratio controls (Fit, Crop, 21:9 Cinemascope).

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Build Tool**: Vite
- **Streaming & Transmuxing Engine**: Node.js HTTP Range Proxy + FFmpeg / FFprobe
- **Authentication**: Google OAuth 2.0 (Google Drive API v3)

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Ensure your `.env.local` contains your Google credentials:
   ```env
   GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```

3. Start the dev server:
   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000` (or your LAN IP from phone/TV).
