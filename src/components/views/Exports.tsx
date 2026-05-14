import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { applyFilters } from "@/lib/filter";
import { exportCSV, exportJSON, exportXLSX, downloadFile, exportPDF } from "@/lib/export";
import { ALL_STATUSES, type SortKey, type Status } from "@/lib/types";
import { countryFullName } from "@/lib/countries";

export function Exports() {
  const apps = useStore((s) => s.apps);
  const filters = useStore((s) => s.filters);
  const activity = useStore((s) => s.activity);
  const presets = useStore((s) => s.presets);
  const settings = useStore((s) => s.settings);
  const timer = useStore((s) => s.timer);
  const filtered = useMemo(() => applyFilters(apps, filters), [apps, filters]);

  function downloadCSV(scope: "ALL" | "FILTERED" | "FAVORITES" | "INTERVIEWS" | "OFFERS" | "REJECTED") {
    const set =
      scope === "ALL" ? apps :
      scope === "FILTERED" ? filtered :
      scope === "FAVORITES" ? apps.filter((a) => a.pinned) :
      scope === "INTERVIEWS" ? apps.filter((a) => a.status === "INTERVIEW" || a.status === "ASSESSMENT") :
      scope === "OFFERS" ? apps.filter((a) => a.status === "OFFER") :
      apps.filter((a) => a.status === "REJECTED");
    const csv = exportCSV(set, scope === "FILTERED" ? filters : undefined);
    downloadFile(`career-board-${scope.toLowerCase()}-${stamp()}.csv`, csv);
  }
  function downloadXLSX(scope: keyof typeof counts) {
    const set =
      scope === "ALL" ? apps :
      scope === "FILTERED" ? filtered :
      scope === "FAVORITES" ? apps.filter((a) => a.pinned) :
      scope === "INTERVIEWS" ? apps.filter((a) => a.status === "INTERVIEW" || a.status === "ASSESSMENT") :
      scope === "OFFERS" ? apps.filter((a) => a.status === "OFFER") :
      apps.filter((a) => a.status === "REJECTED");
    exportXLSX(set, `career-board-${scope.toLowerCase()}-${stamp()}.xlsx`);
  }
  function downloadJSON() {
    downloadFile(`career-board-backup-${stamp()}.json`, exportJSON(apps), "application/json");
  }

  const counts = useMemo(() => ({
    ALL: apps.length,
    FILTERED: filtered.length,
    FAVORITES: apps.filter((a) => a.pinned).length,
    INTERVIEWS: apps.filter((a) => a.status === "INTERVIEW" || a.status === "ASSESSMENT").length,
    OFFERS: apps.filter((a) => a.status === "OFFER").length,
    REJECTED: apps.filter((a) => a.status === "REJECTED").length,
  }), [apps, filtered]);

  // PDF sort layers (1–3)
  const [pdfScope, setPdfScope] = useState<"ALL" | "FILTERED">("FILTERED");
  const [s1, setS1] = useState<SortKey>("status");
  const [s2, setS2] = useState<SortKey>("country");
  const [s3, setS3] = useState<SortKey>("default");
  const [d1, setD1] = useState<"asc" | "desc">("asc");
  const [d2, setD2] = useState<"asc" | "desc">("asc");
  const [d3, setD3] = useState<"asc" | "desc">("asc");

  // PDF exclusions
  const [exStatuses, setExStatuses] = useState<Status[]>([]);
  const [exCountries, setExCountries] = useState<string[]>([]);
  const [exFavMode, setExFavMode] = useState<"none" | "favorites" | "nonFavorites">("none");
  const [exArchMode, setExArchMode] = useState<"none" | "archived" | "active">("none");

  // Available countries from current scope, normalized to full names
  const scopeApps = pdfScope === "ALL" ? apps : filtered;
  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    for (const a of scopeApps) {
      const full = countryFullName(a.country);
      if (full && full !== "—") set.add(full);
    }
    return [...set].sort();
  }, [scopeApps]);

  // Live preview count after exclusions
  const previewCount = useMemo(() => {
    const exS = new Set(exStatuses.map((s) => s.toUpperCase()));
    const exC = new Set(exCountries.map((c) => c.toUpperCase()));
    return scopeApps.filter((a) => {
      if (exS.size && exS.has(String(a.status).toUpperCase())) return false;
      if (exC.size && exC.has(countryFullName(a.country).toUpperCase())) return false;
      if (exFavMode === "favorites" && a.pinned) return false;
      if (exFavMode === "nonFavorites" && !a.pinned) return false;
      if (exArchMode === "archived" && a.archived) return false;
      if (exArchMode === "active" && !a.archived) return false;
      return true;
    }).length;
  }, [scopeApps, exStatuses, exCountries, exFavMode, exArchMode]);

  function toggle<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  function downloadPDF() {
    const set = pdfScope === "ALL" ? apps : filtered;
    exportPDF(set, {
      title: `Career Board — ${pdfScope === "ALL" ? "All Records" : "Filtered View"}`,
      sorts: [
        { key: s1, dir: d1 },
        { key: s2, dir: d2 },
        { key: s3, dir: d3 },
      ],
      filters: pdfScope === "FILTERED" ? filters : undefined,
      exclusions: {
        statuses: exStatuses,
        countries: exCountries,
        excludeFavorites: exFavMode === "favorites",
        excludeNonFavorites: exFavMode === "nonFavorites",
        excludeArchived: exArchMode === "archived",
        excludeActive: exArchMode === "active",
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="board-tile rounded border border-board-divider p-4">
          <div className="flap-text text-[10px] tracking-[0.25em] text-muted-foreground mb-3">CSV EXPORTS</div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(counts) as (keyof typeof counts)[]).map((k) => (
              <button key={k} onClick={() => downloadCSV(k)} className="px-3 py-2 rounded border border-border hover:bg-accent flap-text text-[10px] tracking-[0.2em] flex items-center justify-between">
                <span>{k}</span><span className="text-muted-foreground tabular-nums">{counts[k]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="board-tile rounded border border-board-divider p-4">
          <div className="flap-text text-[10px] tracking-[0.25em] text-muted-foreground mb-3">EXCEL EXPORTS (.XLSX)</div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(counts) as (keyof typeof counts)[]).map((k) => (
              <button key={k} onClick={() => downloadXLSX(k)} className="px-3 py-2 rounded border border-amber/40 hover:bg-amber/10 text-amber flap-text text-[10px] tracking-[0.2em] flex items-center justify-between">
                <span>{k}</span><span className="tabular-nums opacity-70">{counts[k]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="board-tile rounded border border-board-divider p-4 space-y-3">
          <div>
            <div className="flap-text text-[10px] tracking-[0.25em] text-muted-foreground mb-3">FULL BACKUP (JSON)</div>
            <button onClick={downloadJSON} className="w-full px-3 py-2 rounded border border-border hover:bg-accent flap-text text-[10px] tracking-[0.2em]">DOWNLOAD JSON BACKUP</button>
          </div>
        </div>
      </div>

      <div className="board-tile rounded border border-board-divider p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flap-text text-[10px] tracking-[0.25em] text-muted-foreground">PDF EXPORT (TRACKING MANIFEST)</div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPdfScope("FILTERED")}
              className={`px-2 py-1 rounded border text-[10px] flap-text tracking-[0.2em] ${pdfScope === "FILTERED" ? "border-amber text-amber bg-amber/10" : "border-border hover:bg-accent"}`}
            >FILTERED ({counts.FILTERED})</button>
            <button
              onClick={() => setPdfScope("ALL")}
              className={`px-2 py-1 rounded border text-[10px] flap-text tracking-[0.2em] ${pdfScope === "ALL" ? "border-amber text-amber bg-amber/10" : "border-border hover:bg-accent"}`}
            >ALL ({counts.ALL})</button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <SortLayer label="1ST SORT" k={s1} d={d1} onK={setS1} onD={setD1} />
          <SortLayer label="2ND SORT" k={s2} d={d2} onK={setS2} onD={setD2} disabled={s1 === "default"} />
          <SortLayer label="3RD SORT" k={s3} d={d3} onK={setS3} onD={setD3} disabled={s2 === "default" || s1 === "default"} />
        </div>

        <div className="rounded border border-board-divider p-3 space-y-3">
          <div className="flap-text text-[9px] tracking-[0.25em] text-muted-foreground">EXCLUDE FROM PDF</div>

          <div>
            <div className="flap-text text-[9px] tracking-[0.22em] text-muted-foreground mb-1">STATUS</div>
            <div className="flex flex-wrap gap-1.5">
              {ALL_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => setExStatuses(toggle(exStatuses, s))}
                  className={`px-2 py-1 rounded border text-[10px] flap-text tracking-[0.18em] cursor-pointer ${exStatuses.includes(s) ? "border-destructive bg-destructive/10 text-destructive line-through" : "border-border hover:bg-accent"}`}
                  title={exStatuses.includes(s) ? "Excluded from PDF" : "Click to exclude"}
                >{s}</button>
              ))}
            </div>
          </div>

          {availableCountries.length > 0 && (
            <div>
              <div className="flap-text text-[9px] tracking-[0.22em] text-muted-foreground mb-1">COUNTRY</div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-auto scroll-thin">
                {availableCountries.map((c) => (
                  <button
                    key={c}
                    onClick={() => setExCountries(toggle(exCountries, c))}
                    className={`px-2 py-1 rounded border text-[10px] flap-text tracking-[0.15em] cursor-pointer ${exCountries.includes(c) ? "border-destructive bg-destructive/10 text-destructive line-through" : "border-border hover:bg-accent"}`}
                  >{c}</button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flap-text text-[9px] tracking-[0.22em] text-muted-foreground mb-1">FAVORITES</div>
              <div className="flex gap-1">
                {(["none","favorites","nonFavorites"] as const).map((m) => (
                  <button key={m} onClick={() => setExFavMode(m)}
                    className={`px-2 py-1 rounded border text-[10px] flap-text tracking-[0.15em] cursor-pointer ${exFavMode === m ? "border-amber text-amber bg-amber/10" : "border-border hover:bg-accent"}`}>
                    {m === "none" ? "INCLUDE ALL" : m === "favorites" ? "EXCL. FAVS" : "EXCL. NON-FAVS"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="flap-text text-[9px] tracking-[0.22em] text-muted-foreground mb-1">ARCHIVE</div>
              <div className="flex gap-1">
                {(["none","archived","active"] as const).map((m) => (
                  <button key={m} onClick={() => setExArchMode(m)}
                    className={`px-2 py-1 rounded border text-[10px] flap-text tracking-[0.15em] cursor-pointer ${exArchMode === m ? "border-amber text-amber bg-amber/10" : "border-border hover:bg-accent"}`}>
                    {m === "none" ? "INCLUDE ALL" : m === "archived" ? "EXCL. ARCHIVED" : "EXCL. ACTIVE"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] flap-text tracking-[0.2em] text-muted-foreground pt-1">
            <span>WILL EXPORT</span>
            <span className="tabular-nums text-foreground">{previewCount} / {scopeApps.length}</span>
          </div>
        </div>

        <button
          onClick={downloadPDF}
          className="w-full px-3 py-2 rounded border border-amber/50 bg-amber/10 hover:bg-amber/15 text-amber flap-text text-[11px] tracking-[0.25em] cursor-pointer"
        >PREVIEW PDF MANIFEST ({previewCount})</button>
        <div className="text-[10px] flap-text tracking-[0.18em] text-muted-foreground leading-relaxed">
          OPENS A PREVIEW IN A NEW TAB — DOWNLOAD FROM THERE. EXCLUSIONS APPLY BEFORE SORTING. PINNED ROWS ALWAYS APPEAR FIRST WITHIN THE SORT.
        </div>
      </div>

      <div className="board-tile rounded border border-board-divider p-4">
        <div className="flap-text text-[10px] tracking-[0.25em] text-muted-foreground mb-2">STATUSES IN DATA</div>
        <div className="flex flex-wrap gap-2 text-[10px] flap-text tracking-[0.2em]">
          {ALL_STATUSES.map((s) => (
            <span key={s} className="px-2 py-1 rounded border border-border">{s} · {apps.filter((a) => a.status === s).length}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function stamp() { return new Date().toISOString().slice(0,16).replace(/[:T]/g, "-"); }

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "default", label: "NONE" },
  { value: "status", label: "STATUS" },
  { value: "company", label: "COMPANY" },
  { value: "country", label: "COUNTRY" },
  { value: "role", label: "ROLE" },
  { value: "newest", label: "NEWEST" },
  { value: "oldest", label: "OLDEST" },
  { value: "updated", label: "UPDATED" },
  { value: "favorites", label: "FAVORITES" },
];

function SortLayer({
  label, k, d, onK, onD, disabled,
}: {
  label: string;
  k: SortKey;
  d: "asc" | "desc";
  onK: (v: SortKey) => void;
  onD: (v: "asc" | "desc") => void;
  disabled?: boolean;
}) {
  return (
    <div className={`rounded border border-board-divider p-2 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="flap-text text-[9px] tracking-[0.25em] text-muted-foreground mb-1">{label}</div>
      <div className="flex gap-1">
        <select
          value={k}
          onChange={(e) => onK(e.target.value as SortKey)}
          className="flex-1 bg-input border border-border rounded px-2 py-1 text-[10px] flap-text tracking-[0.18em]"
        >
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button
          onClick={() => onD(d === "asc" ? "desc" : "asc")}
          className="px-2 py-1 rounded border border-border text-[10px] flap-text tracking-[0.2em] hover:bg-accent"
          title="Toggle direction"
        >{d === "asc" ? "↑" : "↓"}</button>
      </div>
    </div>
  );
}
