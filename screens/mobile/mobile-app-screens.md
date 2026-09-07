# Leave Approvals (Android) — Screen Inventory

Reference doc for a UI redesign. Covers every screen, sheet, dialog, and
state currently in the manager-facing Android app (`android-app/`), as
built with Jetpack Compose + Material 3. This is a **single-user app** —
there's exactly one signed-in "owner" (the manager), so there's no
multi-account switching, no per-user theming, nothing like that.

Where useful, a screen's description notes the loading / empty / error
states it can be in, since those are as much "a screen" as the happy path
for redesign purposes.

---

## Navigation map

```
Sign In  ──(Google sign-in)──▶  ┌─ owner email? ──yes──▶ Manager Home (Scaffold)
                                 │                          ├─ tab: Requests
                                 │                          ├─ tab: Archived
                                 │                          ├─ tab: Summary
                                 │                          └─ tab: Report
                                 └─ no ──▶ Restricted screen
```

- There is no drawer, no hamburger menu, no settings screen. Navigation is
  a single **bottom `NavigationBar`** with 4 tabs, plus a **top `TopAppBar`**
  (title + refresh + overflow menu) shared by all 4 tabs.
- A tapped push notification jumps straight into whichever tab currently
  holds that request (Requests if still open, Archived if it already aged
  out) and opens that request's detail sheet automatically.
- Every screen below (other than Sign In / Restricted) lives *inside* the
  one Scaffold — none of them own their own top bar or bottom nav.

---

## 1. Sign In

**File:** `ui/signin/SignInScreen.kt`

The only entry point; shown whenever there's no signed-in Firebase user,
or a previous sign-in attempt failed.

- Full-bleed background using the theme's base surface color.
- Vertically centered content block:
  - A 104dp circular logo tile (white surface, a thin orange-tinted
    border, soft orange-tinted shadow) containing the NDMA logo image
    (68dp).
  - "Tech EW" — headline, bold.
  - "Leave Approvals" — subtitle, in the brand orange (`TechEwOrange`).
  - A **Google Sign-In button**: white pill (24dp corner radius), Google's
    own brand border color (#DADCE0) and label color (#3C4043) — kept
    exactly to Google's brand guideline rather than themed. Shows the
    official multi-color "G" logo + "Sign in with Google" label.
  - **Loading state:** button becomes disabled, the "G" logo swaps for a
    small circular spinner, and the label changes to "Signing in...".
  - **Error state:** an outlined error icon + red error text appears
    below the button (e.g. "not an authorized account" style messages).
- Footer, pinned to the bottom: "National Disaster Management Authority"
  in small caption text.

## 2. Restricted (signed in, not the owner)

**File:** `ui/restricted/RestrictedScreen.kt`

Shown if a Google account signs in successfully but isn't the configured
owner account. Deliberately minimal — this is a dead end, not a flow:

- Centered column: "Access restricted" (bold title), body text
  "This app is only available to the account owner. Signed in as
  `<email>`.", and a single "Sign out" button that returns to Sign In.

## 3. Manager Home (Scaffold shell)

**File:** `ui/ManagerHomeScreen.kt`

The container for everything else once signed in as the owner.

- **Top app bar:** title changes per tab ("Leave Requests" / "Archived
  Requests" / "Leave Summary" / "Uninformed Leave"). Two trailing icon
  actions:
  - **Refresh** — spins continuously (800ms linear rotation) while that
    tab's data is loading.
  - **Overflow (⋮)** — opens a dropdown with a single red "Sign out" item
    (red text + red logout icon).
- **Bottom navigation bar**, 4 destinations, each an outlined Material
  icon + label:
  1. **Requests** — `Assignment` icon
  2. **Archived** — `Archive` icon
  3. **Summary** — `Insights` icon
  4. **Report** — `Flag` icon
- Tab content fills the remaining space below the top bar / above the nav
  bar; none of the 4 tab screens have their own Scaffold/status-bar
  padding.

---

### 3.1 Requests tab

**Files:** `ui/requests/RequestListScreen.kt` (thin wrapper) →
`LeaveRequestList` (shared with Archived, see below) → `RequestCard.kt` /
`RequestDetailSheet.kt`.

Shows every **not-yet-archived** leave request (a request archives the day
after its last leave day passes, regardless of status — see `ArchiveRules`).

**Filter bar** (`LeaveFilterBar.kt`), pinned above the list, 3 equal-width
outlined dropdown buttons in a row:
- **Status** — All statuses / Requested / Approved / Rejected / Withdrawn
- **Type** — All types / Foreign Trip / Umrah / Medical / Short Leave /
  Full Leave / Out Pass / Uninformed Leave (drives from `LeaveType.ALL`)
- **Person** — "Everyone" or a selected developer's name; opens a full
  **bottom sheet** (see "Person filter sheet" below), not a simple dropdown
- Filter state is shared with the Archived tab (switching tabs doesn't
  reset it) — this is a deliberate cross-tab design choice.

**List states:**
- **First load (empty + loading):** 4 `SkeletonCard` placeholders — a
  shimmering gradient sweep (1.2s loop) over blocks shaped exactly like a
  real `RequestCard` (avatar circle, name/email lines, status-pill shape,
  3 chip shapes, 2 text lines) so the real content doesn't visibly jump in.
- **Manual refresh with data already showing:** list stays visible; a
  small pill ("⟳ Refreshing…") floats centered above it instead of
  replacing anything.
- **Empty (no requests match):** plain centered text, "No leave requests
  yet." (Requests tab keeps this plain state; Archived has a richer one —
  see 3.2.)
- **Populated:** a `LazyColumn` of `RequestCard`s, 12dp horizontal padding.

**`RequestCard`** — one leave request, compact:
- Row: `Avatar` (initials circle, 36dp, deterministic color from
  name/email hash) · name (bold) + email (2 lines max) · a status pill on
  the right (`REQUESTED` amber / `APPROVED` green / `REJECTED` red /
  `WITHDRAWN` grey).
- **Chip row** (horizontally scrollable — chips must never clip): type
  chip (e.g. "Casual", "Foreign Trip", colored per family), duration chip
  ("Short Leave" / "Full Leave" / "Out Pass", each its own color), a
  tappable week-label chip (opens the read-only `LeaveDateDialog`), and —
  if present — a submitted-time chip (HH:mm).
- Divider, then a 2-line reason preview (plain text, HTML stripped).
- If resolved: a one-line "Approved by X" / "Rejected by X" / "Withdrawn
  by requester" summary.
- If withdrawn and still inside its 7-day grace window: a red notice pill,
  "Deletes permanently in N days." (small, 11sp — matches the web app's
  wording/size exactly).
- Full-width outlined "View details" button at the bottom, opening the
  detail sheet.

**`RequestDetailSheet`** — a Material3 `ModalBottomSheet`, opened from a
card's "View details":
- **Pinned header:** avatar/name/email/status row (same as the card, just
  larger avatar), then the same type/duration/week chip row (also
  horizontally scrollable), then a **2×2 facts grid** of bordered tiles:
  `LEAVE DATE`, `DURATION`, `APPLIED`, and a 4th tile that's either
  `ATTACHMENTS` (file count) while pending, or `DECIDED IN` (e.g. "3
  hours") once resolved.
  - `LEAVE DATE` shows a single day, a "start – end" range, or — for a
    Custom (non-contiguous) pick — the actual picked dates ("4 Sept, 5
    Sept, 6 Sept +1 more"), never a misleading solid range.
  - `DURATION` is type-aware: "Half day · 7:00 AM" (Short Leave), a
    check-out–check-in time range (Out Pass), or a real day count
    ("4 days") for Full Leave / other whole-day types.
  - Tapping the week-label chip opens `LeaveDateDialog` (below).
- **Scrolling middle region** (everything else stays pinned): the reason,
  rendered as real HTML (bold/italic/underline/paragraphs) via an embedded
  `TextView`. Long reasons (>320 plain-text characters) collapse behind a
  fade-out gradient + "Read full reason" button. Below that, one outlined
  button per attachment (paperclip icon + filename), opening the file's
  Drive link.
- **Pinned footer**, one of three states:
  - **Still requested:** two large pill buttons side by side, **Approve**
    (green) / **Reject** (red). Tapping either doesn't submit immediately —
    it swaps in a small optional-note text field (2–4 lines) + Cancel /
    "Confirm approve"("Confirm reject") buttons.
  - **Decision in flight:** the whole footer becomes a single centered
    spinner.
  - **Already resolved:** a colored panel (green/red/grey background
    matching the status) with "Approved by X" / "Rejected by X" /
    "Withdrawn by requester" + an optional decision note underneath.

**`LeaveDateDialog`** (`ui/common/LeaveDateDialog.kt`) — a *read-only*
Material3 `DatePicker`/`DateRangePicker` popup (every day refuses
selection; it's a viewer, not an editor), with a custom title/headline
("LEAVE DATE(S)" + a formatted date or date range) replacing Material's
default generic header text.

**Person filter sheet** (`LeaveFilterBar.kt` → `PersonFilterSheet`) — a
`ModalBottomSheet` opened from the filter bar's "Person" button:
- Header ("Filter by person" + a "Clear" text button), a search field
  (magnifying-glass icon, "Search N developers" placeholder).
- A scrollable list: "Everyone" (grey "All" avatar) pinned first with the
  total record count, then every developer alphabetically, each row =
  avatar + name + a pill showing their request count + (if selected) a
  checkmark and highlighted row background.

---

### 3.2 Archived Requests tab

**File:** `ui/requests/ArchivedRequestsScreen.kt`

Same card/filter/detail-sheet mechanics as Requests (they share
`LeaveRequestList`), but adds a **Year › Quarter › Month › Week
drill-down** above the list, since archived history only grows over time:

- A **Period** card at the top:
  - A row of 4 granularity chips: **Year / Quarter / Month / Week**.
  - Directly below, a horizontally scrolling row of year chips (always
    visible, whatever granularity is selected).
  - If granularity is Quarter: a row of `Q1..Q4` chips.
  - If Month: a horizontally scrolling row of 12 month chips
    (auto-scrolled to the current selection).
  - If Week: a horizontally scrolling row of the year's actual ISO week
    numbers that have data (plus the current week).
  - A **breadcrumb** line under the chips (e.g. "2026 › Q3 · Jul – Sep",
    "2026 › Q3 › Sep · 4 requests", "2026 › Week 38 · 1 request") showing
    exactly what's currently scoped.
  - Every level is independently viewable — picking just "Year" + a year
    shows that whole year's archive; there's no requirement to drill all
    the way to a single week.
- Below the Period card: the exact same filterable `LeaveRequestList` as
  Requests, just scoped to the selected period on top of the shared
  status/type/person filters.
- **Empty state** here is richer than the Requests tab's plain text
  (`ArchivedEmptyState.kt`): a 96dp rounded icon tile (Archive icon),
  a headline ("Nothing archived yet" / "No archived requests match"), body
  copy explaining the archiving rule, and action buttons ("Clear filters"
  when filters are active, always a "Go to requests" button).

---

### 3.3 Summary tab

**Files:** `ui/summary/LeaveSummaryScreen.kt` / `LeaveSummaryViewModel.kt`

A manager's analytics view — developer + period scoped, fully drillable,
one scrolling column.

- **Filters card:**
  - **Developers** — multi-select dropdown (`DeveloperFilterDropdown`);
    stays open across taps so multiple people can be compared at once;
    label shows "All developers" / one name / "N developers".
  - **Period** — the same 4-chip Year/Quarter/Month/Week granularity
    switch as Archived, plus year chips, and (contextually) quarter/month/
    week chips — this is where Archived's pattern was borrowed from.
  - A **breadcrumb** appears once narrowed past Year (e.g. "2026 › Q3 ·
    Jul – Sep", "2026 › Q3 › Sep · 4 requests").
- **Activity** section: 4 KPI tiles in a row — **Total** (neutral),
  **Approved** (green), **Rejected** (red), **Pending** (amber) — each a
  bold number over a small caption label.
- **By leave type** card: one horizontal bar row per leave type (Foreign
  Trip, Umrah, Medical, Short, Full, Out Pass, Uninformed) — a short label,
  a proportional bar (colored per type's duration color), and the count.
  Always shown, all 7 types listed even at zero.
- **When granularity is Year or Quarter** — "By quarter & month" section:
  - 4 **quarter tiles** (Q1–Q4) in a row — count + selectable (tapping one
    jumps the whole screen's granularity/selection to that quarter);
    selected tile gets a primary-tinted background + border.
  - A **12-month bar chart** (`MonthlyTrendChart` — a plain, animation-free
    bar chart; the tallest bar is highlighted in the solid brand color,
    all others a lighter tint) with a "Busiest month: X · N requests"
    caption underneath.
- **When granularity is Month** — two extra sections replace the above:
  - **By week**: one tile per ISO week that falls in the selected month,
    each showing "W36" style label + count.
  - **Most requests**: a top-5 leaderboard — avatar + name + a count pill,
    sorted descending, "No requests in this period." when empty.
- **Loading state:** a centered spinner (first load only). **Empty
  state:** centered "No leave activity yet." text.

---

### 3.4 Report tab (Uninformed Leave)

**Files:** `ui/report/ReportScreen.kt` / `ReportViewModel.kt`

Where the manager flags an unexplained absence (an employee who never
applied for leave) and tracks/resolves those flags. This is the *only*
place in the app that creates a leave-adjacent record directly (every
other leave record originates on the web app).

- Header row: "Report" title + a filled **"+ New report"** button that
  toggles a form open/closed in place (no separate screen/dialog).
- A **developer filter dropdown** ("All developers" or one specific
  person) scopes everything below it.
- **New report form** (only visible once opened), a `Card`:
  - `DeveloperPickerDropdown` — single-select, required, "Select a
    developer" placeholder.
  - `EditableDateField` — an outlined button showing "d MMM yyyy",
    opening a real (editable) Material3 `DatePickerDialog` with OK/Cancel;
    defaults to today but can be back-dated.
  - A **rich-text reason editor** (see `RichTextEditor` below),
    placeholder "Why is this being flagged?".
  - Cancel / **Submit** (disabled until a developer + non-blank reason are
    set; shows a small spinner in place of the label while submitting).
- **Open reports** list — one `Card` per still-unresolved report: name +
  email, the absence date top-right, the reported reason (rendered HTML),
  "Reported by X", and a "Resolve" outlined button.
  - Tapping **Resolve** expands the same card in place with its own rich-
    text editor ("Explain what happened...") + Cancel / "Save resolution"
    (spinner while submitting). This is the **manager-direct resolution
    path** — the alternative to the developer explaining themselves via
    the emailed link on web.
  - Empty: "No open reports." (or "... for this developer." when filtered).
- **Resolutions** section below (always visible, header + list): read-only
  audit log of resolved reports — name/email, "Absence: <date>" top-right,
  divider, "Reported reason" (HTML), divider, "Resolved by X" (bold) +
  the resolution HTML. Cards use a faint tinted background to visually
  de-emphasize them versus the actionable "Open reports" above.
  - Empty: "Nothing resolved yet." (or "... for this developer.").
- **Loading state:** centered spinner, but only while both lists are still
  empty (a background refresh doesn't blank the screen).

---

## 4. Shared building blocks

These aren't separate screens, but they recur across multiple screens
above and are worth their own design treatment in a redesign:

- **`Avatar`** — initials circle (name → 2-letter initials, or first 2
  letters of a single word, or "?"), color deterministically hashed from
  name/email out of a 4-color palette shared with the leave-type accents
  (no separate "avatar palette").
- **`RichTextEditor`** — a from-scratch native Compose editor (no WebView):
  a 3-button toolbar (Bold / Italic / Underline as `IconToggleButton`s,
  disabled with no text selection, tinted primary when the current
  selection is fully covered by that style) above a rounded, tinted
  text box (min 4 lines). Serializes straight to the same
  `<p>`/`<b>`/`<i>`/`<u>` HTML string shape used everywhere else in the
  project (web included) — so a report written here and a leave reason
  written on the web app render identically.
- **`HtmlText`** — the read-only counterpart; renders that same HTML
  shape with real paragraph/list spacing via an embedded `TextView`
  (`FROM_HTML_MODE_LEGACY`), used for reasons/resolutions wherever they're
  displayed but not edited.
- **Status colors** (used everywhere a status badge/pill appears):
  Requested = amber, Approved = green, Rejected = red, Withdrawn = neutral
  grey.
- **Type/duration colors:** Foreign Trip = blue, Umrah = teal, Medical =
  cyan, Casual (Short/Full/Out Pass family) = purple; duration-specific:
  Short = blue-ish, Full = indigo, Out Pass = teal — matching the web
  app's own token palette 1:1 (this app deliberately mirrors the web
  design system rather than having its own).
- **Skeleton / refreshing states** — `SkeletonCard` (shimmer placeholder,
  first load only) and `RefreshingPill` (small floating "Refreshing…"
  pill, manual refresh with existing data) are the only two loading
  treatments used anywhere; no full-screen spinners once any real data has
  ever loaded for a tab.
- **Push notifications** — not a screen, but part of the navigation
  surface: a high-importance "Leave requests" channel; tapping a
  notification always opens the app straight to the relevant request's
  detail sheet, auto-routed to whichever tab (Requests or Archived)
  currently holds it.

---

## Screens/states this app does **not** have

Worth naming explicitly since their absence is itself a redesign
consideration:

- No settings/preferences screen (nothing to configure — single owner,
  no theme choice, no notification toggles beyond the OS permission
  prompt).
- No onboarding/first-run walkthrough.
- No in-app leave *application* flow — applying for leave only exists on
  the web app; this app is purely for the manager to review/approve/report.
- No offline/no-connectivity screen — Firestore's own offline cache/retry
  behavior is relied on implicitly, with no bespoke UI for it.
- No dedicated dark-mode redesign — `ui/theme/Theme.kt` just swaps in a
  static Material3 `darkColorScheme` (same brand orange primary either
  way) when the system is in dark mode; there's no dynamic/Material-You
  color and no per-screen dark-specific layout.
