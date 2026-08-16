# Harborline Status

Harborline gives small platform teams one incident API, one typed browser
client, and one embeddable status beacon. Release 1.0 covers the core loop:
publish an incident, keep its state current, and show customers whether the
platform is steady.

## Run it

Requires Node.js 20 or later.

```bash
npm install
npm run dev
```

The API listens on `http://localhost:3417`. `GET /health` and `GET /version`
are public. Set `HARBORLINE_API_TOKEN` to require a bearer token on `/v1/*`.

## API

The complete machine-readable contract is in [`openapi.yaml`](./openapi.yaml).
Release 1.0 ships these workflows:

- `GET /v1/components` lists the systems represented on the status page.
- `GET /v1/incidents` and `GET /v1/incidents/:id` read incident state.
- `POST /v1/incidents` opens an incident in `investigating` state.
- `PATCH /v1/incidents/:id` advances its message or lifecycle state.

Every error uses `{ "error": { "code", "message" } }`.

## Browser SDK

```ts
import { createHarborlineClient } from "@harborline/status/sdk";

const harborline = createHarborlineClient({
  baseUrl: "https://status.example.com",
  apiToken: process.env.HARBORLINE_API_TOKEN,
});

const incidents = await harborline.listIncidents();
```

The 1.0 client exposes `listComponents()`, `listIncidents()`, and
`getIncident(id)`.

## Beacon widget

```ts
import { defineHarborlineStatusWidget } from "@harborline/status/widget";

defineHarborlineStatusWidget();
```

```html
<harborline-status endpoint="https://status.example.com"></harborline-status>
```

The 1.0 widget is a dependency-free Web Component with an accessible all-clear
or active-incident state, safe text rendering, reduced-motion support, and an
isolated shadow root.

## Development

```bash
npm test
npm run typecheck
npm run build
```

## License

MIT © Harborline
