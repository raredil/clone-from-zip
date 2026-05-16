export type Status =
  | "APPLIED"
  | "INTERVIEW"
  | "FOLLOW-UP"
  | "SAVED"
  | "OFFER"
  | "REJECTED"
  | "WAITING"
  | "ASSESSMENT";

export const ALL_STATUSES: Status[] = [
  "APPLIED", "INTERVIEW", "FOLLOW-UP", "SAVED", "OFFER", "REJECTED", "WAITING", "ASSESSMENT",
];

export interface InterviewStage {
  id: string;
  name: string;
  date?: string;
  notes?: string;
  done: boolean;
}

export interface Reminder {
  id: string;
  text: string;
  due: string; // ISO
  done: boolean;
}

export interface DocLink {
  id: string;
  name: string;
  url: string;
  /** "link" (external URL) or "file" (locally stored blob). Defaults to "link" for legacy records. */
  kind?: "link" | "file";
  /** IndexedDB blob id when kind === "file". */
  blobId?: string;
  mime?: string;
  size?: number;
  addedAt?: string;
}

export interface StatusEvent {
  id: string;
  status: Status;
  ts: string; // ISO local timestamp
  from?: Status;
}

export interface ActivityEntry {
  id: string;
  ts: string;
  kind: string;
  text: string;
  appId?: string;
}

export interface Application {
  id: string;
  company: string;
  country: string;
  role: string;
  status: Status;
  pinned: boolean;
  archived: boolean;
  salary?: string;
  recruiter?: string;
  recruiterEmail?: string;
  recruiterLinkedin?: string;
  notes?: string;
  link?: string;
  tags: string[];
  stages: InterviewStage[];
  reminders: Reminder[];
  docs: DocLink[];
  outcome?: string;
  createdAt: string;
  updatedAt: string;
  appliedAt?: string;
  statusChangedAt?: string;
  statusHistory?: StatusEvent[];
}

export interface FilterPreset {
  id: string;
  name: string;
  filters: FilterState;
}

export interface FilterState {
  statuses: Status[];
  countries: string[];
  companies: string[];
  roles: string[];
  tags: string[];
  favoritesOnly: boolean;
  activeOnly: boolean;
  archivedOnly: boolean;
  dateFrom?: string;
  dateTo?: string;
  search: string;
  sortBy?: SortKey;
  sortDir?: "asc" | "desc";
}

export type SortKey =
  | "default"
  | "status"
  | "company"
  | "country"
  | "role"
  | "newest"
  | "oldest"
  | "updated"
  | "favorites";

export const emptyFilters = (): FilterState => ({
  statuses: [], countries: [], companies: [], roles: [], tags: [],
  favoritesOnly: false, activeOnly: false, archivedOnly: false, search: "",
  sortBy: "default", sortDir: "desc",
});

export interface TimerState {
  mode: "SEARCH" | "APPLY";
  kind: "NORMAL" | "CONTINUOUS";
  durationSec: number;
  remainingSec: number;
  running: boolean;
  startedAt?: string;
  cycleStartCount: number; // count of apps (search) or applied (apply) at cycle start
  cycleStartedAt?: string;
  totalCycles: number;
  successCycles: number;
  missedCycles: number;
  totalFocusSec: number;
  soundOn: boolean;
}

export const defaultTimer = (): TimerState => ({
  mode: "SEARCH",
  kind: "NORMAL",
  durationSec: 600,
  remainingSec: 600,
  running: false,
  cycleStartCount: 0,
  totalCycles: 0,
  successCycles: 0,
  missedCycles: 0,
  totalFocusSec: 0,
  soundOn: true,
});

export interface CycleResult {
  idx: number;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  mode: "SEARCH" | "APPLY";
  added: number;
  applied: number;
  success: boolean;
}

export interface SessionState {
  active: boolean;
  kind: "NORMAL" | "CONTINUOUS";
  mode: "SEARCH" | "APPLY";
  startedAt?: string;
  endedAt?: string;
  intendedDurationSec: number; // per-cycle
  totalElapsedSec: number;
  addedTotal: number;
  appliedTotal: number;
  cycles: CycleResult[]; // capped, in-memory only
  currentStreak: number;
  longestStreak: number;
  // baselines captured at session start (apps total counts)
  baseAppsCount: number;
  baseAppliedCount: number;
  // baselines captured at current cycle start
  cycleBaseAppsCount: number;
  cycleBaseAppliedCount: number;
}

export const defaultSession = (): SessionState => ({
  active: false,
  kind: "NORMAL",
  mode: "SEARCH",
  intendedDurationSec: 600,
  totalElapsedSec: 0,
  addedTotal: 0,
  appliedTotal: 0,
  cycles: [],
  currentStreak: 0,
  longestStreak: 0,
  baseAppsCount: 0,
  baseAppliedCount: 0,
  cycleBaseAppsCount: 0,
  cycleBaseAppliedCount: 0,
});

export interface Settings {
  notifications: boolean;
  sound: boolean;
}
