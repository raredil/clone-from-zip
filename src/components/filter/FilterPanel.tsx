import { useMemo, useState } from "react";
import { X, Save, RotateCcw, Trash2 } from "lucide-react";
import { useStore, setFilters, setFilterPanelOpen, resetFilters, savePreset, applyPreset, removePreset } from "@/lib/store";
import { ALL_STATUSES, type Status } from "@/lib/types";

export function FilterPanel() {
  const open = useStore((s) => s.filterPanelOpen);
  const filters = useStore((s) => s.filters);
  const apps = useStore((s) => s.apps);
  const presets = useStore((s) => s.presets);
  const [draft, setDraft] = useState(filters);
  const [presetName, setPresetName] = useState("");

  // sync when opening
  useMemo(() => { if (open) setDraft(filters); }, [open]); // eslint-disable-line

  const countries = useMemo(() => unique(apps.map((a) => a.country)), [apps]);
  const companies = useMemo(() => unique(apps.map((a) => a.company)), [apps]);
  const roles = useMemo(() => unique(apps.map((a) => a.role)), [apps]);
  const tags = useMemo(() => unique(apps.flatMap((a) => a.tags || [])), [apps]);

  if (!open) return null;

  function toggle<T>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }
  function apply() {
    setFilters(draft);
    setFilterPanelOpen(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setFilterPanelOpen(false)} />
      <aside className="fixed top-0 right-0 h-screen w-[min(440px,100vw)] bg-card border-l border-border z-50 flex flex-col">
        <header className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="flap-text text-sm tracking-[0.25em]">FILTERS</h2>
          <button onClick={() => setFilterPanelOpen(false)} className="p-2 rounded hover:bg-accent"><X className="w-4 h-4" /></button>
        </header>

        <div className="flex-1 overflow-auto scroll-thin px-5 py-4 space-y-5">
          <Group title="STATUS">
            <ChipGroup
              options={ALL_STATUSES}
              selected={draft.statuses}
              onToggle={(v) => setDraft({ ...draft, statuses: toggle(draft.statuses, v as Status) })}
            />
          </Group>
          <Group title="COUNTRY">
            <ChipGroup options={countries} selected={draft.countries} onToggle={(v) => setDraft({ ...draft, countries: toggle(draft.countries, v) })} />
          </Group>
          <Group title="COMPANY">
            <ChipGroup options={companies} selected={draft.companies} onToggle={(v) => setDraft({ ...draft, companies: toggle(draft.companies, v) })} />
          </Group>
          <Group title="ROLE">
            <ChipGroup options={roles} selected={draft.roles} onToggle={(v) => setDraft({ ...draft, roles: toggle(draft.roles, v) })} />
          </Group>
          {tags.length > 0 && (
            <Group title="TAGS">
              <ChipGroup options={tags} selected={draft.tags} onToggle={(v) => setDraft({ ...draft, tags: toggle(draft.tags, v) })} />
            </Group>
          )}
          <Group title="STATE">
            <div className="flex flex-wrap gap-2">
              <Toggle label="Favorites only" on={draft.favoritesOnly} onChange={(v) => setDraft({ ...draft, favoritesOnly: v })} />
              <Toggle label="Active only" on={draft.activeOnly} onChange={(v) => setDraft({ ...draft, activeOnly: v })} />
              <Toggle label="Archived" on={draft.archivedOnly} onChange={(v) => setDraft({ ...draft, archivedOnly: v })} />
            </div>
          </Group>
          <Group title="DATE RANGE">
            <div className="flex items-center gap-2">
              <input type="date" value={draft.dateFrom || ""} onChange={(e) => setDraft({ ...draft, dateFrom: e.target.value || undefined })} className="bg-input border border-border rounded px-2 py-1.5 text-xs" />
              <span className="text-xs text-muted-foreground">→</span>
              <input type="date" value={draft.dateTo || ""} onChange={(e) => setDraft({ ...draft, dateTo: e.target.value || undefined })} className="bg-input border border-border rounded px-2 py-1.5 text-xs" />
            </div>
          </Group>
          <Group title="PRESETS">
            <div className="space-y-2">
              {presets.length === 0 && <div className="text-[11px] text-muted-foreground">No presets saved.</div>}
              {presets.map((p) => (
                <div key={p.id} className="flex items-center gap-2 bg-input/40 border border-border rounded px-2 py-1.5">
                  <button onClick={() => { applyPreset(p.id); setFilterPanelOpen(false); }} className="flex-1 text-left text-xs flap-text tracking-[0.15em]">{p.name}</button>
                  <button onClick={() => removePreset(p.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Preset name" className="flex-1 bg-input border border-border rounded px-2 py-1.5 text-xs" />
                <button
                  onClick={() => { if (presetName.trim()) { savePreset(presetName.trim()); setPresetName(""); } }}
                  className="px-2 py-1.5 rounded border border-border hover:bg-accent inline-flex items-center gap-1 text-xs"
                ><Save className="w-3 h-3" /> Save current</button>
              </div>
            </div>
          </Group>
        </div>

        <footer className="px-5 py-3 border-t border-border flex items-center gap-2">
          <button onClick={() => { resetFilters(); setDraft({ ...draft, statuses: [], countries: [], companies: [], roles: [], tags: [], favoritesOnly: false, activeOnly: false, archivedOnly: false, dateFrom: undefined, dateTo: undefined }); }} className="px-3 py-2 rounded border border-border hover:bg-accent inline-flex items-center gap-1 text-xs">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
          <button onClick={apply} className="ml-auto px-4 py-2 rounded bg-amber text-primary-foreground flap-text text-[11px] tracking-[0.2em]">APPLY</button>
        </footer>
      </aside>
    </>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flap-text text-[10px] tracking-[0.25em] text-muted-foreground mb-2">{title}</div>
      {children}
    </section>
  );
}
function ChipGroup({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  if (options.length === 0) return <div className="text-[11px] text-muted-foreground">None.</div>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onToggle(o)}
          className={`px-2 py-1 rounded border text-[10px] flap-text tracking-[0.15em] ${selected.includes(o) ? "border-amber bg-amber/10 text-amber" : "border-border hover:bg-accent"}`}
        >{o}</button>
      ))}
    </div>
  );
}
function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={`px-2 py-1 rounded border text-[10px] flap-text tracking-[0.15em] ${on ? "border-amber bg-amber/10 text-amber" : "border-border hover:bg-accent"}`}
    >{label}</button>
  );
}
function unique(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))].sort();
}
