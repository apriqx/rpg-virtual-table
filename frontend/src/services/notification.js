// Itens 25-30: som de notificacao para novas mensagens e rolagens.
// Gerado via WebAudio (sem asset externo); trocavel por arquivo depois.
// Preferencia individual por usuario (localStorage), volume preparado (item 29).

const ENABLED_KEY = 'notifySound';
const VOLUME_KEY = 'notifySoundVolume';
let ctx = null;
let unlocked = false;

export function isNotifySoundEnabled() {
  try { return localStorage.getItem(ENABLED_KEY) !== 'off'; } catch { return true; }
}

export function setNotifySoundEnabled(on) {
  try { localStorage.setItem(ENABLED_KEY, on ? 'on' : 'off'); } catch {}
}

// Item 29: 0..100 — pronto para uso futuro
export function getNotifyVolume() {
  const v = Number(localStorage.getItem(VOLUME_KEY));
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : 70;
}

export function setNotifyVolume(v) {
  try { localStorage.setItem(VOLUME_KEY, String(Math.max(0, Math.min(100, Number(v) || 0)))); } catch {}
}

// Item 30: navegadores exigem interacao antes de tocar audio
export function unlockAudio() {
  if (unlocked) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    unlocked = true;
  } catch {}
}

function tone(freq, start, dur, gain) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, ctx.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, ctx.currentTime + start + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.05);
}

// Item 25: aviso curto estilo "new notification"
export function playNotifySound() {
  if (!isNotifySoundEnabled() || !unlocked || !ctx || ctx.state !== 'running') return;
  try {
    const gain = 0.22 * (getNotifyVolume() / 100);
    tone(880, 0, 0.12, gain);
    tone(1244.5, 0.09, 0.16, gain * 0.9);
  } catch {}
}

// Item 27: variacao para resultado de dados
export function playDiceSound() {
  if (!isNotifySoundEnabled() || !unlocked || !ctx || ctx.state !== 'running') return;
  try {
    const gain = 0.2 * (getNotifyVolume() / 100);
    tone(660, 0, 0.09, gain);
    tone(990, 0.07, 0.09, gain * 0.85);
    tone(1318.5, 0.14, 0.14, gain * 0.9);
  } catch {}
}
