import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * Non-intrusive banner shown only if the browser refused persistent storage.
 * Lets the user retry the prompt with a click — many browsers only grant
 * `navigator.storage.persist()` after a user gesture.
 */
export function StorageWarning() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (typeof navigator === "undefined" || !navigator.storage?.persisted) return;
        const persisted = await navigator.storage.persisted();
        if (!cancelled) setShow(!persisted);
      } catch {/* ignore */}
    })();
    return () => { cancelled = true; };
  }, []);

  async function requestPersistence() {
    try {
      if (!navigator.storage?.persist) return;
      const granted = await navigator.storage.persist();
      if (granted) {
        toast.success("Persistent storage enabled — your data is safe across restarts.");
        setShow(false);
      } else {
        toast.warning("Browser denied permanent storage. Bookmark this page or export backups regularly.");
      }
    } catch {/* ignore */}
  }

  if (!show) return null;

  return (
    <div className="board-frame px-3 py-2 flex items-center gap-3 border-amber/60 bg-amber/10">
      <AlertCircle className="w-4 h-4 text-amber shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flap-text text-amber text-[10px] tracking-[0.25em]">STORAGE NOT PERSISTENT</div>
        <div className="text-[11px] text-muted-foreground">
          Browser may evict data on restart. Click to enable permanent storage.
        </div>
      </div>
      <button
        onClick={requestPersistence}
        className="px-3 py-1.5 rounded bg-amber text-primary-foreground flap-text text-[10px] tracking-[0.25em] shrink-0"
      >ENABLE</button>
      <button
        onClick={() => setShow(false)}
        className="px-2 py-1.5 text-[10px] text-muted-foreground hover:text-foreground shrink-0"
      >DISMISS</button>
    </div>
  );
}
