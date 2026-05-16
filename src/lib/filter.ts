import type { Application, FilterState, SortKey } from "./types";

export function applyFilters(apps: Application[], f: FilterState): Application[] {
  const q = f.search.trim().toLowerCase();
  return apps.filter((a) => {
    if (f.archivedOnly) { if (!a.archived) return false; }
    else if (!f.archivedOnly && a.archived) return false;
    if (f.favoritesOnly && !a.pinned) return false;
    if (f.activeOnly && (a.status === "REJECTED" || a.archived)) return false;
    if (f.statuses.length && !f.statuses.includes(a.status)) return false;
    if (f.countries.length && !f.countries.includes(a.country)) return false;
    if (f.companies.length && !f.companies.includes(a.company)) return false;
    if (f.roles.length && !f.roles.includes(a.role)) return false;
    if (f.tags.length && !f.tags.some((t) => a.tags.includes(t))) return false;
    if (f.dateFrom && a.createdAt < f.dateFrom) return false;
    if (f.dateTo && a.createdAt > f.dateTo + "T23:59:59") return false;
    if (q) {
      const hay = [a.company, a.role, a.country, a.status, a.notes, a.recruiter, ...(a.tags || [])]
        .filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

const STATUS_ORDER: Record<string, number> = {
  OFFER: 0, INTERVIEW: 1, ASSESSMENT: 2, "FOLLOW-UP": 3, APPLIED: 4,
  WAITING: 5, SAVED: 6, REJECTED: 7,
};

/**
 * Status-based priority bucket. Lower = higher in list.
 *  0 = OFFER (always at very top)
 *  1 = pinned/favorite active rows
 *  2 = other active rows (not SAVED, not REJECTED)
 *  3 = SAVED
 *  4 = REJECTED (always at very bottom)
 */
function priorityBucket(a: Application): number {
  if (a.status === "OFFER") return 0;
  if (a.status === "REJECTED") return 4;
  if (a.status === "SAVED") return 3;
  if (a.pinned) return 1;
  return 2;
}

export function applySort(apps: Application[], key: SortKey, dir: "asc" | "desc"): Application[] {
  const arr = [...apps];
  const sign = dir === "asc" ? 1 : -1;
  const cmpStr = (a: string, b: string) => a.localeCompare(b);
  // Status-priority bucketing (OFFER top, REJECTED bottom, SAVED near bottom,
  // pinned floats) applies ONLY when the user is explicitly sorting by Status.
  // For every other sort key we honor the user's chosen order purely.
  const useBuckets = key === "status";
  arr.sort((a, b) => {
    if (useBuckets) {
      const pa = priorityBucket(a);
      const pb = priorityBucket(b);
      if (pa !== pb) return pa - pb;
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    }
    switch (key) {
      case "status":
        return sign * ((STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99));
      case "company": return sign * cmpStr(a.company, b.company);
      case "country": return sign * cmpStr(a.country, b.country);
      case "role":    return sign * cmpStr(a.role, b.role);
      case "newest":  return -1 * sign * cmpStr(a.createdAt, b.createdAt);
      case "oldest":  return sign * cmpStr(a.createdAt, b.createdAt);
      case "updated": return -1 * sign * cmpStr(a.updatedAt, b.updatedAt);
      case "favorites":
        // Explicit favorite-first sort — pinned at the top, then by creation.
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return cmpStr(a.createdAt, b.createdAt);
      case "default":
      default:
        return cmpStr(a.createdAt, b.createdAt);
    }
  });
  return arr;
}
