// server.ts
import http from "node:http";
import fs2 from "node:fs";
import path2 from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execFile } from "node:child_process";
import { Readable } from "node:stream";
import os from "node:os";

// authManager.ts
import fs from "node:fs";
import path from "node:path";
function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (val.startsWith('"') && val.endsWith('"') || val.startsWith("'") && val.endsWith("'")) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch {
    }
  }
}
loadEnvFile(path.resolve(".env"));
loadEnvFile(path.resolve(".env.local"));
var authCacheDir = path.resolve(".cache", "auth");
var authCacheFile = path.join(authCacheDir, "session.json");
var activeSession = null;
try {
  if (!fs.existsSync(authCacheDir)) {
    fs.mkdirSync(authCacheDir, { recursive: true });
  } else if (fs.existsSync(authCacheFile)) {
    const raw = fs.readFileSync(authCacheFile, "utf8");
    activeSession = JSON.parse(raw);
  }
} catch {
  activeSession = null;
}
function saveSession(session) {
  activeSession = session;
  try {
    if (!fs.existsSync(authCacheDir)) {
      fs.mkdirSync(authCacheDir, { recursive: true });
    }
    if (session) {
      fs.writeFileSync(authCacheFile, JSON.stringify(session, null, 2), "utf8");
    } else if (fs.existsSync(authCacheFile)) {
      fs.unlinkSync(authCacheFile);
    }
  } catch (e) {
    console.warn("[Nebula Auth] Failed to save session to disk cache:", e);
  }
}
function getOAuthCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET || "";
  const apiKey = process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY || "";
  return { clientId, clientSecret, apiKey };
}
function hasClientSecret() {
  const { clientSecret } = getOAuthCredentials();
  return Boolean(clientSecret && clientSecret.trim().length > 0);
}
function clearAuthSession() {
  saveSession(null);
}
async function exchangeAuthCode(code) {
  const { clientId, clientSecret } = getOAuthCredentials();
  if (!clientId || !clientSecret) {
    throw new Error("Server is missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: "postmessage",
    grant_type: "authorization_code"
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const errorMsg = data.error_description || data.error || "Failed to exchange authorization code";
    throw new Error(errorMsg);
  }
  const expiresIn = parseInt(data.expires_in, 10) || 3600;
  const refreshToken = data.refresh_token || activeSession?.refresh_token;
  const session = {
    access_token: data.access_token,
    refresh_token: refreshToken,
    expires_at: Date.now() + (expiresIn - 60) * 1e3,
    token_type: data.token_type || "Bearer",
    scope: data.scope,
    updated_at: Date.now()
  };
  saveSession(session);
  return {
    ...data,
    refresh_token: refreshToken
  };
}
async function refreshAccessToken(refreshTokenArg) {
  const { clientId, clientSecret } = getOAuthCredentials();
  if (!clientId || !clientSecret) {
    throw new Error("Server is missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }
  const refreshToken = refreshTokenArg || activeSession?.refresh_token;
  if (!refreshToken) {
    throw new Error("No refresh token available to refresh session");
  }
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    const errorMsg = data.error_description || data.error || "Failed to refresh token";
    throw new Error(errorMsg);
  }
  const expiresIn = parseInt(data.expires_in, 10) || 3600;
  const newRefreshToken = data.refresh_token || refreshToken;
  const session = {
    access_token: data.access_token,
    refresh_token: newRefreshToken,
    expires_at: Date.now() + (expiresIn - 60) * 1e3,
    token_type: data.token_type || "Bearer",
    scope: data.scope || activeSession?.scope,
    updated_at: Date.now()
  };
  saveSession(session);
  return {
    ...data,
    refresh_token: newRefreshToken
  };
}
function extractEffectiveToken(req, queryToken) {
  let token = queryToken?.trim();
  if (!token && req.headers?.authorization) {
    token = req.headers.authorization.replace(/^Bearer\s+/i, "").trim();
  }
  if (!token && req.headers?.cookie) {
    const match = req.headers.cookie.match(/gdrive_token=([^;]+)/);
    if (match) token = decodeURIComponent(match[1].trim());
  }
  if (!token && activeSession?.access_token) {
    token = activeSession.access_token;
  }
  if (activeSession?.access_token && token && token !== activeSession.access_token && activeSession.expires_at > Date.now()) {
    token = activeSession.access_token;
  }
  return token || "";
}
async function getOrRefreshToken(req, queryToken) {
  let token = extractEffectiveToken(req, queryToken);
  if (activeSession && activeSession.expires_at <= Date.now() + 6e4 && activeSession.refresh_token && hasClientSecret()) {
    try {
      const refreshed = await refreshAccessToken();
      if (refreshed?.access_token) {
        token = refreshed.access_token;
      }
    } catch (e) {
      console.warn("[Nebula Auth] Proactive token refresh notice:", e);
    }
  }
  return token;
}
async function handleGoogleDrive401(req) {
  if (!hasClientSecret()) return null;
  try {
    let reqRefreshToken;
    if (req?.headers?.cookie) {
      const match = req.headers.cookie.match(/gdrive_refresh_token=([^;]+)/);
      if (match) reqRefreshToken = decodeURIComponent(match[1].trim());
    }
    const result = await refreshAccessToken(reqRefreshToken);
    return result?.access_token || null;
  } catch (err) {
    console.error("[Nebula Auth] Automatic 401 token recovery failed:", err);
    return null;
  }
}
async function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}
async function handleAuthRoutes(req, res) {
  const rawUrl = req.url || "";
  const url = new URL(rawUrl, `http://${req.headers?.host || "localhost:3000"}`);
  const pathname = url.pathname;
  if (pathname === "/api/auth/token" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const code = body?.code;
      if (!code) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Missing authorization code" }));
        return true;
      }
      const result = await exchangeAuthCode(code);
      const cookies = [
        `gdrive_token=${encodeURIComponent(result.access_token)}; Max-Age=2592000; Path=/; SameSite=Lax`
      ];
      if (result.refresh_token) {
        cookies.push(
          `gdrive_refresh_token=${encodeURIComponent(result.refresh_token)}; Max-Age=31536000; Path=/; SameSite=Lax`
        );
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Set-Cookie", cookies);
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error("[Nebula Auth] Token exchange error:", err);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: err.message || "Token exchange failed" }));
    }
    return true;
  }
  if (pathname === "/api/auth/refresh" && req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      let refreshToken = body?.refresh_token;
      if (!refreshToken && req.headers?.cookie) {
        const match = req.headers.cookie.match(/gdrive_refresh_token=([^;]+)/);
        if (match) refreshToken = decodeURIComponent(match[1].trim());
      }
      if (!refreshToken && activeSession?.refresh_token) {
        refreshToken = activeSession.refresh_token;
      }
      if (!refreshToken) {
        res.statusCode = 401;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "no_refresh_token", message: "No refresh token available. Please sign in." }));
        return true;
      }
      const result = await refreshAccessToken(refreshToken);
      const cookies = [
        `gdrive_token=${encodeURIComponent(result.access_token)}; Max-Age=2592000; Path=/; SameSite=Lax`
      ];
      if (result.refresh_token) {
        cookies.push(
          `gdrive_refresh_token=${encodeURIComponent(result.refresh_token)}; Max-Age=31536000; Path=/; SameSite=Lax`
        );
      }
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Set-Cookie", cookies);
      res.end(JSON.stringify(result));
    } catch (err) {
      console.warn("[Nebula Auth] Token refresh notice:", err?.message || err);
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: err.message || "Token refresh failed" }));
    }
    return true;
  }
  if (pathname === "/api/auth/logout" && req.method === "POST") {
    clearAuthSession();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Set-Cookie", [
      "gdrive_token=; Max-Age=0; Path=/; SameSite=Lax",
      "gdrive_refresh_token=; Max-Age=0; Path=/; SameSite=Lax"
    ]);
    res.end(JSON.stringify({ success: true }));
    return true;
  }
  if (pathname === "/api/auth/session" && req.method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        hasSession: Boolean(activeSession?.access_token),
        hasRefreshToken: Boolean(activeSession?.refresh_token),
        expiresAt: activeSession?.expires_at || 0
      })
    );
    return true;
  }
  return false;
}

// server.ts
function getLocalNetworkIp() {
  try {
    const interfaces = os.networkInterfaces();
    const candidates = [];
    for (const [name, ifaceList] of Object.entries(interfaces)) {
      if (!ifaceList) continue;
      const isVirtual = /^(docker|vbox|br-|tun|tap|virbr|dummy|lo)/i.test(name);
      for (const iface of ifaceList) {
        if (iface.family === "IPv4" && !iface.internal) {
          if (!isVirtual) {
            candidates.unshift({ name, address: iface.address });
          } else {
            candidates.push({ name, address: iface.address });
          }
        }
      }
    }
    const preferred = candidates.find((c) => /^(wl|wlan|en|eth|wi-fi|ethernet)/i.test(c.name));
    return preferred ? preferred.address : candidates[0]?.address || "127.0.0.1";
  } catch {
    return "127.0.0.1";
  }
}
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var trackMetadataCache = /* @__PURE__ */ new Map();
var metaCacheDir = path2.resolve(".cache", "metadata");
if (!fs2.existsSync(metaCacheDir)) {
  try {
    fs2.mkdirSync(metaCacheDir, { recursive: true });
  } catch (e) {
  }
}
function parseDuration(val) {
  if (!val) return 0;
  if (typeof val === "number") return isFinite(val) && !isNaN(val) ? val : 0;
  if (typeof val !== "string") return 0;
  val = val.trim();
  if (val.includes(":")) {
    const parts = val.split(":");
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
function isValidWebVtt(contents) {
  if (!contents || contents.length < 16) return false;
  const str = contents.toString("utf8", 0, Math.min(contents.length, 512));
  return str.startsWith("WEBVTT") && contents.includes(Buffer.from("-->"));
}
function getAudioTrackCodec(fileId, audioIndex) {
  const cached = trackMetadataCache.get(fileId);
  if (cached?.audioTracks && cached.audioTracks[audioIndex]) {
    return cached.audioTracks[audioIndex].codec;
  }
  const metaCacheFile = path2.join(metaCacheDir, `${fileId}.json`);
  if (fs2.existsSync(metaCacheFile)) {
    try {
      const fileData = JSON.parse(fs2.readFileSync(metaCacheFile, "utf8"));
      if (fileData.audioTracks && fileData.audioTracks[audioIndex]) {
        return fileData.audioTracks[audioIndex].codec;
      }
    } catch {
    }
  }
  return null;
}
var handler = async (req, res, next) => {
  const rawUrl = req.url || "";
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.end();
    return;
  }
  if (rawUrl.startsWith("/api/auth/")) {
    const handled = await handleAuthRoutes(req, res);
    if (handled) return;
  }
  if (rawUrl.startsWith("/api/config") || rawUrl.startsWith("/api/network")) {
    const localIp = getLocalNetworkIp();
    const hostHeader = req.headers.host || "";
    const port = hostHeader.includes(":") ? parseInt(hostHeader.split(":")[1], 10) : process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
    const isCloud = Boolean(process.env.RENDER || process.env.VERCEL);
    const { clientId, apiKey, clientSecret } = getOAuthCredentials();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "no-cache");
    res.end(JSON.stringify({
      GOOGLE_CLIENT_ID: clientId,
      GOOGLE_API_KEY: apiKey,
      hasClientSecret: Boolean(clientSecret && clientSecret.length > 0),
      localIp,
      port,
      isCloud,
      networkUrl: `http://${localIp}:${port}`
    }));
    return;
  }
  if (rawUrl.startsWith("/api/tracks")) {
    try {
      const url = new URL(rawUrl, `http://${req.headers.host || "localhost:3000"}`);
      const fileId = url.searchParams.get("fileId");
      const token = await getOrRefreshToken(req, url.searchParams.get("token"));
      if (!fileId || !token) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(JSON.stringify({ error: "Missing fileId or token" }));
        return;
      }
      const cached = trackMetadataCache.get(fileId);
      if (cached && Date.now() - cached.timestamp < 3600 * 24 * 1e3) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(JSON.stringify({
          audioTracks: cached.audioTracks,
          subtitleTracks: cached.subtitleTracks,
          duration: cached.duration || 0
        }));
        return;
      }
      const metaCacheFile = path2.join(metaCacheDir, `${fileId}.json`);
      if (fs2.existsSync(metaCacheFile)) {
        try {
          const diskContent = fs2.readFileSync(metaCacheFile, "utf-8");
          const parsed = JSON.parse(diskContent);
          if (parsed && (parsed.audioTracks || parsed.duration > 0)) {
            trackMetadataCache.set(fileId, {
              audioTracks: parsed.audioTracks || [],
              subtitleTracks: parsed.subtitleTracks || [],
              duration: parsed.duration || 0,
              timestamp: Date.now()
            });
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end(diskContent);
            return;
          }
        } catch (diskErr) {
          console.warn("[metadata cache read error]", diskErr);
        }
      }
      const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const headersParam = `Authorization: Bearer ${token}\r
`;
      execFile(
        "ffprobe",
        [
          "-headers",
          headersParam,
          "-seekable",
          "1",
          "-multiple_requests",
          "1",
          "-v",
          "quiet",
          "-print_format",
          "json",
          "-show_streams",
          "-show_format",
          driveUrl
        ],
        { timeout: 25e3, maxBuffer: 15 * 1024 * 1024 },
        (err, stdout) => {
          if (err || !stdout) {
            console.warn("[ffprobe] Could not probe streams:", err?.message);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end(JSON.stringify({ audioTracks: [], subtitleTracks: [], duration: 0 }));
            return;
          }
          try {
            const data = JSON.parse(stdout);
            const streams = data.streams || [];
            const format = data.format || {};
            let probedDuration = parseDuration(format.duration);
            if (probedDuration <= 0) {
              for (const s of streams) {
                const d = parseDuration(s.duration) || parseDuration(s.tags?.DURATION) || parseDuration(s.tags?.duration) || parseDuration(s.tags?.["DURATION-eng"]) || parseDuration(s.tags?.["DURATION-und"]);
                if (d > probedDuration) probedDuration = d;
              }
            }
            if (probedDuration <= 0) {
              const formatTagDur = parseDuration(format.tags?.DURATION) || parseDuration(format.tags?.duration);
              if (formatTagDur > probedDuration) probedDuration = formatTagDur;
            }
            const audioStreams = streams.filter((s) => s.codec_type === "audio");
            const subtitleStreams = streams.filter((s) => s.codec_type === "subtitle");
            const audioTracks = audioStreams.map((s, idx) => {
              const lang = s.tags?.language || s.tags?.LANGUAGE || "und";
              const title = s.tags?.title || s.tags?.TITLE || `Track ${idx + 1}`;
              const channels = s.channels ? `${s.channels}ch` : "";
              const codec = (s.codec_name || "").toUpperCase();
              return {
                id: idx,
                streamIndex: s.index,
                codec: s.codec_name,
                channels: s.channels,
                language: lang,
                label: `${title} (${lang.toUpperCase()} \u2022 ${codec}${channels ? " \u2022 " + channels : ""})`
              };
            });
            const subtitleTracks = subtitleStreams.map((s, idx) => {
              const lang = s.tags?.language || s.tags?.LANGUAGE || "und";
              const title = s.tags?.title || s.tags?.TITLE || `Subtitle ${idx + 1}`;
              const codec = (s.codec_name || "").toUpperCase();
              const isBitmap = ["hdmv_pgs_subtitle", "dvd_subtitle", "dvb_subtitle"].includes(s.codec_name);
              return {
                id: idx,
                streamIndex: s.index,
                codec: s.codec_name,
                language: lang,
                isBitmap,
                label: `${title} (${lang.toUpperCase()} \u2022 ${codec}${isBitmap ? " [PGS Bitmap]" : ""})`
              };
            });
            const metaPayload = {
              audioTracks,
              subtitleTracks,
              duration: probedDuration
            };
            trackMetadataCache.set(fileId, { ...metaPayload, timestamp: Date.now() });
            fs2.writeFile(metaCacheFile, JSON.stringify(metaPayload), () => {
            });
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end(JSON.stringify(metaPayload));
          } catch (parseErr) {
            console.error("[ffprobe parse error]:", parseErr);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end(JSON.stringify({ audioTracks: [], subtitleTracks: [], duration: 0 }));
          }
        }
      );
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }
  if (rawUrl.startsWith("/api/subtitles")) {
    try {
      const url = new URL(rawUrl, `http://${req.headers.host || "localhost:3000"}`);
      const fileId = url.searchParams.get("fileId");
      const streamIndex = url.searchParams.get("streamIndex");
      const isBitmap = url.searchParams.get("isBitmap") === "true";
      const token = await getOrRefreshToken(req, url.searchParams.get("token"));
      if (!fileId || !token || streamIndex === null) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end("Missing fileId, streamIndex, or token");
        return;
      }
      if (isBitmap) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/vtt; charset=utf-8");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end("WEBVTT\n\n00:00:01.000 --> 00:00:10.000\n[PGS/Bitmap Subtitle: Please choose a text subtitle track or upload .srt]\n\n");
        return;
      }
      const cacheDir = path2.resolve(".cache", "subtitles");
      if (!fs2.existsSync(cacheDir)) {
        try {
          fs2.mkdirSync(cacheDir, { recursive: true });
        } catch {
        }
      }
      const cacheFile = path2.join(cacheDir, `${fileId}_${streamIndex}.vtt`);
      if (fs2.existsSync(cacheFile) && fs2.statSync(cacheFile).size > 30) {
        try {
          const cached = fs2.readFileSync(cacheFile);
          if (isValidWebVtt(cached)) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/vtt; charset=utf-8");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Cache-Control", "public, max-age=86400");
            res.setHeader("Content-Length", cached.length.toString());
            res.end(cached);
            return;
          }
          fs2.unlinkSync(cacheFile);
        } catch {
        }
      }
      const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const headersParam = `Authorization: Bearer ${token}\r
`;
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/vtt; charset=utf-8");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Transfer-Encoding", "chunked");
      const ffmpegArgs = [
        "-loglevel",
        "error",
        "-reconnect",
        "1",
        "-reconnect_streamed",
        "1",
        "-reconnect_on_network_error",
        "1",
        "-reconnect_delay_max",
        "2",
        "-headers",
        headersParam,
        "-i",
        driveUrl,
        "-map",
        `0:${streamIndex}`,
        "-vn",
        "-an",
        "-c:s",
        "webvtt",
        "-f",
        "webvtt",
        "pipe:1"
      ];
      const ffmpeg = spawn("ffmpeg", ffmpegArgs);
      const chunks = [];
      ffmpeg.stdout.on("data", (c) => {
        chunks.push(c);
        if (!res.writableEnded) {
          res.write(c);
          if (typeof res.flush === "function") {
            res.flush();
          }
        }
      });
      ffmpeg.stderr.on("data", (d) => {
        console.warn("[ffmpeg-sub]", d.toString().trim());
      });
      ffmpeg.on("close", (code) => {
        const fullData = Buffer.concat(chunks);
        if (code === 0 && isValidWebVtt(fullData)) {
          const tempFile = `${cacheFile}.tmp.${Date.now()}`;
          try {
            fs2.writeFileSync(tempFile, fullData);
            fs2.renameSync(tempFile, cacheFile);
          } catch (e) {
            console.warn("[subtitle cache write error]", e);
          }
        }
        if (!res.writableEnded) {
          res.end();
        }
      });
      ffmpeg.on("error", (err) => {
        console.error("[ffmpeg subtitle extraction error]", err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end("WEBVTT\n\n");
        } else if (!res.writableEnded) {
          res.end();
        }
      });
      const stopSubtitleExtraction = () => {
        if (!res.writableEnded) {
          try {
            ffmpeg.kill("SIGKILL");
          } catch {
          }
        }
      };
      req.on("aborted", stopSubtitleExtraction);
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "text/vtt");
        res.end("WEBVTT\n\n");
      } else if (!res.writableEnded) {
        res.end();
      }
    }
    return;
  }
  if (rawUrl.startsWith("/api/thumbnail")) {
    try {
      const url = new URL(rawUrl, `http://${req.headers.host || "localhost:3000"}`);
      const fileId = url.searchParams.get("fileId");
      const googleThumbnailUrl = url.searchParams.get("url");
      const token = await getOrRefreshToken(req, url.searchParams.get("token"));
      if (!fileId) {
        res.statusCode = 400;
        res.end("Missing fileId");
        return;
      }
      const cacheDir = path2.resolve(".cache", "thumbnails");
      if (!fs2.existsSync(cacheDir)) {
        fs2.mkdirSync(cacheDir, { recursive: true });
      }
      const cacheFile = path2.join(cacheDir, `${fileId}.jpg`);
      if (fs2.existsSync(cacheFile) && fs2.statSync(cacheFile).size > 500) {
        res.statusCode = 200;
        res.setHeader("Content-Type", "image/jpeg");
        res.setHeader("Cache-Control", "public, max-age=86400");
        res.setHeader("Access-Control-Allow-Origin", "*");
        fs2.createReadStream(cacheFile).pipe(res);
        return;
      }
      if (googleThumbnailUrl && googleThumbnailUrl.startsWith("http")) {
        try {
          const thumbHeaders = {};
          if (token) thumbHeaders["Authorization"] = `Bearer ${token}`;
          const gRes = await fetch(googleThumbnailUrl, { headers: thumbHeaders });
          if (gRes.ok) {
            const buffer = Buffer.from(await gRes.arrayBuffer());
            if (buffer.length > 500) {
              fs2.writeFileSync(cacheFile, buffer);
              res.statusCode = 200;
              res.setHeader("Content-Type", gRes.headers.get("content-type") || "image/jpeg");
              res.setHeader("Cache-Control", "public, max-age=86400");
              res.setHeader("Access-Control-Allow-Origin", "*");
              res.end(buffer);
              return;
            }
          }
        } catch (e) {
        }
      }
      if (!token) {
        res.statusCode = 401;
        res.end("Missing token for thumbnail generation");
        return;
      }
      const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      const headersParam = `Authorization: Bearer ${token}\r
`;
      const ffmpeg = spawn("ffmpeg", [
        "-ss",
        "00:00:10",
        "-headers",
        headersParam,
        "-i",
        driveUrl,
        "-vframes",
        "1",
        "-vf",
        "scale=640:-1",
        "-q:v",
        "3",
        "-f",
        "image2",
        "-c:v",
        "mjpeg",
        "pipe:1"
      ]);
      const chunks = [];
      ffmpeg.stdout.on("data", (c) => chunks.push(c));
      ffmpeg.on("close", (code) => {
        if (code === 0 && chunks.length > 0) {
          const imgBuffer = Buffer.concat(chunks);
          fs2.writeFile(cacheFile, imgBuffer, () => {
          });
          if (!res.headersSent) {
            res.statusCode = 200;
            res.setHeader("Content-Type", "image/jpeg");
            res.setHeader("Cache-Control", "public, max-age=86400");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end(imgBuffer);
          }
        } else {
          const retryFfmpeg = spawn("ffmpeg", [
            "-ss",
            "00:00:01",
            "-headers",
            headersParam,
            "-i",
            driveUrl,
            "-vframes",
            "1",
            "-vf",
            "scale=640:-1",
            "-q:v",
            "3",
            "-f",
            "image2",
            "-c:v",
            "mjpeg",
            "pipe:1"
          ]);
          const retryChunks = [];
          retryFfmpeg.stdout.on("data", (c) => retryChunks.push(c));
          retryFfmpeg.on("close", (rCode) => {
            if (rCode === 0 && retryChunks.length > 0) {
              const img = Buffer.concat(retryChunks);
              fs2.writeFile(cacheFile, img, () => {
              });
              if (!res.headersSent) {
                res.statusCode = 200;
                res.setHeader("Content-Type", "image/jpeg");
                res.setHeader("Cache-Control", "public, max-age=86400");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.end(img);
              }
            } else if (!res.headersSent) {
              res.statusCode = 404;
              res.end("Thumbnail unavailable");
            }
          });
        }
      });
      const stopThumbnail = () => {
        if (!res.writableEnded) ffmpeg.kill("SIGKILL");
      };
      req.on("aborted", stopThumbnail);
      res.on("close", stopThumbnail);
    } catch (err) {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(err.message);
      }
    }
    return;
  }
  if (!rawUrl.startsWith("/api/stream")) {
    return next();
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }
  try {
    const url = new URL(rawUrl, `http://${req.headers.host || "localhost:3000"}`);
    const fileId = url.searchParams.get("fileId");
    const audioIndexStr = url.searchParams.get("audioIndex");
    const startTimeStr = url.searchParams.get("startTime");
    let token = await getOrRefreshToken(req, url.searchParams.get("token"));
    if (!fileId || !token) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(JSON.stringify({ error: "Missing required fileId or token" }));
      return;
    }
    const driveUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    if (audioIndexStr !== null && audioIndexStr !== "") {
      const audioIndex = parseInt(audioIndexStr, 10) || 0;
      const startTime = startTimeStr ? Math.max(0, parseFloat(startTimeStr)) : 0;
      const directAudioParam = url.searchParams.get("directAudio");
      const headersParam = `Authorization: Bearer ${token}\r
`;
      res.statusCode = 200;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Cache-Control", "public, max-age=86400, no-transform");
      res.setHeader("Transfer-Encoding", "chunked");
      res.setHeader("Content-Type", "video/mp4");
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      let isPlayable = false;
      if (directAudioParam === "1" || directAudioParam === "true") {
        isPlayable = true;
      } else if (directAudioParam === "0" || directAudioParam === "false") {
        isPlayable = false;
      } else {
        const codec = getAudioTrackCodec(fileId, audioIndex);
        if (codec && ["aac", "opus", "flac", "mp3", "vorbis", "wav"].includes(codec.toLowerCase())) {
          isPlayable = true;
        }
      }
      const audioArgs = isPlayable ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "320k"];
      const ffmpegArgs = [
        "-loglevel",
        "error",
        "-reconnect",
        "1",
        "-reconnect_streamed",
        "1",
        "-reconnect_on_network_error",
        "1",
        "-reconnect_delay_max",
        "2",
        "-multiple_requests",
        "1",
        "-tcp_nodelay",
        "1",
        "-recv_buffer_size",
        "16777216",
        "-noaccurate_seek",
        "-ss",
        startTime.toString(),
        "-headers",
        headersParam,
        "-i",
        driveUrl,
        "-map",
        "0:v:0",
        "-map",
        `0:a:${audioIndex}`,
        "-c:v",
        "copy",
        ...audioArgs,
        "-avoid_negative_ts",
        "make_zero",
        "-f",
        "mp4",
        "-movflags",
        "frag_keyframe+empty_moov+default_base_moof",
        "-frag_duration",
        "1000000",
        "-max_muxing_queue_size",
        "4096",
        "-flush_packets",
        "1",
        "pipe:1"
      ];
      const ffmpeg = spawn("ffmpeg", ffmpegArgs);
      ffmpeg.stdout.pipe(res);
      ffmpeg.stderr.on("data", (d) => {
        const s = d.toString();
        if (!s.includes("frame=") && !s.includes("speed=")) {
          console.warn("[ffmpeg-stream]", s.trim());
        }
      });
      let killed = false;
      const stopRemux = () => {
        if (!killed) {
          killed = true;
          try {
            ffmpeg.stdout.destroy();
            ffmpeg.kill("SIGKILL");
          } catch {
          }
        }
      };
      req.on("aborted", stopRemux);
      req.on("close", stopRemux);
      res.on("close", stopRemux);
      res.on("finish", stopRemux);
      ffmpeg.on("error", (err) => {
        console.error("[ffmpeg remux stream error]", err);
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end(`Transmux error: ${err.message}`);
        }
      });
      return;
    }
    const rangeHeader = req.headers.range;
    const requestHeaders = {
      Authorization: `Bearer ${token}`
    };
    if (rangeHeader) {
      requestHeaders["Range"] = rangeHeader;
    }
    let driveRes = await fetch(driveUrl, {
      method: req.method,
      headers: requestHeaders
    });
    if (driveRes.status === 401) {
      const freshToken = await handleGoogleDrive401(req);
      if (freshToken) {
        token = freshToken;
        requestHeaders["Authorization"] = `Bearer ${token}`;
        driveRes = await fetch(driveUrl, {
          method: req.method,
          headers: requestHeaders
        });
        res.setHeader("Set-Cookie", `gdrive_token=${encodeURIComponent(token)}; Max-Age=2592000; Path=/; SameSite=Lax`);
      }
    }
    if (!driveRes.ok && driveRes.status !== 206) {
      const errorText = await driveRes.text();
      console.error(`[Drive Stream Proxy Error] Status: ${driveRes.status}`, errorText);
      res.statusCode = driveRes.status;
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(`Google Drive Error (${driveRes.status}): ${errorText}`);
      return;
    }
    res.statusCode = driveRes.status;
    let contentType = driveRes.headers.get("content-type") || url.searchParams.get("mimeType") || "video/mp4";
    if (contentType === "application/octet-stream") {
      const requestedMime = url.searchParams.get("mimeType");
      contentType = requestedMime || "video/mp4";
    }
    res.setHeader("Content-Type", contentType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, no-transform, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    const contentRange = driveRes.headers.get("content-range");
    if (contentRange) {
      res.setHeader("Content-Range", contentRange);
    }
    const contentLength = driveRes.headers.get("content-length");
    if (contentLength) {
      res.setHeader("Content-Length", contentLength);
    }
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    if (driveRes.body) {
      const nodeStream = Readable.fromWeb(driveRes.body);
      const stopDirectStream = () => {
        if (!res.writableEnded) nodeStream.destroy();
      };
      req.on("aborted", stopDirectStream);
      res.on("close", stopDirectStream);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    console.error("[Drive Stream Proxy Exception]", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(`Stream Proxy Error: ${err.message}`);
    }
  }
};
var MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp4": "video/mp4",
  ".webm": "video/webm"
};
function serveStatic(req, res) {
  const distDir = path2.resolve(__dirname, "dist");
  let pathname = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`).pathname;
  if (pathname === "/" || pathname === "") pathname = "/index.html";
  let filePath = path2.join(distDir, pathname);
  if (!fs2.existsSync(filePath) || fs2.statSync(filePath).isDirectory()) {
    filePath = path2.join(distDir, "index.html");
  }
  if (!fs2.existsSync(filePath)) {
    res.statusCode = 404;
    res.end("Not Found. Please run `npm run build` first.");
    return;
  }
  if (filePath.endsWith("index.html")) {
    try {
      let html = fs2.readFileSync(filePath, "utf-8");
      const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "";
      const apiKey = process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY || "";
      const configScript = `
    <script>
      window.process = window.process || { env: {} };
      window.process.env = window.process.env || {};
      window.process.env.GOOGLE_CLIENT_ID = ${JSON.stringify(clientId)};
      window.process.env.GOOGLE_API_KEY = ${JSON.stringify(apiKey)};
      window.NEBULA_CONFIG = {
        GOOGLE_CLIENT_ID: ${JSON.stringify(clientId)},
        GOOGLE_API_KEY: ${JSON.stringify(apiKey)}
      };
    </script>`;
      html = html.replace("</head>", `${configScript}
  </head>`);
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(html);
      return;
    } catch (e) {
    }
  }
  const ext = path2.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  res.statusCode = 200;
  res.setHeader("Content-Type", contentType);
  fs2.createReadStream(filePath).pipe(res);
}
var PORT = parseInt(process.env.PORT || "3000", 10);
var HOST = "0.0.0.0";
var server = http.createServer(async (req, res) => {
  if (req.url && req.url.startsWith("/api/")) {
    try {
      await handler(req, res, () => serveStatic(req, res));
    } catch (err) {
      console.error("[API Error]", err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: err.message }));
      }
    }
  } else {
    serveStatic(req, res);
  }
});
server.listen(PORT, HOST, () => {
  console.log(`
Nebula-Panda Cinema Server running on http://${HOST}:${PORT}`);
});
