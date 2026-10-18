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
* **Smart Auto-Codec Audio Engine:**
  * **⚡ Direct Bitstream Passthrough (Zero Processing):**
    * For tracks using natively playable browser codecs (`aac`, `opus`, `flac`, `mp3`, `vorbis`), audio is directly passed packet-by-packet (`-c:a copy`) with **0% CPU overhead, 0ms latency, and untouched original fidelity**.
  * **🎙️ Studio Master AAC 320k (Transparent Remux):**
    * For proprietary codecs unsupported by desktop Chromium/Firefox (`eac3` / Dolby Digital Plus, `ac3`, `dts`, `truehd`), audio is seamlessly remuxed into pristine 320kbps multi-channel AAC (`-c:a aac -b:a 320k`).
    * Preserves full 5.1 surround sound while eliminating the browser silence bug.
  * **Mathematical PTS Zero-Sync:**
    * Eliminates audio desync on seek by pairing `-noaccurate_seek -ss <start>` with `-avoid_negative_ts make_zero`, removing timestamp gaps and ensuring audio and video start together at PTS 0.000s.
  * **Seamless & Invisible to User:**
    * The user simply chooses their desired audio track (Track 1, Track 2, etc.). No duplicate "Raw" or "Default" options and no manual toggle switches clutter the interface.
  * **Seeking & Lifecycle:**
    * `-noaccurate_seek -ss <start>` before `-i` for instantaneous network-level keyframe input seeking.
    * Bulletproof process cleanup: `req.on('aborted')`, `req.on('close')`, `res.on('close')`, and `res.on('finish')` immediately kill FFmpeg and destroy stdout to prevent zombie processes.
  * **Fallback Direct Range Mode:**
    * Raw byte-range proxying directly to Google Drive remains active for external media players (VLC, MPV) or download requests without `audioIndex`.

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
  * Accessing the app over Wi-Fi is enabled by the "TV & Phone" share modal, which is conditionally displayed when running on localhost.
  * Dynamically queries the host machine's active network interfaces via Node.js `os.networkInterfaces()` to construct the actual LAN stream URL (e.g. `http://<local-network-ip>:<port>/?token=...`).
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
│   ├── Header.tsx              # Minimalist glass header, LAN pulse badge, TV share modal, brand mascot
│   ├── Loader.tsx              # Glowing cinematic ring spinner
│   ├── Login.tsx               # Nebula welcome portal, Google OAuth trigger, hero mascot
│   ├── MascotLogo.tsx          # Animated Detective Panda mascot & official logo component
│   ├── VideoGrid.tsx           # Responsive media grid & empty states with mascot
│   ├── VideoItem.tsx           # 16:9 thumbnail cards with resolution chips & hover zoom
│   └── VideoPlayer.tsx         # Cinema player: timeline scrubber, rVFC subtitle sync, track pickers
├── public/
│   ├── favicon.svg             # Standalone colored Detective Panda SVG favicon
│   └── mascot.svg              # Standalone high-res mascot SVG asset
├── services/
│   └── googleDriveService.ts   # Drive API v3 paginated queries with MIME filters
├── index.css                   # Custom range sliders, dark minimalist scrollbars, glow keyframes
├── types.ts                    # GoogleDriveFile, AudioTrackInfo, SubtitleTrackInfo interfaces
├── vite.config.ts              # Vite config + all /api/ backend streaming proxy handlers
└── .cache/                     # Local disk caches (metadata, subtitles, thumbnails)
```

---

## 8. Mascot & Brand Identity (Detective Panda)

* **Origin & Geometry:**
  * Decomposed from `/home/bimbok/Downloads/tibbixel-dot-com-37713-svg.svg` compound paths into 10 discrete anatomical and apparel vector layers.
  * Preserves original vector geometry and curvature.
* **Palette:**
  * **Fedora Hat:** Cyber Obsidian slate (`#0f172a` -> `#1e293b` -> `#334155`).
  * **Hat Ribbon Band:** Neon Cyan-to-Electric-Violet gradient (`#06b6d4` -> `#6366f1` -> `#a855f7`).
  * **Eyes & Irises:** Electric Cyan Nebula glow (`#06b6d4` -> `#38bdf8`) with pure white star sparkles (`#ffffff`).
  * **Panda Fur:** Celestial Platinum White (`#ffffff` -> `#f1f5f9` -> `#cbd5e1`).
  * **Eye Patches & Chin:** Midnight Obsidian charcoal (`#080910` -> `#181928`).
* **Animations:**
  * Gentle organic breathing float (`mascotBreathing`).
  * Dynamic hat band pulse with ambient neon drop-shadow (`bandPulse`).
  * Staggered double-eye twinkle sparkles (`eyeTwinkle`).
* **Integration Points:**
  * Browser Favicon (`/favicon.svg`).
  * App Header Brand Lockup (`<MascotLogo size="sm" animated />`).
  * Welcome Portal Hero Avatar (`<MascotLogo size="xl" animated showBadge />`).
  * Empty & Search Results States (`<MascotLogo size="lg" animated showBadge />`).
  * Library Loading State (`<MascotLogo size="xl" animated showBadge />`).

