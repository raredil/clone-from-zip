import { useState } from "react";
import { useStore, setTimerMode, setTimerKind, setTimerDuration, startTimer, pauseTimer, resetTimer, stopSession, toggleTimerSound, requestNotifPermission, updateSettings, unlockTimerSound } from "@/lib/store";
import type { SessionState, Application } from "@/lib/types";

export function TimerView() {
  const timer = useStore((s) => s.timer);
  const session = useStore((s) => s.session);
  const settings = useStore((s) => s.settings);
  const apps = useStore((s) => s.apps);
  const mm = String(Math.floor(timer.remainingSec / 60)).padStart(2, "0");
  const ss = String(timer.remainingSec % 60).padStart(2, "0");
  const pct = ((timer.durationSec - timer.remainingSec) / timer.durationSec) * 100;

  const goalText = timer.mode === "SEARCH"
    ? "Add at least 1 new job before the timer ends."
    : "Mark at least 1 application as Applied before the timer ends.";

  return (
    <div className="space-y-4">
      <div className="board-tile rounded border border-board-divider p-6 flex flex-col items-center gap-4">
        <div className="flap-text text-[10px] tracking-[0.3em] text-muted-foreground flex items-center gap-3">
          <span>{timer.mode === "SEARCH" ? "JOB SEARCH MODE" : "JOB APPLY MODE"}</span>
          <span className="opacity-50">·</span>
          <span className={timer.kind === "CONTINUOUS" ? "text-amber" : ""}>
            {timer.kind === "CONTINUOUS" ? "CONTINUOUS PRESSURE" : "NORMAL SESSION"}
          </span>
        </div>
        <div className="flap-text text-amber text-7xl tabular-nums leading-none">{mm}:{ss}</div>
        <div className="w-full max-w-md h-1.5 rounded bg-input overflow-hidden">
          <div className="h-full bg-amber transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flap-text text-[10px] tracking-[0.2em] text-muted-foreground text-center max-w-md">
          {goalText.toUpperCase()}
        </div>
        <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
          {!timer.running ? (
            <button onClick={startTimer} className="px-4 py-2 rounded bg-amber text-primary-foreground flap-text text-xs tracking-[0.25em]">
              {session.active ? "RESUME" : "START"}
            </button>
          ) : (
            <button onClick={pauseTimer} className="px-4 py-2 rounded border border-border hover:bg-accent flap-text text-xs tracking-[0.25em]">PAUSE</button>
          )}
          <button onClick={resetTimer} className="px-4 py-2 rounded border border-border hover:bg-accent flap-text text-xs tracking-[0.25em]">RESET</button>
          {session.active && (
            <button onClick={stopSession} className="px-4 py-2 rounded border border-destructive/60 text-destructive hover:bg-destructive/10 flap-text text-xs tracking-[0.25em]">STOP &amp; SUMMARIZE</button>
          )}
        </div>
      </div>

      {session.active && (
        <div className="board-tile rounded border border-board-divider p-4">
          <LiveSession session={session} apps={apps} />
          {session.cycles.length > 0 && (
            <div className="mt-3 max-h-40 overflow-auto scroll-thin pr-1 space-y-1">
              {session.cycles.slice().reverse().slice(0, 12).map((c) => (
                <div key={c.idx} className={`flex items-center gap-2 text-[11px] flap-text tracking-[0.15em] px-2 py-1 rounded border ${c.success ? "border-amber/40 bg-amber/5" : "border-destructive/40 bg-destructive/5"}`}>
                  <span className="tabular-nums w-10 text-muted-foreground">#{String(c.idx).padStart(2, "0")}</span>
                  <span className={c.success ? "text-amber" : "text-destructive"}>{c.success ? "✓" : "✗"}</span>
                  <span className="text-muted-foreground">{c.mode}</span>
                  <span className="ml-auto tabular-nums">+{c.added} J · +{c.applied} A</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="board-tile rounded border border-board-divider p-4">
          <div className="flap-text text-[10px] tracking-[0.25em] text-muted-foreground mb-3">SESSION TYPE</div>
          <div className="flex gap-2">
            <ModeBtn active={timer.kind === "NORMAL"} onClick={() => setTimerKind("NORMAL")}>NORMAL</ModeBtn>
            <ModeBtn active={timer.kind === "CONTINUOUS"} onClick={() => setTimerKind("CONTINUOUS")}>CONTINUOUS</ModeBtn>
          </div>
          <div className="flap-text text-[10px] tracking-[0.2em] text-muted-foreground mt-3 leading-relaxed">
            {timer.kind === "NORMAL"
              ? "ONE FOCUSED CYCLE. SUMMARY APPEARS WHEN THE TIMER ENDS."
              : "REPEATING CYCLES. AUTO-RESTARTS UNTIL YOU PRESS STOP."}
          </div>
        </div>
        <div className="board-tile rounded border border-board-divider p-4">
          <div className="flap-text text-[10px] tracking-[0.25em] text-muted-foreground mb-3">FOCUS</div>
          <div className="flex gap-2">
            <ModeBtn active={timer.mode === "SEARCH"} onClick={() => setTimerMode("SEARCH")}>SEARCH</ModeBtn>
            <ModeBtn active={timer.mode === "APPLY"} onClick={() => setTimerMode("APPLY")}>APPLY</ModeBtn>
          </div>
          <div className="flap-text text-[10px] tracking-[0.2em] text-muted-foreground mt-3 leading-relaxed">
            {timer.mode === "SEARCH"
              ? "GOAL: ADD AT LEAST 1 NEW JOB PER CYCLE."
              : "GOAL: MARK AT LEAST 1 APPLICATION AS APPLIED PER CYCLE."}
          </div>
        </div>
      </div>

      <div className="board-tile rounded border border-board-divider p-4">
        <div className="flap-text text-[10px] tracking-[0.25em] text-muted-foreground mb-3">CYCLE LENGTH</div>
        <div className="flex flex-wrap gap-2">
          {[5,10,15,20,25,30,45,60].map((m) => (
            <button key={m} onClick={() => setTimerDuration(m * 60)} className={`px-2 py-1 rounded border text-[10px] flap-text tracking-[0.2em] ${timer.durationSec === m * 60 ? "border-amber bg-amber/10 text-amber" : "border-border hover:bg-accent"}`}>{m}M</button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="number" min={1} max={180}
            defaultValue={Math.round(timer.durationSec / 60)}
            onBlur={(e) => setTimerDuration(Math.max(1, parseInt(e.target.value || "1")) * 60)}
            className="w-20 bg-input border border-border rounded px-2 py-1 text-xs"
          />
          <span className="text-xs text-muted-foreground">minutes</span>
        </div>
      </div>

      <div className="board-tile rounded border border-board-divider p-4">
        <div className="flap-text text-[10px] tracking-[0.25em] text-muted-foreground mb-3">PREFERENCES</div>
        <div className="flex flex-wrap gap-2">
          <button onClick={toggleTimerSound} className={`px-3 py-1.5 rounded border text-[10px] flap-text tracking-[0.2em] ${timer.soundOn ? "border-amber bg-amber/10 text-amber" : "border-border hover:bg-accent"}`}>SOUND {timer.soundOn ? "ON" : "OFF"}</button>
          <EnableSoundBtn />
          <button
            onClick={() => { updateSettings({ notifications: !settings.notifications }); requestNotifPermission(); }}
            className={`px-3 py-1.5 rounded border text-[10px] flap-text tracking-[0.2em] ${settings.notifications ? "border-amber bg-amber/10 text-amber" : "border-border hover:bg-accent"}`}
          >NOTIFICATIONS {settings.notifications ? "ON" : "OFF"}</button>
        </div>
        <div className="flap-text text-[9px] tracking-[0.2em] text-muted-foreground mt-2 leading-relaxed">
          BROWSERS BLOCK AUDIO UNTIL YOU INTERACT. CLICK "ENABLE REMINDER SOUND" ONCE TO UNLOCK THE TIMER ALERT.
        </div>
      </div>
    </div>
  );
}

function EnableSoundBtn() {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <button
      onClick={async () => {
        const ok = await unlockTimerSound();
        setState(ok ? "ok" : "fail");
      }}
      className={`px-3 py-1.5 rounded border text-[10px] flap-text tracking-[0.2em] ${state === "ok" ? "border-amber bg-amber/10 text-amber" : "border-border hover:bg-accent"}`}
    >
      {state === "ok" ? "✓ REMINDER SOUND ENABLED" : state === "fail" ? "RETRY ENABLE SOUND" : "ENABLE REMINDER SOUND"}
    </button>
  );
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex-1 px-3 py-2 rounded border text-xs flap-text tracking-[0.25em] ${active ? "border-amber bg-amber/10 text-amber" : "border-border hover:bg-accent"}`}>{children}</button>
  );
}

function Mini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border border-board-divider/70 p-2">
      <div className="flap-text text-[9px] tracking-[0.25em] text-muted-foreground">{label}</div>
      <div className="flap-text tabular-nums text-sm text-amber mt-0.5">{value}</div>
    </div>
  );
}

function LiveSession({ session, apps }: { session: SessionState; apps: Application[] }) {
  const liveAdded = Math.max(0, apps.length - session.baseAppsCount);
  const liveApplied = Math.max(0, apps.filter((a) => !!a.appliedAt).length - session.baseAppliedCount);
  const successCycles = session.cycles.filter((c) => c.success).length;
  const failedCycles = session.cycles.length - successCycles;
  const rate = session.cycles.length ? `${Math.round((successCycles / session.cycles.length) * 100)}%` : "—";
  const elapsedMs = session.startedAt ? Date.now() - new Date(session.startedAt).getTime() : 0;
  const hours = Math.max(elapsedMs / 3600000, 1 / 3600);
  const perHour = (n: number) => (n / hours).toFixed(1);
  return (
    <>
      <div className="flap-text text-[10px] tracking-[0.25em] text-muted-foreground mb-3 flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        LIVE SESSION · {session.mode} · {session.kind}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Mini label="JOBS ADDED" value={liveAdded} />
        <Mini label="APPLIED" value={liveApplied} />
        <Mini label="JOBS / HR" value={perHour(liveAdded)} />
        <Mini label="APPLIED / HR" value={perHour(liveApplied)} />
        <Mini label="CYCLES" value={session.cycles.length} />
        <Mini label="STREAK" value={session.currentStreak} />
        <Mini label="SUCCESS" value={successCycles} />
        <Mini label="FAILED" value={failedCycles} />
        <Mini label="LONGEST" value={session.longestStreak} />
        <Mini label="RATE" value={rate} />
      </div>
    </>
  );
}
