import { useStore, dismissSessionSummary } from "@/lib/store";
import type { SessionState } from "@/lib/types";

export function SessionSummary() {
  const summary = useStore((s) => s.sessionSummary);
  if (!summary) return null;
  return <SummaryModal session={summary} onClose={dismissSessionSummary} />;
}

function fmt(secs: number) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function SummaryModal({ session, onClose }: { session: SessionState; onClose: () => void }) {
  const totalCycles = session.cycles.length;
  const successCycles = session.cycles.filter((c) => c.success).length;
  const failedCycles = totalCycles - successCycles;
  const successRate = totalCycles ? Math.round((successCycles / totalCycles) * 100) : 0;
  const start = session.startedAt ? new Date(session.startedAt).getTime() : 0;
  const end = session.endedAt ? new Date(session.endedAt).getTime() : Date.now();
  const totalSec = Math.max(1, Math.round((end - start) / 1000));
  const perHour = (n: number) => (n / (totalSec / 3600)).toFixed(1);
  const avgAdded = totalCycles ? (session.cycles.reduce((s, c) => s + c.added, 0) / totalCycles).toFixed(1) : "0.0";
  const avgApplied = totalCycles ? (session.cycles.reduce((s, c) => s + c.applied, 0) / totalCycles).toFixed(1) : "0.0";

  const isContinuous = session.kind === "CONTINUOUS";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3 bg-black/55 backdrop-blur-sm">
      <div className="board-frame max-w-2xl w-full max-h-[88vh] overflow-auto scroll-thin">
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flap-text text-[10px] tracking-[0.3em] text-muted-foreground">SESSION SUMMARY</div>
              <div className="flap-text text-amber text-xl tracking-[0.25em] mt-1">
                {session.kind} · {session.mode}
              </div>
            </div>
            <button onClick={onClose} className="px-3 py-1.5 rounded border border-border hover:bg-accent flap-text text-[10px] tracking-[0.25em]">CLOSE</button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Stat label="DURATION" value={fmt(totalSec)} />
            <Stat label="JOBS ADDED" value={session.addedTotal} />
            <Stat label="APPLIED" value={session.appliedTotal} />
            <Stat label="JOBS / HR" value={perHour(session.addedTotal)} />
            <Stat label="APPLIED / HR" value={perHour(session.appliedTotal)} />
            <Stat label="GOAL MODE" value={session.mode} />
            <Stat label="CYCLES" value={totalCycles} />
            <Stat label="MODE" value={session.kind} />
          </div>

          {isContinuous && totalCycles > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <Stat label="SUCCESSFUL" value={successCycles} />
                <Stat label="FAILED" value={failedCycles} />
                <Stat label="SUCCESS RATE" value={`${successRate}%`} />
                <Stat label="LONGEST STREAK" value={session.longestStreak} />
                <Stat label="AVG JOBS / CYCLE" value={avgAdded} />
                <Stat label="AVG APPLIED / CYCLE" value={avgApplied} />
                <Stat label="CYCLE LENGTH" value={`${Math.round(session.intendedDurationSec / 60)}M`} />
                <Stat label="FINAL STREAK" value={session.currentStreak} />
              </div>

              <div className="board-tile rounded border border-board-divider p-3">
                <div className="flap-text text-[10px] tracking-[0.25em] text-muted-foreground mb-2">CYCLE TIMELINE</div>
                <div className="space-y-1 max-h-64 overflow-auto scroll-thin pr-1">
                  {session.cycles.slice().reverse().map((c) => (
                    <div key={c.idx} className={`flex items-center gap-2 text-[11px] flap-text tracking-[0.15em] px-2 py-1 rounded border ${c.success ? "border-amber/40 bg-amber/5" : "border-destructive/40 bg-destructive/5"}`}>
                      <span className="tabular-nums w-10 text-muted-foreground">#{String(c.idx).padStart(2, "0")}</span>
                      <span className={c.success ? "text-amber" : "text-destructive"}>{c.success ? "✓" : "✗"}</span>
                      <span className="text-muted-foreground">{c.mode}</span>
                      <span className="ml-auto tabular-nums">+{c.added} JOBS · +{c.applied} APPLIED</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="text-[10px] flap-text tracking-[0.2em] text-muted-foreground leading-relaxed">
            SESSION ANALYTICS ARE TRANSIENT — THEY RESET ON THE NEXT SESSION START.
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="board-tile rounded border border-board-divider p-2.5">
      <div className="flap-text text-[9px] tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className="flap-text tabular-nums text-base text-amber mt-0.5">{value}</div>
    </div>
  );
}
