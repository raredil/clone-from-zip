import { LayoutGrid, ListChecks, BarChart3, History, Timer, Download, FolderOpen, Archive, Settings as SetIcon, X, Menu } from "lucide-react";
import { useStore, setView, setMenuOpen, type View } from "@/lib/store";

const ITEMS: { v: View; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { v: "DASHBOARD", label: "Dashboard", icon: LayoutGrid },
  { v: "APPLICATIONS", label: "Applications", icon: ListChecks },
  { v: "ANALYTICS", label: "Analytics", icon: BarChart3 },
  { v: "ACTIVITY", label: "Activity", icon: History },
  { v: "TIMER", label: "Timer", icon: Timer },
  { v: "EXPORTS", label: "Exports", icon: Download },
  { v: "DOCUMENTS", label: "Documents", icon: FolderOpen },
  { v: "ARCHIVE", label: "Archive", icon: Archive },
  { v: "SETTINGS", label: "Settings", icon: SetIcon },
];

export function SideMenu() {
  const view = useStore((s) => s.view);
  const open = useStore((s) => s.menuOpen);

  return (
    <>
      {/* Desktop rail — collapsed by default, expands on hover */}
      <aside
        className="side-rail hidden lg:flex flex-col gap-1 shrink-0 sticky top-4 self-start group"
        aria-label="Primary navigation"
      >
        <div className="board-frame px-2 py-3 flex flex-col gap-1 overflow-hidden">
          <div className="side-rail__handle flex items-center justify-center text-muted-foreground py-1 mb-1">
            <Menu className="w-4 h-4" />
          </div>
          {ITEMS.map((it) => (
            <Btn key={it.v} active={view === it.v} onClick={() => setView(it.v)} icon={it.icon} label={it.label} />
          ))}
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <>
          <div className="lg:hidden fixed inset-0 bg-black/60 z-40" onClick={() => setMenuOpen(false)} />
          <aside className="lg:hidden fixed top-0 left-0 h-screen w-64 bg-card border-r border-border z-50 p-3 flex flex-col gap-1">
            <div className="flex items-center justify-between mb-2">
              <span className="flap-text text-xs tracking-[0.25em]">MENU</span>
              <button onClick={() => setMenuOpen(false)} className="p-2 rounded hover:bg-accent"><X className="w-4 h-4" /></button>
            </div>
            {ITEMS.map((it) => (
              <Btn key={it.v} active={view === it.v} onClick={() => { setView(it.v); setMenuOpen(false); }} icon={it.icon} label={it.label} />
            ))}
          </aside>
        </>
      )}
    </>
  );
}

function Btn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`side-rail__btn flex items-center gap-2 px-2 py-2 rounded text-left flap-text text-[11px] tracking-[0.2em] transition ${active ? "bg-amber/10 text-amber border border-amber/40" : "hover:bg-accent border border-transparent text-muted-foreground"}`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="side-rail__label whitespace-nowrap">{label.toUpperCase()}</span>
    </button>
  );
}
