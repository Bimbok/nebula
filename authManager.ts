import fs from 'node:fs';
import path from 'node:path';

// Parse .env and .env.local to ensure environment variables are present in Node runtime
function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    } catch {}
  }
}

loadEnvFile(path.resolve('.env'));
loadEnvFile(path.resolve('.env.local'));

export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // epoch ms
  token_type?: string;
  scope?: string;
  updated_at: number;
}

const authCacheDir = path.resolve('.cache', 'auth');
const authCacheFile = path.join(authCacheDir, 'session.json');

let activeSession: AuthSession | null = null;

// Initialize session from disk cache if present
try {
  if (!fs.existsSync(authCacheDir)) {
    fs.mkdirSync(authCacheDir, { recursive: true });
  } else if (fs.existsSync(authCacheFile)) {
    const raw = fs.readFileSync(authCacheFile, 'utf8');
    activeSession = JSON.parse(raw);
  }
} catch {
  activeSession = null;
}

function saveSession(session: AuthSession | null) {
  activeSession = session;
  try {
    if (!fs.existsSync(authCacheDir)) {
      fs.mkdirSync(authCacheDir, { recursive: true });
    }
    if (session) {
      fs.writeFileSync(authCacheFile, JSON.stringify(session, null, 2), 'utf8');
    } else if (fs.existsSync(authCacheFile)) {
      fs.unlinkSync(authCacheFile);
    }
  } catch (e) {
    console.warn('[Nebula Auth] Failed to save session to disk cache:', e);
  }
}

export function getOAuthCredentials() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID ||
    process.env.VITE_GOOGLE_CLIENT_ID ||
    '';
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET ||
    process.env.VITE_GOOGLE_CLIENT_SECRET ||
    '';
  const apiKey =
    process.env.GOOGLE_API_KEY ||
    process.env.VITE_GOOGLE_API_KEY ||
    '';
  return { clientId, clientSecret, apiKey };
}

export function hasClientSecret(): boolean {
  const { clientSecret } = getOAuthCredentials();
  return Boolean(clientSecret && clientSecret.trim().length > 0);
}

export function getActiveSession(): AuthSession | null {
  return activeSession;
}

export function clearAuthSession() {
  saveSession(null);
}

export async function exchangeAuthCode(code: string): Promise<any> {
  const { clientId, clientSecret } = getOAuthCredentials();
  if (!clientId || !clientSecret) {
    throw new Error('Server is missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  }

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: 'postmessage',
    grant_type: 'authorization_code',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data: any = await res.json();
  if (!res.ok || data.error) {
    const errorMsg = data.error_description || data.error || 'Failed to exchange authorization code';
    throw new Error(errorMsg);
  }

  const expiresIn = parseInt(data.expires_in, 10) || 3600;
  const refreshToken = data.refresh_token || activeSession?.refresh_token;

  const session: AuthSession = {
    access_token: data.access_token,
    refresh_token: refreshToken,
    expires_at: Date.now() + (expiresIn - 60) * 1000,
    token_type: data.token_type || 'Bearer',
    scope: data.scope,
    updated_at: Date.now(),
  };

  saveSession(session);
  return {
    ...data,
    refresh_token: refreshToken,
  };
}

export async function refreshAccessToken(refreshTokenArg?: string): Promise<any> {
  const { clientId, clientSecret } = getOAuthCredentials();
  if (!clientId || !clientSecret) {
    throw new Error('Server is missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  }

  const refreshToken = refreshTokenArg || activeSession?.refresh_token;
  if (!refreshToken) {
    throw new Error('No refresh token available to refresh session');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  const data: any = await res.json();
  if (!res.ok || data.error) {
    const errorMsg = data.error_description || data.error || 'Failed to refresh token';
    throw new Error(errorMsg);
  }

  const expiresIn = parseInt(data.expires_in, 10) || 3600;
  const newRefreshToken = data.refresh_token || refreshToken;

  const session: AuthSession = {
    access_token: data.access_token,
    refresh_token: newRefreshToken,
    expires_at: Date.now() + (expiresIn - 60) * 1000,
    token_type: data.token_type || 'Bearer',
    scope: data.scope || activeSession?.scope,
    updated_at: Date.now(),
  };

  saveSession(session);
  return {
    ...data,
    refresh_token: newRefreshToken,
  };
}

export function extractEffectiveToken(req: any, queryToken?: string | null): string {
  let token = queryToken?.trim();

  // Check Authorization header
  if (!token && req.headers?.authorization) {
    token = req.headers.authorization.replace(/^Bearer\s+/i, '').trim();
  }

  // Check cookie
  if (!token && req.headers?.cookie) {
    const match = req.headers.cookie.match(/gdrive_token=([^;]+)/);
    if (match) token = decodeURIComponent(match[1].trim());
  }

  // If no token provided from request, use active session
  if (!token && activeSession?.access_token) {
    token = activeSession.access_token;
  }

  // If the provided query token was an older token and our active session has a valid newer token, prefer newer token
  if (
    activeSession?.access_token &&
    token &&
    token !== activeSession.access_token &&
    activeSession.expires_at > Date.now()
  ) {
    token = activeSession.access_token;
  }

  return token || '';
}

export async function getOrRefreshToken(req: any, queryToken?: string | null): Promise<string> {
  let token = extractEffectiveToken(req, queryToken);

  // If session is expired or expiring within 60 seconds, proactively refresh
  if (
    activeSession &&
    activeSession.expires_at <= Date.now() + 60000 &&
    activeSession.refresh_token &&
    hasClientSecret()
  ) {
    try {
      const refreshed = await refreshAccessToken();
      if (refreshed?.access_token) {
        token = refreshed.access_token;
      }
    } catch (e) {
      console.warn('[Nebula Auth] Proactive token refresh notice:', e);
    }
  }

  return token;
}

export async function handleGoogleDrive401(req?: any): Promise<string | null> {
  if (!hasClientSecret()) return null;

  try {
    let reqRefreshToken: string | undefined;
    if (req?.headers?.cookie) {
      const match = req.headers.cookie.match(/gdrive_refresh_token=([^;]+)/);
      if (match) reqRefreshToken = decodeURIComponent(match[1].trim());
    }

    const result = await refreshAccessToken(reqRefreshToken);
    return result?.access_token || null;
  } catch (err) {
    console.error('[Nebula Auth] Automatic 401 token recovery failed:', err);
    return null;
  }
}

async function readJsonBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export async function handleAuthRoutes(req: any, res: any): Promise<boolean> {
  const rawUrl = req.url || '';
  const url = new URL(rawUrl, `http://${req.headers?.host || 'localhost:3000'}`);
  const pathname = url.pathname;

  if (pathname === '/api/auth/token' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req);
      const code = body?.code;
      if (!code) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Missing authorization code' }));
        return true;
      }

      const result = await exchangeAuthCode(code);
      const cookies = [
        `gdrive_token=${encodeURIComponent(result.access_token)}; Max-Age=2592000; Path=/; SameSite=Lax`,
      ];
      if (result.refresh_token) {
        cookies.push(
          `gdrive_refresh_token=${encodeURIComponent(result.refresh_token)}; Max-Age=31536000; Path=/; SameSite=Lax`
        );
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Set-Cookie', cookies);
      res.end(JSON.stringify(result));
    } catch (err: any) {
      console.error('[Nebula Auth] Token exchange error:', err);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Token exchange failed' }));
    }
    return true;
  }

  if (pathname === '/api/auth/refresh' && req.method === 'POST') {
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
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'no_refresh_token', message: 'No refresh token available. Please sign in.' }));
        return true;
      }

      const result = await refreshAccessToken(refreshToken);
      const cookies = [
        `gdrive_token=${encodeURIComponent(result.access_token)}; Max-Age=2592000; Path=/; SameSite=Lax`,
      ];
      if (result.refresh_token) {
        cookies.push(
          `gdrive_refresh_token=${encodeURIComponent(result.refresh_token)}; Max-Age=31536000; Path=/; SameSite=Lax`
        );
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Set-Cookie', cookies);
      res.end(JSON.stringify(result));
    } catch (err: any) {
      console.warn('[Nebula Auth] Token refresh notice:', err?.message || err);
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: err.message || 'Token refresh failed' }));
    }
    return true;
  }

  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    clearAuthSession();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Set-Cookie', [
      'gdrive_token=; Max-Age=0; Path=/; SameSite=Lax',
      'gdrive_refresh_token=; Max-Age=0; Path=/; SameSite=Lax',
    ]);
    res.end(JSON.stringify({ success: true }));
    return true;
  }

  if (pathname === '/api/auth/session' && req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        hasSession: Boolean(activeSession?.access_token),
        hasRefreshToken: Boolean(activeSession?.refresh_token),
        expiresAt: activeSession?.expires_at || 0,
      })
    );
    return true;
  }

  return false;
}
