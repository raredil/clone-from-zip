import { useStore, selectApp } from "@/lib/store";

export function Activity() {
  const items = useStore((s) => s.activity);
  if (items.length === 0) return <div className="text-muted-foreground text-sm">No activity yet.</div>;
  return (
    <div className="board-tile rounded border border-board-divider divide-y divide-board-divider">
      {items.slice(0, 200).map((e) => (
        <div key={e.id} className="px-4 py-2 flex items-center gap-3 text-xs hover:bg-accent/40 cursor-pointer" onClick={() => e.appId && selectApp(e.appId)}>
          <span className="flap-text text-[10px] tracking-[0.2em] text-muted-foreground w-36">{new Date(e.ts).toLocaleString()}</span>
          <span className="flap-text text-[10px] tracking-[0.2em] text-amber w-20">{e.kind}</span>
          <span className="text-foreground/90">{e.text}</span>
        </div>
      ))}
    </div>
  );
}
