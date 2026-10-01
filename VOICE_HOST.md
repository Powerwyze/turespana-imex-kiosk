# Turespaña voice photo host

Adapted from Powerwyze/flow-fort-lauderdale-kiosk branch codex/flow-sunny-host using the powerwyze-voice-photo-kiosk skill on 2026-09-18.

Main entry and /host: Sol voice host. /classic: original touchscreen photo and newsletter workflow. Voice photo email is transactional and never calls the newsletter endpoint. Existing classic data/provider contracts are retained.

Operator: refresh the browser, enable camera sentry once and allow camera/microphone. Presence is detected locally; one recent frame supplies the greeting. Sol asks for a destination, 1–3 guests and explicit readiness, then runs a local five-second countdown. Independent image checking gates display. Visitors spell email and must tap confirmation; voice alone never sends. After 30 seconds without guest activity the host returns to watching. Manual Stop stays off.

Assets: original geometric Sol sun built with Blender in GitHub Actions, design/sol.blend and public/assets/host-avatar.glb. This is not the licensed Turespaña logo.

Required existing OpenAI variable: OPENAI_API_KEY. Existing image model/size/quality settings are respected. Voice: gpt-live-1 / marin, delegation OPENAI_HOST_BACKEND_MODEL or gpt-5.6-luna. ENABLE_FACE_HOST=false is an operator kill switch.

Email: existing WYZER_GMAIL_USER and WYZER_APP_PASSWORD (or GMAIL_USER / GOOGLE_APP_PASSWORD), optionally RESEND_API_KEY and RESEND_FROM_EMAIL. Resend provides provider idempotency; Gmail uses a stable Message-ID and the client pending-send lock, but cannot guarantee cross-instance exactly-once delivery after an ambiguous network failure.

Remote checks: npm test, tests/host.e2e.mjs; workflow_dispatch optional voice, sentry, image checks use repository variable TURESPANA_HOST_PREVIEW_URL. Voice transport smoke mocks email to avoid emailing real people. Real mailbox delivery remains an operator acceptance check.

Rollback deployment before this rebuild: dpl_FCs3FpTtMZTZ1bA6nn5ZHjVM2UQ9.
