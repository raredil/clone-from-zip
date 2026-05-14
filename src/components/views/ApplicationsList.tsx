import { useMemo } from "react";
import { useStore, selectApp, setFilters } from "@/lib/store";
import { applyFilters, applySort } from "@/lib/filter";
import { StatusLabel } from "../board/StatusLabel";
import {
  AirportBoardRow,
  AirportHeaderRow,
  AirportScreen,
} from "../board/AirportBoard";
import { ALL_STATUSES, type SortKey, type Status } from "@/lib/types";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "default", label: "Default" },
  { value: "company", label: "Company" },
  { value: "country", label: "Country" },
  { value: "role", label: "Role / Position" },
  { value: "status", label: "Status" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "updated", label: "Recently Updated" },
  { value: "favorites", label: "Favorites first" },
];

export function ApplicationsList({ scope = "ACTIVE" }: { scope?: "ACTIVE" | "ALL" | "ARCHIVE" | "DOCS" }) {
  const apps = useStore((s) => s.apps);
  const filters = useStore((s) => s.filters);

  const list = useMemo(() => {
    let base = apps;
    if (scope === "ARCHIVE") base = apps.filter((a) => a.archived);
    else if (scope === "ACTIVE") base = apps.filter((a) => !a.archived);
    else if (scope === "DOCS") base = apps.filter((a) => (a.docs && a.docs.length > 0) || a.link);
    const filtered = applyFilters(base, { ...filters, archivedOnly: scope === "ARCHIVE" ? true : filters.archivedOnly });
    return applySort(filtered, filters.sortBy || "default", filters.sortDir || "desc");
  }, [apps, filters, scope]);

  const countryOptions = useMemo(
    () => Array.from(new Set(apps.map((a) => a.country).filter(Boolean))).sort(),
    [apps],
  );

  const toggleStatus = (s: Status) => {
    const has = filters.statuses.includes(s);
    setFilters({ statuses: has ? filters.statuses.filter((x) => x !== s) : [...filters.statuses, s] });
  };

  return (
    <div className="space-y-3">
      <Controls
        filters={filters}
        countryOptions={countryOptions}
        onSort={(sortBy) => setFilters({ sortBy })}
        onDir={(sortDir) => setFilters({ sortDir })}
        onSearch={(search) => setFilters({ search })}
        onCountry={(country) =>
          setFilters({ countries: country === "" ? [] : [country] })
        }
        onToggleStatus={toggleStatus}
        onFav={(v) => setFilters({ favoritesOnly: v })}
        onActive={(v) => setFilters({ activeOnly: v })}
        onReset={() =>
          setFilters({
            statuses: [], countries: [], companies: [], roles: [], tags: [],
            favoritesOnly: false, activeOnly: false, search: "",
            sortBy: "default", sortDir: "desc",
          })
        }
        scope={scope}
      />

      <div className="text-[10px] flap-text tracking-[0.2em] text-muted-foreground">
        SHOWING {list.length} / {apps.length}
      </div>

      {list.length === 0 ? (
        <div className="text-muted-foreground text-sm py-8 text-center">No items.</div>
      ) : scope === "DOCS" ? (
        <div className="board-tile rounded border border-board-divider divide-y divide-board-divider">
          {list.map((a) => (
            <div key={a.id} className="px-4 py-3 hover:bg-accent/40 cursor-pointer" onClick={() => selectApp(a.id)}>
              <div className="flex items-center gap-3">
                <span className="flap-text text-xs tracking-[0.15em]">{a.pinned ? "★ " : ""}{a.company}</span>
                <span className="text-[10px] flap-text tracking-[0.2em] text-muted-foreground">{a.role}</span>
                <span className="ml-auto"><StatusLabel value={a.status} /></span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
                {a.link && <a href={a.link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-amber underline">Posting ↗</a>}
                {(a.docs || []).map((d) => (
                  <a key={d.id} href={d.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="px-1.5 py-0.5 rounded border border-border hover:bg-accent">{d.name}</a>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <AirportScreen>
          <AirportHeaderRow />
          <div className="ab-rows">
            {list.map((a) => (
              <AirportBoardRow key={a.id} app={a} />
            ))}
          </div>
        </AirportScreen>
      )}
    </div>
  );
}

function Controls({
  filters, countryOptions, onSort, onDir, onSearch, onCountry, onToggleStatus, onFav, onActive, onReset, scope,
}: {
  filters: import("@/lib/types").FilterState;
  countryOptions: string[];
  onSort: (k: SortKey) => void;
  onDir: (d: "asc" | "desc") => void;
  onSearch: (q: string) => void;
  onCountry: (c: string) => void;
  onToggleStatus: (s: Status) => void;
  onFav: (v: boolean) => void;
  onActive: (v: boolean) => void;
  onReset: () => void;
  scope: string;
}) {
  return (
    <div className="board-tile rounded border border-board-divider p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={filters.search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search company, role, country, tag…"
          className="flex-1 min-w-[180px] bg-input border border-border rounded px-2 py-1 text-xs"
        />
        <label className="flap-text text-[10px] tracking-[0.2em] text-muted-foreground">SORT</label>
        <select
          value={filters.sortBy || "default"}
          onChange={(e) => onSort(e.target.value as SortKey)}
          className="bg-input border border-border rounded px-2 py-1 text-xs"
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={filters.sortDir || "desc"}
          onChange={(e) => onDir(e.target.value as "asc" | "desc")}
          className="bg-input border border-border rounded px-2 py-1 text-xs"
        >
          <option value="asc">↑ Asc</option>
          <option value="desc">↓ Desc</option>
        </select>
        <label className="flap-text text-[10px] tracking-[0.2em] text-muted-foreground">COUNTRY</label>
        <select
          value={filters.countries[0] || ""}
          onChange={(e) => onCountry(e.target.value)}
          className="bg-input border border-border rounded px-2 py-1 text-xs"
        >
          <option value="">All</option>
          {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={onReset}
          className="px-2 py-1 rounded border border-border text-[10px] flap-text tracking-[0.2em] hover:bg-accent"
        >RESET</button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flap-text text-[10px] tracking-[0.2em] text-muted-foreground mr-1">STATUS</span>
        {ALL_STATUSES.map((s) => {
          const active = filters.statuses.includes(s);
          return (
            <button
              key={s}
              onClick={() => onToggleStatus(s)}
              className={`px-2 py-0.5 rounded border text-[10px] flap-text tracking-[0.15em] ${active ? "border-amber bg-amber/10 text-amber" : "border-border hover:bg-accent text-muted-foreground"}`}
            >{s}</button>
          );
        })}
        <span className="mx-2 opacity-40">·</span>
        <button
          onClick={() => onFav(!filters.favoritesOnly)}
          className={`px-2 py-0.5 rounded border text-[10px] flap-text tracking-[0.15em] ${filters.favoritesOnly ? "border-amber bg-amber/10 text-amber" : "border-border hover:bg-accent text-muted-foreground"}`}
        >★ FAVORITES</button>
        {scope !== "ARCHIVE" && (
          <button
            onClick={() => onActive(!filters.activeOnly)}
            className={`px-2 py-0.5 rounded border text-[10px] flap-text tracking-[0.15em] ${filters.activeOnly ? "border-amber bg-amber/10 text-amber" : "border-border hover:bg-accent text-muted-foreground"}`}
          >ACTIVE ONLY</button>
        )}
      </div>
    </div>
  );
}
