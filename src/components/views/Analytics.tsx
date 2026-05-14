import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { computeAnalytics } from "@/lib/analytics";
import { applyFilters } from "@/lib/filter";

export function Analytics() {
  const apps = useStore((s) => s.apps);
  const filters = useStore((s) => s.filters);
  const timer = useStore((s) => s.timer);

  const filtered = useMemo(() => applyFilters(apps, filters), [apps, filters]);
  const a = useMemo(() => computeAnalytics(filtered), [filtered]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="TOTAL" value={a.total} />
        <Stat label="ACTIVE" value={a.active} />
        <Stat label="INTERVIEWS" value={a.interviewed} />
        <Stat label="OFFERS" value={a.offers} />
        <Stat label="RESPONSE RATE" value={pct(a.responseRate)} />
        <Stat label="INTERVIEW RATE" value={pct(a.interviewRate)} />
        <Stat label="OFFER RATE" value={pct(a.offerRate)} />
        <Stat label="REJECTION RATE" value={pct(a.rejectionRate)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Panel title="BY STATUS"><BarList data={a.byStatus} /></Panel>
        <Panel title="BY COUNTRY"><BarList data={a.byCountry} /></Panel>
        <Panel title="BY ROLE"><BarList data={a.byRole} /></Panel>
      </div>

      <Panel title="APPLICATIONS PER WEEK">
        <Sparkline points={a.perWeek.map((w) => w.count)} labels={a.perWeek.map((w) => w.week)} />
      </Panel>

      <Panel title="TIMER PRODUCTIVITY">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <Stat small label="CYCLES" value={timer.totalCycles} />
          <Stat small label="SUCCESS" value={timer.successCycles} />
          <Stat small label="MISSED" value={timer.missedCycles} />
          <Stat small label="SUCCESS RATE" value={pct(timer.totalCycles ? timer.successCycles / timer.totalCycles : 0)} />
          <Stat small label="FOCUS TIME" value={fmtSec(timer.totalFocusSec)} />
          <Stat small label="JOBS / HOUR" value={timer.totalFocusSec ? ((apps.length / (timer.totalFocusSec / 3600)) || 0).toFixed(1) : "0.0"} />
          <Stat small label="APPLIED / HOUR" value={timer.totalFocusSec ? ((apps.filter((x) => x.appliedAt).length / (timer.totalFocusSec / 3600)) || 0).toFixed(1) : "0.0"} />
          <Stat small label="MODE" value={timer.mode} />
        </div>
      </Panel>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="board-tile rounded border border-board-divider p-3">
      <div className="flap-text text-[9px] tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className={`flap-text tabular-nums ${small ? "text-base" : "text-2xl"} text-amber mt-1`}>{value}</div>
    </div>
  );
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="board-tile rounded border border-board-divider p-4">
      <div className="flap-text text-[10px] tracking-[0.25em] text-muted-foreground mb-3">{title}</div>
      {children}
    </div>
  );
}
function BarList({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map((e) => e[1]));
  if (entries.length === 0) return <div className="text-xs text-muted-foreground">No data.</div>;
  return (
    <div className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div key={k} className="flex items-center gap-2 text-xs">
          <span className="flap-text text-[10px] tracking-[0.15em] w-24 truncate">{k}</span>
          <div className="flex-1 h-2 rounded bg-input overflow-hidden">
            <div className="h-full bg-amber/70" style={{ width: `${(v / max) * 100}%` }} />
          </div>
          <span className="tabular-nums w-8 text-right text-muted-foreground">{v}</span>
        </div>
      ))}
    </div>
  );
}
function Sparkline({ points, labels }: { points: number[]; labels: string[] }) {
  if (points.length === 0) return <div className="text-xs text-muted-foreground">No data.</div>;
  const max = Math.max(1, ...points);
  const W = 100, H = 30;
  const step = points.length > 1 ? W / (points.length - 1) : W;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${(H - (p / max) * H).toFixed(2)}`).join(" ");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
        <path d={`${d} L${W},${H} L0,${H} Z`} fill="oklch(0.78 0.16 80 / 0.15)" />
        <path d={d} fill="none" stroke="oklch(0.82 0.14 80)" strokeWidth="0.6" />
      </svg>
      <div className="flex justify-between text-[9px] flap-text tracking-[0.15em] text-muted-foreground mt-1">
        <span>{labels[0]}</span><span>{labels[labels.length - 1]}</span>
      </div>
    </div>
  );
}
function pct(n: number) { return `${(n * 100).toFixed(0)}%`; }
function fmtSec(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
