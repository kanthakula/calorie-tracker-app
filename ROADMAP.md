# K21 Calorie Tracker — Product & Security Roadmap

> Status: planning. Sprints are sequenced by dependency. Security foundation (Phase A)
> must land before any medical-document feature goes live.
> Last updated: 2026-06-23.

## Vision & differentiation
Most calorie apps track food in. K21 closes the loop with the user's **actual clinical
context**: it ingests the nutrition plan a doctor prescribed and the user's lab reports,
then continuously measures real diet/workout behavior against that plan and those
biomarkers — flagging drift, warning on exceedances, and producing a doctor-readable
report the user can hand back to their physician.

**What makes it unique (one-liner):** *"The only tracker that helps you follow your
doctor's nutrition plan — and proves to your doctor how you did."*

Pillars: food & nutrition tracking · workouts & calorie burn · recipes · nutrition-database
sync · **prescribed-plan compliance** · **lab/biomarker history & insights** · **doctor-grade export**.

## Guardrails (apply to every sprint)
- **Not medical advice.** The app surfaces patterns and deviations from the user's own
  doctor-prescribed plan. It never diagnoses, never alters a prescription, and shows a
  persistent disclaimer. All AI insight copy reviewed against this rule.
- **Security hygiene, not formal HIPAA** (unless a covered-entity customer is onboarded).
  Encryption, least-privilege, audit logging, consent, minimization, masking.
- **Explicit consent** before processing any medical document; one-tap delete of medical data.
- **Contract-first.** All new shapes added to `@k21/validation` (Zod) before consumers.

---

## PHASE A — Security & data-protection foundation
*Must precede Phase B. Closes brute-force/DDoS/secret holes and makes the system safe to hold medical data.*

### Sprint 1 — Stop the bleeding (critical, ~1–2 days)
- Fail-fast at boot in `api/node-api/src/env.ts` if `JWT_SECRET`, `AI_INTERNAL_TOKEN`,
  `ADMIN_PASSWORD` are unset or equal to dev defaults when `NODE_ENV=production`.
- Generate & install strong random secrets for production.
- Rate-limit `/api/auth/login` & `/register` (5–10/min/IP) + per-account failed-login
  lockout (model the timing-safe pattern in `middleware/admin.ts`).
- Cloudflare edge protection on the public tunnel (`ojas.akulaz.ai`): WAF managed rules,
  Bot Fight Mode, rate-limiting rule, DDoS protection. *(Biggest single win vs bots/DoS.)*
- **Exit:** no insecure default reachable in prod; auth endpoints throttled; edge WAF live.

### Sprint 2 — Data protection + compliance scaffolding (~3–4 days)
- Postgres: automated daily encrypted `pg_dump` off-box + documented restore; volume/disk
  encryption; least-privilege app DB role (not superuser); rotate dev password for non-dev.
- HTTPS/HSTS everywhere; Node trusts only the tunnel; tighten Helmet CSP for Next.js.
- Move JWT from `localStorage` → httpOnly+Secure+SameSite cookie; add short access token +
  refresh + server-side revocation (logout/everywhere).
- **Audit logging** foundation: structured, separate sink — auth events, admin actions,
  and (forward-looking) medical-record access. Who/what/when/where.
- **Consent & disclaimer framework**: consent records table, persistent "not medical
  advice" disclaimer component, account-delete + export-my-data endpoints (GDPR/FTC).
- Redis-backed rate limiting shared across the 4 PM2 workers (in-memory limits leak per-worker today).
- **Exit:** data encrypted at rest + backed up; tokens revocable; audit trail + consent in place.

---

## PHASE B — Health intelligence core (the differentiator)

### Sprint 3 — Document scan + prescribed nutrition plan (~4–5 days)
- New AI-service capability: **document analysis** (distinct from food photo). Vision LLM
  reads a photo/PDF of a nutrition plan or prescription → structured plan. No separate OCR
  needed (Gemini/Claude read documents directly); accept image + PDF.
- **Secure document storage**: finish `ai-service/app/integrations/storage.py` with an
  encrypted backend (server-side encryption, per-user access control, signed short-TTL URLs).
  Documents are sensitive — never world-readable, never in client logs.
- New models (`@k21/validation` + Prisma): `NutritionPlan` (targets: kcal, macros, sodium,
  sugar, fiber, water, per-meal rules, restrictions/allergens, prescribing notes, source doc,
  active range) attached to `Profile`.
- Web/mobile: "Scan my plan" flow → review/confirm extracted plan → save to profile.
- **Exit:** user scans a plan; it's parsed, confirmed, stored encrypted, shown on profile.

### Sprint 4 — Plan-vs-actual compliance engine (~3–4 days)
- Compliance service: compare each day's tracked meals/macros/water/workouts against the
  active `NutritionPlan` → per-day adherence score + per-rule deltas.
- Dashboard surfaces: green/amber/red flags, "over sodium 3 days running," tailored
  suggestions ("you're 30g under protein vs plan"). Extends the existing daily "insight."
- Persist daily adherence snapshots (needed later for trends + doctor export).
- **Exit:** dashboard shows real-time adherence and deviation warnings against the plan.

### Sprint 5 — Medical reports & lab biomarker history (~4–5 days)
- Scan lab report → extract biomarkers into a typed catalog (HbA1c, fasting glucose, lipid
  panel, BP, vitamin D, eGFR, etc.) with value, unit, reference range, in/out-of-range, date.
- New models: `MedicalReport` (source doc, lab, date, raw extraction) + `LabResult`
  (biomarker, value, unit, range, flag) + optional `HealthCondition` (e.g. T2 diabetes,
  hypertension) the engine can reason over.
- Biomarker **trend history** view (date-wise charts, hand-rolled per CLAUDE.md — no chart lib).
- Heightened controls: explicit consent gate, encryption, audit log on every read, easy delete.
- **Exit:** user scans labs; biomarkers tracked over time with trends; fully consented + encrypted.

### Sprint 6 — Health insight & recommendation engine (~4–5 days)
- Rules + LLM engine combining `NutritionPlan` + `LabResult` history + actual diet/workouts →
  personalized, *informational* food suggestions and exceedance warnings
  ("your added-sugar intake trends with your rising HbA1c — your plan caps it at Xg").
- Strict output validation; every suggestion carries the disclaimer; never contradicts the
  prescribed plan; configurable aggressiveness.
- **Exit:** users get contextual, safe, plan-and-lab-aware guidance with clear disclaimers.

---

## PHASE C — Engagement & sharing

### Sprint 7 — Notifications & email (~3–4 days)
- Transactional email provider (e.g. Resend/SES/Postmark — pick by cost + deliverability):
  email verification, **password reset** (single-use, expiring, hashed token, out-of-band),
  security alerts (new login).
- Notification engine + **subscription preferences**: daily/weekly adherence digest,
  exceedance/red-flag alerts, lab-trend nudges, reminders. Per-channel opt-in/out.
- Web/mobile **push** notifications.
- **Exit:** users self-subscribe; password reset works; alerts & digests deliver per preference.

### Sprint 8 — Doctor-grade export & dashboards (~4–5 days)
- Export user data **date-range / month-wise** in clinician-friendly format: PDF report +
  CSV, using clinical terminology, with hand-rolled charts (intake vs plan adherence,
  biomarker trends, macro distribution, weight/workout trends).
- Shareable, access-controlled report link (expiring) the user can hand to their doctor.
- Reuses Sprint 4 adherence snapshots + Sprint 5 biomarker history.
- **Exit:** user exports a doctor-readable PDF/CSV for any date range and shares it securely.

---

## PHASE D — Breadth & polish

### Sprint 9 — Nutrition database, recipes, barcode (~3–4 days)
- Deepen nutrition-database sync (USDA/branded) feeding the food library and AI fallbacks.
- Recipe enhancements (per-ingredient macros → meal logging); finish barcode lookup.
- **Exit:** richer food data; recipes and barcode fully usable.

### Sprint 10 — Mobile parity, privacy & ops hardening (~ongoing)
- Mobile feature parity with web (scan plan, labs, compliance, export).
- Dependency/secret scanning in CI (`pnpm audit`, Dependabot, gitleaks), `SECURITY.md`.
- Monitoring/alerting on 401/429 spikes (early-DDoS signal), error rate, latency.
- Optional: field-level encryption for the most sensitive fields; formal compliance program
  **only** if a covered-entity customer is signed.

---

## Cross-cutting data-model additions (contract-first in `@k21/validation`, then Prisma)
- `NutritionPlan`, `MedicalReport`, `LabResult`, `HealthCondition`
- `ConsentRecord`, `AuditLog`, `NotificationPreference`, `RefreshToken`
- `DailyAdherence` snapshot, `StoredDocument` (encrypted blob metadata)

## Open decisions (need your call)
1. **Email/push provider** — DEFERRED: keep provider-agnostic; pick (Resend/SES/Postmark) at Sprint 7.
2. **Document storage backend** — local-encrypted now vs S3/GCS with SSE for scale.
3. **Suggestion aggressiveness** — conservative (flag deviations only) vs proactive (suggest swaps).
4. **Mobile parity timing** — build each feature web-first then port, or web+mobile together.
