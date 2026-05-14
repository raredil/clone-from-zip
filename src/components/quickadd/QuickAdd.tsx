import { useState } from "react";
import { X } from "lucide-react";
import { useStore, setQuickAddOpen, addApp, selectApp } from "@/lib/store";
import { ALL_STATUSES, type Status } from "@/lib/types";
import { CountrySelect } from "@/components/ui/CountrySelect";
import { normalizeCountry } from "@/lib/countries";

export function QuickAdd() {
  const open = useStore((s) => s.quickAddOpen);
  const [tab, setTab] = useState<"FORM" | "LINK" | "TEXT">("FORM");
  const [company, setCompany] = useState("");
  const [country, setCountry] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<Status>("SAVED");
  const [link, setLink] = useState("");
  const [text, setText] = useState("");

  if (!open) return null;

  function close() {
    setQuickAddOpen(false);
    setCompany(""); setCountry(""); setRole(""); setStatus("SAVED"); setLink(""); setText("");
  }

  async function submit() {
    let parsed: Partial<import("@/lib/types").Application> = {};
    if (tab === "FORM") {
      if (!company.trim()) return;
      parsed = { company: company.toUpperCase(), country: normalizeCountry(country) || "—", role: role.toUpperCase() || "ROLE", status };
    } else if (tab === "LINK") {
      const url = link.trim();
      if (!url) return;
      parsed = { ...parseLink(url), link: url, status };
    } else {
      if (!text.trim()) return;
      parsed = { ...parseText(text), status };
    }
    const app = await addApp(parsed);
    close();
    selectApp(app.id);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm flex items-center justify-center p-4" onClick={close}>
        <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl bg-card border border-border rounded-lg shadow-2xl">
          <header className="px-5 py-3 border-b border-border flex items-center justify-between">
            <h2 className="flap-text text-sm tracking-[0.25em]">QUICK ADD</h2>
            <button onClick={close} className="p-2 rounded hover:bg-accent"><X className="w-4 h-4" /></button>
          </header>
          <div className="px-5 pt-3 flex gap-1">
            {(["FORM","LINK","TEXT"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded border text-[10px] flap-text tracking-[0.2em] ${tab === t ? "border-amber bg-amber/10 text-amber" : "border-border hover:bg-accent"}`}>{t}</button>
            ))}
          </div>
          <div className="p-5 space-y-3">
            {tab === "FORM" && (
              <>
                <Input label="Company" value={company} onChange={setCompany} autoFocus />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Country</Label>
                    <div className="mt-1"><CountrySelect value={country} onChange={setCountry} placeholder="United States" /></div>
                  </div>
                  <Input label="Role" value={role} onChange={setRole} placeholder="Product Designer" />
                </div>
              </>
            )}
            {tab === "LINK" && (
              <Input label="Job posting URL" value={link} onChange={setLink} placeholder="https://example.com/jobs/..." autoFocus />
            )}
            {tab === "TEXT" && (
              <div>
                <Label>Paste job posting text</Label>
                <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} className="w-full mt-1 bg-input border border-border rounded px-3 py-2 text-xs" placeholder="Company: Stripe&#10;Role: Senior Product Designer&#10;Country: US" />
              </div>
            )}
            <div>
              <Label>Status</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {ALL_STATUSES.map((s) => (
                  <button key={s} onClick={() => setStatus(s)} className={`px-2 py-1 rounded border text-[10px] flap-text tracking-[0.18em] ${status === s ? "border-amber bg-amber/10 text-amber" : "border-border hover:bg-accent"}`}>{s}</button>
                ))}
              </div>
            </div>
          </div>
          <footer className="px-5 py-3 border-t border-border flex items-center justify-end gap-2">
            <button onClick={close} className="px-3 py-2 rounded border border-border hover:bg-accent text-xs">Cancel</button>
            <button onClick={submit} className="px-4 py-2 rounded bg-amber text-primary-foreground flap-text text-[11px] tracking-[0.2em]">ADD</button>
          </footer>
        </div>
      </div>
    </>
  );
}

function Input({ label, value, onChange, placeholder, autoFocus }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full mt-1 bg-input border border-border rounded px-3 py-2 text-xs"
      />
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="flap-text text-[9px] tracking-[0.25em] text-muted-foreground">{children}</div>;
}

function parseLink(url: string): Partial<import("@/lib/types").Application> {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "").split(".")[0];
    const company = host.toUpperCase();
    // try to read role from query / path
    const path = decodeURIComponent(u.pathname).replace(/[-_/]/g, " ").trim();
    const guess = path.split(" ").filter(Boolean).slice(-4).join(" ").toUpperCase();
    return { company, role: guess || "ROLE", country: "—" };
  } catch {
    return { company: "UNTITLED", role: "ROLE", country: "—" };
  }
}
function parseText(text: string): Partial<import("@/lib/types").Application> {
  const lines = text.split(/\r?\n/);
  const get = (re: RegExp) => {
    for (const l of lines) { const m = l.match(re); if (m) return m[1].trim(); }
    return "";
  };
  const company = get(/(?:company|employer)\s*[:\-]\s*(.+)/i) || lines[0]?.slice(0, 40) || "UNTITLED";
  const role = get(/(?:role|title|position)\s*[:\-]\s*(.+)/i) || "ROLE";
  const country = get(/(?:country|location)\s*[:\-]\s*(.+)/i) || "—";
  return { company: company.toUpperCase(), role: role.toUpperCase(), country: country.toUpperCase() };
}
