# Project Brain — Meta Lead → Email + WhatsApp → Agentic Booking (Antigravity IDE)
Version: 1.0  
Owner: Moments to Frames Studio (Barrhaven, Ottawa)  
Timezone: America/Toronto  
Primary Goal: Convert Meta leads into booked sessions with **zero human intervention** (except edge cases).

---

## 1) Mission
Build an event-driven, agentic automation that:
1) detects new Meta leads,
2) sends an immediate email + WhatsApp outreach (when phone exists),
3) runs a two-way conversation on both channels,
4) books the client into a calendar slot + sends confirmation,
5) executes a follow-up cadence if the lead is idle,
6) never spams, never violates opt-out, and never double-messages due to webhook retries.

Success is measured by **booking conversion rate**, **time-to-first-response**, and **manual intervention rate**.

---

## 2) Business Context (MTF Studio Defaults)
Studio: Moments to Frames Studio  
Location: 3 Stoneleigh Street, Barrhaven, Ottawa  
Offerings:
- Maternity Sessions: $300 CAD, 1 hour, studio, maternity wardrobe included, partner/children allowed, 10 edited photos included, extra edits $5/image
- Family Portraits: Same base package structure but valid for 5 people; +$25/person beyond 5; wardrobe not included; provide consult for outfit guidance
Delivery timeline:
- Next-day online selection gallery (non-downloadable, no RAWs)
- Editing: 5–7 days after selection
- Final downloadable gallery full-res

**This information must be used by the Conversation Agent when answering pricing/package questions.**

---

## 3) Scope
### In Scope
- Meta Lead Ads ingestion via webhook + Graph API fetch
- Dedupe + idempotent processing
- Automated outbound:
  - Email (transactional provider)
  - WhatsApp Business Platform (Cloud API) outbound template + session messaging
- Inbound handling:
  - Email replies
  - WhatsApp replies
- Conversation agent to qualify + move to booking
- Booking agent to propose times + confirm + create calendar event
- Automated follow-up cadence (up to 3 touches)
- Opt-out compliance across channels
- Audit logs and metrics

### Out of Scope (Phase 1)
- Full CRM integration (HubSpot/Salesforce) (optional Phase 2)
- Payments capture automation (deposit links allowed; auto reconciliation later)
- Multi-language (English-only Phase 1)
- Human handoff UI (only minimal “needs_manual” queue)

---

## 4) Non-Negotiables (Reliability + Compliance)
### Webhook Reality
- Meta/Email/WhatsApp webhooks can retry and duplicate.
- The system must be **idempotent**:
  - Meta lead uniqueness key = `leadgen_id`
  - Store and reject duplicates on ingest.
- Every outbound message must have a **cooldown guard** to prevent double-sends.

### WhatsApp Rules
- First outbound message should use an **approved template** (unless within 24-hour window triggered by user message).
- If user replies, we have a **24-hour service window** for free-form messages.
- Outside the 24-hour window: templates only.

### Email Rules
- Include identity + opt-out instruction in footer.
- If user opts out, suppress all future messages.

### Hard Stop
If a lead is in `OPT_OUT`, do not send anything. No exceptions.

---

## 5) High-Level Architecture
Event-driven pipeline with agentic orchestration and state management.

### Components
1) **Webhook Gateway**
   - Endpoints: Meta leadgen, WhatsApp inbound, Email inbound
   - Signature verification (Meta / provider-specific)
2) **Core Orchestrator (State Machine)**
   - Owns lead lifecycle: NEW → CONTACTED → ENGAGED → BOOKED/CLOSED/OPT_OUT
3) **Agents**
   - Lead Qualifier Agent
   - Conversation Agent
   - Booking Agent
   - Follow-up Agent
   - Compliance Guard Agent
4) **Data Store**
   - Lead table
   - Message log table
   - Job schedule table
5) **Messaging Integrations**
   - Email provider (SendGrid recommended for inbound parsing)
   - WhatsApp Business Platform Cloud API
6) **Calendar Integration**
   - Google Calendar availability + event creation
7) **Scheduler/Queue**
   - Runs follow-up jobs and delayed actions

---

## 6) Data Model (Must Implement Exactly)
### 6.1 Lead Table: `leads`
Required fields:
- `lead_id` (string, primary key) — Meta `leadgen_id`
- `source` (string) — "meta"
- `created_at` (datetime)
- `name` (string|null)
- `email` (string|null)
- `phone` (string|null, E.164 if possible)
- `session_type` (enum|null) — maternity | family | portrait | unknown
- `timeline` (enum|null) — within_month | one_to_two_months | two_plus_months | unknown
- `consent_email` (bool) default true if captured in form; else false
- `consent_whatsapp` (bool) default true if captured; else false
- `status` (enum) — NEW | CONTACTED | ENGAGED | BOOKED | CLOSED | OPT_OUT | NEEDS_MANUAL
- `email_thread_id` (string|null)
- `whatsapp_conversation_id` (string|null)
- `last_contact_at` (datetime|null)
- `last_reply_at` (datetime|null)
- `followup_stage` (int) default 0
- `next_followup_at` (datetime|null)
- `cooldown_until` (datetime|null) — global anti-spam guard
- `notes` (json|null) — extracted details (preferences, family size, etc.)

### 6.2 Message Log Table: `message_log`
- `id` (uuid, pk)
- `lead_id` (fk)
- `channel` (enum) — email | whatsapp
- `direction` (enum) — outbound | inbound
- `timestamp` (datetime)
- `content` (text, store sanitized; no secrets)
- `provider_ref` (string|null) — message id from provider
- `intent_tag` (string|null) — booking_intent | pricing | schedule | objection | opt_out | etc.

### 6.3 Job Table: `jobs`
- `id` (uuid)
- `job_name` (string) — followup_check | delayed_send | etc.
- `lead_id` (fk)
- `run_at` (datetime)
- `payload` (json)
- `status` (enum) — queued | running | done | failed
- `attempts` (int)

---

## 7) State Machine (Canonical)
### 7.1 States
- `NEW`: lead ingested, not contacted yet
- `CONTACTED`: first outreach sent
- `ENGAGED`: inbound reply received OR lead actively conversing
- `BOOKED`: appointment confirmed + calendar event created
- `CLOSED`: not interested / out of scope / no response after cadence
- `OPT_OUT`: user requested stop/unsubscribe
- `NEEDS_MANUAL`: missing contact info, repeated failures, ambiguous

### 7.2 Transitions
- NEW → CONTACTED: after successful first outreach
- CONTACTED → ENGAGED: on inbound reply (email or WhatsApp)
- ENGAGED → BOOKED: after booking confirmed + calendar event created
- ENGAGED → CLOSED: “not interested”, “already booked elsewhere”, out of region, etc.
- Any → OPT_OUT: on opt-out keywords or explicit request
- CONTACTED → CLOSED: after follow-up stage 3 with no response
- Any → NEEDS_MANUAL: repeated errors (>=3) or no channels available

---

## 8) Event Flows (Required)
### 8.1 Meta Lead Ingestion
Trigger: `webhook.meta.leadgen`
Steps:
1) Verify signature
2) Extract `leadgen_id`
3) If `lead_id` exists in `leads`, exit (idempotency)
4) Fetch lead fields from Meta Graph API
5) Normalize phone/email
6) Infer `session_type` and `timeline` from form fields if present
7) Save lead with status NEW
8) Emit internal event `lead.created`

### 8.2 First Contact (Parallel)
Trigger: `lead.created`
Rules:
- If `email` exists AND `consent_email=true` → send email
- If `phone` exists AND `consent_whatsapp=true` → send WhatsApp template
- If neither exists → status NEEDS_MANUAL
- Set status CONTACTED
- Set `last_contact_at=now`
- Schedule follow-up job `followup_check` at T+2h (local)

### 8.3 Inbound Routing
Trigger:
- `webhook.email.inbound`
- `webhook.whatsapp.inbound`
Steps:
1) Identify lead by:
   - email thread id / In-Reply-To headers, or
   - email address / phone number match
2) Log inbound message
3) If opt-out detected → set OPT_OUT and send one confirmation (if allowed)
4) Else set status ENGAGED and `last_reply_at=now`
5) Pass message + lead context to **Conversation Agent**
6) Send agent reply on same channel
7) If agent tags booking intent → invoke **Booking Agent**

### 8.4 Follow-up Cadence
Trigger: `followup_check(lead_id)`
Rules:
- If status in BOOKED/CLOSED/OPT_OUT → stop
- If `last_reply_at` exists and is after last_contact → stop (engaged)
- Else progress `followup_stage += 1` and send follow-up (email + WhatsApp template if required)
- Follow-up schedule:
  - Stage 1: +2 hours from first outreach
  - Stage 2: +24 hours
  - Stage 3: +72 hours
- After Stage 3 with no response → set status CLOSED (`closed_no_response`)
- Every follow-up must include opt-out instruction

---

## 9) Agent Specifications (Exact Responsibilities)
### 9.1 Compliance Guard Agent (Runs Before Any Outbound)
Inputs: lead, message, channel, time-window  
Outputs: allow/deny + redactions + reason
Rules:
- If lead.status=OPT_OUT → deny
- If cooldown active (`now < cooldown_until`) → deny
- Enforce WhatsApp template requirement when outside 24h window
- Detect and act on opt-out keywords: "stop", "unsubscribe", "don’t contact", "do not contact"
- Never request sensitive info (SIN, health, etc.)

### 9.2 Lead Qualifier Agent
Goal: Extract missing booking-critical details with minimal questions.
Outputs fields:
- session_type
- timeline
- preferred dates range
- studio vs outdoor
- for family: family_size
- any special requests

### 9.3 Conversation Agent (Core Sales + Service)
Goal: Move lead to booking with minimal friction.
Hard rules:
- WhatsApp messages <= 120 words
- Ask max 2 questions per message
- Always include a clear CTA: propose times or ask for date range
- If pricing asked: respond with package details (Section 2) + CTA
- If timeline is 2+ months: still book a tentative slot or offer calendar hold
- Always remain warm, professional, Ottawa-local tone
- If out of scope or non-local: politely close and set CLOSED

Must tag intent:
- booking_intent
- pricing
- availability_request
- objection
- opt_out
- not_interested

### 9.4 Booking Agent
Inputs: lead context + extracted preferences  
Steps:
1) Determine session duration default = 60 minutes
2) Call calendar availability within next 14–60 days based on timeline
3) Propose 3 slots in America/Toronto
4) Confirm slot on reply
5) Create calendar event:
   - Title: “MTF {SessionType} Session — {ClientName}”
   - Location: “3 Stoneleigh Street, Barrhaven, Ottawa”
6) Send confirmation email + WhatsApp message
7) Set status BOOKED

Failure handling:
- If slot taken: apologize + propose new options
- If calendar API fails: set NEEDS_MANUAL after 3 attempts

### 9.5 Follow-up Agent
Generates follow-up messages aligned to stage:
- Stage 1: quick check + 2 slots
- Stage 2: add value (prep/what-to-wear guide) + link/slots
- Stage 3: scarcity-light (“I can hold a spot for 24h”) + opt-out

---

## 10) Messaging Templates (Seed Copy)
### 10.1 WhatsApp Approved Template (First Touch)
Template name: `lead_welcome_booking`
Params: {1=Name, 2=SessionType}

Body:
"Hi {{1}} 👋 It’s Moments to Frames Studio in Barrhaven. Thanks for reaching out about a {{2}} session.  
To get you booked, reply with:  
1) your ideal date range, and  
2) studio or outdoor."

### 10.2 Email First Touch
Subject:
"Next steps for your {session_type} session in Barrhaven"

Body must include:
- short thank you
- 2 key questions (date range + studio/outdoor)
- package headline + starting price (if session_type known)
- opt-out line in footer

Email footer (mandatory):
"Moments to Frames Studio — Barrhaven, Ottawa.  
Reply STOP to opt out of messages."

### 10.3 Follow-up Email/WA
All follow-ups must:
- be short
- include value + CTA
- include opt-out instruction

---

## 11) Integrations (Implementation Requirements)
### 11.1 Meta Graph API
- Store tokens securely (secrets manager)
- Fetch lead fields using `leadgen_id`
- Map Meta fields to Lead table

### 11.2 WhatsApp Cloud API
- Configure webhook verification
- Store phone numbers in E.164
- Template submission + approval (manual setup step)
- Track `whatsapp_conversation_id` and last inbound timestamp to enforce 24h rule

### 11.3 Email Provider
Recommended: SendGrid
- Outbound API
- Inbound parse webhook to capture replies
- Threading using Message-ID / In-Reply-To

### 11.4 Google Calendar
- Read availability windows
- Create events
- Avoid double-bookings via re-check just before creation

### 11.5 Payments (Optional Phase 1)
- Stripe payment link generator
- Only send when lead requests or after booking confirmation

---

## 12) Antigravity Tooling (Functions to Implement)
All tools must return structured JSON, and every tool must log failures.

### 12.1 Data Tools
- `db.upsert_lead(lead)`
- `db.get_lead_by_id(lead_id)`
- `db.find_lead_by_contact(email, phone)`
- `db.log_message(entry)`
- `db.set_status(lead_id, status)`
- `db.increment_followup_stage(lead_id)`

### 12.2 Meta Tools
- `meta.verify_signature(headers, body)`
- `meta.fetch_lead(leadgen_id)`

### 12.3 WhatsApp Tools
- `wa.send_template(phone, template_name, params)`
- `wa.send_message(phone, text)`
- `wa.parse_inbound(payload)` → {phone, text, msg_id, timestamp}

### 12.4 Email Tools
- `email.send(to, subject, body_html, thread_ref?)`
- `email.parse_inbound(payload)` → {from, subject, body_text, thread_id, timestamp}

### 12.5 Calendar Tools
- `calendar.get_availability(start, end, duration_minutes)`
- `calendar.create_event(title, start, end, location, description, attendee_email?)`

### 12.6 Scheduler Tools
- `scheduler.enqueue(job_name, run_at, payload)`
- `scheduler.cancel_jobs(lead_id, job_name?)`

### 12.7 Policy Tool
- `policy.check(lead, channel, message, now)` → allow/deny + edits

---

## 13) Workflow Definitions (Antigravity)
### Workflow A: `MetaLeadIntake`
Trigger: `webhook.meta.leadgen`
1) Verify
2) Deduplicate by `leadgen_id`
3) Fetch lead
4) Normalize + store in DB
5) Emit `lead.created`

### Workflow B: `LeadFirstContact`
Trigger: `lead.created`
1) Run policy check per channel
2) Send WhatsApp template if allowed
3) Send email if allowed
4) Update status CONTACTED
5) Schedule followup_check in 2 hours

### Workflow C: `InboundMessageRouter`
Trigger: `webhook.whatsapp.inbound` OR `webhook.email.inbound`
1) Parse inbound
2) Match lead
3) Log inbound
4) Opt-out check → OPT_OUT + cancel scheduled followups
5) Set ENGAGED
6) Conversation Agent generates reply + intent tag
7) Policy check + send reply
8) If booking intent → invoke Booking Agent

### Workflow D: `FollowupCadence`
Trigger: `job.followup_check`
1) Load lead
2) Stop conditions (BOOKED/CLOSED/OPT_OUT/ENGAGED)
3) Increment stage
4) Generate follow-up via Follow-up Agent
5) Policy check + send
6) Schedule next stage or close lead

### Workflow E: `BookingFlow`
Trigger: `intent.booking_intent`
1) Ensure we have minimum fields
2) Calendar availability
3) Send 3 slot options
4) On user confirmation, create event
5) Send confirmation + prep info
6) Set BOOKED + cancel followup jobs

---

## 14) Error Handling & Retries
### Retry Policy
- For external API failures: exponential backoff, max 3 attempts
- After 3 failures:
  - set lead to NEEDS_MANUAL
  - log error with context

### Dead-letter Strategy
- Failed jobs stored with payload + error
- A manual replay mechanism exists (Phase 2)

---

## 15) Observability (Required Metrics)
Track:
- Leads ingested/day
- Time-to-first-contact (p50/p95)
- Reply rate by channel
- Booking conversion rate
- Manual intervention rate
- Follow-up stage distribution
- Opt-out rate
- Duplicate webhook events blocked

Logs must include:
- lead_id
- channel
- message ids
- tool call success/failure

---

## 16) Test Plan (Must Pass Before Launch)
### Unit Tests
- Deduplication on Meta webhook retries
- Phone/email normalization
- Opt-out detection across languages/variants
- WhatsApp 24-hour window enforcement

### Integration Tests (Sandbox)
- Meta lead fetch works end-to-end
- WhatsApp template send success
- Email send + inbound reply parsing
- Calendar availability + create event

### Scenario Tests
1) Lead has phone+email → gets both messages → replies on WhatsApp → books
2) Lead has email only → email convo → books
3) Lead never replies → follow-ups trigger stage 1–3 → lead closes
4) Lead says STOP → OPT_OUT + suppress forever
5) Calendar conflict mid-booking → re-offer slots

---

## 17) Deployment Checklist
- Meta webhook live + verified
- WhatsApp Cloud API configured + template approved
- Email inbound parse webhook configured
- Secrets stored in secure vault
- Database migrations applied
- Scheduler enabled
- Monitoring dashboard live
- Rate limits configured (per channel) to avoid provider bans

---

## 18) Operating Rules (Production Guardrails)
- Never send more than:
  - 1 initial outreach per channel
  - 3 follow-ups total
- Respect quiet hours (optional but recommended):
  - Do not send between 9pm–8am America/Toronto unless user initiated within last hour
- If lead replies on one channel, pause follow-ups on both channels
- If lead is booked, stop all future follow-ups immediately

---

## 19) Phase Roadmap
### Phase 1 (MVP)
- Meta ingestion + email + WhatsApp + basic booking + follow-ups
- Google Calendar integration
- Basic metrics

### Phase 2
- CRM sync
- Payment automation + deposit collection tracking
- A/B testing of scripts
- Human handoff UI

---

## 20) Definition of Done
Project is “done” when:
- 95%+ of leads receive first contact within 2 minutes
- Duplicate webhooks never cause duplicate messages
- 0 policy violations (opt-out respected, WhatsApp templates used correctly)
- Bookings can be created end-to-end without human intervention
- Follow-up cadence runs reliably and stops on engagement/booking/opt-out

---
END OF PROJECT BRAIN