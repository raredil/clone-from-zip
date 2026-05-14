import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, searchCountries, countryFullName } from "@/lib/countries";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

/** Offline autocomplete/select for country input. Saves the canonical full name. */
export function CountrySelect({ value, onChange, placeholder = "Country", className, autoFocus }: Props) {
  const [query, setQuery] = useState(() => countryFullName(value) || value || "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(countryFullName(value) || value || ""); }, [value]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const matches = useMemo(() => searchCountries(query, 8), [query]);

  function commit(name: string) {
    setQuery(name);
    onChange(name);
    setOpen(false);
  }

  function onBlur() {
    // normalize freeform entry on blur
    const norm = countryFullName(query);
    if (norm && norm !== query) setQuery(norm);
    onChange(norm || query);
  }

  return (
    <div ref={wrapRef} className={`relative ${className ?? ""}`}>
      <input
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(matches.length - 1, a + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === "Enter" && open && matches[active]) { e.preventDefault(); commit(matches[active].name); }
          else if (e.key === "Escape") { setOpen(false); }
        }}
        placeholder={placeholder}
        className="w-full bg-input border border-border rounded px-3 py-2 text-xs"
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div className="absolute z-50 mt-1 left-0 right-0 max-h-56 overflow-auto rounded border border-border bg-popover shadow-lg">
          {matches.map((c, i) => (
            <button
              type="button"
              key={c.code}
              onMouseDown={(e) => { e.preventDefault(); commit(c.name); }}
              onMouseEnter={() => setActive(i)}
              className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between gap-2 ${i === active ? "bg-accent" : "hover:bg-accent"}`}
            >
              <span>{c.name}</span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{c.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { COUNTRIES };
