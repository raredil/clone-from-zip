import { memo } from "react";
import type { Application } from "@/lib/types";
import { selectApp, useStore } from "@/lib/store";
import { StatusLabel } from "./StatusLabel";
import { cn } from "@/lib/utils";

interface Props {
  app: Application;
}

function RowImpl({ app }: Props) {
  const selected = useStore((s) => s.selectedId === app.id);
  return (
    <tr
      onClick={() => selectApp(app.id)}
      className={cn(
        "row-flap board-tile cursor-pointer select-none",
        selected && "is-selected",
      )}
    >
      <td className="px-3 py-2 w-1/4 text-center">
        <div className="truncate flap-text text-[12px]" title={app.company}>{app.pinned ? "* " : ""}{app.company}</div>
      </td>
      <td className="px-3 py-2 w-1/4 text-center">
        <div className="truncate flap-text text-[12px] text-muted-foreground" title={app.country}>{app.country}</div>
      </td>
      <td className="px-3 py-2 w-1/4 text-center">
        <PositionMarquee text={app.role} />
      </td>
      <td className="px-3 py-2 w-1/4 text-center">
        <div className="flex justify-center">
          <StatusLabel value={app.status} />
        </div>
      </td>
    </tr>
  );
}
export const Row = memo(RowImpl);

function PositionMarquee({ text }: { text: string }) {
  return (
    <div className="position-marquee flap-text text-[12px] text-foreground/90" title={text}>
      <span className="position-marquee-inner">{text}</span>
    </div>
  );
}
