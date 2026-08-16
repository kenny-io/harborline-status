# Harborline Status

Harborline gives small platform teams one incident API, one typed browser
client, and one embeddable status beacon. Version 1.1, **Harborline Watch**,
adds customer subscriptions and a durable customer-facing incident timeline.

## Run it

Requires Node.js 20 or later.

```bash
npm install
npm run dev
```

The API listens on `http://localhost:3417`. `GET /health`, `GET /version`,
`GET /v1/status`, and `POST /v1/subscribers` are public. Set
`HARBORLINE_API_TOKEN` to require a bearer token on the remaining `/v1/*`
operations.

The reference server accepts at most 120 public signups per minute and keeps a
maximum of 10,000 in memory. Production deployments should enforce their own
edge limits and use a durable subscriber store.

## Harborline Watch

Status readers can opt into all incidents or select up to 20 component ids.
Register an email destination:

```bash
curl -X POST http://localhost:3417/v1/subscribers \
  -H 'content-type: application/json' \
  -d '{"channel":"email","address":"ops@example.com","componentIds":["api"]}'
```

Webhook destinations use the same endpoint with `channel: "webhook"` and an
HTTPS URL. HTTP URLs are rejected. Reads, verification, and deletion require
the operator bearer token:

- `GET /v1/subscribers/:id` reads one destination.
- `POST /v1/subscribers/:id/verify` marks it verified.
- `DELETE /v1/subscribers/:id` removes it.

Incident communication is now a timeline rather than a mutable final message:

```bash
curl -X POST http://localhost:3417/v1/incidents/inc_000001/updates \
  -H 'content-type: application/json' \
  -d '{"status":"monitoring","message":"A fix is deployed; watching recovery."}'
```

`GET /v1/incidents/:id/updates` returns every published update oldest first.
Publishing an update also advances the incident's current message and status.

## API

The complete machine-readable 1.1 contract is in
[`openapi.yaml`](./openapi.yaml). The release adds seven operations:

- `GET /v1/status`
- `GET` and `POST /v1/incidents/:id/updates`
- `POST /v1/subscribers`
- `GET` and `DELETE /v1/subscribers/:id`
- `POST /v1/subscribers/:id/verify`

Every error uses `{ "error": { "code", "message" } }`.

## Browser SDK 1.1

```ts
import { createHarborlineClient } from "@harborline/status/sdk";

const harborline = createHarborlineClient({
  baseUrl: "https://status.example.com",
  apiToken: process.env.HARBORLINE_API_TOKEN,
});

const status = await harborline.getStatus();
const subscriber = await harborline.subscribe({
  channel: "email",
  address: "ops@example.com",
  componentIds: ["api"],
});
```

The 1.1 client adds `getStatus()`, `listIncidentUpdates()`,
`publishIncidentUpdate()`, `subscribe()`, `getSubscriber()`,
`verifySubscriber()`, and `unsubscribe()` while retaining the 1.0 incident and
component methods.

## Beacon widget 1.1

```ts
import { defineHarborlineStatusWidget } from "@harborline/status/widget";

defineHarborlineStatusWidget();
```

```html
<harborline-status
  endpoint="https://status.example.com"
  show-subscribe
></harborline-status>
```

The widget now consumes the one-call public status summary and can present an
accessible email alert opt-in. It remains a dependency-free Web Component with
safe text rendering, reduced-motion support, a shadow root, and CSS variables
for `--harborline-surface` and `--harborline-ink`.

## Development

```bash
npm test
npm run typecheck
npm run build
npm audit
```

## License

MIT © Harborline
