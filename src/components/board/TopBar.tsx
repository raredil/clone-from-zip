import { useEffect, useState } from "react";
import { Search, Plus, SlidersHorizontal, Pause, Play, Menu, Sun, Moon, ArrowUp, ArrowDown, Type } from "lucide-react";
import { useStore, setSearch, setFilterPanelOpen, setQuickAddOpen, startTimer, pauseTimer, setMenuOpen, setFilters } from "@/lib/store";
import { toggleTheme, toggleFont } from "@/lib/theme";
import type { SortKey } from "@/lib/types";

export function TopBar() {
  const search = useStore((s) => s.filters.search);
  const timer = useStore((s) => s.timer);
  const filters = useStore((s) => s.filters);
  const theme = useStore((s) => s.settings.theme || "dark");
  const font = useStore((s) => s.settings.font || "mono");
  const activeFilterCount = countActiveFilters(filters);
  const sortBy = (filters.sortBy || "default") as SortKey;
  const sortDir = filters.sortDir || "desc";
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const mm = String(Math.floor(timer.remainingSec / 60)).padStart(2, "0");
  const ss = String(timer.remainingSec % 60).padStart(2, "0");

  return (
    <div className="board-frame px-5 py-4 flex items-center gap-4 flex-wrap">
      <button
        onClick={() => setMenuOpen(true)}
        aria-label="Menu"
        className="lg:hidden p-2 rounded border border-board-divider hover:bg-accent"
      >
        <Menu className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-3 mr-2">
        <PlaneIcon />
        <div className="flex flex-col">
          <h1
            className="text-[clamp(1.6rem,3vw,2.4rem)] tracking-[0.32em] leading-none text-amber font-extrabold uppercase career-board-title"
          >CAREER BOARD</h1>
          <div className="flap-text text-[10px] tracking-[0.3em] text-foreground mt-1">NEXT ROLE READY</div>
        </div>
      </div>

      <div className="flex-1 flex items-center gap-2 min-w-[260px]">
        <label className="flex items-center gap-2 px-3 py-2 rounded border border-board-divider bg-board flex-1 max-w-[320px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SEARCH"
            className="bg-transparent outline-none flap-text text-[12px] tracking-[0.2em] placeholder:text-muted-foreground/60 w-full"
          />
        </label>
        <button
          onClick={() => setQuickAddOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded border border-board-divider bg-board hover:bg-accent flap-text text-[11px] tracking-[0.2em]"
        >
          <Plus className="w-3.5 h-3.5" /> QUICK ADD
        </button>
        <button
          onClick={() => setFilterPanelOpen(true)}
          className="relative flex items-center gap-2 px-3 py-2 rounded border border-board-divider bg-board hover:bg-accent flap-text text-[11px] tracking-[0.2em]"
          aria-label="Filters"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {activeFilterCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[9px] bg-amber text-primary-foreground px-1">
              {activeFilterCount}
            </span>
          )}
        </button>
        <div className="flex items-center rounded border border-board-divider bg-board overflow-hidden">
          <select
            value={sortBy}
            onChange={(e) => setFilters({ sortBy: e.target.value as SortKey })}
            className="bg-transparent flap-text text-[10px] tracking-[0.2em] px-2 py-2 outline-none"
            aria-label="Sort by"
            title="Sort by"
          >
            <option value="default">SORT</option>
            <option value="status">STATUS</option>
            <option value="company">COMPANY</option>
            <option value="country">COUNTRY</option>
            <option value="role">ROLE</option>
            <option value="newest">NEWEST</option>
            <option value="oldest">OLDEST</option>
            <option value="updated">UPDATED</option>
            <option value="favorites">FAVORITES</option>
          </select>
          <button
            onClick={() => setFilters({ sortDir: sortDir === "asc" ? "desc" : "asc" })}
            className="px-2 py-2 border-l border-board-divider hover:bg-accent"
            aria-label="Toggle sort direction"
            title={sortDir === "asc" ? "Ascending" : "Descending"}
          >
            {sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      <div className="rounded border border-board-divider bg-board px-3 py-2 flex items-center gap-3 min-w-[200px]">
        <div className="flex flex-col">
          <div className="flap-text text-[9px] tracking-[0.25em] text-muted-foreground flex items-center gap-1">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${timer.running ? "bg-green-500 animate-pulse" : "bg-muted-foreground/40"}`} />
            {timer.mode === "SEARCH" ? "SEARCH MODE" : "APPLY MODE"}
          </div>
          <div className="flap-text text-amber text-xl tabular-nums leading-none mt-1">{mm}:{ss}</div>
          <div className="flap-text text-[9px] tracking-[0.25em] text-muted-foreground mt-1">
            {Math.round(timer.durationSec / 60)} MIN INTERVAL
          </div>
        </div>
        <button
          onClick={() => (timer.running ? pauseTimer() : startTimer())}
          className="ml-auto p-2 rounded border border-board-divider bg-board hover:bg-accent"
          aria-label={timer.running ? "Pause" : "Start"}
        >
          {timer.running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
      </div>

      <div suppressHydrationWarning className="hidden md:flex flex-col items-end leading-tight flap-text text-[10px] tracking-[0.25em] text-muted-foreground">
        <span>{now ? now.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : "--"}</span>
        <span className="text-amber tabular-nums">{now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}</span>
      </div>
      <button
        onClick={toggleFont}
        aria-label="Toggle font"
        title={font === "board" ? "Switch to terminal font" : "Switch to split-flap font"}
        className={`p-2 rounded border border-board-divider bg-board hover:bg-accent ${font === "board" ? "text-amber" : ""}`}
      >
        <Type className="w-4 h-4" />
      </button>
      <button
        onClick={toggleTheme}
        aria-label="Toggle theme"
        title={theme === "light" ? "Switch to dark" : "Switch to light"}
        className="p-2 rounded border border-board-divider bg-board hover:bg-accent"
      >
        {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </button>
    </div>
  );
}

function countActiveFilters(f: import("@/lib/types").FilterState): number {
  let n = 0;
  n += f.statuses.length + f.countries.length + f.companies.length + f.roles.length + f.tags.length;
  if (f.favoritesOnly) n++;
  if (f.activeOnly) n++;
  if (f.archivedOnly) n++;
  if (f.dateFrom) n++;
  if (f.dateTo) n++;
  return n;
}

function PlaneIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber">
      <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
    </svg>
  );
}
