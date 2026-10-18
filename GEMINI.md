# Nebula — Project Overview & Architecture

**Nebula** is a high-fidelity web application that streams high-bitrate videos directly from Google Drive in original quality without downloading. Built with React 19, TypeScript, Tailwind CSS, Vite, and native FFmpeg/FFprobe streaming pipelines.

---

## 1. Key Technologies & Stack

* **Frontend:** React 19, TypeScript, Tailwind CSS v4
* **Build Tool:** Vite 6
* **Authentication:** Google OAuth 2.0 (Google Drive API v3) with persistent token storage
* **Media Processing:** Native `/usr/bin/ffmpeg` and `/usr/bin/ffprobe`
* **Network & Sharing:** HTTP Range proxying, Local Area Network (LAN) sharing for TV & Mobile

---

## 2. System Architecture

The application combines a modern client-side React SPA with an integrated streaming and transmuxing proxy engine implemented in Vite middleware (`vite.config.ts`):

```
Google Drive API (alt=media)
         │
         ▼
[Vite Streaming Proxy Plugin]
   ├── /api/stream      ──► Direct HTTP Range passthrough OR FFmpeg AAC 320k Remux
   ├── /api/tracks      ──► ffprobe metadata inspection & duration extraction
   ├── /api/subtitles   ──► FFmpeg WebVTT extraction with stream caching
   └── /api/thumbnail   ──► FFmpeg frame grabber fallback
         │
         ▼
[Nebula React Frontend]
   ├── VideoPlayer      ──► Floating glass player, frame-accurate rVFC subtitle sync
   ├── VideoGrid/Item   ──► IntersectionObserver lazy-loaded cards with resolution chips
   ├── Header & Modals  ──► LAN stream sharing to Smart TVs / mobile
   └── Search/Filter    ──► Client-side search and sorting (Recent, Name, Size)
```

---

## 3. Endpoints & Media Streaming Engine

### A. `/api/stream`
* **Direct Mode (Default Audio Track):** Proxies incoming client `Range:` headers straight to Google Drive. Transmits raw bytes with zero re-encoding (100% lossless video and audio passthrough).
* **Audio Track Switching & Streaming:**
  * **⚡ Raw Audio Passthrough (Default Mode):**
    * Uses `-c:v copy -c:a copy -f matroska` to demux and remux both video and audio directly at the packet level without ANY re-encoding.
    * Eliminates 100% of CPU processing overhead and encoder buffer delays.
    * Both streams are sliced from the identical container packet boundary, providing **mathematically guaranteed zero-lag, sample-accurate A/V synchronization**.
    * Delivers bit-perfect original multi-channel surround sound (Dolby Digital Plus EAC3, AC3, FLAC, Opus, AAC).
  * **AAC 320k Compatibility Remux (Optional Mode `mode=transcode`):**
    * Fallback mode for legacy devices or Smart TVs that do not possess native EAC3/AC3 hardware decoders.
    * Spawns `ffmpeg` with `-c:v copy` and `-c:a aac -b:a 320k` into a fragmented MP4 container.
  * **Seeking & Lifecycle:**
    * `-ss <start>` before `-i` for instantaneous keyframe input seeking.
    * Uses `req.on('aborted')` and `res.on('close')` safeguards to terminate FFmpeg cleanly on client disconnects or track switching.

### B. `/api/tracks`
* Probes audio streams, subtitle streams, and container duration via `ffprobe`.
* Inspects Matroska metadata tags (`DURATION`, `DURATION-eng`) and formats for precise container runtime.
* Tiered caching: in-memory `Map` + disk cache at `.cache/metadata/${fileId}.json`.

### C. `/api/subtitles`
* Extracts embedded text subtitle streams (SRT/ASS/SSA) into WebVTT on-the-fly.
* Disk caching at `.cache/subtitles/${fileId}_${streamIndex}.vtt`.
* `isUsableWebVtt` validation ensures interrupted conversions (containing only `WEBVTT` header without cues) are discarded and re-extracted.

### D. `/api/thumbnail`
* Proxies Google Drive thumbnails or uses FFmpeg to capture a frame at second 10 (or second 1) scaled to 640px width.
* Cached in `.cache/thumbnails/${fileId}.jpg`.

---

## 4. Subtitle Synchronization Architecture

* **Hardware-Clocked Frame Presentation (`requestVideoFrameCallback`):**
  * Rather than relying on browser-throttled `timeupdate` events (which only fire ~4 times/sec and cause visible caption lag after seeking), the player binds subtitle cue lookup to `video.requestVideoFrameCallback` (rVFC).
  * Automatically falls back to a 50ms interval loop on older browser engines without rVFC.
* **Stream Abort Safety:**
  * Uses `AbortController` on subtitle HTTP requests so switching subtitle tracks immediately cancels previous streams without race conditions.

---

## 5. LAN Sharing & Authentication Flow

* **Session Persistence:** OAuth access token is stored in `localStorage` (`gdrive_oauth_token`) and `document.cookie` (`gdrive_token`).
* **LAN / Smart TV Access:**
  * Accessing the app over Wi-Fi (`http://192.168.29.213:3000`) is enabled by the "TV & Phone" share modal.
  * App automatically detects `?token=` query parameters on load, installs the token into `localStorage` and `cookie`, and cleans the URL so no Google OAuth login prompt is required on secondary devices.

---

## 6. Building and Running

**Prerequisites:**
* Node.js (v18+)
* FFmpeg & FFprobe installed in system PATH (`/usr/bin/ffmpeg`, `/usr/bin/ffprobe`)
* `.env.local` containing `GOOGLE_CLIENT_ID` (and optionally `GOOGLE_CLIENT_SECRET`)

**Commands:**
* `npm install` — Install dependencies
* `npm run dev` — Run development server with live streaming proxy (`0.0.0.0:3000`)
* `npm run build` — Production Vite bundle build
* `npm run preview` — Preview production build

---

## 7. Directory Structure

```
├── App.tsx                     # Main layout, search capsule, infinite scroll, auth state
├── components/
│   ├── Header.tsx              # Minimalist glass header, LAN pulse badge, TV share modal
│   ├── Loader.tsx              # Glowing cinematic ring spinner
│   ├── Login.tsx               # Nebula welcome portal, Google OAuth trigger
│   ├── VideoGrid.tsx           # Responsive media grid & empty states
│   ├── VideoItem.tsx           # 16:9 thumbnail cards with resolution chips & hover zoom
│   └── VideoPlayer.tsx         # Cinema player: timeline scrubber, rVFC subtitle sync, track pickers
├── services/
│   └── googleDriveService.ts   # Drive API v3 paginated queries with MIME filters
├── index.css                   # Custom range sliders, dark minimalist scrollbars, glow keyframes
├── types.ts                    # GoogleDriveFile, AudioTrackInfo, SubtitleTrackInfo interfaces
├── vite.config.ts              # Vite config + all /api/ backend streaming proxy handlers
└── .cache/                     # Local disk caches (metadata, subtitles, thumbnails)
```
