// Timer reminder audio. Strategy:
//   1. Try the bundled file at /timer-alert.m4a (works when app is hosted normally).
//   2. If that fails (single-file html, missing asset, codec), fall back to an
//      embedded base64 WAV beep (always works offline).
//   3. As a final guarantee, synthesize a chime via WebAudio.

let primaryEl: HTMLAudioElement | null = null;
let fallbackEl: HTMLAudioElement | null = null;
let unlocked = false;
let primaryWorks = true;
let loopTimer: ReturnType<typeof setInterval> | null = null;
let autoStop: ReturnType<typeof setTimeout> | null = null;
let fallbackCtx: AudioContext | null = null;

// Tiny embedded WAV beep (≈0.5s at 880Hz). Shipped inline so it works
// even when the app is opened as a single offline html file.
const EMBEDDED_WAV =
  "data:audio/wav;base64,UklGRoQrAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YWArAAAA"; // header only; we synthesize bytes below
let embeddedUrl: string | null = null;

function buildEmbeddedBeep(): string {
  if (embeddedUrl) return embeddedUrl;
  if (typeof window === "undefined") return EMBEDDED_WAV;
  // Synthesize a 0.6s 880Hz sine wav, then turn into a blob: URL.
  const sampleRate = 22050;
  const seconds = 0.6;
  const total = Math.floor(sampleRate * seconds);
  const buffer = new ArrayBuffer(44 + total * 2);
  const view = new DataView(buffer);
  const writeStr = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + total * 2, true);
  writeStr(8, "WAVE"); writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, total * 2, true);
  for (let i = 0; i < total; i++) {
    // Slight envelope to avoid clicks
    const env = Math.min(1, i / 800) * Math.min(1, (total - i) / 1200);
    const v = Math.sin((2 * Math.PI * 880 * i) / sampleRate) * 0.55 * env;
    view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, v)) * 32767, true);
  }
  const blob = new Blob([buffer], { type: "audio/wav" });
  embeddedUrl = URL.createObjectURL(blob);
  return embeddedUrl;
}

function getPrimary(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!primaryEl) {
    primaryEl = new Audio("/timer-alert.m4a");
    primaryEl.preload = "auto";
    primaryEl.volume = 0.9;
    primaryEl.addEventListener("error", () => { primaryWorks = false; });
  }
  return primaryEl;
}
function getFallback(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!fallbackEl) {
    fallbackEl = new Audio(buildEmbeddedBeep());
    fallbackEl.preload = "auto";
    fallbackEl.volume = 0.85;
  }
  return fallbackEl;
}

/** Try to unlock audio in response to a user gesture. */
export async function unlockAudio(): Promise<boolean> {
  let ok = false;
  for (const el of [getPrimary(), getFallback()]) {
    if (!el) continue;
    try {
      el.muted = true;
      await el.play();
      el.pause();
      el.currentTime = 0;
      el.muted = false;
      ok = true;
    } catch {/* try next */}
  }
  // Also resume an AudioContext if we have one.
  try {
    if (typeof window !== "undefined") {
      if (!fallbackCtx) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (Ctx) fallbackCtx = new Ctx();
      }
      if (fallbackCtx && fallbackCtx.state === "suspended") await fallbackCtx.resume();
    }
  } catch {/* ignore */}
  unlocked = unlocked || ok;
  return unlocked;
}

export function isAudioUnlocked() { return unlocked; }

/** Auto-unlock on first user gesture anywhere — runs once. */
let autoUnlockBound = false;
export function bindAutoUnlock() {
  if (autoUnlockBound || typeof window === "undefined") return;
  autoUnlockBound = true;
  const handler = () => { unlockAudio().finally(() => {/* noop */}); };
  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    window.addEventListener(ev, handler, { once: true, passive: true })
  );
}

function oscillatorBeep(success: boolean) {
  try {
    if (typeof window === "undefined") return;
    if (!fallbackCtx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      fallbackCtx = new Ctx();
    }
    const ctx = fallbackCtx;
    const notes = success ? [880, 1175, 1568] : [520, 392];
    notes.forEach((freq, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = "sine";
      o.frequency.value = freq;
      const t0 = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
      o.start(t0);
      o.stop(t0 + 0.34);
    });
  } catch {/* noop */}
}

function playOnce(success: boolean) {
  // Try primary first; if it fails or is known-broken, use embedded WAV; then oscillator.
  const tryEl = (el: HTMLAudioElement | null) => {
    if (!el) return Promise.reject(new Error("no el"));
    try {
      el.currentTime = 0;
      const p = el.play();
      return p instanceof Promise ? p : Promise.resolve();
    } catch (e) { return Promise.reject(e); }
  };
  const primary = primaryWorks ? getPrimary() : null;
  tryEl(primary).catch(() => {
    primaryWorks = false;
    return tryEl(getFallback()).catch(() => oscillatorBeep(success));
  });
}

/** Play a single short cue (used between continuous cycles). */
export function playCue(success: boolean) {
  playOnce(success);
}

/** Start a repeating, dismissable alert (used at end of normal session). */
export function startAlertSound(success: boolean) {
  stopAlertSound();
  playOnce(success);
  loopTimer = setInterval(() => playOnce(success), 4000);
  autoStop = setTimeout(() => stopAlertSound(), 30000);
}

export function stopAlertSound() {
  if (loopTimer) { clearInterval(loopTimer); loopTimer = null; }
  if (autoStop) { clearTimeout(autoStop); autoStop = null; }
  for (const el of [primaryEl, fallbackEl]) {
    if (el) { try { el.pause(); el.currentTime = 0; } catch {/* noop */} }
  }
}
