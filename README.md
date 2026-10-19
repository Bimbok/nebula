<div align="center">

<img src="public/mascot.svg" width="130" alt="Nebula-Panda Mascot" />

# Nebula-Panda

### High-Performance Cloud Cinema Streaming Engine for Google Drive

Nebula-Panda is an enterprise-grade media streaming platform designed to stream high-bitrate, master-quality video files directly from Google Drive without local disk caching, pre-downloading, or quality degradation. Built on React 19, TypeScript, Tailwind CSS, Node.js, and native FFmpeg/FFprobe streaming pipelines, Nebula-Panda delivers original-fidelity playback across desktop browsers, mobile devices, and Smart TVs on local networks.

---

## Architecture Overview

Nebula-Panda bridges Google Drive's REST API and client-side media decoders through a dedicated high-throughput streaming and transmuxing proxy engine.

```
                      +----------------------------------+
                      |      Google Drive API (v3)       |
                      |   alt=media / HTTP Range Stream  |
                      +-----------------+----------------+
                                        |
                                        v
                      +----------------------------------+
                      |   Nebula-Panda Streaming Proxy   |
                      |    (Node.js / Vite Middleware)   |
                      +----+-------------+-------------+-+
                           |             |             |
           Direct Range    |             | Metadata    | Subtitles
           Passthrough     |             | Inspection  | Extraction
           (HTTP 206)      |             |             |
                           v             v             v
                     +-----------+ +-----------+ +-----------+
                     |  /stream  | |  /tracks  | |/subtitles |
                     +-----+-----+ +-----+-----+ +-----+-----+
                           |             |             |
                           +------+      |      +------+
                                  |      |      |
                                  v      v      v
                      +----------------------------------+
                      |       Nebula-Panda Client        |
                      |  React 19 / rVFC Frame Pipeline  |
                      +----------------------------------+
                                        |
                 +----------------------+----------------------+
                 |                      |                      |
                 v                      v                      v
        +------------------+  +-------------------+  +-------------------+
        |  Hardware-Clocked|  |   Cross-Device    |  |  Discord Gateway  |
        |  Subtitles (rVFC)|  |  LAN Token Share  |  |   Rich Presence   |
        +------------------+  +-------------------+  +-------------------+
```

---

## Core Engineering Highlights

### Zero-Quality-Loss Video Pipeline

**Bit-for-Bit Video Passthrough (`-c:v copy`):** Video streams are never re-encoded. Original high-bitrate video streams—including 4K UHD, 1080p Remux, HEVC/H.265, AVC/H.264, VP9, and AV1—are transmuxed on the fly into fragmented MP4 containers without modifying a single pixel or dropping bitrate.

**4 MB TCP Socket Receive Buffer (`-recv_buffer_size 4194304`):** The upstream HTTP input socket buffer is expanded from the default 32 KB to 4 MB, providing a resilient memory cushion that absorbs network latency and prevents buffer underruns during high-bitrate playback.

**Persistent TLS Pooling & Reconnect Engine:** Incorporates `-multiple_requests 1`, `-tcp_nodelay 1`, and aggressive reconnect flags (`-reconnect 1 -reconnect_streamed 1 -reconnect_on_network_error 1 -reconnect_delay_max 2`). Transient network fluctuations or dropped Google Drive connections are automatically recovered within two seconds without interrupting user playback.

---

### Smart Auto-Codec Audio Engine

**Direct Bitstream Passthrough (Zero Processing Overhead):** For browser-native codecs (`AAC`, `Opus`, `FLAC`, `MP3`, `Vorbis`), audio packets are passed directly (`-c:a copy`) with 0% CPU overhead, 0 ms transcoding latency, and untouched source fidelity.

**Studio Master 320k Multi-Channel Remuxing:** For proprietary or non-native codecs unsupported by desktop browsers (`EAC3` / Dolby Digital Plus, `AC3`, `DTS`, `TrueHD`), audio is remuxed on the fly into 320 kbps multi-channel AAC (`-c:a aac -b:a 320k`). Full 5.1/7.1 surround spatiality is preserved while completely eliminating browser audio silence.

**Mathematical PTS Zero-Sync:** Seeking pairs keyframe input seeking (`-noaccurate_seek -ss <start>`) with `-avoid_negative_ts make_zero`, removing timestamp gaps and locking audio and video streams together at PTS 0.000s to eliminate post-seek audio desynchronization.

---

### Sub-Second Fragmented MP4 Streaming

**Real-Time Fragment Flushing (`-frag_duration 1000000 -flush_packets 1`):** Rather than waiting for complete GOP intervals (which can be 5 to 10 seconds in cinema files), the pipeline forces 1-second fragmented MP4 atom flushes (`moof` + `mdat`), delivering initial playback within milliseconds of seeking.

**Preserved Video Decoder Lifecycle:** The player maintains a continuous DOM lifecycle without unmounting the `<video>` element on seek. Hardware video decoders remain engaged, eliminating black-screen flashes and preserving fullscreen presentation across track changes.

**Visual Buffer Lookahead Bar:** The timeline scrubber visualizes real-time buffered ranges ahead of the playhead, offering clear visual feedback on network lookahead depth.

---

### Subtitle Synchronization Architecture

**Hardware-Clocked Frame Presentation (`requestVideoFrameCallback`):** Browser-throttled `timeupdate` events only trigger approximately 4 times per second, leading to noticeable caption delay. Nebula-Panda binds caption lookup directly to the display hardware clock via `HTMLVideoElement.requestVideoFrameCallback` (with a 50 ms fallback for older engines), guaranteeing frame-accurate subtitle alignment.

**On-the-Fly Text Subtitle Extraction:** Server-side FFmpeg processes embedded Matroska subtitle streams (SRT, ASS, SSA) into WebVTT formats on demand, with on-disk caching and integrity verification (`isUsableWebVtt`) to prevent partial cue delivery.

**External Subtitle Upload:** Supports drag-and-drop or manual selection of local `.srt` and `.vtt` files, parsing cues client-side into synchronized WebVTT tracks.

---

### Cross-Device LAN Streaming & Token Handoff

**Local Network Interface Discovery:** Dynamically discovers host network interfaces via `os.networkInterfaces()` to construct LAN streaming addresses for Smart TVs, mobile phones, and tablets.

**Zero-Login Token Handoff:** Authenticated sessions on the primary host generate URL-encoded access tokens (`?token=...`). Secondary devices opening the URL automatically import credentials into `localStorage` and `document.cookie`, sanitizing the URL bar and bypassing Google OAuth prompts entirely on television and mobile viewports.

---

### Universal Discord Gateway Rich Presence

**Client-Side WebSocket Gateway:** Connects directly to Discord's official Gateway (`wss://gateway.discord.gg/?v=10`), allowing activity presence updates from any client device, including Smart TVs and mobile browsers.

**Semantic Media Parser:** Parses torrent and scene release naming schemes (e.g. `Dark.S01E10.1080p.NF.WEB-DL.mkv`) into human-readable titles (`Dark`) and episodic markers (`Season 1 • Episode 10`), broadcasting elapsed timestamps, remaining runtime, and real-time play/pause states.

---

## Technical Specifications

| Category | Specification |
| :---: | :---: |
| Framework Stack | React 19, TypeScript, Tailwind CSS v4, Vite 6 |
| Backend Engine | Node.js (v18+ / v20+ / v22+ / v26+) |
| Media Transmuxer | Native FFmpeg and FFprobe (`/usr/bin/ffmpeg`, `/usr/bin/ffprobe`) |
| Container Support | Matroska (.mkv), MP4 (.mp4, .m4v), WebM (.webm), QuickTime (.mov), MPEG-TS (.ts), AVI (.avi) |
| Video Bitstream | H.264 / AVC, H.265 / HEVC (8-bit & 10-bit), VP8, VP9, AV1 (Direct Bitstream Copy) |
| Audio Passthrough | AAC, Opus, FLAC, MP3, Vorbis (Direct Bitstream Passthrough) |
| Audio Remuxing | EAC3, AC3, DTS, TrueHD, PCM (Transmuxed to 320 kbps Multi-Channel AAC) |
| Subtitle Pipeline | Embedded SRT, ASS, SSA (Extracted to WebVTT); Custom .srt / .vtt Uploads |
| Storage Provider | Google Drive API v3 (REST `alt=media` Chunked Range Streaming) |
| Identity & Auth | Google Identity Services (GSI) OAuth 2.0 with Persistent Session Management |

---

## Getting Started

### Prerequisites

Node.js Version 18.0.0 or higher

FFmpeg & FFprobe installed and accessible in the system PATH

```bash
# Debian / Ubuntu
sudo apt update && sudo apt install -y ffmpeg

# Arch Linux
sudo pacman -S ffmpeg

# macOS (Homebrew)
brew install ffmpeg
```

Google Cloud Project with the Google Drive API enabled and an OAuth 2.0 Client ID configured

---

### Installation

Clone the repository

```bash
git clone https://github.com/Bimbok/nebula.git
cd nebula
```

Install project dependencies

```bash
npm install
```

Configure environment variables in `.env.local`

```env
GOOGLE_CLIENT_ID=your_oauth_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_oauth_client_secret
PORT=3000
```

Launch the development server

```bash
npm run dev
```

Open `http://localhost:3000` in your browser

---

## Production Deployment

Build optimized client and standalone server bundles

```bash
npm run build
```

Launch the production server

```bash
npm start
```

---

### Docker Deployment

```dockerfile
FROM node:22-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

EXPOSE 3000
ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "server.js"]
```

---

## Keyboard Controls

| Key Binding | Action |
| :---: | :---: |
| Space / K | Toggle Play / Pause |
| F | Toggle Fullscreen |
| M | Toggle Mute |
| Left Arrow | Seek backward 10 seconds |
| Right Arrow | Seek forward 10 seconds |
| Up Arrow | Increase volume by 10% |
| Down Arrow | Decrease volume by 10% |
| C / A | Cycle Aspect Ratio (Fit, Crop, Stretch, 21:9 Cinemascope, 16:9, 4:3) |
| Escape | Close Player / Exit Fullscreen |
| ? | Toggle Keyboard Shortcut Guide |

---

</div>

## Directory Structure

```
├── App.tsx                     # Main layout, search, sorting, and authentication flow
├── components/
│   ├── ContinueWatching.tsx    # Resume shelf with saved playback progress
│   ├── DiscordPresenceModal.tsx# Discord Gateway connection configuration
│   ├── Header.tsx              # Navigation bar, LAN IP discovery, TV share modal
│   ├── Loader.tsx              # Minimalist ring spinner
│   ├── Login.tsx               # Authentication portal and Google OAuth trigger
│   ├── MascotLogo.tsx          # Multi-layer vector brand asset with ambient keyframes
│   ├── VideoGrid.tsx           # Media card grid with lazy loading and empty states
│   ├── VideoItem.tsx           # 16:9 thumbnail cards with resolution badges
│   └── VideoPlayer.tsx         # Cinema player: timeline scrubber, rVFC subtitle sync
├── services/
│   ├── discordPresenceService.ts # Direct Discord Gateway WebSocket client
│   ├── googleDriveService.ts   # Drive API v3 paginated queries with MIME filters
│   └── mediaTitleParser.ts     # Release title parser for episodic descriptors
├── server.ts                   # Production streaming server & API proxy
├── vite.config.ts              # Development streaming proxy & build pipeline
├── types.ts                    # TypeScript interface definitions
└── .cache/                     # Ephemeral disk cache (metadata, subtitles, thumbnails)
```

---

<div align="center">

## Privacy and Data Handling

**Read-Only Access:** Nebula-Panda requests read-only scopes (`https://www.googleapis.com/auth/drive.readonly`) and never modifies or deletes files on your Google Drive.

**Direct Client-to-Host Streaming:** Video data streams directly between Google Drive servers and your local Nebula-Panda host. No video data or personal credentials are sent to external third parties.

**Local Session Storage:** Tokens and playback history are stored exclusively in your browser's `localStorage` and local cookies.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

</div>
