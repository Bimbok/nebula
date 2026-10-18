/**
 * Discord Gateway Rich Presence & Custom Status Service
 * Connects directly to Discord Gateway (wss://gateway.discord.gg) so presence
 * updates work on ANY device (Phone, Smart TV, Render/Cloud, Desktop) without
 * needing Discord desktop or local IPC.
 */

import { parseMediaTitle, ParsedMediaTitle } from './mediaTitleParser';

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
}

export type DiscordPresenceStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PlaybackState {
  fileName: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

const STORAGE_KEY_TOKEN = 'nebula_discord_token';
const STORAGE_KEY_ENABLED = 'nebula_discord_enabled';
const STORAGE_KEY_CUSTOM_STATUS = 'nebula_discord_custom_status';

class DiscordPresenceService {
  private ws: WebSocket | null = null;
  private heartbeatInterval: any = null;
  private seq: number | null = null;
  private status: DiscordPresenceStatus = 'disconnected';
  private user: DiscordUser | null = null;
  private errorMessage: string | null = null;
  private currentPlayback: PlaybackState | null = null;
  private listeners: Set<() => void> = new Set();
  private reconnectTimer: any = null;
  private isIntentionallyClosed = false;

  constructor() {
    // Auto-connect if token exists and enabled
    if (typeof window !== 'undefined') {
      const token = this.getToken();
      const enabled = this.isEnabled();
      if (token && enabled) {
        this.connect(token);
      }
    }
  }

  // --- Subscriptions for React Components ---
  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('DiscordPresence listener error:', e);
      }
    });
  }

  // --- Getters & Settings ---
  public getStatus(): DiscordPresenceStatus {
    return this.status;
  }

  public getUser(): DiscordUser | null {
    return this.user;
  }

  public getErrorMessage(): string | null {
    return this.errorMessage;
  }

  public getToken(): string {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(STORAGE_KEY_TOKEN) || '';
  }

  public isEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    const val = localStorage.getItem(STORAGE_KEY_ENABLED);
    return val === null ? true : val === 'true';
  }

  public setEnabled(enabled: boolean) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));
    if (enabled) {
      const token = this.getToken();
      if (token) this.connect(token);
    } else {
      this.clearPlayback();
      this.disconnect();
    }
    this.notify();
  }

  public isCustomStatusEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    const val = localStorage.getItem(STORAGE_KEY_CUSTOM_STATUS);
    return val === null ? true : val === 'true';
  }

  public setCustomStatusEnabled(enabled: boolean) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_CUSTOM_STATUS, String(enabled));
    if (!enabled) {
      this.clearCustomStatus();
    } else if (this.currentPlayback) {
      this.syncCustomStatus(this.currentPlayback);
    }
    this.notify();
  }

  // --- Validate & Save Token ---
  public async setToken(rawToken: string): Promise<{ success: boolean; error?: string; user?: DiscordUser }> {
    const cleanToken = rawToken.trim().replace(/^["']|["']$/g, '');
    if (!cleanToken) {
      this.clearToken();
      return { success: true };
    }

    try {
      // Validate token via Discord REST API
      const res = await fetch('https://discord.com/api/v9/users/@me', {
        headers: {
          Authorization: cleanToken,
        },
      });

      if (!res.ok) {
        if (res.status === 401) {
          return { success: false, error: 'Invalid Discord token. Please check and try again.' };
        }
        return { success: false, error: `Discord API returned HTTP ${res.status}` };
      }

      const userData: DiscordUser = await res.json();
      localStorage.setItem(STORAGE_KEY_TOKEN, cleanToken);
      this.user = userData;
      this.errorMessage = null;

      if (this.isEnabled()) {
        this.connect(cleanToken);
      }

      this.notify();
      return { success: true, user: userData };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to connect to Discord' };
    }
  }

  public clearToken() {
    this.clearPlayback();
    this.disconnect();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
    }
    this.user = null;
    this.status = 'disconnected';
    this.errorMessage = null;
    this.notify();
  }

  // --- Gateway Connection ---
  public connect(token: string) {
    if (!token) return;
    this.isIntentionallyClosed = false;
    clearTimeout(this.reconnectTimer);

    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.status = 'connecting';
    this.errorMessage = null;
    this.notify();

    try {
      this.ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');

      this.ws.onopen = () => {
        // Connected to socket; waiting for HELLO (op: 10)
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleGatewayMessage(payload, token);
        } catch (err) {
          console.error('Failed to parse gateway message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.error('Discord gateway error:', err);
        this.status = 'error';
        this.errorMessage = 'Connection error with Discord gateway';
        this.notify();
      };

      this.ws.onclose = (event) => {
        this.cleanupHeartbeat();
        if (this.status !== 'error') {
          this.status = 'disconnected';
        }
        this.notify();

        // Auto reconnect if not closed intentionally
        if (!this.isIntentionallyClosed && this.isEnabled() && this.getToken()) {
          this.reconnectTimer = setTimeout(() => {
            if (this.isEnabled() && this.getToken()) {
              this.connect(this.getToken());
            }
          }, 5000);
        }
      };
    } catch (e: any) {
      this.status = 'error';
      this.errorMessage = e?.message || 'WebSocket connection error';
      this.notify();
    }
  }

  private handleGatewayMessage(payload: any, token: string) {
    const { op, d, s, t } = payload;
    if (s !== null && s !== undefined) {
      this.seq = s;
    }

    switch (op) {
      case 10: {
        // HELLO: Start heartbeats and send IDENTIFY
        const interval = d.heartbeat_interval;
        this.startHeartbeat(interval);
        this.sendIdentify(token);
        break;
      }
      case 1: {
        // Heartbeat requested by server immediately
        this.sendHeartbeat();
        break;
      }
      case 0: {
        // DISPATCH event
        if (t === 'READY') {
          this.status = 'connected';
          this.errorMessage = null;
          if (d.user) {
            this.user = {
              id: d.user.id,
              username: d.user.username,
              global_name: d.user.global_name,
              avatar: d.user.avatar,
            };
          }
          this.notify();

          // Send current playback activity if playing
          if (this.currentPlayback) {
            this.sendPresenceActivity(this.currentPlayback);
          }
        }
        break;
      }
      case 7: {
        // RECONNECT requested
        this.disconnect();
        this.connect(token);
        break;
      }
      case 9: {
        // Invalid session
        this.status = 'error';
        this.errorMessage = 'Session expired. Reconnecting...';
        this.notify();
        setTimeout(() => this.connect(token), 3000);
        break;
      }
      default:
        break;
    }
  }

  private startHeartbeat(intervalMs: number) {
    this.cleanupHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, intervalMs);
  }

  private sendHeartbeat() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ op: 1, d: this.seq }));
    }
  }

  private cleanupHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendIdentify(token: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const identifyPayload = {
      op: 2,
      d: {
        token,
        capabilities: 16381,
        properties: {
          os: 'Linux',
          browser: 'Chrome',
          device: 'desktop',
          system_locale: 'en-US',
          browser_user_agent: navigator.userAgent,
          browser_version: '124.0.0.0',
          os_version: '',
          referrer: '',
          referring_domain: '',
        },
        presence: {
          activities: [],
          status: 'online',
          since: null,
          afk: false,
        },
      },
    };

    this.ws.send(JSON.stringify(identifyPayload));
  }

  public disconnect() {
    this.isIntentionallyClosed = true;
    clearTimeout(this.reconnectTimer);
    this.cleanupHeartbeat();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
    this.status = 'disconnected';
    this.notify();
  }

  // --- Playback Activity Updates ---
  public updatePlayback(playback: PlaybackState) {
    this.currentPlayback = playback;
    if (!this.isEnabled()) return;

    const token = this.getToken();
    if (!token) return;

    // Ensure connection is active
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect(token);
    } else {
      this.sendPresenceActivity(playback);
    }

    if (this.isCustomStatusEnabled()) {
      this.syncCustomStatus(playback);
    }
  }

  public clearPlayback() {
    this.currentPlayback = null;
    if (!this.isEnabled()) return;

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Clear activity on Gateway
      this.ws.send(
        JSON.stringify({
          op: 3,
          d: {
            since: null,
            activities: [],
            status: 'online',
            afk: false,
          },
        })
      );
    }

    this.clearCustomStatus();
  }

  private sendPresenceActivity(playback: PlaybackState) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const parsed: ParsedMediaTitle = parseMediaTitle(playback.fileName);
    const now = Date.now();
    const isPaused = !playback.isPlaying;

    let timestamps: { start?: number; end?: number } | undefined;
    if (!isPaused && playback.duration > 0) {
      timestamps = {
        start: Math.floor(now - playback.currentTime * 1000),
        end: Math.floor(now + (playback.duration - playback.currentTime) * 1000),
      };
    } else if (!isPaused) {
      timestamps = {
        start: Math.floor(now - playback.currentTime * 1000),
      };
    }

    const stateText = isPaused
      ? `${parsed.displayState} (Paused)`
      : parsed.displayState;

    const activity = {
      name: 'Nebula Cinema',
      type: 3, // 3 = Watching
      details: parsed.displayTitle,
      state: stateText,
      timestamps,
      assets: {
        large_image: 'https://raw.githubusercontent.com/Bimbok/nebula/master/public/mascot.png',
        large_text: isPaused ? 'Nebula Cinema (Paused)' : 'Nebula Cinema',
      },
    };

    const presencePayload = {
      op: 3,
      d: {
        since: null,
        activities: [activity],
        status: 'online',
        afk: false,
      },
    };

    this.ws.send(JSON.stringify(presencePayload));
  }

  // --- Discord Custom Status REST Sync ---
  private async syncCustomStatus(playback: PlaybackState) {
    const token = this.getToken();
    if (!token) return;

    const parsed = parseMediaTitle(playback.fileName);
    const isPaused = !playback.isPlaying;
    const text = isPaused
      ? `Paused: ${parsed.displayTitle} (${parsed.displayState})`
      : `Watching ${parsed.displayTitle} • ${parsed.displayState}`;

    try {
      await fetch('https://discord.com/api/v9/users/@me/settings', {
        method: 'PATCH',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          custom_status: {
            text: text.slice(0, 128),
            emoji_name: null,
            emoji_id: null,
          },
        }),
      });
    } catch {}
  }

  private async clearCustomStatus() {
    const token = this.getToken();
    if (!token) return;

    try {
      await fetch('https://discord.com/api/v9/users/@me/settings', {
        method: 'PATCH',
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          custom_status: null,
        }),
      });
    } catch {}
  }
}

export const discordPresenceService = new DiscordPresenceService();
