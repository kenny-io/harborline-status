# Changelog

## 1.2.0 — Harborline Watch pause controls

- Added authenticated pause and resume endpoints for subscriber delivery.
- Added `pauseSubscriber()` and `resumeSubscriber()` to the typed browser SDK.
- Preserved verification and component preferences while delivery is paused.

## 1.1.0 — Harborline Watch

Harborline Watch turns a passive status page into an alerting workflow.

### Added

- Public `GET /v1/status` summary for status pages and embeds.
- Incident timelines through `GET` and `POST /v1/incidents/:id/updates`.
- Email and HTTPS webhook subscribers with create, read, verify, and remove endpoints.
- Browser SDK methods for public status, timeline publishing, and the subscriber lifecycle.
- Beacon widget `show-subscribe` mode with an accessible email opt-in flow.

### Security

- Webhook destinations require HTTPS and are capped at 2,048 characters.
- Subscriber reads, verification, and deletion remain bearer-authenticated.
- Public widget payloads are escaped before HTML rendering.
- Request bodies are capped at 16 KiB before JSON parsing.
- Only public status and signup routes opt into cross-origin access.
- Public signups are rate-limited and the in-process registry is memory-bounded.

## 1.0.0

- Incident and component API.
- Typed browser SDK.
- Dependency-free status beacon Web Component.
