import type { Application } from "./types";

export interface Analytics {
  total: number;
  byStatus: Record<string, number>;
  byCountry: Record<string, number>;
  byRole: Record<string, number>;
  perWeek: { week: string; count: number }[];
  applied: number;
  interviewed: number;
  offers: number;
  rejected: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  rejectionRate: number;
  active: number;
  pinned: number;
}

export function computeAnalytics(apps: Application[]): Analytics {
  const byStatus: Record<string, number> = {};
  const byCountry: Record<string, number> = {};
  const byRole: Record<string, number> = {};
  const weekMap = new Map<string, number>();
  for (const a of apps) {
    byStatus[a.status] = (byStatus[a.status] || 0) + 1;
    byCountry[a.country] = (byCountry[a.country] || 0) + 1;
    byRole[a.role] = (byRole[a.role] || 0) + 1;
    const d = new Date(a.createdAt);
    const week = isoWeekKey(d);
    weekMap.set(week, (weekMap.get(week) || 0) + 1);
  }
  const total = apps.length;
  const applied = (byStatus["APPLIED"] || 0) + (byStatus["INTERVIEW"] || 0) + (byStatus["FOLLOW-UP"] || 0)
    + (byStatus["OFFER"] || 0) + (byStatus["REJECTED"] || 0) + (byStatus["ASSESSMENT"] || 0) + (byStatus["WAITING"] || 0);
  const interviewed = (byStatus["INTERVIEW"] || 0) + (byStatus["OFFER"] || 0) + (byStatus["ASSESSMENT"] || 0);
  const offers = byStatus["OFFER"] || 0;
  const rejected = byStatus["REJECTED"] || 0;
  const responses = interviewed + rejected + (byStatus["FOLLOW-UP"] || 0);
  return {
    total, byStatus, byCountry, byRole,
    perWeek: [...weekMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([week, count]) => ({ week, count })),
    applied, interviewed, offers, rejected,
    responseRate: applied ? responses / applied : 0,
    interviewRate: applied ? interviewed / applied : 0,
    offerRate: applied ? offers / applied : 0,
    rejectionRate: applied ? rejected / applied : 0,
    active: apps.filter((a) => !a.archived && a.status !== "REJECTED").length,
    pinned: apps.filter((a) => a.pinned).length,
  };
}

function isoWeekKey(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}
