import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { Readable } from 'node:stream';
import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';

// Cache probed track metadata in memory by fileId
const trackMetadataCache = new Map<string, { audioTracks: any[]; subtitleTracks: any[]; duration: number; timestamp: number }>();

const metaCacheDir = path.resolve('.cache', 'metadata');
if (!fs.existsSync(metaCacheDir)) {
  try {
    fs.mkdirSync(metaCacheDir, { recursive: true });
  } catch (e) {}
}

function parseDuration(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return isFinite(val) && !isNaN(val) ? val : 0;
  if (typeof val !== 'string') return 0;
  val = val.trim();
  if (val.includes(':')) {
    const parts = val.split(':');
    if (parts.length === 3) {
      return (parseFloat(parts[0]) || 0) * 3600 + (parseFloat(parts[1]) || 0) * 60 + (parseFloat(parts[2]) || 0);
    }
    if (parts.length === 2) {
      return (parseFloat(parts[0]) || 0) * 60 + (parseFloat(parts[1]) || 0);
    }
  }
  const n = parseFloat(val);
  return isNaN(n) ? 0 : n;
}

function streamProxyPlugin() {
  const handler = async (req: any, res: any, next: any) => {
    const rawUrl = req.url || '';

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.end();
      return;
    }

    // -------------------------------------------------------------
    // 1. /api/tracks : Probe audio and subtitle streams using ffprobe
    // -------------------------------------------------------------
    if (rawUrl.startsWith('/api/tracks')) {
      try {
        const url = new URL(rawUrl, `http://${req.headers.host || 'localhost:3000'}`);
        const fileId = url.searchParams.get('fileId');
        let token = url.searchParams.get('token');

        if (!token && req.headers.cookie) {
          const match = req.headers.cookie.match(/gdrive_token=([^;]+)/);
          if (match) token = match[1].trim();
        }
        if (!token && req.headers.authorization) {
          token = req.headers.authorization.replace(/^Bearer\s+/i, '').trim();
        }

        if (!fileId || !token) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({ error: 'Missing fileId or token' }));
          return;
        }

        // 1. Check in-memory cache
        const cached = trackMetadataCache.get(fileId);
        if (cached && Date.now() - cached.timestamp < 3600 * 24 * 1000) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(JSON.stringify({
            audioTracks: cached.audioTracks,
            subtitleTracks: cached.subtitleTracks,
            duration: cached.duration || 0,
          }));
          return;
        }

        // 2. Check on-disk cache
        const metaCacheFile = path.join(metaCacheDir, `${fileId}.json`);
        if (fs.existsSync(metaCacheFile)) {
          try {
            const diskContent = fs.readFileSync(metaCacheFile, 'utf-8');
            const parsed = JSON.parse(diskContent);
            if (parsed && (parsed.audioTracks || parsed.duration > 0)) {
              trackMetadataCache.set(fileId, {
                audioTracks: parsed.audioTracks || [],
                subtitleTracks: parsed.subtitleTracks || [],
                duration: parsed.duration || 0,
                timestamp: Date.now(),
              });
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(diskContent);
              return;
            }
          } catch (diskErr) {
            console.warn('[metadata cache read error]', diskErr);
          }
        }

        const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const headersParam = `Authorization: Bearer ${token}\r\n`;

        execFile(
          'ffprobe',
          [
            '-headers', headersParam,
            '-seekable', '1',
            '-multiple_requests', '1',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_streams',
            '-show_format',
            driveUrl,
          ],
          { timeout: 25000, maxBuffer: 15 * 1024 * 1024 },
          (err, stdout) => {
            if (err || !stdout) {
              console.warn('[ffprobe] Could not probe streams:', err?.message);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ audioTracks: [], subtitleTracks: [], duration: 0 }));
              return;
            }

            try {
              const data = JSON.parse(stdout);
              const streams = data.streams || [];
              const format = data.format || {};

              // Robust duration calculation from format and streams (including HH:MM:SS tags)
              let probedDuration = parseDuration(format.duration);

              if (probedDuration <= 0) {
                for (const s of streams) {
                  const d =
                    parseDuration(s.duration) ||
                    parseDuration(s.tags?.DURATION) ||
                    parseDuration(s.tags?.duration) ||
                    parseDuration(s.tags?.['DURATION-eng']) ||
                    parseDuration(s.tags?.['DURATION-und']);
                  if (d > probedDuration) probedDuration = d;
                }
              }

              if (probedDuration <= 0) {
                const formatTagDur = parseDuration(format.tags?.DURATION) || parseDuration(format.tags?.duration);
                if (formatTagDur > probedDuration) probedDuration = formatTagDur;
              }

              const audioStreams = streams.filter((s: any) => s.codec_type === 'audio');
              const subtitleStreams = streams.filter((s: any) => s.codec_type === 'subtitle');

              const audioTracks = audioStreams.map((s: any, idx: number) => {
                const lang = s.tags?.language || s.tags?.LANGUAGE || 'und';
                const title = s.tags?.title || s.tags?.TITLE || `Track ${idx + 1}`;
                const channels = s.channels ? `${s.channels}ch` : '';
                const codec = (s.codec_name || '').toUpperCase();
                return {
                  id: idx,
                  streamIndex: s.index,
                  codec: s.codec_name,
                  channels: s.channels,
                  language: lang,
                  label: `${title} (${lang.toUpperCase()} • ${codec}${channels ? ' • ' + channels : ''})`,
                };
              });

              const subtitleTracks = subtitleStreams.map((s: any, idx: number) => {
                const lang = s.tags?.language || s.tags?.LANGUAGE || 'und';
                const title = s.tags?.title || s.tags?.TITLE || `Subtitle ${idx + 1}`;
                const codec = (s.codec_name || '').toUpperCase();
                const isBitmap = ['hdmv_pgs_subtitle', 'dvd_subtitle', 'dvb_subtitle'].includes(s.codec_name);
                return {
                  id: idx,
                  streamIndex: s.index,
                  codec: s.codec_name,
                  language: lang,
                  isBitmap,
                  label: `${title} (${lang.toUpperCase()} • ${codec}${isBitmap ? ' [PGS Bitmap]' : ''})`,
                };
              });

              const metaPayload = {
                audioTracks,
                subtitleTracks,
                duration: probedDuration,
              };

              // Cache in memory and persist on disk
              trackMetadataCache.set(fileId, { ...metaPayload, timestamp: Date.now() });
              fs.writeFile(metaCacheFile, JSON.stringify(metaPayload), () => {});

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify(metaPayload));
            } catch (parseErr: any) {
              console.error('[ffprobe parse error]:', parseErr);
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(JSON.stringify({ audioTracks: [], subtitleTracks: [], duration: 0 }));
            }
          }
        );
      } catch (err: any) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }

    // -------------------------------------------------------------
    // 2. /api/subtitles : Extract embedded subtitle track to WebVTT with on-disk caching
    // -------------------------------------------------------------
    if (rawUrl.startsWith('/api/subtitles')) {
      try {
        const url = new URL(rawUrl, `http://${req.headers.host || 'localhost:3000'}`);
        const fileId = url.searchParams.get('fileId');
        const streamIndex = url.searchParams.get('streamIndex');
        const isBitmap = url.searchParams.get('isBitmap') === 'true';
        let token = url.searchParams.get('token');

        if (!token && req.headers.cookie) {
          const match = req.headers.cookie.match(/gdrive_token=([^;]+)/);
          if (match) token = match[1].trim();
        }
        if (!token && req.headers.authorization) {
          token = req.headers.authorization.replace(/^Bearer\s+/i, '').trim();
        }

        if (!fileId || !token || streamIndex === null) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'text/plain');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end('Missing fileId, streamIndex, or token');
          return;
        }

        const cacheDir = path.resolve('.cache', 'subtitles');
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }

        const cacheFile = path.join(cacheDir, `${fileId}_${streamIndex}.vtt`);

        // Serve instantly from disk if previously cached
        if (fs.existsSync(cacheFile) && fs.statSync(cacheFile).size > 10) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          fs.createReadStream(cacheFile).pipe(res);
          return;
        }

        // If client requested a bitmap subtitle, return a helpful WebVTT cue
        if (isBitmap) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end('WEBVTT\n\n00:00:01.000 --> 00:00:10.000\n[PGS/Bitmap Subtitle: Please choose a text subtitle track or upload .srt]\n\n');
          return;
        }

        const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const headersParam = `Authorization: Bearer ${token}\r\n`;

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Transfer-Encoding', 'chunked');

        // Extract subtitles: -headers must be immediately before -i in newer FFmpeg
        const ffmpeg = spawn('ffmpeg', [
          '-loglevel', 'error',
          '-reconnect', '1',
          '-reconnect_streamed', '1',
          '-reconnect_delay_max', '5',
          '-headers', headersParam,
          '-i', driveUrl,
          '-map', `0:${streamIndex}`,
          '-c:s', 'webvtt',
          '-f', 'webvtt',
          'pipe:1',
        ]);

        const chunks: Buffer[] = [];
        ffmpeg.stdout.on('data', (c) => {
          chunks.push(c);
          res.write(c);
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        });

        ffmpeg.stderr.on('data', (d) => {
          console.warn('[ffmpeg-sub]', d.toString().trim());
        });

        ffmpeg.on('close', (code) => {
          if (code === 0 && chunks.length > 0) {
            fs.writeFile(cacheFile, Buffer.concat(chunks), () => {});
          }
          if (!res.writableEnded) {
            res.end();
          }
        });

        req.on('close', () => {
          ffmpeg.kill('SIGKILL');
        });

        ffmpeg.on('error', (err) => {
          console.error('[ffmpeg subtitle extraction error]', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end('WEBVTT\n\n');
          } else if (!res.writableEnded) {
            res.end();
          }
        });
      } catch (err: any) {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/vtt');
          res.end('WEBVTT\n\n');
        } else if (!res.writableEnded) {
          res.end();
        }
      }
      return;
    }

    // -------------------------------------------------------------
    // 2b. /api/thumbnail : High-resolution video thumbnail proxy & generator
    // -------------------------------------------------------------
    if (rawUrl.startsWith('/api/thumbnail')) {
      try {
        const url = new URL(rawUrl, `http://${req.headers.host || 'localhost:3000'}`);
        const fileId = url.searchParams.get('fileId');
        const googleThumbnailUrl = url.searchParams.get('url');
        let token = url.searchParams.get('token');

        if (!token && req.headers.cookie) {
          const match = req.headers.cookie.match(/gdrive_token=([^;]+)/);
          if (match) token = match[1].trim();
        }
        if (!token && req.headers.authorization) {
          token = req.headers.authorization.replace(/^Bearer\s+/i, '').trim();
        }

        if (!fileId) {
          res.statusCode = 400;
          res.end('Missing fileId');
          return;
        }

        const cacheDir = path.resolve('.cache', 'thumbnails');
        if (!fs.existsSync(cacheDir)) {
          fs.mkdirSync(cacheDir, { recursive: true });
        }

        const cacheFile = path.join(cacheDir, `${fileId}.jpg`);

        // Check local disk cache
        if (fs.existsSync(cacheFile) && fs.statSync(cacheFile).size > 500) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'image/jpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.setHeader('Access-Control-Allow-Origin', '*');
          fs.createReadStream(cacheFile).pipe(res);
          return;
        }

        // Try proxying Google Drive thumbnail if available
        if (googleThumbnailUrl && googleThumbnailUrl.startsWith('http')) {
          try {
            const thumbHeaders: Record<string, string> = {};
            if (token) thumbHeaders['Authorization'] = `Bearer ${token}`;
            const gRes = await fetch(googleThumbnailUrl, { headers: thumbHeaders });
            if (gRes.ok) {
              const buffer = Buffer.from(await gRes.arrayBuffer());
              if (buffer.length > 500) {
                fs.writeFileSync(cacheFile, buffer);
                res.statusCode = 200;
                res.setHeader('Content-Type', gRes.headers.get('content-type') || 'image/jpeg');
                res.setHeader('Cache-Control', 'public, max-age=86400');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(buffer);
                return;
              }
            }
          } catch (e) {
            // Fall through to FFmpeg generation
          }
        }

        // Fallback: Generate thumbnail frame directly from the video stream using FFmpeg
        if (!token) {
          res.statusCode = 401;
          res.end('Missing token for thumbnail generation');
          return;
        }

        const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
        const headersParam = `Authorization: Bearer ${token}\r\n`;

        const ffmpeg = spawn('ffmpeg', [
          '-ss', '00:00:10',
          '-headers', headersParam,
          '-i', driveUrl,
          '-vframes', '1',
          '-vf', 'scale=640:-1',
          '-q:v', '3',
          '-f', 'image2',
          '-c:v', 'mjpeg',
          'pipe:1',
        ]);

        const chunks: Buffer[] = [];
        ffmpeg.stdout.on('data', (c) => chunks.push(c));

        ffmpeg.on('close', (code) => {
          if (code === 0 && chunks.length > 0) {
            const imgBuffer = Buffer.concat(chunks);
            fs.writeFile(cacheFile, imgBuffer, () => {});
            if (!res.headersSent) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'image/jpeg');
              res.setHeader('Cache-Control', 'public, max-age=86400');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(imgBuffer);
            }
          } else {
            // Retry at second 1 if video is short
            const retryFfmpeg = spawn('ffmpeg', [
              '-ss', '00:00:01',
              '-headers', headersParam,
              '-i', driveUrl,
              '-vframes', '1',
              '-vf', 'scale=640:-1',
              '-q:v', '3',
              '-f', 'image2',
              '-c:v', 'mjpeg',
              'pipe:1',
            ]);
            const retryChunks: Buffer[] = [];
            retryFfmpeg.stdout.on('data', (c) => retryChunks.push(c));
            retryFfmpeg.on('close', (rCode) => {
              if (rCode === 0 && retryChunks.length > 0) {
                const img = Buffer.concat(retryChunks);
                fs.writeFile(cacheFile, img, () => {});
                if (!res.headersSent) {
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'image/jpeg');
                  res.setHeader('Cache-Control', 'public, max-age=86400');
                  res.setHeader('Access-Control-Allow-Origin', '*');
                  res.end(img);
                }
              } else if (!res.headersSent) {
                res.statusCode = 404;
                res.end('Thumbnail unavailable');
              }
            });
          }
        });

        req.on('close', () => {
          ffmpeg.kill('SIGKILL');
        });
      } catch (err: any) {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end(err.message);
        }
      }
      return;
    }

    // -------------------------------------------------------------
    // 3. /api/stream : High-performance HTTP Range stream + audio switch
    // -------------------------------------------------------------
    if (!rawUrl.startsWith('/api/stream')) {
      return next();
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    try {
      const url = new URL(rawUrl, `http://${req.headers.host || 'localhost:3000'}`);
      const fileId = url.searchParams.get('fileId');
      const audioIndexStr = url.searchParams.get('audioIndex');
      const startTimeStr = url.searchParams.get('startTime');
      let token = url.searchParams.get('token');

      // Check cookie if token not in query param
      if (!token && req.headers.cookie) {
        const match = req.headers.cookie.match(/gdrive_token=([^;]+)/);
        if (match) token = match[1].trim();
      }

      // Check Authorization header
      if (!token && req.headers.authorization) {
        token = req.headers.authorization.replace(/^Bearer\s+/i, '').trim();
      }

      if (!fileId || !token) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({ error: 'Missing required fileId or token' }));
        return;
      }

      const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;

      // -------------------------------------------------------------
      // Case A: Specific alternate audio track selected -> remux with high quality 320k AAC
      // -------------------------------------------------------------
      if (audioIndexStr !== null && audioIndexStr !== '' && audioIndexStr !== 'default') {
        const audioIndex = parseInt(audioIndexStr, 10);
        const startTime = startTimeStr ? Math.max(0, parseFloat(startTimeStr)) : 0;
        const headersParam = `Authorization: Bearer ${token}\r\n`;

        res.statusCode = 200;
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

        // A/V Sync fix:
        // -ss before -i: fast seek to nearest keyframe before startTime
        // -headers directly before -i: FFmpeg v9 requires this ordering
        // -avoid_negative_ts make_zero: normalizes all output timestamps to start at 0
        //   so browser video.currentTime = 0 at seek point, preventing A/V drift
        // -fflags +genpts: regenerate PTS from DTS for clean monotonic timestamps
        const ffmpegArgs = [
          '-loglevel', 'error',
          '-reconnect', '1',
          '-reconnect_streamed', '1',
          '-reconnect_delay_max', '5',
          '-ss', startTime.toString(),
          '-headers', headersParam,
          '-i', driveUrl,
          '-map', '0:v:0',
          '-map', `0:a:${audioIndex}`,
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '320k',
          '-avoid_negative_ts', 'make_zero',
          '-fflags', '+genpts',
          '-f', 'mp4',
          '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
          'pipe:1',
        ];

        const ffmpeg = spawn('ffmpeg', ffmpegArgs);
        ffmpeg.stdout.pipe(res);

        ffmpeg.stderr.on('data', () => {});

        req.on('close', () => {
          ffmpeg.kill('SIGKILL');
        });

        ffmpeg.on('error', (err) => {
          console.error('[ffmpeg remux stream error]', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end(`Transmux error: ${err.message}`);
          }
        });
        return;
      }

      // -------------------------------------------------------------
      // Case B: Default Direct HTTP Range proxy from Google Drive
      // -------------------------------------------------------------
      const rangeHeader = req.headers.range;
      const requestHeaders: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };

      if (rangeHeader) {
        requestHeaders['Range'] = rangeHeader;
      }

      const driveRes = await fetch(driveUrl, {
        method: req.method,
        headers: requestHeaders,
      });

      if (!driveRes.ok && driveRes.status !== 206) {
        const errorText = await driveRes.text();
        console.error(`[Drive Stream Proxy Error] Status: ${driveRes.status}`, errorText);
        res.statusCode = driveRes.status;
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(`Google Drive Error (${driveRes.status}): ${errorText}`);
        return;
      }

      res.statusCode = driveRes.status;

      let contentType = driveRes.headers.get('content-type') || url.searchParams.get('mimeType') || 'video/mp4';
      if (contentType === 'application/octet-stream') {
        const requestedMime = url.searchParams.get('mimeType');
        contentType = requestedMime || 'video/mp4';
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');

      const contentRange = driveRes.headers.get('content-range');
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }

      const contentLength = driveRes.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      if (req.method === 'HEAD') {
        res.end();
        return;
      }

      if (driveRes.body) {
        // @ts-ignore
        const nodeStream = Readable.fromWeb(driveRes.body);
        req.on('close', () => {
          nodeStream.destroy();
        });
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (err: any) {
      console.error('[Drive Stream Proxy Exception]', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(`Stream Proxy Error: ${err.message}`);
      }
    }
  };

  return {
    name: 'google-drive-stream-proxy',
    configureServer(server: any) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      tailwindcss(),
      streamProxyPlugin(),
      {
        name: 'ignore-missing-sourcemaps',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url && req.url.endsWith('.map')) {
              res.statusCode = 404;
              res.end();
              return;
            }
            next();
          });
        },
      },
    ],
    envPrefix: ['VITE_', 'GOOGLE_'],
    define: {
      'process.env.GOOGLE_API_KEY': JSON.stringify(env.GOOGLE_API_KEY || ''),
      'process.env.GOOGLE_CLIENT_ID': JSON.stringify(env.GOOGLE_CLIENT_ID || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
