import { openDB, type IDBPDatabase } from "idb";
import type { Application, ActivityEntry, FilterPreset, TimerState, Settings } from "./types";
import { defaultTimer } from "./types";

const DB_NAME = "career-board";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("DB only available in browser"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("apps")) {
          const s = db.createObjectStore("apps", { keyPath: "id" });
          s.createIndex("updatedAt", "updatedAt");
          s.createIndex("status", "status");
        }
        if (!db.objectStoreNames.contains("activity")) {
          db.createObjectStore("activity", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("kv")) {
          db.createObjectStore("kv");
        }
        if (!db.objectStoreNames.contains("presets")) {
          db.createObjectStore("presets", { keyPath: "id" });
        }
      },
    }).catch((e) => {
      console.error("[db] failed to open IndexedDB, falling back to localStorage", e);
      // Reset cache so a future call retries instead of returning a permanently-rejected promise.
      dbPromise = null;
      throw e;
    });
  }
  return dbPromise;
}

// Request persistent storage so the browser does not evict IndexedDB
// (Safari ITP, Chrome storage pressure, etc.). Safe to call repeatedly.
let persistGranted = false;
export async function requestPersistentStorage(): Promise<boolean> {
  if (persistGranted) return true;
  try {
    if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
      const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      if (already) { persistGranted = true; return true; }
      const granted = await navigator.storage.persist();
      if (granted) persistGranted = true;
      return granted;
    }
  } catch {/* ignore */}
  return false;
}

// Re-attempt persistent-storage grant on first user gesture (browsers often
// only grant it after interaction).
if (typeof window !== "undefined") {
  const tryPersist = () => { requestPersistentStorage().catch(() => {}); };
  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    window.addEventListener(ev, tryPersist, { once: true, passive: true })
  );
}

// ----- Internal: restore from LS into IDB -----
async function restoreToIDB<T>(store: "apps" | "activity" | "presets", rows: T[]) {
  try {
    const db = await getDB();
    const tx = db.transaction(store, "readwrite");
    await Promise.all(rows.map((r) => tx.store.put(r as never)));
    await tx.done;
  } catch {/* ignore */}
}

// ============= Apps =============
export async function getAllApps(): Promise<Application[]> {
  let fromIdb: Application[] | null = null;
  try {
    const db = await getDB();
    fromIdb = await db.getAll("apps");
  } catch {
    fromIdb = null;
  }
  const fromLs = readLS("apps", [] as Application[]);
  // Recovery: if IDB is empty/unavailable but LS backup has data, restore.
  if ((!fromIdb || fromIdb.length === 0) && fromLs.length > 0) {
    await restoreToIDB("apps", fromLs);
    return fromLs;
  }
  // Keep LS in sync if it's stale relative to IDB.
  if (fromIdb && fromIdb.length > 0 && fromLs.length === 0) {
    writeLS("apps", fromIdb);
  }
  return fromIdb ?? fromLs;
}

export async function putApp(app: Application) {
  try {
    const db = await getDB();
    await db.put("apps", app);
  } catch {/* ignore */}
  // mirror to LS as backup using read-modify-write on LS only (avoid
  // re-reading IDB which can be slow under load).
  const arr = readLS<Application[]>("apps", []);
  const idx = arr.findIndex((a) => a.id === app.id);
  if (idx >= 0) arr[idx] = app; else arr.push(app);
  writeLS("apps", arr);
}

export async function deleteApp(id: string) {
  try {
    const db = await getDB();
    await db.delete("apps", id);
  } catch {/* ignore */}
  writeLS("apps", readLS<Application[]>("apps", []).filter((a) => a.id !== id));
}

export async function bulkPutApps(apps: Application[]) {
  try {
    const db = await getDB();
    const tx = db.transaction("apps", "readwrite");
    await Promise.all(apps.map((a) => tx.store.put(a)));
    await tx.done;
  } catch {/* ignore */}
  writeLS("apps", apps);
}

export async function clearAllApps() {
  try {
    const db = await getDB();
    await db.clear("apps");
  } catch {/* ignore */}
  writeLS("apps", []);
}

// ============= Activity =============
export async function getAllActivity(): Promise<ActivityEntry[]> {
  let fromIdb: ActivityEntry[] | null = null;
  try {
    const db = await getDB();
    fromIdb = await db.getAll("activity");
  } catch {
    fromIdb = null;
  }
  const fromLs = readLS("activity", [] as ActivityEntry[]);
  if ((!fromIdb || fromIdb.length === 0) && fromLs.length > 0) {
    await restoreToIDB("activity", fromLs);
    return [...fromLs].sort((a, b) => b.ts.localeCompare(a.ts));
  }
  const all = fromIdb ?? fromLs;
  return [...all].sort((a, b) => b.ts.localeCompare(a.ts));
}
export async function pushActivity(e: ActivityEntry) {
  try {
    const db = await getDB();
    await db.put("activity", e);
  } catch {/* ignore */}
  const arr = readLS<ActivityEntry[]>("activity", []);
  arr.unshift(e);
  writeLS("activity", arr.slice(0, 1000));
}

// ============= KV (timer, settings) =============
export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  let fromIdb: T | undefined;
  try {
    const db = await getDB();
    fromIdb = (await db.get("kv", key)) as T | undefined;
  } catch {
    fromIdb = undefined;
  }
  if (fromIdb !== undefined && fromIdb !== null) return fromIdb;
  // LS recovery — and migrate back into IDB
  const ls = readLS<T | undefined>(`kv:${key}`, undefined);
  if (ls !== undefined && ls !== null) {
    try {
      const db = await getDB();
      await db.put("kv", ls, key);
    } catch {/* ignore */}
    return ls;
  }
  return fallback;
}
export async function kvSet<T>(key: string, value: T) {
  try {
    const db = await getDB();
    await db.put("kv", value, key);
  } catch {/* ignore */}
  writeLS(`kv:${key}`, value);
}

export async function getTimer(): Promise<TimerState> {
  return kvGet("timer", defaultTimer());
}
export async function setTimer(t: TimerState) {
  return kvSet("timer", t);
}
export async function getSettings(): Promise<Settings> {
  return kvGet<Settings>("settings", { notifications: true, sound: true, theme: "dark" });
}
export async function setSettings(s: Settings) {
  return kvSet("settings", s);
}

// ============= Presets =============
export async function getPresets(): Promise<FilterPreset[]> {
  let fromIdb: FilterPreset[] | null = null;
  try {
    const db = await getDB();
    fromIdb = await db.getAll("presets");
  } catch {
    fromIdb = null;
  }
  const fromLs = readLS("presets", [] as FilterPreset[]);
  if ((!fromIdb || fromIdb.length === 0) && fromLs.length > 0) {
    await restoreToIDB("presets", fromLs);
    return fromLs;
  }
  return fromIdb ?? fromLs;
}
export async function putPreset(p: FilterPreset) {
  try {
    const db = await getDB();
    await db.put("presets", p);
  } catch {/* ignore */}
  const arr = readLS<FilterPreset[]>("presets", []);
  const idx = arr.findIndex((x) => x.id === p.id);
  if (idx >= 0) arr[idx] = p; else arr.push(p);
  writeLS("presets", arr);
}
export async function deletePreset(id: string) {
  try {
    const db = await getDB();
    await db.delete("presets", id);
  } catch {/* ignore */}
  writeLS("presets", readLS<FilterPreset[]>("presets", []).filter((p) => p.id !== id));
}

// ============= LS helpers =============
function readLS<T>(key: string, fallback: T): T {
  if (typeof localStorage === "undefined") return fallback;
  try {
    const v = localStorage.getItem(`cb:${key}`);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch { return fallback; }
}
function writeLS<T>(key: string, value: T) {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(`cb:${key}`, JSON.stringify(value)); } catch {/* quota */}
}
