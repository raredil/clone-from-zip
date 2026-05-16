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
  flight: { slots: 12, align: "left", marquee: true },
  destination: { slots: 3, align: "center" },
  position: { slots: 20, align: "left", marquee: true },
  // bumped to 13 + marquee so "ASSESSMENT 12" / "INTERVIEW 10" fit cleanly.
  status: { slots: 13, align: "center", marquee: true },
};

/** Empty modular panels flanking the STATUS field (left + right). */
const STATUS_PAD_SLOTS = 1;
/** Empty modular panels flanking the DESTINATION field (left + right). */
const DEST_PAD_SLOTS = 1;

export const TOTAL_COLS =
  FIELD_SPECS.flight.slots +
  DEST_PAD_SLOTS +
  FIELD_SPECS.destination.slots +
  DEST_PAD_SLOTS +
  FIELD_SPECS.position.slots +
  STATUS_PAD_SLOTS +
  FIELD_SPECS.status.slots +
  STATUS_PAD_SLOTS;

export function AirportHeaderRow() {
  return (
    <div className="ab-header-row">
      <div style={{ gridColumn: `span ${FIELD_SPECS.flight.slots}` }}>FLIGHT</div>
      <div style={{ gridColumn: `span ${DEST_PAD_SLOTS}` }} aria-hidden="true" />
      <div style={{ gridColumn: `span ${FIELD_SPECS.destination.slots}` }}>DST</div>
      <div style={{ gridColumn: `span ${DEST_PAD_SLOTS}` }} aria-hidden="true" />
      <div style={{ gridColumn: `span ${FIELD_SPECS.position.slots}` }}>POSITION</div>
      <div style={{ gridColumn: `span ${STATUS_PAD_SLOTS}` }} aria-hidden="true" />
      <div style={{ gridColumn: `span ${FIELD_SPECS.status.slots}` }}>STATUS</div>
      <div style={{ gridColumn: `span ${STATUS_PAD_SLOTS}` }} aria-hidden="true" />
    </div>
  );
}

interface FieldProps {
  text: string;
  spec: FieldSpec;
  fieldClass: string;
  charClass?: string;
  /** Returns a className for character at index `i` (in the original text, not padded). */
  charClassAt?: (i: number, ch: string) => string | undefined;
}

function AirportField({ text, spec, fieldClass, charClass, charClassAt }: FieldProps) {
  const upper = (text || "").toUpperCase();
  const chars = Array.from(upper);
  const overflow = chars.length > spec.slots;
  const total = overflow ? chars.length : spec.slots;

  const padded: string[] = chars.slice();
  let leftPad = 0;
  if (!overflow) {
    if (spec.align === "center") {
      const pad = spec.slots - chars.length;
      const left = Math.floor(pad / 2);
      const right = pad - left;
      leftPad = left;
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
        {padded.map((c, i) => {
          const origIdx = i - leftPad;
          const extra = charClassAt && origIdx >= 0 && origIdx < chars.length
            ? charClassAt(origIdx, c)
            : undefined;
          return (
            <span key={i} className={cn("ab-ch", charClass, extra)}>
              {c === " " ? "\u00A0" : c}
            </span>
          );
        })}
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
  const statusKey = app.status.replace(/[^A-Z]/g, "");
  // Prefix favorite rows with "★ " in the flight field. The first char is
  // styled by the `charClassAt` callback so it stays orange (red on REJECTED)
  // independent of the row's status color.
  const flightText = (fav ? "★ " : "") + app.company;
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
        `is-status-${statusKey}`,
      )}
    >
      <AirportField
        text={flightText}
        spec={FIELD_SPECS.flight}
        fieldClass="ab-field--flight"
        charClassAt={fav ? (i) => (i === 0 ? "ab-ch--fav-star" : undefined) : undefined}
      />
      <EmptyPanels count={DEST_PAD_SLOTS} />
      <AirportField
        text={countryCode(app.country)}
        spec={FIELD_SPECS.destination}
        fieldClass="ab-field--destination"
      />
      <EmptyPanels count={DEST_PAD_SLOTS} />
      <AirportField
        text={app.role}
        spec={FIELD_SPECS.position}
        fieldClass="ab-field--position"
      />
      <EmptyPanels count={STATUS_PAD_SLOTS} />
      <StatusField value={app.status} app={app} />
      <EmptyPanels count={STATUS_PAD_SLOTS} />
    </div>
  );
}

function EmptyPanels({ count }: { count: number }) {
  const style = {
    ["--slots" as string]: String(count),
    ["--chars" as string]: String(count),
    gridColumn: `span ${count}`,
  } as React.CSSProperties;
  return (
    <div className="ab-field ab-field--empty" style={style} aria-hidden="true">
      <div className="ab-cells">
        {Array.from({ length: count }).map((_, i) => (
          <span key={i} className="ab-cell" />
        ))}
      </div>
    </div>
  );
}

function StatusField({ value, app }: { value: Status; app: Application }) {
  const isWaiting = value === "WAITING";
  let displayText: string;
  if (isWaiting) displayText = "...";
  else if (value === "INTERVIEW" || value === "ASSESSMENT") {
    const n = stageNumberFor(app, value);
    displayText = `${value} ${n}`;
  } else {
    displayText = value;
  }
  return (
    <AirportField
      text={displayText}
      spec={FIELD_SPECS.status}
      fieldClass="ab-field--status"
      charClass={`ab-ch--status ab-ch--status-${value.replace(/[^A-Z]/g, "")}${isWaiting ? " ab-ch--waiting-dot" : ""}`}
    />
  );
}

/** Count occurrences of a given status (INTERVIEW or ASSESSMENT) in history.
 *  Defaults to 1 when history is missing/empty but current status matches. */
export function stageNumberFor(app: Application, status: "INTERVIEW" | "ASSESSMENT"): number {
  const hist = app.statusHistory || [];
  let n = 0;
  for (const e of hist) if (e && e.status === status) n++;
  if (n === 0 && app.status === status) n = 1;
  return Math.max(1, n);
}

export const AirportBoardRow = memo(AirportBoardRowImpl);

export function AirportScreen({ children }: { children: React.ReactNode }) {
  return <div className="ab-screen">{children}</div>;
}
