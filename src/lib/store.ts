import { useEffect, useSyncExternalStore } from "react";
import type { Application, ActivityEntry, FilterPreset, FilterState, TimerState, Settings, SessionState, CycleResult } from "./types";
import { emptyFilters, defaultTimer, defaultSession } from "./types";
import * as db from "./db";
import { buildSeed } from "./seed";
import { startAlertSound, stopAlertSound, unlockAudio, bindAutoUnlock, playCue } from "./audio";

interface State {
  ready: boolean;
  apps: Application[];
  activity: ActivityEntry[];
  presets: FilterPreset[];
  timer: TimerState;
  session: SessionState;
  sessionSummary: SessionState | null; // shown in summary modal after a session ends
  settings: Settings;
  filters: FilterState;
  selectedId: string | null;
  view: View;
  filterPanelOpen: boolean;
  quickAddOpen: boolean;
  menuOpen: boolean;
  alertActive: boolean;
}

export type View = "DASHBOARD" | "APPLICATIONS" | "ANALYTICS" | "ACTIVITY" | "TIMER" | "EXPORTS" | "DOCUMENTS" | "ARCHIVE" | "SETTINGS";

const state: State = {
  ready: false,
  apps: [],
  activity: [],
  presets: [],
  timer: defaultTimer(),
  session: defaultSession(),
  sessionSummary: null,
  settings: { notifications: true, sound: true, theme: "dark" },
  filters: emptyFilters(),
  selectedId: null,
  view: "DASHBOARD",
  filterPanelOpen: false,
  quickAddOpen: false,
  menuOpen: false,
  alertActive: false,
};

const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }

export function getState(): Readonly<State> { return state; }
export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => sel(state),
    () => sel(state),
  );
}

let timerInterval: ReturnType<typeof setInterval> | null = null;

export async function initStore() {
  if (state.ready) return;
  // Ask the browser to keep our IndexedDB data persistent (no eviction).
  db.requestPersistentStorage().catch(() => {});
  // Try to auto-unlock audio on the first user gesture.
  bindAutoUnlock();
  // First-run sentinel — once set, we NEVER auto-seed again,
  // even if IndexedDB is momentarily empty (eviction, new profile, etc.).
  const SEEDED_KEY = "cb:seeded";
  const hasSeededFlag = typeof localStorage !== "undefined" && localStorage.getItem(SEEDED_KEY) === "1";
  let apps = await db.getAllApps();
  if (apps.length === 0 && !hasSeededFlag) {
    apps = buildSeed();
    await db.bulkPutApps(apps);
    await pushActivity("SYSTEM", "Seeded initial sample applications");
    if (typeof localStorage !== "undefined") localStorage.setItem(SEEDED_KEY, "1");
  } else if (!hasSeededFlag && typeof localStorage !== "undefined") {
    // Returning user with existing data — mark as seeded so we never overwrite.
    localStorage.setItem(SEEDED_KEY, "1");
  }
  state.apps = apps.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  state.activity = await db.getAllActivity();
  state.presets = await db.getPresets();
  state.timer = { ...defaultTimer(), ...(await db.getTimer()) };
  state.settings = await db.getSettings();
  // resume running timer
  if (state.timer.running && state.timer.startedAt) {
    const elapsed = Math.floor((Date.now() - new Date(state.timer.startedAt).getTime()) / 1000);
    state.timer.remainingSec = Math.max(0, state.timer.remainingSec - elapsed);
    state.timer.startedAt = new Date().toISOString();
    if (state.timer.remainingSec === 0) {
      state.timer.running = false;
    }
    await db.setTimer(state.timer);
  }
  startTimerLoop();
  state.ready = true;
  emit();
}

// Activity helper
async function pushActivity(kind: string, text: string, appId?: string) {
  const e: ActivityEntry = { id: cryptoId(), ts: new Date().toISOString(), kind, text, appId };
  await db.pushActivity(e);
  state.activity = [e, ...state.activity].slice(0, 1000);
}

export function cryptoId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// Apps mutations
export async function addApp(partial: Partial<Application>) {
  const now = new Date().toISOString();
  const app: Application = {
    id: cryptoId(),
    company: partial.company || "UNTITLED",
    country: partial.country || "—",
    role: partial.role || "ROLE",
    status: partial.status || "SAVED",
    pinned: false,
    archived: false,
    tags: [], stages: [], reminders: [], docs: [],
    createdAt: now, updatedAt: now,
    statusChangedAt: now,
    statusHistory: [{ id: cryptoId(), status: partial.status || "SAVED", ts: now }],
    ...partial,
  };
  // ensure required fields exist even if `partial` overrode them
  if (!app.statusHistory || app.statusHistory.length === 0) {
    app.statusHistory = [{ id: cryptoId(), status: app.status, ts: now }];
  }
  if (!app.statusChangedAt) app.statusChangedAt = now;
  state.apps = [...state.apps, app];
  await db.putApp(app);
  await pushActivity("ADD", `Added ${app.company} — ${app.role}`, app.id);
  emit();
  return app;
}

const saveDebounce = new Map<string, ReturnType<typeof setTimeout>>();
export function updateApp(id: string, patch: Partial<Application>, opts: { activity?: string } = {}) {
  const idx = state.apps.findIndex((a) => a.id === id);
  if (idx === -1) return;
  const prev = state.apps[idx];
  const now = new Date().toISOString();
  const next: Application = { ...prev, ...patch, updatedAt: now };
  if (patch.status && patch.status !== prev.status) {
    next.statusChangedAt = now;
    const evt = { id: cryptoId(), status: patch.status, ts: now, from: prev.status };
    next.statusHistory = [...(prev.statusHistory || []), evt];
    pushActivity("STATUS", `${next.company}: ${prev.status} → ${patch.status}`, id);
    if (patch.status === "APPLIED" && !next.appliedAt) {
      next.appliedAt = now;
    }
  }
  state.apps = [...state.apps.slice(0, idx), next, ...state.apps.slice(idx + 1)];
  if (patch.pinned !== undefined && patch.pinned !== prev.pinned) {
    pushActivity("PIN", `${patch.pinned ? "Pinned" : "Unpinned"} ${next.company}`, id);
  }
  if (opts.activity) pushActivity("EDIT", opts.activity, id);
  emit();
  // debounced persistence
  const t = saveDebounce.get(id);
  if (t) clearTimeout(t);
  saveDebounce.set(id, setTimeout(() => { db.putApp(next); saveDebounce.delete(id); }, 250));
}

export async function removeApp(id: string) {
  const app = state.apps.find((a) => a.id === id);
  state.apps = state.apps.filter((a) => a.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  await db.deleteApp(id);
  if (app) await pushActivity("DELETE", `Deleted ${app.company}`, id);
  emit();
}

export function selectApp(id: string | null) {
  state.selectedId = id;
  emit();
}

// Filters
export function setFilters(f: Partial<FilterState>) {
  state.filters = { ...state.filters, ...f };
  emit();
}
export function resetFilters() {
  state.filters = emptyFilters();
  emit();
}
export function setSearch(q: string) {
  state.filters = { ...state.filters, search: q };
  emit();
}

export async function savePreset(name: string) {
  const p: FilterPreset = { id: cryptoId(), name, filters: state.filters };
  state.presets = [...state.presets, p];
  await db.putPreset(p);
  emit();
}
export async function applyPreset(id: string) {
  const p = state.presets.find((x) => x.id === id);
  if (p) { state.filters = { ...p.filters }; emit(); }
}
export async function removePreset(id: string) {
  state.presets = state.presets.filter((p) => p.id !== id);
  await db.deletePreset(id);
  emit();
}

// View
export function setView(v: View) {
  state.view = v;
  state.menuOpen = false;
  emit();
}
export function setFilterPanelOpen(o: boolean) { state.filterPanelOpen = o; emit(); }
export function setQuickAddOpen(o: boolean) { state.quickAddOpen = o; emit(); }
export function setMenuOpen(o: boolean) { state.menuOpen = o; emit(); }

// Settings
export async function updateSettings(p: Partial<Settings>) {
  state.settings = { ...state.settings, ...p };
  await db.setSettings(state.settings);
  emit();
}

// ===== Timer =====
// CRITICAL: every mutation must replace state.timer with a NEW object so
// useSyncExternalStore selectors that return s.timer detect the change.
function setTimer(patch: Partial<TimerState>, persist = true) {
  state.timer = { ...state.timer, ...patch };
  if (persist) db.setTimer(state.timer);
  emit();
}

function startTimerLoop() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    if (!state.timer.running) return;
    const remaining = Math.max(0, state.timer.remainingSec - 1);
    const totalFocus = state.timer.totalFocusSec + 1;
    if (remaining === 0) {
      state.timer = { ...state.timer, remainingSec: 0, totalFocusSec: totalFocus };
      finishCycle();
    } else {
      state.timer = { ...state.timer, remainingSec: remaining, totalFocusSec: totalFocus };
      if (remaining % 5 === 0) db.setTimer(state.timer);
      emit();
    }
  }, 1000);
}

export function startTimer() {
  const isResume = state.timer.remainingSec > 0 && state.timer.remainingSec < state.timer.durationSec;
  const now = new Date().toISOString();
  // Start a new session if there isn't an active one (or if user pressed start fresh)
  if (!state.session.active || !isResume) {
    state.session = {
      ...defaultSession(),
      active: true,
      kind: state.timer.kind,
      mode: state.timer.mode,
      startedAt: now,
      intendedDurationSec: state.timer.durationSec,
      baseAppsCount: state.apps.length,
      baseAppliedCount: state.apps.filter((a) => !!a.appliedAt).length,
      cycleBaseAppsCount: state.apps.length,
      cycleBaseAppliedCount: state.apps.filter((a) => !!a.appliedAt).length,
    };
  } else {
    state.session = { ...state.session, kind: state.timer.kind, mode: state.timer.mode };
  }
  setTimer({
    remainingSec: isResume ? state.timer.remainingSec : state.timer.durationSec,
    running: true,
    startedAt: now,
    cycleStartedAt: state.timer.cycleStartedAt ?? now,
    cycleStartCount: isResume ? state.timer.cycleStartCount : currentCycleBaseline(),
  });
  pushActivity("TIMER", `Started ${state.timer.kind} ${state.timer.mode} session (${state.timer.durationSec / 60}m)`);
}
export function pauseTimer() { setTimer({ running: false }); }
export function resetTimer() {
  stopAlert();
  setTimer({ running: false, remainingSec: state.timer.durationSec, cycleStartedAt: undefined });
}

export function stopSession() {
  // Manually end an in-progress session (esp. continuous mode).
  stopAlert();
  if (state.session.active) {
    const ended: SessionState = {
      ...state.session,
      active: false,
      endedAt: new Date().toISOString(),
      addedTotal: Math.max(0, state.apps.length - state.session.baseAppsCount),
      appliedTotal: Math.max(0, state.apps.filter((a) => !!a.appliedAt).length - state.session.baseAppliedCount),
    };
    state.session = ended;
    state.sessionSummary = ended;
    pushActivity("TIMER", `Ended ${ended.kind} session — ${ended.cycles.length} cycle(s)`);
  }
  setTimer({ running: false, remainingSec: state.timer.durationSec, cycleStartedAt: undefined });
}

export function dismissSessionSummary() {
  stopAlert();
  state.sessionSummary = null;
  emit();
}

export function setTimerMode(m: "SEARCH" | "APPLY") {
  setTimer({ mode: m, cycleStartCount: currentCycleBaseline() });
  if (state.session.active) state.session = { ...state.session, mode: m };
}
export function setTimerKind(k: "NORMAL" | "CONTINUOUS") {
  setTimer({ kind: k });
  if (state.session.active) state.session = { ...state.session, kind: k };
}
export function setTimerDuration(sec: number) {
  const dur = Math.max(60, Math.floor(sec));
  setTimer({
    durationSec: dur,
    remainingSec: state.timer.running ? state.timer.remainingSec : dur,
  });
  if (state.session.active) state.session = { ...state.session, intendedDurationSec: dur };
}
export function toggleTimerSound() { setTimer({ soundOn: !state.timer.soundOn }); }

function currentCycleBaseline(): number {
  if (state.timer.mode === "SEARCH") return state.apps.length;
  return state.apps.filter((a) => !!a.appliedAt).length;
}

function finishCycle() {
  const t = state.timer;
  const sess = state.session;
  const appsNow = state.apps;
  const appliedNow = appsNow.filter((a) => !!a.appliedAt).length;
  const added = Math.max(0, appsNow.length - sess.cycleBaseAppsCount);
  const applied = Math.max(0, appliedNow - sess.cycleBaseAppliedCount);
  const success = t.mode === "SEARCH" ? added >= 1 : applied >= 1;
  const now = new Date().toISOString();
  const startedIso = t.cycleStartedAt ?? sess.startedAt ?? now;
  const cycle: CycleResult = {
    idx: sess.cycles.length + 1,
    startedAt: startedIso,
    endedAt: now,
    durationSec: t.durationSec,
    mode: t.mode,
    added,
    applied,
    success,
  };
  // Update session (cap to 200 cycles in memory)
  const newStreak = success ? sess.currentStreak + 1 : 0;
  const updatedSession: SessionState = {
    ...sess,
    cycles: [...sess.cycles, cycle].slice(-200),
    currentStreak: newStreak,
    longestStreak: Math.max(sess.longestStreak, newStreak),
    addedTotal: Math.max(0, appsNow.length - sess.baseAppsCount),
    appliedTotal: Math.max(0, appliedNow - sess.baseAppliedCount),
  };
  state.session = updatedSession;
  // Update aggregate timer counters (lifetime, lightweight)
  state.timer = {
    ...t,
    running: false,
    totalCycles: t.totalCycles + 1,
    successCycles: t.successCycles + (success ? 1 : 0),
    missedCycles: t.missedCycles + (success ? 0 : 1),
    remainingSec: t.durationSec,
    cycleStartedAt: undefined,
  };
  db.setTimer(state.timer);
  pushActivity("TIMER", `${t.mode} cycle ${success ? "✓ success" : "✗ missed"} (+${added} jobs, +${applied} applied)`);

  if (t.kind === "CONTINUOUS") {
    // Brief notification + auto-restart next cycle
    notify(success ? "Cycle complete — next starting" : "Cycle missed — next starting",
      success ? `${t.mode} goal met. New cycle begins.` : `No ${t.mode === "SEARCH" ? "jobs" : "applications"} this cycle. Pressure on.`);
    // Continuous mode: play reminder ONCE per cycle (not a repeating alert).
    // Ensures sound fires every cycle without overlapping previous loops.
    stopAlertSound();
    if (state.timer.soundOn) playCue(success);
    // Auto-start next cycle
    const next = new Date().toISOString();
    state.timer = {
      ...state.timer,
      running: true,
      startedAt: next,
      cycleStartedAt: next,
      remainingSec: state.timer.durationSec,
      cycleStartCount: currentCycleBaseline(),
    };
    state.session = {
      ...state.session,
      cycleBaseAppsCount: state.apps.length,
      cycleBaseAppliedCount: appliedNow,
    };
    db.setTimer(state.timer);
    emit();
    return;
  }

  // Normal mode: end the session, show summary
  notify(success ? "Session complete" : "Session ended",
    success ? `Great work — ${t.mode} goal met` : `No new ${t.mode === "SEARCH" ? "jobs" : "applications"} this cycle`);
  if (state.timer.soundOn) startAlertSound(success, { intervalMs: 3000, maxMs: null });
  state.alertActive = true;
  const ended: SessionState = {
    ...state.session,
    active: false,
    endedAt: now,
  };
  state.session = ended;
  state.sessionSummary = ended;
  emit();
}

function notify(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (!state.settings.notifications) return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") new Notification(title, { body });
  else if (Notification.permission !== "denied") Notification.requestPermission();
}

export function requestNotifPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") Notification.requestPermission();
}

// ===== Repeating, dismissable alert (uses bundled audio file) =====
export async function unlockTimerSound(): Promise<boolean> {
  return unlockAudio();
}

export function stopAlert() {
  stopAlertSound();
  if (state.alertActive) {
    state.alertActive = false;
    emit();
  }
}

// React hook to init
export function useInitStore() {
  const ready = useStore((s) => s.ready);
  useEffect(() => { initStore(); }, []);
  return ready;
}

function sanitizeApp(a: Application): Application | null {
  if (!a || !a.id || !a.company) return null;
  const now = new Date().toISOString();
  return {
    ...a,
    pinned: a.pinned ?? false,
    archived: a.archived ?? false,
    tags: a.tags ?? [],
    stages: a.stages ?? [],
    reminders: a.reminders ?? [],
    docs: a.docs ?? [],
    createdAt: a.createdAt ?? now,
    updatedAt: a.updatedAt ?? now,
    status: a.status ?? "SAVED",
  };
}

function dedupeKey(a: Application): string {
  // Stable identity: prefer id, then external link, then triple of normalized fields.
  const norm = (s?: string) => (s || "").trim().toLowerCase();
  if (a.link) return `link:${norm(a.link)}`;
  return `crc:${norm(a.company)}|${norm(a.role)}|${norm(a.country)}`;
}

export async function bulkImport(apps: Application[]) {
  // MERGE — preserve all existing records; add imported ones.
  // Dedupe by id first, then by link / company+role+country to avoid creating duplicates.
  const byId = new Map(state.apps.map((a) => [a.id, a]));
  const byKey = new Map(state.apps.map((a) => [dedupeKey(a), a]));
  let added = 0;
  let updated = 0;
  for (const raw of apps) {
    const merged = sanitizeApp(raw);
    if (!merged) continue;
    if (byId.has(merged.id)) {
      // Same id — keep newer updatedAt to avoid reverting edits.
      const existing = byId.get(merged.id)!;
      const winner = (merged.updatedAt || "") > (existing.updatedAt || "") ? merged : existing;
      byId.set(merged.id, winner);
      byKey.set(dedupeKey(winner), winner);
      updated++;
      continue;
    }
    const k = dedupeKey(merged);
    const dupe = byKey.get(k);
    if (dupe) {
      // Same logical record — keep existing id, take newer fields.
      const winner: Application = (merged.updatedAt || "") > (dupe.updatedAt || "")
        ? { ...merged, id: dupe.id }
        : dupe;
      byId.set(dupe.id, winner);
      byKey.set(k, winner);
      updated++;
    } else {
      byId.set(merged.id, merged);
      byKey.set(k, merged);
      added++;
    }
  }
  state.apps = [...byId.values()];
  await db.bulkPutApps(state.apps);
  await pushActivity("IMPORT", `Merged ${added} new, ${updated} updated`);
  emit();
}

// Optional restore of secondary stores from a full backup payload.
export async function bulkImportExtras(payload: {
  activity?: ActivityEntry[];
  presets?: FilterPreset[];
  settings?: Settings;
  timer?: Partial<TimerState>;
}, mode: "REPLACE" | "MERGE" = "REPLACE") {
  if (payload.settings) {
    state.settings = { ...state.settings, ...payload.settings };
    await db.setSettings(state.settings);
  }
  if (payload.timer) {
    // never resume an old running timer mid-import
    state.timer = { ...defaultTimer(), ...payload.timer, running: false };
    await db.setTimer(state.timer);
  }
  if (payload.activity && Array.isArray(payload.activity)) {
    if (mode === "REPLACE") {
      try { const d = await db.getDB(); await d.clear("activity"); } catch {/* ignore */}
      state.activity = [...payload.activity].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 1000);
    } else {
      const seen = new Set(state.activity.map((e) => e.id));
      const merged = [...state.activity];
      for (const e of payload.activity) if (!seen.has(e.id)) merged.push(e);
      state.activity = merged.sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 1000);
    }
    for (const e of state.activity) await db.pushActivity(e);
  }
  if (payload.presets && Array.isArray(payload.presets)) {
    if (mode === "REPLACE") {
      try { const d = await db.getDB(); await d.clear("presets"); } catch {/* ignore */}
      state.presets = [...payload.presets];
    } else {
      const ids = new Set(state.presets.map((p) => p.id));
      state.presets = [...state.presets, ...payload.presets.filter((p) => !ids.has(p.id))];
    }
    for (const p of state.presets) await db.putPreset(p);
  }
  emit();
}

export async function bulkImportReplace(apps: Application[]) {
  // REPLACE — wipe current apps and replace with imported set
  const cleaned: Application[] = [];
  for (const raw of apps) {
    const s = sanitizeApp(raw);
    if (s) cleaned.push(s);
  }
  try {
    const d = await db.getDB();
    await d.clear("apps");
  } catch {/* ignore */}
  state.apps = cleaned;
  state.selectedId = null;
  await db.bulkPutApps(state.apps);
  await pushActivity("IMPORT", `Replaced data with ${cleaned.length} applications`);
  emit();
}

export async function wipeAll() {
  stopAlert();
  state.apps = [];
  state.activity = [];
  state.presets = [];
  state.selectedId = null;
  state.filters = emptyFilters();
  state.timer = defaultTimer();
  state.session = defaultSession();
  state.sessionSummary = null;
  // Preserve theme/font preferences across a wipe.
  const keptTheme = state.settings.theme;
  const keptFont = state.settings.font;
  state.settings = { notifications: true, sound: true, theme: keptTheme, font: keptFont };
  try {
    const d = await db.getDB();
    await Promise.all([
      d.clear("apps"),
      d.clear("activity"),
      d.clear("presets"),
      d.clear("kv"),
    ]);
  } catch {/* ignore */}
  if (typeof localStorage !== "undefined") {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("cb:") && k !== "cb:seeded") keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    // Keep the sentinel so we never re-seed sample data after a user wipe.
    localStorage.setItem("cb:seeded", "1");
  }
  await db.setTimer(state.timer);
  await db.setSettings(state.settings);
  emit();
}
