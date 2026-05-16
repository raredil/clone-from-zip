import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo } from "react";
import { Toaster } from "sonner";
import { TopBar } from "@/components/board/TopBar";
import { Board } from "@/components/board/Board";
import { DetailDrawer } from "@/components/drawer/DetailDrawer";
import { FilterPanel } from "@/components/filter/FilterPanel";
import { QuickAdd } from "@/components/quickadd/QuickAdd";
import { SessionSummary } from "@/components/timer/SessionSummary";
import { SideMenu } from "@/components/menu/SideMenu";
import { ApplicationsList } from "@/components/views/ApplicationsList";
import { useInitStore, useStore, stopAlert } from "@/lib/store";
import { applyFilters } from "@/lib/filter";
import { useThemeSync } from "@/lib/theme";
import { ViewBoundary } from "@/components/ViewBoundary";

// Lazy-load heavy panels — keeps initial dashboard render fast.
const Analytics = lazy(() => import("@/components/views/Analytics").then((m) => ({ default: m.Analytics })));
const Activity = lazy(() => import("@/components/views/Activity").then((m) => ({ default: m.Activity })));
const TimerView = lazy(() => import("@/components/views/TimerView").then((m) => ({ default: m.TimerView })));
const Exports = lazy(() => import("@/components/views/Exports").then((m) => ({ default: m.Exports })));
const SettingsView = lazy(() => import("@/components/views/Settings").then((m) => ({ default: m.Settings })));

export const Route = createFileRoute("/")({
  ssr: false,
  component: Index,
});

function Index() {
  const ready = useInitStore();
  useThemeSync();
  
  const view = useStore((s) => s.view);
  const apps = useStore((s) => s.apps);
  const filters = useStore((s) => s.filters);
  const filteredCount = useMemo(() => applyFilters(apps, filters).length, [apps, filters]);

  // Persist warn before refresh? Not necessary, IndexedDB handles it.
  useEffect(() => {
    document.title = "Career Board — Next Role Ready";
  }, []);

  return (
    <div className="min-h-screen p-3 lg:p-5">
      <Toaster position="top-right" theme="dark" />
      <div className="max-w-[1600px] mx-auto flex gap-4">
        <SideMenu />

        <main className="flex-1 min-w-0 flex flex-col gap-4">
          <TopBar />

          {!ready ? (
            <div className="board-frame p-10 text-center text-muted-foreground flap-text text-xs tracking-[0.25em]">
              LOADING BOARD…
            </div>
          ) : (
            <>
            <ViewBoundary viewKey={view}>
              {view === "DASHBOARD" && (
                <div className="dashboard-screen p-2 lg:p-3">
                  <Board />
                  <FooterStrip filteredCount={filteredCount} />
                </div>
              )}
              {view === "APPLICATIONS" && (
                <ViewWrap title="ALL APPLICATIONS"><ApplicationsList scope="ACTIVE" /></ViewWrap>
              )}
              {view === "ANALYTICS" && <ViewWrap title="ANALYTICS"><Suspense fallback={<PanelFallback />}><Analytics /></Suspense></ViewWrap>}
              {view === "ACTIVITY" && <ViewWrap title="ACTIVITY TIMELINE"><Suspense fallback={<PanelFallback />}><Activity /></Suspense></ViewWrap>}
              {view === "TIMER" && <ViewWrap title="PRODUCTIVITY TIMER"><Suspense fallback={<PanelFallback />}><TimerView /></Suspense></ViewWrap>}
              {view === "EXPORTS" && <ViewWrap title="EXPORTS"><Suspense fallback={<PanelFallback />}><Exports /></Suspense></ViewWrap>}
              {view === "DOCUMENTS" && <ViewWrap title="DOCUMENTS"><ApplicationsList scope="DOCS" /></ViewWrap>}
              {view === "ARCHIVE" && <ViewWrap title="ARCHIVE"><ApplicationsList scope="ARCHIVE" /></ViewWrap>}
              {view === "SETTINGS" && <ViewWrap title="SETTINGS"><Suspense fallback={<PanelFallback />}><SettingsView /></Suspense></ViewWrap>}
            </ViewBoundary>
            </>
          )}
        </main>
      </div>

      <DetailDrawer />
      <FilterPanel />
      <QuickAdd />
      <AlertBanner />
      <SessionSummary />
    </div>
  );
}

function AlertBanner() {
  const active = useStore((s) => s.alertActive);
  const mode = useStore((s) => s.timer.mode);
  if (!active) return null;
  return (
    <div className="fixed inset-x-0 top-3 z-[60] flex justify-center px-3 pointer-events-none">
      <div className="pointer-events-auto board-frame px-4 py-3 flex items-center gap-4 border-amber/60 bg-amber/10 backdrop-blur">
        <div className="flap-text text-amber text-xs tracking-[0.3em]">{mode} CYCLE COMPLETE</div>
        <button
          onClick={stopAlert}
          className="px-3 py-1.5 rounded bg-amber text-primary-foreground flap-text text-[10px] tracking-[0.25em]"
        >DISMISS</button>
      </div>
    </div>
  );
}

function ViewWrap({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="board-frame p-4 lg:p-5">
      <h2 className="flap-text text-sm tracking-[0.3em] text-muted-foreground mb-4">{title}</h2>
      {children}
    </div>
  );
}

function FooterStrip({ filteredCount }: { filteredCount: number }) {
  const apps = useStore((s) => s.apps);
  const lastUpdate = useMemo(() => {
    if (!apps.length) return null;
    let max = "";
    for (const a of apps) {
      const ts = a.updatedAt || a.createdAt;
      if (ts && ts > max) max = ts;
    }
    return max ? new Date(max) : null;
  }, [apps]);
  const fmt = (d: Date) =>
    `${d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })} • ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`.toUpperCase();
  return (
    <div className="mt-3 pt-3 border-t border-board-divider/60 flex flex-wrap items-center gap-4 text-[10px] flap-text tracking-[0.2em] text-muted-foreground">
      <span className="text-amber">TIP: CLICK ANY ROW FOR DETAILS</span>
      <span className="ml-auto inline-flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" /> DATA SYNCED
      </span>
      <span>· LAST UPDATE: {lastUpdate ? fmt(lastUpdate) : "—"}</span>
      <span>· SHOWING {filteredCount} / {apps.length}</span>
      <span>· TOTAL APPLICATIONS: {apps.length}</span>
    </div>
  );
}

function PanelFallback() {
  return (
    <div className="p-6 text-center text-muted-foreground flap-text text-[11px] tracking-[0.25em]">
      LOADING…
    </div>
  );
}
