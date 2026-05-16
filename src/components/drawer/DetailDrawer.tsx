import { useEffect, useRef, useState } from "react";
import { X, Trash2, Pin, PinOff, ExternalLink, Plus, Upload, Download, Eye, Mail, Linkedin, Undo2, Redo2, Eraser } from "lucide-react";
import { useStore, selectApp, updateApp, removeApp, cryptoId, undoStatusChange, redoStatusChange, clearStatusHistory, canUndoStatus, canRedoStatus } from "@/lib/store";
import { ALL_STATUSES, type DocLink } from "@/lib/types";
import { StatusLabel } from "../board/StatusLabel";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { normalizeCountry } from "@/lib/countries";
import { putDocBlob, getDocBlob, deleteDocBlob } from "@/lib/db";
import { displayStatus } from "@/lib/export";

export function DetailDrawer() {
  const id = useStore((s) => s.selectedId);
  const app = useStore((s) => s.apps.find((a) => a.id === s.selectedId));
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") selectApp(null); }
    if (id) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id]);

  if (!id || !app) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => selectApp(null)} />
      <aside className="fixed top-0 right-0 h-screen w-[min(520px,100vw)] bg-card border-l border-border z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        <header className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <div className="flap-text text-[10px] text-muted-foreground tracking-[0.25em]">APPLICATION · {displayStatus(app)}</div>
            <h2 className="flap-text text-lg tracking-[0.15em] mt-1">{app.company}</h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => updateApp(app.id, { pinned: !app.pinned })}
              className="p-2 rounded hover:bg-accent" aria-label="Pin"
            >
              {app.pinned ? <PinOff className="w-4 h-4 text-amber" /> : <Pin className="w-4 h-4" />}
            </button>
            <button onClick={() => selectApp(null)} className="p-2 rounded hover:bg-accent" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto scroll-thin px-5 py-4 space-y-5">
          <section className="grid grid-cols-2 gap-3">
            <Field label="Company" value={app.company} onChange={(v) => updateApp(app.id, { company: v.toUpperCase() })} />
            <div>
              <Label>Country</Label>
              <div className="mt-1">
                <CountrySelect value={app.country} onChange={(v) => updateApp(app.id, { country: normalizeCountry(v) })} />
              </div>
            </div>
            <Field label="Role" value={app.role} onChange={(v) => updateApp(app.id, { role: v.toUpperCase() })} className="col-span-2" />
            <div className="col-span-2">
              <Label>Status</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ALL_STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => updateApp(app.id, { status: s })}
                    className={`px-2 py-1 rounded border text-[10px] flap-text tracking-[0.18em] ${app.status === s ? "border-amber bg-amber/10" : "border-border hover:bg-accent"}`}
                  >
                    <StatusLabel value={s} />
                  </button>
                ))}
              </div>
            </div>
            <Field label="Salary" value={app.salary || ""} onChange={(v) => updateApp(app.id, { salary: v })} />
            <Field label="Recruiter (name)" value={app.recruiter || ""} onChange={(v) => updateApp(app.id, { recruiter: v })} />
            <div>
              <Label>Recruiter email</Label>
              <div className="flex gap-1 mt-1">
                <input
                  type="email"
                  defaultValue={app.recruiterEmail || ""}
                  onBlur={(e) => updateApp(app.id, { recruiterEmail: e.target.value.trim() })}
                  className="flex-1 bg-input border border-border rounded px-2 py-1.5 text-xs"
                  placeholder="name@company.com"
                />
                {app.recruiterEmail && (
                  <a href={`mailto:${app.recruiterEmail}`} className="px-2 py-1.5 rounded border border-border hover:bg-accent" aria-label="Email recruiter">
                    <Mail className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
            <div>
              <Label>Recruiter LinkedIn</Label>
              <div className="flex gap-1 mt-1">
                <input
                  defaultValue={app.recruiterLinkedin || ""}
                  onBlur={(e) => updateApp(app.id, { recruiterLinkedin: e.target.value.trim() })}
                  className="flex-1 bg-input border border-border rounded px-2 py-1.5 text-xs"
                  placeholder="https://linkedin.com/in/…"
                />
                {isValidUrl(app.recruiterLinkedin) && (
                  <a href={app.recruiterLinkedin} target="_blank" rel="noreferrer" className="px-2 py-1.5 rounded border border-border hover:bg-accent" aria-label="Open LinkedIn">
                    <Linkedin className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
            <div className="col-span-2">
              <Label>Link</Label>
              <div className="flex gap-1 mt-1">
                <input
                  defaultValue={app.link || ""}
                  onBlur={(e) => updateApp(app.id, { link: e.target.value })}
                  className="flex-1 bg-input border border-border rounded px-2 py-1.5 text-xs"
                  placeholder="https://"
                />
                {app.link && (
                  <a href={app.link} target="_blank" rel="noreferrer" className="px-2 py-1.5 rounded border border-border hover:bg-accent">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
            <div className="col-span-2">
              <Label>Tags (comma separated)</Label>
              <input
                defaultValue={(app.tags || []).join(", ")}
                onBlur={(e) => updateApp(app.id, { tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                className="w-full bg-input border border-border rounded px-2 py-1.5 text-xs mt-1"
                placeholder="remote, design-system"
              />
            </div>
          </section>

          <section>
            <Label>Notes</Label>
            <textarea
              defaultValue={app.notes || ""}
              onBlur={(e) => updateApp(app.id, { notes: e.target.value })}
              rows={4}
              className="w-full mt-1 bg-input border border-border rounded px-3 py-2 text-xs leading-relaxed resize-y"
              placeholder="Notes, recruiter messages, observations…"
            />
          </section>

          <Stages app={app} />
          <Reminders app={app} />
          <Docs app={app} />
          <StatusHistorySection app={app} />

          <section>
            <Label>Outcome</Label>
            <input
              defaultValue={app.outcome || ""}
              onBlur={(e) => updateApp(app.id, { outcome: e.target.value })}
              className="w-full mt-1 bg-input border border-border rounded px-2 py-1.5 text-xs"
              placeholder="e.g. Offer accepted"
            />
          </section>

          <section className="text-[10px] text-muted-foreground flap-text tracking-[0.15em] space-y-1 pt-2 border-t border-border">
            <div>CREATED {new Date(app.createdAt).toLocaleString()}</div>
            <div>UPDATED {new Date(app.updatedAt).toLocaleString()}</div>
            {app.statusChangedAt && <div>STATUS SINCE {new Date(app.statusChangedAt).toLocaleString()}</div>}
            {app.appliedAt && <div>APPLIED {new Date(app.appliedAt).toLocaleString()}</div>}
            <div className="pt-2">
              <button
                onClick={() => updateApp(app.id, { archived: !app.archived })}
                className="px-2 py-1 rounded border border-border hover:bg-accent mr-2"
              >
                {app.archived ? "Unarchive" : "Archive"}
              </button>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="px-2 py-1 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <span className="text-destructive">Confirm?</span>
                  <button onClick={() => removeApp(app.id)} className="px-2 py-1 rounded bg-destructive text-destructive-foreground">Yes, delete</button>
                  <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded border border-border">Cancel</button>
                </span>
              )}
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="flap-text text-[9px] tracking-[0.25em] text-muted-foreground">{children}</div>;
}

function isValidUrl(s?: string): boolean {
  if (!s) return false;
  try { new URL(s); return true; } catch { return false; }
}

function Field({ label, value, onChange, className }: { label: string; value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <div className={className}>
      <Label>{label}</Label>
      <input
        defaultValue={value}
        onBlur={(e) => onChange(e.target.value)}
        className="w-full mt-1 bg-input border border-border rounded px-2 py-1.5 text-xs"
      />
    </div>
  );
}

function Stages({ app }: { app: import("@/lib/types").Application }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-1">
        <Label>Interview stages</Label>
        <button
          onClick={() => updateApp(app.id, { stages: [...app.stages, { id: cryptoId(), name: "Stage", done: false }] })}
          className="text-[10px] flap-text tracking-[0.2em] px-2 py-1 rounded border border-border hover:bg-accent inline-flex items-center gap-1"
        ><Plus className="w-3 h-3" /> ADD</button>
      </div>
      <div className="space-y-1">
        {app.stages.length === 0 && <div className="text-[11px] text-muted-foreground">No stages yet.</div>}
        {app.stages.map((s) => (
          <div key={s.id} className="flex items-center gap-2 bg-input/40 border border-border rounded px-2 py-1.5">
            <input
              type="checkbox" checked={s.done}
              onChange={(e) => updateApp(app.id, { stages: app.stages.map((x) => x.id === s.id ? { ...x, done: e.target.checked } : x) })}
            />
            <input
              defaultValue={s.name}
              onBlur={(e) => updateApp(app.id, { stages: app.stages.map((x) => x.id === s.id ? { ...x, name: e.target.value } : x) })}
              className="flex-1 bg-transparent text-xs outline-none"
            />
            <input
              type="date" defaultValue={s.date || ""}
              onBlur={(e) => updateApp(app.id, { stages: app.stages.map((x) => x.id === s.id ? { ...x, date: e.target.value } : x) })}
              className="bg-transparent text-xs outline-none"
            />
            <button
              onClick={() => updateApp(app.id, { stages: app.stages.filter((x) => x.id !== s.id) })}
              className="text-muted-foreground hover:text-destructive"
            ><X className="w-3 h-3" /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Reminders({ app }: { app: import("@/lib/types").Application }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-1">
        <Label>Reminders</Label>
        <button
          onClick={() => updateApp(app.id, { reminders: [...app.reminders, { id: cryptoId(), text: "Follow up", due: new Date().toISOString().slice(0,10), done: false }] })}
          className="text-[10px] flap-text tracking-[0.2em] px-2 py-1 rounded border border-border hover:bg-accent inline-flex items-center gap-1"
        ><Plus className="w-3 h-3" /> ADD</button>
      </div>
      <div className="space-y-1">
        {app.reminders.length === 0 && <div className="text-[11px] text-muted-foreground">No reminders.</div>}
        {app.reminders.map((r) => (
          <div key={r.id} className="flex items-center gap-2 bg-input/40 border border-border rounded px-2 py-1.5">
            <input
              type="checkbox" checked={r.done}
              onChange={(e) => updateApp(app.id, { reminders: app.reminders.map((x) => x.id === r.id ? { ...x, done: e.target.checked } : x) })}
            />
            <input
              defaultValue={r.text}
              onBlur={(e) => updateApp(app.id, { reminders: app.reminders.map((x) => x.id === r.id ? { ...x, text: e.target.value } : x) })}
              className="flex-1 bg-transparent text-xs outline-none"
            />
            <input
              type="date" defaultValue={r.due}
              onBlur={(e) => updateApp(app.id, { reminders: app.reminders.map((x) => x.id === r.id ? { ...x, due: e.target.value } : x) })}
              className="bg-transparent text-xs outline-none"
            />
            <button
              onClick={() => updateApp(app.id, { reminders: app.reminders.filter((x) => x.id !== r.id) })}
              className="text-muted-foreground hover:text-destructive"
            ><X className="w-3 h-3" /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Docs({ app }: { app: import("@/lib/types").Application }) {
  const fileInput = useRef<HTMLInputElement | null>(null);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const newDocs: DocLink[] = [];
    for (const f of Array.from(files)) {
      const blobId = cryptoId();
      try {
        await putDocBlob(blobId, f);
      } catch (e) {
        console.warn("[docs] upload failed", e);
        continue;
      }
      newDocs.push({
        id: cryptoId(),
        name: f.name,
        url: "",
        kind: "file",
        blobId,
        mime: f.type || "application/octet-stream",
        size: f.size,
        addedAt: new Date().toISOString(),
      });
    }
    if (newDocs.length) {
      updateApp(app.id, { docs: [...app.docs, ...newDocs] });
    }
  }

  async function openBlob(d: DocLink, mode: "view" | "download") {
    if (!d.blobId) return;
    const blob = await getDocBlob(d.blobId);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    if (mode === "view") {
      const w = window.open(url, "_blank");
      if (!w) window.location.href = url;
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = d.name || "document";
      document.body.appendChild(a); a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1500);
      return;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function removeDoc(d: DocLink) {
    if (d.kind === "file" && d.blobId) {
      await deleteDocBlob(d.blobId);
    }
    updateApp(app.id, { docs: app.docs.filter((x) => x.id !== d.id) });
  }

  function fmtSize(n?: number) {
    if (!n && n !== 0) return "";
    if (n < 1024) return `${n}B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
    return `${(n / 1024 / 1024).toFixed(1)}MB`;
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-1">
        <Label>Documents &amp; links</Label>
        <div className="flex items-center gap-1">
          <input
            ref={fileInput}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => { handleUpload(e.target.files); e.target.value = ""; }}
          />
          <button
            onClick={() => fileInput.current?.click()}
            className="text-[10px] flap-text tracking-[0.2em] px-2 py-1 rounded border border-border hover:bg-accent inline-flex items-center gap-1"
          ><Upload className="w-3 h-3" /> UPLOAD</button>
          <button
            onClick={() => updateApp(app.id, { docs: [...app.docs, { id: cryptoId(), name: "Resume", url: "", kind: "link" }] })}
            className="text-[10px] flap-text tracking-[0.2em] px-2 py-1 rounded border border-border hover:bg-accent inline-flex items-center gap-1"
          ><Plus className="w-3 h-3" /> LINK</button>
        </div>
      </div>
      <div className="space-y-1">
        {app.docs.length === 0 && <div className="text-[11px] text-muted-foreground">No documents.</div>}
        {app.docs.map((d) => {
          const isFile = d.kind === "file";
          return (
            <div key={d.id} className="flex items-center gap-2 bg-input/40 border border-border rounded px-2 py-1.5">
              <input
                defaultValue={d.name}
                onBlur={(e) => updateApp(app.id, { docs: app.docs.map((x) => x.id === d.id ? { ...x, name: e.target.value } : x) })}
                className="w-32 bg-transparent text-xs outline-none"
              />
              {isFile ? (
                <span className="flex-1 text-[10px] text-muted-foreground truncate" title={`${d.mime || ""} · ${fmtSize(d.size)}`}>
                  {(d.mime || "file").split("/").pop()} · {fmtSize(d.size)}
                </span>
              ) : (
                <input
                  defaultValue={d.url}
                  onBlur={(e) => updateApp(app.id, { docs: app.docs.map((x) => x.id === d.id ? { ...x, url: e.target.value } : x) })}
                  className="flex-1 bg-transparent text-xs outline-none"
                  placeholder="URL"
                />
              )}
              {isFile ? (
                <>
                  <button onClick={() => openBlob(d, "view")} className="text-muted-foreground hover:text-foreground" aria-label="View"><Eye className="w-3 h-3" /></button>
                  <button onClick={() => openBlob(d, "download")} className="text-muted-foreground hover:text-foreground" aria-label="Download"><Download className="w-3 h-3" /></button>
                </>
              ) : (
                d.url && <a href={d.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground"><ExternalLink className="w-3 h-3" /></a>
              )}
              <button
                onClick={() => removeDoc(d)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Remove"
              ><X className="w-3 h-3" /></button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StatusHistorySection({ app }: { app: import("@/lib/types").Application }) {
  const history = app.statusHistory || [];
  return (
    <section>
      <Label>Status history</Label>
      {history.length === 0 ? (
        <div className="text-[11px] text-muted-foreground mt-1">No transitions recorded.</div>
      ) : (
        <ol className="mt-1 space-y-1 border-l border-border pl-3">
          {history.slice().reverse().map((e) => (
            <li key={e.id} className="relative text-[11px] flap-text tracking-[0.12em]">
              <span className="absolute -left-[15px] top-[5px] inline-block w-1.5 h-1.5 rounded-full bg-amber" />
              <div className="flex items-center justify-between gap-2">
                <span>
                  {e.from ? <span className="text-muted-foreground">{e.from} → </span> : null}
                  <StatusLabel value={e.status} />
                </span>
                <span className="text-muted-foreground tabular-nums">{new Date(e.ts).toLocaleString()}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
