import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import type { Application, FilterState, SortKey, Status } from "./types";
import { applySort } from "./filter";
import { countryFullName } from "./countries";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v).replace(/"/g, '""');
  return /[",\n]/.test(s) ? `"${s}"` : s;
}

export function exportCSV(apps: Application[], filters?: FilterState): string {
  const headers = ["id","company","country","role","status","pinned","archived","salary","recruiter","tags","link","appliedAt","createdAt","updatedAt","notes"];
  const meta = `# Career Board Export\n# Generated: ${new Date().toISOString()}\n# Count: ${apps.length}\n${filters ? `# Filters: ${JSON.stringify(filters)}\n` : ""}`;
  const lines = [meta + headers.join(",")];
  for (const a of apps) {
    lines.push([
      a.id, a.company, a.country, a.role, a.status, a.pinned, a.archived,
      a.salary || "", a.recruiter || "", (a.tags || []).join("|"),
      a.link || "", a.appliedAt || "", a.createdAt, a.updatedAt, a.notes || "",
    ].map(csvEscape).join(","));
  }
  return lines.join("\n");
}

export function downloadFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

export interface FullBackup {
  version: number;
  app: string;
  exportedAt: string;
  count: number;
  apps: Application[];
  activity?: unknown[];
  presets?: unknown[];
  settings?: unknown;
  timer?: unknown;
}

export function exportJSON(
  apps: Application[],
  extras?: { activity?: unknown[]; presets?: unknown[]; settings?: unknown; timer?: unknown },
): string {
  const payload: FullBackup = {
    version: 2,
    app: "career-board",
    exportedAt: new Date().toISOString(),
    count: apps.length,
    apps,
    ...(extras || {}),
  };
  return JSON.stringify(payload, null, 2);
}

export function exportPrintableHTML(apps: Application[], title: string): string {
  const rows = apps.map((a, i) => `
    <tr>
      <td>${String(i + 1).padStart(2, "0")}</td>
      <td>${esc(a.company)}</td><td>${esc(a.country)}</td>
      <td>${esc(a.role)}</td><td>${esc(a.status)}</td>
      <td>${esc(a.appliedAt || "")}</td>
    </tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
  <style>
    body{font-family:ui-monospace,monospace;background:#fff;color:#111;padding:24px}
    h1{margin:0 0 8px;font-size:20px;letter-spacing:.1em;text-transform:uppercase}
    .meta{color:#666;font-size:11px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th,td{padding:6px 8px;border-bottom:1px solid #ddd;text-align:left;text-transform:uppercase;letter-spacing:.05em}
    th{background:#f5f5f5}
    @media print{body{padding:0}}
  </style></head><body>
  <h1>${esc(title)}</h1>
  <div class="meta">Generated ${new Date().toLocaleString()} · ${apps.length} applications</div>
  <table><thead><tr><th>#</th><th>Company</th><th>Country</th><th>Role</th><th>Status</th><th>Applied</th></tr></thead>
  <tbody>${rows}</tbody></table>
  <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
  </body></html>`;
}

function esc(s: string) { return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]!)); }

/** Compute display string for an application's status, adding stage number
 *  for INTERVIEW / ASSESSMENT (e.g. "INTERVIEW 3"). Uses statusHistory. */
export function displayStatus(a: Application): string {
  const s = a.status;
  if (s !== "INTERVIEW" && s !== "ASSESSMENT") return s;
  const hist = a.statusHistory || [];
  let n = 0;
  for (const e of hist) if (e && e.status === s) n++;
  if (n === 0) n = 1;
  return `${s} ${n}`;
}

/* ============================================================
 * PDF — operational tracking manifest
 * Compact, mechanical, mono-styled; up to 3 layered sorts.
 * ============================================================ */

export interface PdfSortLayer { key: SortKey; dir: "asc" | "desc" }

const FOOTER_TEXT = "Application activity summary generated from synchronized local Career Board records for personal operational tracking and progress review.";

function multiSort(apps: Application[], layers: PdfSortLayer[]): Application[] {
  // Apply sorts from least → most significant so the most significant is final.
  let arr = [...apps];
  const active = layers.filter((l) => l && l.key && l.key !== "default");
  if (active.length === 0) return arr;
  for (let i = active.length - 1; i >= 0; i--) {
    arr = applySort(arr, active[i].key, active[i].dir);
  }
  return arr;
}

function summarizeFilters(f?: FilterState): string {
  if (!f) return "";
  const parts: string[] = [];
  if (f.search) parts.push(`search="${f.search}"`);
  if (f.statuses?.length) parts.push(`status=${f.statuses.join("/")}`);
  if (f.countries?.length) parts.push(`country=${f.countries.join("/")}`);
  if (f.companies?.length) parts.push(`company=${f.companies.length}`);
  if (f.roles?.length) parts.push(`role=${f.roles.length}`);
  if (f.tags?.length) parts.push(`tags=${f.tags.join("/")}`);
  if (f.favoritesOnly) parts.push("favorites only");
  if (f.activeOnly) parts.push("active only");
  if (f.archivedOnly) parts.push("archived only");
  if (f.dateFrom) parts.push(`from=${f.dateFrom}`);
  if (f.dateTo) parts.push(`to=${f.dateTo}`);
  return parts.join(" · ");
}

/** Truncate a string to fit `maxWidth` pt at the doc's current font/size. Adds an ellipsis if clipped. */
function truncate(doc: jsPDF, text: string, maxWidth: number): string {
  if (!text) return "";
  if (doc.getTextWidth(text) <= maxWidth) return text;
  const ell = "…";
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (doc.getTextWidth(text.slice(0, mid) + ell) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + ell;
}

/**
 * Generate the PDF as a clean, centered, portrait report (no tables, no borders).
 * Returns a blob URL — caller is responsible for opening / revoking it.
 */
export interface PdfExclusions {
  statuses?: Status[];
  countries?: string[]; // canonical full names
  excludeFavorites?: boolean;
  excludeNonFavorites?: boolean;
  excludeArchived?: boolean;
  excludeActive?: boolean;
}

function applyExclusions(apps: Application[], ex?: PdfExclusions): Application[] {
  if (!ex) return apps;
  const exStatuses = new Set((ex.statuses || []).map((s) => s.toUpperCase()));
  const exCountries = new Set((ex.countries || []).map((c) => c.toUpperCase()));
  return apps.filter((a) => {
    if (exStatuses.size && exStatuses.has(String(a.status).toUpperCase())) return false;
    if (exCountries.size && exCountries.has(countryFullName(a.country).toUpperCase())) return false;
    if (ex.excludeFavorites && a.pinned) return false;
    if (ex.excludeNonFavorites && !a.pinned) return false;
    if (ex.excludeArchived && a.archived) return false;
    if (ex.excludeActive && !a.archived) return false;
    return true;
  });
}

export function generatePDF(
  apps: Application[],
  opts: { title?: string; sorts?: PdfSortLayer[]; filters?: FilterState; exclusions?: PdfExclusions } = {},
): { url: string; blob: Blob; filename: string } {
  const title = opts.title || "Career Board — Tracking Manifest";
  const sorts = opts.sorts || [];
  // Order: scope → exclusions → sort
  const filteredOut = applyExclusions(apps, opts.exclusions);
  const sorted = multiSort(filteredOut, sorts);
  const generatedAt = new Date().toLocaleString();
  const filterText = summarizeFilters(opts.filters);

  // PORTRAIT, centered
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const cx = pageWidth / 2;
  const contentWidth = Math.min(440, pageWidth - 80);
  const left = cx - contentWidth / 2;
  const right = cx + contentWidth / 2;

  const FONT = "courier"; // mechanical / terminal-like; preserves dashboard feel
  // Increased top margin for clear breathing room between header and data.
  const TOP_MARGIN = 150;
  const BOTTOM_LIMIT = pageHeight - 70;

  let y = TOP_MARGIN;

  function drawHeader() {
    // Title — centered
    doc.setFont(FONT, "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 24, 32);
    doc.text(title.toUpperCase(), cx, 56, { align: "center" });
    // Subtitle — centered
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(
      `GENERATED ${generatedAt.toUpperCase()}   ·   ${sorted.length} RECORDS`,
      cx, 76, { align: "center" },
    );
    let legendY = 94;
    if (filterText) {
      const wrapped = doc.splitTextToSize(`FILTERS: ${filterText}`.toUpperCase(), contentWidth);
      doc.text(wrapped, cx, 92, { align: "center" });
      legendY = 92 + wrapped.length * 10 + 4;
    }
    // Favorite legend
    doc.setFont(FONT, "normal");
    doc.setFontSize(7);
    doc.setTextColor(130, 130, 130);
    doc.text("* INDICATES FAVORITE APPLICATION", cx, legendY, { align: "center" });
  }

  function drawFooter() {
    const pageNumber = doc.getCurrentPageInfo().pageNumber;
    const totalPages = doc.getNumberOfPages();
    doc.setFont(FONT, "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    const wrappedFooter = doc.splitTextToSize(FOOTER_TEXT, contentWidth);
    doc.text(wrappedFooter, cx, pageHeight - 48, { align: "center" });
    doc.text(
      `${generatedAt}   ·   PAGE ${pageNumber} / ${totalPages}`,
      cx, pageHeight - 24, { align: "center" },
    );
  }

  function ensureSpace(needed: number) {
    if (y + needed > BOTTOM_LIMIT) {
      drawFooter();
      doc.addPage();
      y = TOP_MARGIN;
      drawHeader();
    }
  }

  drawHeader();

  // ---- Borderless table layout ----
  // Columns: # | COMPANY | COUNTRY | ROLE (wraps) | STATUS | APPLIED
  // ROLE gets the most flexible space and wraps to multiple lines when long
  // so POSITION text is never cut off.
  const colX = {
    idx:     left,
    company: left + 24,
    country: left + 128,
    role:    left + 204,
    status:  left + 332,
    applied: left + 388,
  };
  const colW = {
    company: 100,
    country: 72,
    role:    124, // widest — wraps when needed
    status:  52,
    applied: 50,
  };
  const ROW_H = 16;
  const LINE_H = 11;

  function drawColumnHeaders() {
    doc.setFont(FONT, "bold");
    doc.setFontSize(8);
    doc.setTextColor(100, 104, 112);
    doc.text("#",       colX.idx,     y);
    doc.text("COMPANY", colX.company, y);
    doc.text("COUNTRY", colX.country, y);
    doc.text("ROLE",    colX.role,    y);
    doc.text("STATUS",  colX.status,  y);
    doc.text("APPLIED", colX.applied, y);
    y += 6;
    // very subtle dotted separator under header (no border line)
    doc.setTextColor(210, 210, 210);
    doc.setFontSize(6);
    doc.text(". . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .",
      left, y, { maxWidth: contentWidth });
    y += 8;
  }

  drawColumnHeaders();

  sorted.forEach((a, i) => {
    const idx = String(i + 1).padStart(3, "0");
    const company = ((a.pinned ? "* " : "") + (a.company || "—")).toUpperCase();
    const country = (countryFullName(a.country) || a.country || "—").toUpperCase();
    const roleRaw = (a.role    || "—").toUpperCase();
    const status  = displayStatus(a);
    const applied = a.appliedAt ? a.appliedAt.slice(0, 10) : "—";
    const isRejected = a.status === "REJECTED";

    doc.setFont(FONT, "normal");
    doc.setFontSize(8);

    // Wrap ROLE and COMPANY — never clip either.
    const roleLines = doc.splitTextToSize(roleRaw, colW.role) as string[];
    const companyLines = doc.splitTextToSize(company, colW.company) as string[];
    const maxLines = Math.max(roleLines.length, companyLines.length);
    const rowHeight = Math.max(ROW_H, maxLines * LINE_H + 5);

    ensureSpace(rowHeight);
    if (y === TOP_MARGIN) drawColumnHeaders();

    // REJECTED rows: paint every cell in red. Otherwise keep original tones.
    doc.setTextColor(isRejected ? 200 : 150, isRejected ? 40 : 150, isRejected ? 40 : 150);
    doc.text(idx, colX.idx, y);

    if (isRejected) doc.setTextColor(200, 30, 30); else doc.setTextColor(25, 28, 36);
    doc.text(companyLines, colX.company, y);

    if (isRejected) doc.setTextColor(200, 30, 30); else doc.setTextColor(80, 84, 92);
    doc.text(truncate(doc, country, colW.country), colX.country, y);

    if (isRejected) doc.setTextColor(200, 30, 30); else doc.setTextColor(40, 44, 52);
    doc.text(roleLines, colX.role, y);

    if (isRejected) doc.setTextColor(200, 30, 30); else doc.setTextColor(60, 64, 72);
    doc.text(truncate(doc, status, colW.status), colX.status, y);

    if (isRejected) doc.setTextColor(200, 30, 30); else doc.setTextColor(110, 114, 122);
    doc.text(applied, colX.applied, y);

    y += rowHeight;
  });

  if (sorted.length === 0) {
    doc.setFont(FONT, "normal");
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text("NO RECORDS", cx, y + 20, { align: "center" });
  }

  drawFooter();

  const filename = `career-board-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.pdf`;
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  // silence unused linter warning for `right`
  void right;
  return { url, blob, filename };
}

/** Backwards-compat: open the generated PDF in a new tab for preview. */
export function exportPDF(
  apps: Application[],
  opts: { title?: string; sorts?: PdfSortLayer[]; filters?: FilterState; filename?: string; exclusions?: PdfExclusions } = {},
) {
  const { url } = generatePDF(apps, opts);
  const win = window.open(url, "_blank");
  if (!win) {
    // popup blocked — fall back to in-place navigation so the user still sees the preview
    window.location.href = url;
  }
}

export function exportXLSX(apps: Application[], filename: string) {
  const rows = apps.map((a) => ({
    Company: a.company,
    Country: a.country,
    Role: a.role,
    Status: a.status,
    Pinned: a.pinned ? "Yes" : "",
    Archived: a.archived ? "Yes" : "",
    Salary: a.salary || "",
    Recruiter: a.recruiter || "",
    Tags: (a.tags || []).join(", "),
    Link: a.link || "",
    Applied: a.appliedAt ? a.appliedAt.slice(0, 10) : "",
    Created: a.createdAt.slice(0, 10),
    Updated: a.updatedAt.slice(0, 10),
    Notes: a.notes || "",
  }));
  const headers = rows.length
    ? Object.keys(rows[0])
    : ["Company","Country","Role","Status","Pinned","Archived","Salary","Recruiter","Tags","Link","Applied","Created","Updated","Notes"];

  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });

  // Column widths tuned per field
  ws["!cols"] = [
    { wch: 24 }, { wch: 12 }, { wch: 30 }, { wch: 14 },
    { wch: 8 },  { wch: 10 }, { wch: 14 }, { wch: 20 },
    { wch: 30 }, { wch: 36 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 50 },
  ];

  // Style header row: bold, white-on-graphite, centered
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFFFF" }, name: "Calibri", sz: 11 },
    fill: { patternType: "solid", fgColor: { rgb: "FF1F2937" } },
    alignment: { horizontal: "left", vertical: "center" },
    border: {
      bottom: { style: "thin", color: { rgb: "FF111827" } },
    },
  };
  for (let c = 0; c < headers.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) continue;
    (ws[addr] as Record<string, unknown>).s = headerStyle;
  }

  // Color every cell in REJECTED rows red — only color, no other format change.
  const rejectedFont = { color: { rgb: "FFC81E1E" }, name: "Calibri", sz: 11 };
  apps.forEach((a, i) => {
    if (a.status !== "REJECTED") return;
    const r = i + 1; // header is row 0
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) continue;
      const cell = ws[addr] as Record<string, unknown>;
      const prev = (cell.s as Record<string, unknown>) || {};
      cell.s = { ...prev, font: { ...(prev.font as object || {}), ...rejectedFont } };
    }
  });

  // Freeze header row + enable sortable autofilter across the data range
  const lastRow = rows.length; // header is row 0
  const lastColLetter = XLSX.utils.encode_col(headers.length - 1);
  ws["!autofilter"] = { ref: `A1:${lastColLetter}${lastRow + 1}` };
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  // SheetJS reads frozen panes from "!views"
  (ws as Record<string, unknown>)["!views"] = [{ state: "frozen", ySplit: 1, topLeftCell: "A2" }];
  ws["!margins"] = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };

  const wb = XLSX.utils.book_new();
  // Workbook properties (visible in Excel → File → Properties)
  wb.Props = {
    Title: "Career Board Export",
    Subject: "Job applications",
    Author: "Career Board",
    CreatedDate: new Date(),
  };
  XLSX.utils.book_append_sheet(wb, ws, "Applications");

  // Summary sheet
  const byStatus = new Map<string, number>();
  apps.forEach((a) => byStatus.set(a.status, (byStatus.get(a.status) || 0) + 1));
  const summary = [
    { Metric: "Total applications", Value: apps.length },
    { Metric: "Pinned", Value: apps.filter((a) => a.pinned).length },
    { Metric: "Applied", Value: apps.filter((a) => a.appliedAt).length },
    { Metric: "Generated", Value: new Date().toLocaleString() },
    {},
    ...[...byStatus.entries()].map(([s, n]) => ({ Metric: s, Value: n })),
  ];
  const ws2 = XLSX.utils.json_to_sheet(summary, { header: ["Metric", "Value"] });
  ws2["!cols"] = [{ wch: 28 }, { wch: 24 }];
  for (const c of [0, 1]) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws2[addr]) (ws2[addr] as Record<string, unknown>).s = headerStyle;
  }
  ws2["!autofilter"] = { ref: `A1:B${summary.length + 1}` };
  (ws2 as Record<string, unknown>)["!views"] = [{ state: "frozen", ySplit: 1, topLeftCell: "A2" }];
  XLSX.utils.book_append_sheet(wb, ws2, "Summary");

  XLSX.writeFile(wb, filename);
}

/* ============================================================
 * STATUS TIMELINE EXPORTS
 * Separate from the main exports. Flattens every status
 * transition into its own row: company, role, status, timestamp,
 * (optional) previous status. Falls back to statusChangedAt /
 * createdAt when historical records are incomplete.
 * ============================================================ */

export interface TimelineRow {
  company: string;
  role: string;
  lastStatus: Status;
  lastStatusDate: string; // ISO
  appliedDate: string;    // ISO or ""
  statusChanged: number;
}

/** Count meaningful status changes AFTER the first APPLIED event.
 *  - SAVED transitions don't count
 *  - APPLIED itself doesn't count
 *  - Repeated identical statuses don't count (unless they represent a new
 *    INTERVIEW/ASSESSMENT stage, which DO count because each entry is a
 *    distinct stage occurrence in the saved history)
 */
export function countStatusChanges(app: Application): number {
  const hist = app.statusHistory || [];
  if (hist.length === 0) return 0;
  const appliedIdx = hist.findIndex((e) => e.status === "APPLIED");
  const start = appliedIdx === -1 ? 0 : appliedIdx + 1;
  let count = 0;
  let prev: Status | undefined = appliedIdx === -1 ? undefined : "APPLIED";
  for (let i = start; i < hist.length; i++) {
    const e = hist[i];
    if (!e || !e.status) continue;
    if (e.status === "SAVED") continue;
    // Interview/Assessment repeats are new stages — always count.
    if (e.status === "INTERVIEW" || e.status === "ASSESSMENT") {
      count++;
      prev = e.status;
      continue;
    }
    if (e.status !== prev) {
      count++;
      prev = e.status;
    }
  }
  return count;
}

export function buildStatusTimeline(apps: Application[]): TimelineRow[] {
  return apps.map((a) => {
    const hist = a.statusHistory || [];
    const last = hist.length > 0 ? hist[hist.length - 1] : undefined;
    const lastStatusDate = last?.ts || a.statusChangedAt || a.updatedAt || a.createdAt;
    const appliedEvt = hist.find((e) => e.status === "APPLIED");
    const appliedDate = a.appliedAt || appliedEvt?.ts || "";
    return {
      company: a.company,
      role: a.role,
      lastStatus: a.status,
      lastStatusDate,
      appliedDate,
      statusChanged: countStatusChanges(a),
    };
  });
}

const fmtDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
};

export function exportStatusTimelineJSON(apps: Application[]): string {
  const rows = buildStatusTimeline(apps);
  return JSON.stringify({
    version: 2,
    app: "career-board",
    kind: "status-timeline",
    exportedAt: new Date().toISOString(),
    count: rows.length,
    entries: rows,
  }, null, 2);
}

export function exportStatusTimelineXLSX(apps: Application[], filename: string) {
  const rows = buildStatusTimeline(apps).map((r) => ({
    "Company": r.company,
    "Role": r.role,
    "Last Status (Date)": r.lastStatus + (r.lastStatusDate ? ` (${fmtDate(r.lastStatusDate)})` : ""),
    "Applied Date": r.appliedDate ? fmtDate(r.appliedDate) : "",
    "Status Changed": r.statusChanged,
  }));
  const headers = ["Company","Role","Last Status (Date)","Applied Date","Status Changed"];
  const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
  ws["!cols"] = [{ wch: 24 }, { wch: 30 }, { wch: 34 }, { wch: 22 }, { wch: 16 }];
  const headerStyle = {
    font: { bold: true, color: { rgb: "FFFFFFFF" }, name: "Calibri", sz: 11 },
    fill: { patternType: "solid", fgColor: { rgb: "FF1F2937" } },
    alignment: { horizontal: "left", vertical: "center" },
    border: { bottom: { style: "thin", color: { rgb: "FF111827" } } },
  };
  for (let c = 0; c < headers.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) (ws[addr] as Record<string, unknown>).s = headerStyle;
  }
  const lastColLetter = XLSX.utils.encode_col(headers.length - 1);
  ws["!autofilter"] = { ref: `A1:${lastColLetter}${rows.length + 1}` };
  ws["!freeze"] = { xSplit: 0, ySplit: 1 };
  (ws as Record<string, unknown>)["!views"] = [{ state: "frozen", ySplit: 1, topLeftCell: "A2" }];

  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title: "Career Board Status Timeline",
    Subject: "Per-application status summary",
    Author: "Career Board",
    CreatedDate: new Date(),
  };
  XLSX.utils.book_append_sheet(wb, ws, "Status Timeline");
  XLSX.writeFile(wb, filename);
}

export function generateStatusTimelinePDF(apps: Application[]): { url: string; blob: Blob; filename: string } {
  const rows = buildStatusTimeline(apps);
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const cx = pageWidth / 2;
  const contentWidth = Math.min(460, pageWidth - 80);
  const left = cx - contentWidth / 2;
  const FONT = "courier";
  const TOP_MARGIN = 130;
  const BOTTOM_LIMIT = pageHeight - 60;
  let y = TOP_MARGIN;
  const generatedAt = new Date().toLocaleString();

  function drawHeader() {
    doc.setFont(FONT, "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 24, 32);
    doc.text("CAREER BOARD — STATUS TIMELINE", cx, 56, { align: "center" });
    doc.setFont(FONT, "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 110, 110);
    doc.text(`GENERATED ${generatedAt.toUpperCase()}   ·   ${rows.length} APPLICATIONS`, cx, 76, { align: "center" });
  }
  function drawFooter() {
    const pageNumber = doc.getCurrentPageInfo().pageNumber;
    const totalPages = doc.getNumberOfPages();
    doc.setFont(FONT, "normal");
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(`${generatedAt}   ·   PAGE ${pageNumber} / ${totalPages}`, cx, pageHeight - 24, { align: "center" });
  }
  function ensureSpace(needed: number) {
    if (y + needed > BOTTOM_LIMIT) {
      drawFooter(); doc.addPage(); y = TOP_MARGIN; drawHeader(); drawColHeaders();
    }
  }
  const colX = {
    company: left,
    role:    left + 110,
    last:    left + 230,
    applied: left + 350,
    changed: left + 430,
  };
  const colW = { company: 104, role: 114, last: 116, applied: 76, changed: 30 };
  function drawColHeaders() {
    doc.setFont(FONT, "bold"); doc.setFontSize(8); doc.setTextColor(100, 104, 112);
    doc.text("COMPANY",            colX.company, y);
    doc.text("ROLE",               colX.role,    y);
    doc.text("LAST STATUS (DATE)", colX.last,    y);
    doc.text("APPLIED",            colX.applied, y);
    doc.text("CHG",                colX.changed, y);
    y += 12;
  }

  drawHeader();
  drawColHeaders();

  doc.setFont(FONT, "normal"); doc.setFontSize(8);
  rows.forEach((r) => {
    const lastStr = `${r.lastStatus}${r.lastStatusDate ? " · " + fmtDate(r.lastStatusDate) : ""}`;
    const appliedStr = r.appliedDate ? fmtDate(r.appliedDate).split(",")[0] : "—";
    const roleLines = doc.splitTextToSize(r.role.toUpperCase(), colW.role) as string[];
    const rowH = Math.max(14, roleLines.length * 11 + 4);
    ensureSpace(rowH);
    doc.setTextColor(25, 28, 36);
    doc.text(truncate(doc, r.company.toUpperCase(), colW.company), colX.company, y);
    doc.setTextColor(40, 44, 52);
    doc.text(roleLines, colX.role, y);
    doc.setTextColor(r.lastStatus === "REJECTED" ? 200 : 60, r.lastStatus === "REJECTED" ? 30 : 64, r.lastStatus === "REJECTED" ? 30 : 72);
    doc.text(truncate(doc, lastStr, colW.last), colX.last, y);
    doc.setTextColor(80, 84, 92);
    doc.text(truncate(doc, appliedStr, colW.applied), colX.applied, y);
    doc.setTextColor(40, 44, 52);
    doc.text(String(r.statusChanged), colX.changed, y);
    y += rowH;
  });

  if (rows.length === 0) {
    doc.setFont(FONT, "normal"); doc.setFontSize(10); doc.setTextColor(120,120,120);
    doc.text("NO RECORDS", cx, y + 20, { align: "center" });
  }

  drawFooter();
  const filename = `career-board-timeline-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.pdf`;
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  return { url, blob, filename };
}

export function exportStatusTimelinePDF(apps: Application[]) {
  const { url } = generateStatusTimelinePDF(apps);
  const win = window.open(url, "_blank");
  if (!win) window.location.href = url;
}
