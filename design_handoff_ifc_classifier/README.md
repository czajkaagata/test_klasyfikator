# Handoff: IFC Classifier Review Interface

## Overview
Frontend for reviewing elements from an IFC model that a backend classification model flagged as potentially misclassified. User loads an IFC file, sees a 3D viewer with the model, a sidebar list of flagged elements, and — on selecting one — the camera moves to that element, the rest of the model dims, and the element is highlighted red. A detail panel shows the model's reasoning with accept/reject actions.

## About the Design Files
The file in this bundle (`IFC Classifier.dc.html`) is a **design reference built in HTML** — a clickable prototype showing intended layout, visual style, and interaction behavior. It is NOT production code and should not be shipped as-is. The 3D "model" in this prototype is a flat schematic (positioned colored boxes, not a real IFC scene) used to demonstrate the camera-zoom/highlight interaction pattern — it must be replaced with a real That Open Company (`@thatopen/components` / `web-ifc`) viewer instance in the actual app.

**Task**: recreate this design and its interactions inside the target codebase's existing stack (whatever frontend framework the IFC-viewer app already uses), wiring it to:
1. A real IFC parser/viewer (That Open Company components)
2. The real backend classification model/API (from the user's GitHub repo) instead of the mock data below

## Fidelity
**High-fidelity** for layout, spacing, typography, and color — recreate pixel-accurate. **Low-fidelity / illustrative** for the 3D viewport specifically — that area is a stand-in; its exact schematic shapes don't need to be preserved, only the *interaction behavior* (select in list → camera flies to element → rest of model fades to translucent → element turns red → detail panel opens).

## Screens / Views
Single screen, three states: **Empty** (no file loaded), **Loading** (processing), **Loaded** (3D or List view, toggled by a switch in the top bar).

### Top bar (60px height, white bg, 1px bottom border `oklch(90% 0.005 95)`)
- Left: 28×28px dark badge (bg `oklch(20% 0.01 95)`, radius 6px) with "IFC" white bold 12px text, then title "Klasyfikator elementów IFC" 15px/600 weight.
- Vertical divider, then **"Załaduj model IFC"** button: 36px tall, dark filled (bg/border `oklch(20% 0.01 95)`), white text 13px/600, radius 8px. Triggers a hidden `<input type="file" accept=".ifc">`.
- Loaded filename shown as truncated gray text (13px, `oklch(45% 0.01 95)`) next to the button.
- Right side (only visible once a model is loaded): a red pill badge showing "N podejrzanych elementów" (bg `oklch(94% 0.05 25)`, text `oklch(45% 0.16 25)`, small 7px dot), and a segmented control toggling **3D / Lista** (light gray track `oklch(95% 0.003 95)`, active segment white bg with dark text, inactive transparent with gray text).

### Empty state (before load)
Centered dashed-border card (420px wide, white bg, 2px dashed `oklch(85% 0.005 95)`, radius 16px): icon square, "Przeciągnij plik IFC lub kliknij, aby załadować" (15px/600), subtext "Model zostanie przepuszczony przez klasyfikator elementów" (13px gray). Clicking it also opens the file picker.

### Loading state
900ms simulated delay: centered spinner (36px circle, 3px border, top segment `oklch(55% 0.19 25)`, 0.8s linear spin) + "Przetwarzanie modelu przez klasyfikator..." (13px gray).

### Sidebar (340px fixed width, white bg, right border)
Header "PODEJRZANE ELEMENTY" (13px/700, uppercase, letter-spacing 0.04em, gray). Scrollable list of rows, each row (padding 12px, radius 10px, 6px bottom margin):
- 26×26px colored type-badge with 2-letter abbreviation (e.g. "WA" for IfcWall), element name (13px/600, truncated), GUID shortened + monospace 11px gray below it.
- Status badge (top-right of row) when accepted/rejected: "Zaakceptowano" (green-tinted `oklch(93% 0.01 150)` bg / `oklch(45% 0.1 150)` text) or "Odrzucono" (neutral gray).
- Current → suggested classification line (11px): current in gray, arrow, suggested in red/bold (`oklch(45% 0.16 25)`).
- Confidence bar: 4px height track (`oklch(92% 0.005 95)`), red fill (`oklch(55% 0.19 25)`) sized to confidence %, plus numeric % label.
- Selected row: bg `oklch(96% 0.03 25)`, border `oklch(80% 0.08 25)`.
- Rows with accepted/rejected status drop to 0.55 opacity but remain visible/clickable.

### Main area — 3D view
Bordered panel with a faint CAD-style grid background (repeating 32px linear-gradient lines, `oklch(94% 0.003 95)` on `#fdfdfc`), watermark label "IFC VIEWER — THAT OPEN COMPANY" (monospace 10px, top-right). Inside: a schematic building outline (static rectangle, 3px border) plus positioned colored boxes representing elements. On selection:
- The scene container gets `transform-origin` set to the selected element's center (as a %), and `transform: scale(2.3)` — animated over 0.7s `cubic-bezier(.2,.7,.3,1)` — simulating a camera dolly-in.
- All non-selected elements drop to opacity 0.12 (model becomes "transparent"); the selected element becomes fully opaque, fill color `oklch(55% 0.19 25)` (red), with a glow: `box-shadow: 0 0 0 4px oklch(90% 0.08 25), 0 4px 16px oklch(55% 0.19 25 / 0.4)`.
- Clicking empty space / deselecting returns scale to 1.

### Main area — List view
Full-width table (`table-layout:fixed`, white card, radius 12px, border) with columns: Element (name + type), GUID (monospace), Klasyfikacja (current → suggested), Pewność (%), Status badge, **Popraw klasyfikację** (dropdown of IFC types + inline "Zapisz" save button), and stacked **Akceptuj**/**Odrzuć** action buttons per row. All cells use `overflow:hidden` + ellipsis to stay within their fixed % column width — no horizontal scroll. Replaces the 3D viewport when "Lista" is toggled; detail panel is hidden in this mode since actions are inline.

### Manual reclassification (dropdown + save)
Independent of the accept/reject-suggestion flow: every element also has a **manual classification dropdown** (all IFC types) plus a **Zapisz** button, available both in the List-view table and in the Detail panel (3D view). This lets a reviewer pick the *correct* type directly (not just accept/reject the model's suggestion) and persist it as `manualType` + `savedManual: true` on that element. Accept/Reject and manual-save are separate, independent actions — both can be used on the same element.

### Dashboard view (third tab in the 3D/Lista/Dashboard switch)
File-level stats: 4 summary cards (total elements, pending, accepted, rejected), a horizontal bar chart of flagged-element counts per IFC type, a stacked verification-progress bar (accepted/rejected/pending proportions), average model confidence, and count of manually-saved reclassifications. All computed client-side from the `elements` array — in production these should be computed from the real per-file dataset (or fetched pre-aggregated from the backend for large models).

### Detail panel (320px, right side, only in 3D view when an element is selected)
- Header "SZCZEGÓŁY ELEMENTU" + close (×) button.
- Type badge + name + full GUID (monospace).
- Two side-by-side chips: "Obecna" (current type, neutral gray bg) → arrow → "Sugerowana" (suggested type, red-tinted bg `oklch(94% 0.05 25)`, red text).
- Confidence bar (6px, same red fill) with % label.
- Reasoning text block (12px, gray, light gray bg card, radius 8px) — mock explanation of why the model flagged it (e.g. geometry/proportions).
- Status confirmation banner once acted on.
- Two full-width buttons: **"Akceptuj sugestię"** (dark filled) and **"Odrzuć"** (white, gray border).

## Interactions & Behavior
- File input (hidden) or drop-zone click → `startLoad`: sets loading=true, fake filename if none picked, 900ms timeout → populates elements with `status: 'pending'`.
- Sidebar row click / scene box click → toggles `selectedId` (click again to deselect / zoom back out).
- Accept/Reject (row-inline, table-inline, or detail panel) → sets that element's `status` to `'accepted'`/`'rejected'`; element stays in the list, dimmed, with a status badge — it is **not** removed.
- View toggle 3D/Lista → switches `viewMode`; switching to Lista clears `selectedId` (closes detail panel, keeps the sidebar list active).
- No responsive/mobile behavior designed — desktop-only tool.

## State Management
- `fileName: string|null`
- `loading: boolean`
- `elements: Array<{ id, type, name, current, suggested, confidence, guid, color, x, y, w, h, status: 'pending'|'accepted'|'rejected', manualType: string, savedManual: boolean }> | null` (null = no file loaded yet)
- `selectedId: string|null`
- `viewMode: '3d' | 'list' | 'dashboard'`

In the real app, `elements` should be populated from the backend classification API response instead of the hardcoded mock array, and `x/y/w/h/color` (used only for the schematic placeholder) should be replaced by real IFC element references/GUIDs the That Open Company viewer can select, isolate, and highlight/zoom to (its camera + fragment-highlighting APIs cover the zoom/dim/red-highlight behavior natively).

## Design Tokens
- **Background**: `oklch(98% 0.002 95)` (page), `oklch(97% 0.002 95)` (viewport area), `#fff` (cards/sidebar/panel)
- **Text**: `oklch(20% 0.01 95)` (primary/dark), `oklch(45–55% 0.01 95)` (secondary gray)
- **Borders**: `oklch(90–93% 0.005 95)`
- **Accent (red)**: `oklch(55% 0.19 25)` (solid/fills), `oklch(45% 0.16 25)` (text), `oklch(94% 0.05 25)` (tint bg), `oklch(90% 0.08 25)` (ring)
- **Success tint (accepted badge)**: `oklch(93% 0.01 150)` bg / `oklch(45% 0.1 150)` text
- **Type**: system sans stack (`-apple-system, Inter, Helvetica Neue, Arial, sans-serif`); monospace for GUIDs
- **Radius scale**: 6–8px (buttons/badges), 10–16px (cards/rows/panels)
- **Sizes**: sidebar 340px, detail panel 320px, top bar 60px

## Assets
No external images. One emoji placeholder (📐) in the empty-state icon — replace with a proper icon in production.

## Files
- `IFC Classifier.dc.html` — full prototype (single-file Design Component; open directly in a browser to interact with it)
