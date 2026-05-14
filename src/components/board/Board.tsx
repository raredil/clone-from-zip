import { useMemo } from "react";
import { useStore } from "@/lib/store";
import { applyFilters, applySort } from "@/lib/filter";
import {
  AirportBoardRow,
  AirportHeaderRow,
  AirportScreen,
} from "./AirportBoard";

export function Board() {
  const apps = useStore((s) => s.apps);
  const filters = useStore((s) => s.filters);

  const visible = useMemo(() => {
    const filtered = applyFilters(apps, filters);
    return applySort(filtered, filters.sortBy || "default", filters.sortDir || "desc");
  }, [apps, filters]);

  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-muted-foreground flap-text text-sm">
        NO RESULTS — ADJUST FILTERS OR ADD AN APPLICATION
      </div>
    );
  }

  const mid = Math.ceil(visible.length / 2);
  const left = visible.slice(0, mid);
  const right = visible.slice(mid);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      <AirportColumn rows={left} />
      <AirportColumn rows={right} />
    </div>
  );
}

function AirportColumn({ rows }: { rows: ReturnType<typeof applyFilters> }) {
  return (
    <AirportScreen>
      <AirportHeaderRow />
      <div className="ab-rows">
        {rows.map((app) => (
          <AirportBoardRow key={app.id} app={app} />
        ))}
      </div>
    </AirportScreen>
  );
}
