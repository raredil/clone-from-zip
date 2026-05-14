import { useRef, useState } from "react";
import { useStore, updateSettings, requestNotifPermission, bulkImport, bulkImportReplace, wipeAll } from "@/lib/store";
import { downloadFile, exportJSON } from "@/lib/export";

type PendingImport = { apps: any[]; fileName: string } | null;

export function Settings() {
  const settings = useStore((s) => s.settings);
  const apps = useStore((s) => s.apps);
  const [confirm, setConfirm] = useState(false);
  const [importErr, setImportErr] = useState("");
  const [importMsg, setImportMsg] = useState("");
  const [pending, setPending] = useState<PendingImport>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setImportErr("");
    setImportMsg("");
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : data.apps;
      if (!Array.isArray(arr)) throw new Error("Invalid file format");
      setPending({ apps: arr, fileName: file.name });
    } catch (e) {
      setImportErr(e instanceof Error ? e.message : "Failed to read file");
    }
  }

  async function doMerge() {
    if (!pending) return;
    await bulkImport(pending.apps as any);
    setImportMsg(`Merged ${pending.apps.length} items from ${pending.fileName}.`);
    setPending(null);
  }
  async function doReplace() {
    if (!pending) return;
    await bulkImportReplace(pending.apps as any);
    setImportMsg(`Replaced data with ${pending.apps.length} items from ${pending.fileName}.`);
    setPending(null);
  }

  return (
    <div className="space-y-4">
      <div className="board-tile rounded border border-board-divider p-4">
        <div className="flap-text text-[10px] tracking-[0.25em] text-muted-foreground mb-3">NOTIFICATIONS</div>
        <div className="flex gap-2">
          <button
            onClick={() => { updateSettings({ notifications: !settings.notifications }); requestNotifPermission(); }}
            className={`px-3 py-2 rounded border text-xs flap-text tracking-[0.2em] ${settings.notifications ? "border-amber bg-amber/10 text-amber" : "border-border hover:bg-accent"}`}
          >BROWSER NOTIFICATIONS {settings.notifications ? "ON" : "OFF"}</button>
          <button
            onClick={() => updateSettings({ sound: !settings.sound })}
            className={`px-3 py-2 rounded border text-xs flap-text tracking-[0.2em] ${settings.sound ? "border-amber bg-amber/10 text-amber" : "border-border hover:bg-accent"}`}
          >SOUND {settings.sound ? "ON" : "OFF"}</button>
        </div>
      </div>

      <div className="board-tile rounded border border-board-divider p-4 space-y-3">
        <div className="flap-text text-[10px] tracking-[0.25em] text-muted-foreground">DATA · TRANSFER BETWEEN DEVICES</div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Export your data as a JSON file, copy it to another device, then import it there.
          Choose <span className="text-amber">REPLACE</span> to overwrite the current device with the file,
          or <span className="text-amber">MERGE</span> to combine both datasets (imported items win on ID collision).
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => downloadFile(`career-board-backup-${new Date().toISOString().slice(0,10)}.json`, exportJSON(apps), "application/json")}
            className="px-3 py-2 rounded border border-border hover:bg-accent flap-text text-[10px] tracking-[0.2em]"
          >EXPORT JSON</button>
          <label className="px-3 py-2 rounded border border-border hover:bg-accent flap-text text-[10px] tracking-[0.2em] cursor-pointer">
            CHOOSE IMPORT FILE
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
          </label>
          {!confirm ? (
            <button onClick={() => setConfirm(true)} className="px-3 py-2 rounded border border-destructive/50 text-destructive hover:bg-destructive/10 flap-text text-[10px] tracking-[0.2em]">WIPE ALL DATA</button>
          ) : (
            <span className="inline-flex items-center gap-2 text-xs">
              <span className="text-destructive">Are you sure?</span>
              <button onClick={async () => { await wipeAll(); setConfirm(false); }} className="px-3 py-2 rounded bg-destructive text-destructive-foreground flap-text text-[10px] tracking-[0.2em]">YES, WIPE</button>
              <button onClick={() => setConfirm(false)} className="px-3 py-2 rounded border border-border flap-text text-[10px] tracking-[0.2em]">CANCEL</button>
            </span>
          )}
        </div>

        {pending && (
          <div className="rounded border border-amber/50 bg-amber/5 p-3 space-y-2">
            <div className="flap-text text-[11px] tracking-[0.2em] text-amber">
              FILE READY: {pending.fileName} — {pending.apps.length} ITEMS
            </div>
            <div className="text-[11px] text-muted-foreground">
              How should this be imported into the current device?
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={doReplace}
                className="px-3 py-2 rounded border border-destructive/60 text-destructive hover:bg-destructive/10 flap-text text-[10px] tracking-[0.2em]"
              >REPLACE ALL</button>
              <button
                onClick={doMerge}
                className="px-3 py-2 rounded border border-amber bg-amber/10 text-amber hover:bg-amber/20 flap-text text-[10px] tracking-[0.2em]"
              >MERGE WITH EXISTING</button>
              <button
                onClick={() => setPending(null)}
                className="px-3 py-2 rounded border border-border hover:bg-accent flap-text text-[10px] tracking-[0.2em]"
              >CANCEL</button>
            </div>
          </div>
        )}

        {importMsg && <div className="text-[11px] text-amber">{importMsg}</div>}
        {importErr && <div className="text-[11px] text-destructive">{importErr}</div>}
      </div>

      <div className="board-tile rounded border border-board-divider p-4 text-[11px] text-muted-foreground leading-relaxed">
        Career Board is fully offline-first. Data is stored in your browser via IndexedDB with localStorage backup, and never leaves your device. Use Export / Import to transfer between laptops.
      </div>
    </div>
  );
}
