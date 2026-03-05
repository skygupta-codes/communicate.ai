# plan.md — Antigravity Agentic Workflow: Google Sheets → Telegram + WhatsApp Alerts

## 0) Prime Directive (Hard Rules)
1. The workflow MUST follow ONLY what is written in this file. If a detail is missing, the workflow must choose the simplest safe default described in this file (see “Default Decisions”).
2. No feature creep. Build exactly the minimum to: detect a new row in a Google Sheet and notify Telegram + WhatsApp.
3. No “magic.” Every credential, endpoint, and trigger must be explicit, testable, and logged (without leaking secrets).
4. Security first: secrets never committed; use environment variables only.

---

## 1) Goal
Create an app in **Antigravity IDE** that:
- Detects when a **new row is added** to a specific **Google Sheet**.
- Sends a **Telegram message** to a configured chat.
- Sends a **WhatsApp message** to a configured number.

**Definition of “row added”:**
- A new, non-empty row appears after the last processed row.
- The app must process each row exactly once (idempotent delivery).

---

## 2) Non-Goals
- No UI/dashboard (unless Antigravity requires a minimal config screen; otherwise CLI/service only).
- No complex transformations, analytics, or multi-sheet routing.
- No attachments/media—text messages only.
- No enterprise auth flows beyond what’s required to access Google Sheets.

---

## 3) Architecture (Simple, Reliable)
### 3.1 Components
1. **Row Detector**
   - Reads the sheet at a fixed interval (polling) OR uses a push trigger (Apps Script).
2. **State Store**
   - Persists the last processed row index (or unique row ID) locally.
3. **Notifier**
   - Telegram sender
   - WhatsApp sender
4. **Logger**
   - Structured logs with correlation IDs and status.

### 3.2 Default Decisions (Use these unless you explicitly switch)
- **Default trigger method:** Polling every 30 seconds.
- **Default state store:** Local file `state.json` (or Antigravity key-value store if available).
- **Default WhatsApp provider:** Twilio WhatsApp (fastest to implement) OR Meta WhatsApp Cloud API if Twilio not allowed.
- **Default Google auth:** Google Service Account + shared sheet access (simplest for server-side).

---

## 4) Required Inputs (All via Environment Variables)
### 4.1 Google Sheets
- `GOOGLE_SHEET_ID` — Spreadsheet ID
- `GOOGLE_SHEET_TAB` — Tab name (e.g., `Leads`)
- `GOOGLE_SHEET_RANGE` — Range to read (e.g., `A:Z`)
- `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` — base64-encoded service account JSON

### 4.2 Telegram
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID` (personal chat or group)

### 4.3 WhatsApp (Choose ONE provider path)
#### Option A: Twilio WhatsApp
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM` (format: `whatsapp:+14155238886` or your approved sender)
- `WHATSAPP_TO` (format: `whatsapp:+1XXXXXXXXXX`)

#### Option B: Meta WhatsApp Cloud API
- `META_WHATSAPP_TOKEN`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_TO_E164` (format: `+1XXXXXXXXXX`)

### 4.4 App Runtime
- `POLL_INTERVAL_SECONDS` (default 30)
- `STATE_PATH` (default `./state.json`)
- `LOG_LEVEL` (default `INFO`)

---

## 5) Message Format (Deterministic)
When a new row is detected:
- Build a message string using:
  - Sheet name
  - Row index
  - Timestamp
  - Key columns (first 5 columns by default)

**Default message template:**
`[New Row] Sheet={TAB} Row={ROW_INDEX} Time={ISO8601}\nData={COL1} | {COL2} | {COL3} | {COL4} | {COL5}`

If fewer than 5 columns exist, include what exists.
If columns are empty, show empty placeholders (do not skip).

---

## 6) Idempotency & State
### 6.1 State Model
State must store:
- `last_processed_row_index` (integer)
- `last_run_time` (ISO8601)
- optional: `sheet_fingerprint` (sheet ID + tab)

### 6.2 Idempotency Rule
- Only process rows with index > `last_processed_row_index`.
- After successful sends to BOTH Telegram and WhatsApp, advance state.
- If Telegram succeeds and WhatsApp fails (or vice versa), do NOT advance state.
- Retries will resend. This is acceptable; correctness > convenience.
  - (If you want “no duplicates,” you must implement per-row delivery flags. Not in scope by default.)

---

## 7) Trigger Strategy
### 7.1 Polling (Default)
Loop:
1. Read sheet values (range).
2. Compute “last non-empty row index” (based on any non-empty cell in the row).
3. For each new row, in ascending order:
   - Send Telegram
   - Send WhatsApp
   - Persist updated state

**Polling must:**
- Sleep `POLL_INTERVAL_SECONDS` after each loop.
- Handle rate limits with backoff (see Error Handling).

### 7.2 Alternative: Apps Script Push Trigger (Only if polling is blocked)
- Use a Google Apps Script `onChange` trigger to POST to the app webhook.
- The app receives the payload and then reads the sheet to fetch the new row(s).
- This still requires idempotency state on the app side.

---

## 8) Error Handling (No Drama, Just Discipline)
### 8.1 General
- All external calls must have timeouts.
- Use exponential backoff for retryable errors (HTTP 429, 5xx, network).
- Max retries: 3 attempts per channel per row.

### 8.2 Logging
Every row attempt logs:
- correlation_id (e.g., `{sheet_id}-{tab}-{row_index}-{timestamp}`)
- channel (`telegram` / `whatsapp`)
- status (`success` / `failed`)
- error summary (never include tokens)

### 8.3 Fail-Safe
If state file is missing:
- Initialize `last_processed_row_index = 1` (or the header row index).  
**Default assumption:** Row 1 is header, start at row 2.

If sheet is empty:
- Do nothing.

---

## 9) Development Workflow (Agentic, Strict Roles)
The agentic workflow in Antigravity MUST run these roles in order and must not skip steps.

### Role A — Planner Agent
Deliverables:
- Confirm which WhatsApp provider path is used (Twilio default).
- Confirm the expected sheet structure: header row on row 1.
- Produce a minimal module breakdown (see Section 10).
Rules:
- No implementation yet.

### Role B — Implementer Agent
Deliverables:
- Create modules exactly as specified.
- Wire environment variables.
- Implement polling loop + state store + two notifiers.
Rules:
- No extra features (no UI, no database, no caching).

### Role C — Reviewer Agent
Deliverables:
- Validate idempotency logic and state updates.
- Validate secrets handling (no secrets in code).
- Validate message formatting is deterministic.
Rules:
- Must propose concrete fixes, not vague advice.

### Role D — Tester Agent
Deliverables:
- Unit tests for:
  - state load/save
  - new-row detection logic
  - message formatting
- “Integration test checklist” (manual):
  - Add one row → receive both messages
  - Add 3 rows quickly → receive 3 pairs in order
  - Force WhatsApp failure → no state advance
Rules:
- If tests fail, loop back to Implementer.

### Role E — Release Agent
Deliverables:
- Runbook for local execution
- Minimal deployment guidance (if needed)
Rules:
- Keep it minimal and reproducible.

---

## 10) Module Breakdown (Implement Exactly This)
1. `config`
   - Loads env vars, validates required fields.
2. `state_store`
   - Reads/writes `state.json`.
3. `sheets_client`
   - Auth + read range + parse rows.
4. `row_detector`
   - Computes new rows > last_processed_row_index.
5. `telegram_notifier`
   - Sends text message.
6. `whatsapp_notifier`
   - Sends text message using chosen provider.
7. `app`
   - Main loop, orchestrates everything.

---

## 11) Acceptance Criteria (Binary Pass/Fail)
Pass only if ALL are true:
1. New row triggers BOTH Telegram + WhatsApp notifications.
2. Same row is not reprocessed after successful dual-send.
3. If either channel fails, the row is retried on the next cycle.
4. Secrets are only in environment variables.
5. Logs show per-row status with correlation IDs.
6. App survives restarts without losing progress (state persists).

---

## 12) Implementation Notes (Practical Defaults)
- Google Sheet access:
  - Share the sheet with the service account email.
- Telegram:
  - Bot created via BotFather; chat id known.
- WhatsApp:
  - Twilio sandbox is acceptable for dev; production requires approved sender.
- Keep polling interval >= 15 seconds to reduce API rate risk.

---

## 13) What to Do First (Execution Order)
1. Create Telegram bot + capture `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.
2. Choose WhatsApp provider:
   - Twilio (default) and collect credentials.
3. Create Google service account:
   - Share sheet with service account email.
   - Base64-encode JSON into `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64`.
4. In Antigravity IDE:
   - Initialize project
   - Implement modules Section 10
   - Run locally with a `.env` file (never commit it)
5. Verify via acceptance criteria.

---

## 14) Strict Change Control
If any new requirement appears (filters, multiple sheets, formatting rules, routing, attachments):
- Do NOT implement it.
- Add it as a “Future Enhancements” bullet in a separate file, not in this build.