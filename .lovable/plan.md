## Scope

Ten interrelated changes across sorting, favorites visuals, OFFER color, continuous timer reliability, a new status-history export, local document uploads (IndexedDB), recruiter contact fields, and cross-view sync. Below is what I'll touch and how.

## 1. Status-priority sorting only when sorting by Status

`src/lib/filter.ts` — `applySort`: remove the unconditional `priorityBucket` short-circuit. Only apply the OFFER-top / favorites / SAVED / REJECTED buckets when `key === "status"` or `key === "favorites"`. All other sort keys (`newest`, `oldest`, `company`, `country`, `role`, `updated`, `default`) sort purely by their field with no forced reordering.

PDF export (`src/lib/export.ts`) — apply the same rule using the current sort key when building the rows.

## 2. Favorite marker = asterisk, no orange

- `src/components/board/AirportBoard.tsx`: drop the `ab-ch--fav` charClass on flight/destination/position. Prepend `"* "` to `app.company` for favorites in the flight field only. Keep `is-fav` row class for any non-color uses but remove orange text rules.
- `src/styles.css`: neutralize `.ab-ch--fav` color (leave class but no orange).
- `src/components/board/Row.tsx` (Applications): same — asterisk on company, no orange.
- PDF export: prepend `* ` to company for favorites.

## 3. Brighter OFFER green

`src/styles.css` — bump `--status-offer` (and any OFFER glow tokens) to a brighter, more luminous oklch green while keeping contrast.

## 4. Continuous timer cycle fix

`src/lib/store.ts` timer tick logic — single `setInterval(1000)` with:
- Use `cycleStartedAt` + `durationSec` to derive `remainingSec` from real wall-clock time (no drift).
- When `now >= cycleStartedAt + durationSec`: increment `totalCycles`, evaluate success vs `cycleStartCount`, call `playCue` exactly once, reset `cycleStartedAt = now`, `cycleStartCount = current count`. Guard with an "already-fired-for-this-cycle" boundary so multiple late ticks don't double-fire.
- Ensure the interval is cleared before any new one starts (idempotent `startTimer`).
- Keep audio unlocked: call `unlockAudio()` on start, and use `playCue` (resets currentTime) per cycle so it doesn't degrade.
- Normal mode unchanged: on reaching zero, stop + alert once.

## 5. New "Export Status Timeline"

`src/lib/export.ts` — add `exportStatusTimelineXlsx`, `exportStatusTimelinePdf`, `exportStatusTimelineJson`. Each row = `{ company, role, status, timestamp, from? }` derived from `app.statusHistory` (fallback to `statusChangedAt`/`createdAt` if history empty). PDF reuses existing styling helpers. JSON reuses existing version/metadata wrapper.

`src/components/views/Exports.tsx` — add a separate section "Status Timeline" with three buttons (XLSX / PDF / JSON). Existing export buttons untouched.

## 6. Local document upload (IndexedDB)

- `src/lib/types.ts` — extend `DocLink` with optional `blobId?`, `mime?`, `size?`, `kind: "link" | "file"`. Keep backward compat (existing entries default to `"link"`).
- `src/lib/db.ts` — add a `docBlobs` object store keyed by uuid, value = `Blob`. Helpers: `putDocBlob(id, blob)`, `getDocBlob(id)`, `deleteDocBlob(id)`.
- `src/components/drawer/DetailDrawer.tsx` (or the docs section / edit form): add an "Upload file" button (`<input type=file multiple>`), store blob, append `DocLink` entry of kind `file`. Render entries with View (open via `URL.createObjectURL`), Download, Delete. Keep existing link UI for kind `link`.
- Cleanup: on `deleteApp` and on doc remove, delete associated blobs.

## 7. Recruiter email + LinkedIn fields

- `src/lib/types.ts` — add `recruiterEmail?: string`, `recruiterLinkedin?: string` on `Application`.
- Quick add / detail drawer edit form: add the two inputs.
- Detail drawer view: render email as `mailto:` link, linkedin as external link (only if it parses as URL).
- Existing `recruiter` text field preserved.

## 8/9/10. Sync + preservation + verification

- All edits go through existing `updateApp` so IndexedDB persistence + listeners propagate to dashboard / applications / analytics / exports automatically.
- No schema migration required (new fields are optional). New `docBlobs` store added via version bump in `src/lib/db.ts`.
- Verify build passes; spot-check timer loop logic; confirm no removed features.

## Technical notes

- `applySort` change is the riskiest — I'll keep `favorites` sort key using the bucket logic (since favorites IS the user's explicit intent there), and `status` keeps full bucketing. Everything else: pure field sort, no bucket.
- IDB version bump: existing data preserved via `onupgradeneeded` adding the new store only.
- Timer wall-clock derivation prevents drift after tab throttling — fixes "sound stops after several cycles" symptom which is usually setInterval drift + stale closures.
- Asterisk in board flight field: `"* AIRBNB"` is 8 chars; flight has 12 slots so no overflow regression for short names. Long names already marquee.
