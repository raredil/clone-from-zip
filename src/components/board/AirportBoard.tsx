import { memo } from "react";
import type { Application, Status } from "@/lib/types";
import { selectApp, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { countryCode } from "@/lib/countries";

/**
 * Continuous modular airport/station information board.
 *
 * One uniform grid for the whole row. Every category — flight, destination,
 * position, status — uses the SAME per-character panel system, with the same
 * gap between cells AND between categories. Favorite rows simply tint the
 * non-status text orange; status keeps its own status color.
 */

type FieldKey = "flight" | "destination" | "position" | "status";

export interface FieldSpec {
  slots: number;
  align: "left" | "center";
  marquee?: boolean;
}

export const FIELD_SPECS: Record<FieldKey, FieldSpec> = {
  flight: { slots: 12, align: "left" },
  destination: { slots: 3, align: "center" },
  position: { slots: 20, align: "left", marquee: true },
  status: { slots: 11, align: "center" }, // fits "ASSESSMENT" (10) and "INTERVIEW" (9)
};

export const TOTAL_COLS =
  FIELD_SPECS.flight.slots +
  FIELD_SPECS.destination.slots +
  FIELD_SPECS.position.slots +
  FIELD_SPECS.status.slots;

export function AirportHeaderRow() {
  return (
    <div className="ab-header-row">
      <div style={{ gridColumn: `span ${FIELD_SPECS.flight.slots}` }}>FLIGHT</div>
      <div style={{ gridColumn: `span ${FIELD_SPECS.destination.slots}` }}>DEST</div>
      <div style={{ gridColumn: `span ${FIELD_SPECS.position.slots}` }}>POSITION</div>
      <div style={{ gridColumn: `span ${FIELD_SPECS.status.slots}` }}>STATUS</div>
    </div>
  );
}

interface FieldProps {
  text: string;
  spec: FieldSpec;
  fieldClass: string;
  charClass?: string;
}

function AirportField({ text, spec, fieldClass, charClass }: FieldProps) {
  const upper = (text || "").toUpperCase();
  const chars = Array.from(upper);
  const overflow = chars.length > spec.slots;
  const total = overflow ? chars.length : spec.slots;

  const padded: string[] = chars.slice();
  if (!overflow) {
    if (spec.align === "center") {
      const pad = spec.slots - chars.length;
      const left = Math.floor(pad / 2);
      const right = pad - left;
      for (let i = 0; i < left; i++) padded.unshift(" ");
      for (let i = 0; i < right; i++) padded.push(" ");
    } else {
      for (let i = chars.length; i < spec.slots; i++) padded.push(" ");
    }
  }

  const style = {
    ["--slots" as string]: String(spec.slots),
    ["--chars" as string]: String(total),
    gridColumn: `span ${spec.slots}`,
  } as React.CSSProperties;

  return (
    <div
      className={cn("ab-field", fieldClass, overflow && spec.marquee && "ab-field--marquee")}
      style={style}
      title={upper}
    >
      <div className="ab-cells" aria-hidden="true">
        {Array.from({ length: spec.slots }).map((_, i) => (
          <span key={i} className="ab-cell" />
        ))}
      </div>
      <div className="ab-text">
        {padded.map((c, i) => (
          <span key={i} className={cn("ab-ch", charClass)}>
            {c === " " ? "\u00A0" : c}
          </span>
        ))}
      </div>
    </div>
  );
}

interface RowProps {
  app: Application;
  // legacy prop, kept for API compatibility — no longer used visually
  showFavStar?: boolean;
}

function AirportBoardRowImpl({ app }: RowProps) {
  const selected = useStore((s) => s.selectedId === app.id);
  const fav = !!app.pinned;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => selectApp(app.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectApp(app.id);
        }
      }}
      className={cn(
        "ab-row group/abrow",
        fav && "is-fav",
        selected && "is-selected",
      )}
    >
      <AirportField
        text={app.company}
        spec={FIELD_SPECS.flight}
        fieldClass="ab-field--flight"
        charClass={fav ? "ab-ch--fav" : undefined}
      />
      <AirportField
        text={countryCode(app.country)}
        spec={FIELD_SPECS.destination}
        fieldClass="ab-field--destination"
        charClass={fav ? "ab-ch--fav" : undefined}
      />
      <AirportField
        text={app.role}
        spec={FIELD_SPECS.position}
        fieldClass="ab-field--position"
        charClass={fav ? "ab-ch--fav" : undefined}
      />
      <StatusField value={app.status} />
    </div>
  );
}

function StatusField({ value }: { value: Status }) {
  return (
    <AirportField
      text={value}
      spec={FIELD_SPECS.status}
      fieldClass="ab-field--status"
      charClass={`ab-ch--status ab-ch--status-${value.replace(/[^A-Z]/g, "")}`}
    />
  );
}

export const AirportBoardRow = memo(AirportBoardRowImpl);

export function AirportScreen({ children }: { children: React.ReactNode }) {
  return <div className="ab-screen">{children}</div>;
}
