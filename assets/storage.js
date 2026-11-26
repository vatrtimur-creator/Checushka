import { steamIdFromInput } from './engine.js';
export const SETTINGS_KEY = 'rust-util:settings:v1';
export const TRACKER_KEY = 'rust-util:tracker:v1';
export function normalizePlayers(value) {
  if (!Array.isArray(value) || value.length > 1000) throw new Error('invalidImport');
  const seen = new Set();
  return value.map(player => {
    if (!player || typeof player !== 'object') throw new Error('invalidImport');
    const steamid = steamIdFromInput(player.steamid);
    if (!steamid || seen.has(steamid)) throw new Error('invalidImport');
    seen.add(steamid);
    return {
      steamid,
      nickname: typeof player.nickname === 'string' ? player.nickname.slice(0, 128) : '',
      notes: typeof player.notes === 'string' ? player.notes.slice(0, 2000) : '',
      addedAt: Number.isFinite(player.addedAt) ? player.addedAt : Date.now(),
      status: 'unknown',
      checkedAt: null
    };
  });
}
export function loadPlayers(storage) {
  const raw = storage.getItem(TRACKER_KEY);
  if (!raw) return [];
  // Снимки статуса не достоверны после перезапуска — сбрасываем в unknown.
  return normalizePlayers(JSON.parse(raw));
}
export function savePlayers(storage, players) {
  storage.setItem(TRACKER_KEY, JSON.stringify(players));
}
export function readSettings(storage) {
  const value = JSON.parse(storage.getItem(SETTINGS_KEY) || '{}');
  return {
    theme: value.theme === 'light' ? 'light' : 'dark',
    font: ['small', 'medium', 'large'].includes(value.font) ? value.font : 'medium',
    language: value.language === 'en' ? 'en' : 'ru',
    collapsed: value.collapsed === true,
    api: typeof value.api === 'string' ? value.api : ''
  };
}
export function validateApiUrl(value) {
  if (!value.trim()) return '';
  try {
    const url = new URL(value.trim());
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) return null;
    return url.href.replace(/\/$/, '');
  } catch { return null; }
}
