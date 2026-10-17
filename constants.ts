// IMPORTANT: Make sure to set your Google Cloud project's Client ID (and optionally API Key)
// as environment variables in .env.local (GOOGLE_CLIENT_ID, GOOGLE_API_KEY).
// You can get these from the Google Cloud Console: https://console.cloud.google.com/

const getEnvVar = (key: string): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const metaEnv = (import.meta as any).env;
    if (metaEnv[key]) return metaEnv[key];
    if (metaEnv[`VITE_${key}`]) return metaEnv[`VITE_${key}`];
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env[key]) return process.env[key];
    if (process.env[`VITE_${key}`]) return process.env[`VITE_${key}`];
  }
  return '';
};

export const GOOGLE_API_KEY = getEnvVar('GOOGLE_API_KEY');
export const GOOGLE_CLIENT_ID = getEnvVar('GOOGLE_CLIENT_ID');

export const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';