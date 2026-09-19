# Product — NalamDesk Cloud Bookings Portal

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: Patient (or family member) on mobile or desktop web finding a clinic and requesting an appointment — needs to find a trusted clinic fast with minimal typing.

Secondary: Clinic staff enabling Online Booking (toggle in Desktop Settings → Cloud Sync, enter Clinic Name + City) and polling the queue from Desktop. No clinical roles live in this portal; doctors/receptionists work in the Desktop app.

## Product Purpose

Public-facing booking intake for NalamDesk. What it does: public clinic directory (search by name/city/specialty) → clinic cards with Online/Offline presence → slot picker (date tabs + time grid) or general callback request → name + phone + reason form → queued `APPOINTMENT_REQUEST` message the Desktop polls via `GET /sync` and acks via `POST /ack`. Success means a patient can request in under a minute, and the clinic sees it in Desktop Today's Appointments without exposing any medical records.

## Positioning

Thin public intake, not a clinic SaaS. Unlike the Desktop vault, the cloud holds only directory data (clinic name/city/specialty/`last_seen`), published slots (`AVAILABLE`/`HELD`/`BOOKED`), and transient booking-request messages. Core patient records, encounters, and prescriptions never enter this system.

## Operating Context

Public web (`cloud/web`, Angular 17, `ng serve` on :4200) against Fastify API (`cloud/api`, `POST /onboard`, `GET /clinics`, `GET /slots/:clinicId`, `POST /book`, `GET /sync`, `POST /ack`, `POST /slots`). Desktop heartbeat on each `/sync` updates `clinics.last_seen`; portal shows Online if seen within 5 minutes, else Offline. Slot holds expire after 5 minutes (`held_until`), expired holds read as available. Desktop publishes availability per date (`PublishSlotsSchema`: `dates[]` + `slots[{date,time}]`, clearing `AVAILABLE` rows for those dates first). Patient check-in and validation happen later in Desktop, never here.

## Capabilities and Constraints

Confirmed: clinic search filter (name/city/specialty substring), loading spinner + empty-state copy, clinic cards (specialty badge, city, Online/Offline chip, Book Appointment CTA), booking modal with date tabs (`EEE, MMM d`), 3-col time grid (`max-h-60` scroll), selected-time summary vs. general-request (amber) summary, name + phone (10–15 digits) + optional reason, Zod-validated `POST /book` accepting `{clinicId, slotId?, patientName, phone, reason?}` (slot path does atomic AVAILABLE→HELD + queue insert; general path requires `clinicId`), success state ("Request Sent! … will call you shortly"), inline error box, authenticated sync surface (`x-api-key` + `x-clinic-id`, `x-app-secret` for onboard).

Durable constraints: never store or display patient history, encounters, or prescriptions here; never promise instant confirmation (copy says request/callback); phone format 10–15 digits; slot conflict returns 404/409 and must surface as plain error, not silent success.

Undecided: visual world for this portal (current code uses gradient hero + pill search + cards; no DESIGN.md committed yet).

## Brand Commitments

Name: NalamDesk Health Platform (portal footer `© 2026 NalamDesk Health Platform`). Tone is public-friendly and reassuring ("Find Your NalamDesk Doctor", "Book appointments instantly"). No binding visual constraints committed — do not treat the current gradient hero as an approved identity until a portal DESIGN.md is written.

## Evidence on Hand

Real paths: `cloud/web/src/app/pages/home.component.ts` (hero, search, clinic grid), `cloud/web/src/app/components/booking-modal.component.ts` (slots → form → success), `cloud/web/src/app/api.service.ts` (`/clinics`, `/slots/:clinicId`, `/book`), `cloud/api/src/routes/api.ts` (onboard/book/sync/ack/slots + heartbeat), `cloud/web/src/styles.css`, `cloud/web/src/environments/environment*.ts`.

Absences future work must not fabricate: no doctor ratings data (current hero copy claims "top-rated" without backing — do not extend that claim), no pricing, no testimonials.

## Product Principles

1. Intake only — the portal queues requests; the clinic confirms by phone and checks in on Desktop.
2. Minimal patient effort — search, pick a time or ask for callback, name + phone, done.
3. Honest presence — Online/Offline reflects heartbeat recency, never a quality claim.
4. No record leakage — directory, slots, and queued requests are the entire data surface.

## Accessibility & Inclusion

Form labels, dialog semantics (`role="dialog"`, `aria-modal`, `aria-labelledby`), focus-visible rings, and keyboard-reachable slot buttons must be preserved. No formal WCAG target established — do not claim one.
