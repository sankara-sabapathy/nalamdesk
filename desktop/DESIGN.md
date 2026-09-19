---
name: NalamDesk Desktop
description: Offline-first clinic console — quiet, precise, trust-blue operational UI.
colors:
  primary: "#1868db"
  primary-content: "#ffffff"
  secondary: "#475569"
  accent: "#0ea5e9"
  neutral: "#1e293b"
  base-100: "#ffffff"
  base-200: "#f8fafc"
  base-300: "#f1f5f9"
  base-content: "#0f172a"
  info: "#0ea5e9"
  success: "#22c55e"
  warning: "#eab308"
  error: "#ef4444"
typography:
  display:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontWeight: 700
    lineHeight: 1.25
  headline:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontWeight: 700
    fontSize: "24px"
    lineHeight: 1.3
  title:
    fontFamily: "'Plus Jakarta Sans', sans-serif"
    fontWeight: 600
    fontSize: "20px"
    lineHeight: 1.4
  body:
    fontFamily: "'Inter', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Inter', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.05em"
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-content}"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-outline:
    backgroundColor: "{colors.base-100}"
    textColor: "{colors.base-content}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "{colors.base-100}"
    textColor: "{colors.base-content}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  input:
    backgroundColor: "{colors.base-100}"
    textColor: "{colors.base-content}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.base-100}"
    textColor: "{colors.base-content}"
    rounded: "{rounded.lg}"
    padding: "16px 24px"
---

# Design System: NalamDesk Desktop

> Scope: Desktop Electron console only (`desktop/`). Cloud bookings portal has no committed DESIGN.md yet.

## Overview

**Creative North Star: "Clinical Clarity"**

NalamDesk is a quiet, precise operator console for long clinical shifts. Surfaces stay white on soft slate, hierarchy is carried by weight and position rather than decoration, and enterprise trust-blue appears only where action is required. The anti-reference is marketing SaaS: no gradients, no hero theatrics, no playful dark mode.

**Key Characteristics:**
- Flat white cards on slate-50 app ground with thin gray borders
- Trust-blue reserved for primary action and active selection
- Inter for data, Plus Jakarta Sans for headings only
- Dense but breathable Operate density (14px base, 16–32px section padding)

## Colors

Trust-blue system: one purposeful enterprise blue on calm slate neutrals; sky doubles as info accent; green/yellow/red carry clinical status only.

### Primary
- **Trust Blue** (#1868db): primary actions, active nav, focus rings. White text on top (#ffffff).
- **Trust Blue Content** (#ffffff): text on primary fills.

### Secondary (optional; omit if the project has only one accent)
- **Slate Support** (#475569): secondary text, secondary fills needing lower emphasis than primary.

### Tertiary (optional)
- **Sky Signal** (#0ea5e9): info states, Online Booking accents, drive-sync highlights. Same value doubles as `info`.

### Neutral
- **Ink Slate** (#1e293b): deep neutral for high-emphasis structures.
- **Paper White** (#ffffff): card and modal ground (`base-100`).
- **Clinic Wash** (#f8fafc): app ground (`base-200`, slate-50).
- **Quiet Line Wash** (#f1f5f9): dividers, hover washes, table striping (`base-300`, slate-100).
- **Chart Ink** (#0f172a): primary reading text (`base-content`, slate-900).
- **Clinical Success** (#22c55e): saved confirmations, create-snapshot actions.
- **Caution Amber** (#eab308): warnings needing attention, not errors.
- **Alert Red** (#ef4444): destructive actions, recovery-code emphasis, validation errors.

### Named Rules (optional, powerful)
**The Rare Blue Rule.** Primary blue is used on ≤10% of any screen — one save, one add, one active nav item. Its rarity is the point.

## Typography

**Display Font:** Plus Jakarta Sans (with sans-serif fallback)
**Body Font:** Inter (with sans-serif fallback)

**Character:** Jakarta carries structural headings with calm authority; Inter carries dense clinical data with neutral legibility. No serif, no mono for prose (mono only for versions, paths, codes).

### Hierarchy
- **Display** (700, Plus Jakarta Sans, 1.25): app shell titles like Admin Center.
- **Headline** (700, 24px, 1.3): section titles (`text-2xl font-bold`, e.g. Clinic Details, Users).
- **Title** (600, 20px, 1.4): card titles (`text-lg font-medium`, e.g. Updates, Local Backups).
- **Body** (400, 14px, 1.5): default app text (`text-sm` root); tables at 14px with 13px semibold headers.
- **Label** (600, 12px, 0.05em, uppercase when eyebrow): field labels, table eyebrows, schedule captions.

### Named Rules (optional)
**The Two-Voice Rule.** Headings are always Jakarta; everything else is Inter. Never set body copy in Jakarta for emphasis.

## Layout

Sidebar + content operations grid. Left drawer is fixed 256px (`w-64`) white with right border; right content is fluid `flex-1` with `p-4` mobile / `p-8` desktop scrolling. Cards use `p-4 md:p-6` with `grid grid-cols-1 gap-6` (2-col on `md:` for forms). Tables fill remaining height with internal scroll (`flex-1 min-h-0 overflow-hidden`). Breakpoint behavior is drawer-centric: below `md` the nav becomes fixed overlay with backdrop (`bg-black/50`) and translate transition; above `md` it is static. Spacing rhythm is 8/16/24/32px; section gaps are 16–24px, never tighter in forms.

## Elevation & Depth

Flat-by-default with tonal layering. Depth comes from borders and washes, not shadows.

### Shadow Vocabulary (if applicable)
- **Card rest** (`shadow-sm + border border-gray-200`): default card, form panel, backup section.
- **Overlay lift** (`shadow-lg`): modals (`rounded-lg shadow-lg`), dropdown menus via `.shadow-menu` (`shadow-lg + border-base-200`).
- **Motion accent** (`fade-in-up 420ms cubic-bezier(0.22,1,0.36,1)`): dashboard root entrance only.

### Named Rules (optional)
**The Flat-By-Default Rule.** Surfaces are flat at rest with a 1px gray border. Shadows appear only as response to state (hover, modal, menu).

## Shapes

Gently practical rectangles. Cards and modals are softly rounded (8px, `rounded-lg`); inputs, buttons, and nav items are tighter (6px, `rounded-md`); feature icons use 12px (`rounded-xl`); status dots and avatar placeholders are fully round. Borders are 1px `gray-200` (`#e2e8f0` in grids); active nav adds a 4px left border (`border-l-4 border-blue-500`). No clipping, no pill cards, no sharp zero-radius surfaces except grid internals.

## Components

### Buttons
- **Shape:** tight rectangle (6px, `rounded-md`)
- **Primary:** Trust Blue fill with white text (`btn btn-primary px-6`); small variant `btn-sm` in table toolbars
- **Hover / Focus:** DaisyUI darken + visible focus ring in blue (`focus:ring-blue-500`); disabled uses opacity, never gray text on gray
- **Secondary / Ghost / Tertiary (if applicable):** `btn-outline` for secondary (Check for updates, Change Location), `btn-ghost btn-xs` for quiet resets (Use Default), `btn-error` for destructive restores

### Chips (if used)
- **Style:** role filter pills and urgency badges; active filter is `bg-blue-50 text-blue-700 ring-1 ring-blue-500`
- **State:** triage urgency keeps clinical color (red Immediate, orange Urgent, blue Priority, green Routine); never reuse those hues decoratively

### Cards / Containers
- **Corner Style:** softly rounded (8px, `rounded-lg`)
- **Background:** Paper White on Clinic Wash ground
- **Shadow Strategy:** flat-by-default, `shadow-sm` only
- **Border:** 1px `border-gray-200`
- **Internal Padding:** 16px mobile, 24px desktop (`p-4 md:p-6`)

### Inputs / Fields
- **Style:** white fill, gray stroke, tight radius (`border-gray-300 rounded-md shadow-sm`, `input input-bordered`; small `input-sm` in restores)
- **Focus:** blue border + ring (`focus:border-blue-500 focus:ring-blue-500`)
- **Error / Disabled:** red border + red helper text (`border-red-500 text-red-500`); disabled usernames use `bg-gray-50 text-gray-400`

### Navigation
- Sidebar items are full-width left-aligned rows (`w-full text-left px-3 py-2 rounded-md font-medium flex gap-3 border-l-4`). Default: slate text (`text-gray-600 hover:bg-gray-50 border-transparent`). Active: wash blue with blue text and blue bar (`bg-blue-50 text-blue-700 border-blue-500`). Mobile collapses to overlay drawer with Menu header and ✕ close.

### AG Grid Table
Signature data surface. White ground, white header with gray-900 13px semibold text, 1px slate-200 row/header borders, 24px horizontal cell padding, row hover slate-50 (`#f8fafc`), selected row blue-50 (`#eff6ff`). Header separators hidden; cells vertically centered via flex override.

## Do's and Don'ts

Concrete visual guardrails grounded in the incumbent implementation or the user's chosen world. Lead each with "Do" or "Don't" and include exact values only when established. Do not turn a task-specific concept or surface strategy into a system-wide prohibition.

### Do:
- **Do** keep primary blue rare — one primary per card or dialog.
- **Do** use slate text (`#0f172a` / `gray-600`) on white; keep washes `#f8fafc` / `#f1f5f9` for ground and dividers.
- **Do** keep cards `rounded-lg` with `border-gray-200 + shadow-sm`; modals `rounded-lg + shadow-lg` on `bg-black/50` scrim.
- **Do** set headings in Plus Jakarta Sans, body and tables in Inter 14px.

### Don't:
- **Don't** reuse triage red/orange/green or error red for decoration — they mean clinical status.
- **Don't** introduce gradients, hero shadows, or new accent hues outside the enterprise theme.
- **Don't** set body copy in Jakarta or headings in Inter.
- **Don't** drop card borders to rely on shadow alone — flat with border is the system.
