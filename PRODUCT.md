# Product — NalamDesk (shared)

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two apps, two audiences. Desktop (offline-first clinic console): Doctor primary with Receptionist, Nurse, Admin under RBAC. Cloud portal (public bookings): Patients requesting appointments. Details live in `desktop/PRODUCT.md` and `cloud/PRODUCT.md` — this file records only what both share.

## Product Purpose

Privacy-focused practice management split across two surfaces: an offline-first Desktop vault that runs the clinic day, and a thin public Cloud intake that queues booking requests into it. Success means the clinic operates fully offline while patients can still find the clinic and request a callback online.

## Positioning

Offline-first privacy vault with thin public intake. Core medical records live encrypted on the Desktop device only; the cloud holds directory, slots, and transient request messages — never the record.

## Operating Context

Desktop (Electron + Angular + local Fastify on :3000, SQLite/SQLCipher) polls Cloud (Angular web + Fastify API) via `GET /sync` with heartbeat (`last_seen`), publishes slots via `POST /slots`, and acks via `POST /ack`. Per-app workflows live in the child files.

## Capabilities and Constraints

Shared durable constraints: full-DB encryption at rest with no password reset on Desktop; RBAC on Desktop; cloud never stores encounters/prescriptions/history; AGPL-3.0-only. Per-app capabilities live in `desktop/PRODUCT.md` and `cloud/PRODUCT.md`.

## Brand Commitments

Name: NalamDesk. Promise: secure, offline-first, local data ownership. Desktop visual identity is `desktop/DESIGN.md` (Clinical Clarity). Cloud portal has no committed DESIGN.md yet — its current gradient hero is as-built, not approved identity.

## Evidence on Hand

Child records: `desktop/PRODUCT.md`, `desktop/DESIGN.md`, `cloud/PRODUCT.md`. Entry docs: `README.md`, `desktop/USER_GUIDE.md`, `desktop/DEVELOPER_GUIDE.md`, `cloud/documentation/docs/`.

Absences future work must not fabricate: no testimonials, customers, benchmarks, pricing, or deployment claims in repo.

## Product Principles

1. Local-first privacy by default — cloud is intake, never the record.
2. Clinical safety on Desktop cannot be bypassed.
3. Public intake stays minimal and honest — request, not guaranteed booking.

## Accessibility & Inclusion

Desktop themes and portal dialog semantics must be preserved per child file. No formal WCAG target established — do not claim one.
