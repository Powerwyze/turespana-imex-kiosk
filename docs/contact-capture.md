# Guest contacts and optional marketing consent

The host and classic flows require the guest's name and confirmed email. The marketing checkbox is unchecked and optional. Changing recipient or starting a new visit clears consent; a failed-send retry preserves the draft and choice. Voice cannot grant marketing permission.

Private contact records live in the existing Sites D1 DB, table kiosk_contacts. There is no public contact-list or export route. The Sites database tools provide owner access. Photo bytes are not stored; only a SHA-256 photo reference ties a contact to a generation. Stable content-derived IDs deduplicate retries. A failed write prevents photo-email submission and leaves the guest's draft available.

Each record stores name, email, destination, explicit marketing flag, server timestamps, client/event, displayed consent wording/version and policy URLs. A stored opt-in is a consent record, not enrollment in a mailing provider.

The exact shared kiosk consent wording is from the user's PowerWyze skill. HELP/STOP and message-rate wording has been retained as supplied. No SMS program or HELP/STOP handler is configured here, and the guest form explicitly says it collects email only, with no text-message subscription. No marketing campaigns, client CC/BCC or new external recipients are added.

Official policy sources checked 2026-09-30:
- Terms: https://www.spain.info/en/conditions-use-information/
- Turespaña data protection (Spanish): https://www.tourspain.es/es/proteccion-datos/

The homepage uses the existing official España PNG, including its original lettering. The animated sun remains the voice host during the active visit.

Transactional mail uses the authorized shared Resend configuration (Production/Preview), verified sender wyzer@powerwyze.com. Project Reply-To is losangeles@tourspain.es, the official Turespaña office serving Nevada; checked 2026-09-30 at https://www.spain.info/en/outside/spanish-tourist-office-los-angeles-united-states/. Reply-To does not CC that office.
