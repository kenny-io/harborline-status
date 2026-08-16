/** Embeddable Harborline beacon widget implemented as an isolated Web Component. */

import type { Incident, StatusComponent } from "./types.js";

const TAG_NAME = "harborline-status";

interface PublicStatusPayload {
  components: StatusComponent[];
  incidents: Incident[];
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });

/** Render the widget's complete, safely escaped status card. */
export function renderHarborlineStatus(payload: PublicStatusPayload): string {
  const active = payload.incidents.filter((incident) => incident.status !== "resolved");
  const state = active.length > 0 ? "Incident active" : "All systems steady";
  const detail = active[0]?.title ?? `${payload.components.length} components reporting normally`;
  return `<div class="beacon ${active.length > 0 ? "beacon--incident" : ""}">
    <div class="beacon__signal" aria-hidden="true"><span></span></div>
    <div><p class="beacon__eyebrow">HARBORLINE / LIVE</p><strong>${escapeHtml(state)}</strong><p>${escapeHtml(detail)}</p></div>
  </div>`;
}

class HarborlineStatusElement extends HTMLElement {
  async connectedCallback(): Promise<void> {
    const endpoint = (this.getAttribute("endpoint") ?? "").replace(/\/$/, "");
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>
      :host { display: block; color: #f4f0e6; font: 500 14px/1.4 Georgia, serif; }
      .beacon { --signal: #e6ff57; position: relative; display: grid; grid-template-columns: 44px 1fr; gap: 15px; align-items: center; overflow: hidden; padding: 18px; border: 1px solid #37413d; border-radius: 4px; background: #101815; box-shadow: 0 16px 42px rgb(1 12 8 / 28%); }
      .beacon::after { content: ""; position: absolute; inset: 0; opacity: .12; pointer-events: none; background: repeating-linear-gradient(90deg, transparent 0 23px, #a7b2ab 24px); }
      .beacon--incident { --signal: #ff6b35; }
      .beacon__signal { position: relative; z-index: 1; display: grid; width: 38px; height: 38px; place-items: center; border: 1px solid color-mix(in srgb, var(--signal) 55%, #37413d); border-radius: 50%; }
      .beacon__signal::before { content: ""; position: absolute; inset: 7px; border-radius: inherit; background: var(--signal); opacity: .2; animation: harborline-pulse 2.4s ease-out infinite; }
      .beacon__signal span { width: 8px; height: 8px; border-radius: 50%; background: var(--signal); box-shadow: 0 0 18px var(--signal); }
      .beacon > div:last-child { position: relative; z-index: 1; }
      .beacon__eyebrow { margin: 0 0 3px; color: #91a098; font: 700 9px/1.1 ui-monospace, monospace; letter-spacing: .18em; }
      strong { display: block; font-size: 17px; letter-spacing: -.01em; }
      p:last-child { margin: 2px 0 0; color: #aeb9b2; font-family: ui-monospace, monospace; font-size: 11px; }
      @keyframes harborline-pulse { 0% { transform: scale(.6); opacity: .5; } 80%, 100% { transform: scale(2.2); opacity: 0; } }
      @media (prefers-reduced-motion: reduce) { .beacon__signal::before { animation: none; } }
    </style><div class="beacon"><div class="beacon__signal"><span></span></div><div><p class="beacon__eyebrow">HARBORLINE / CONNECTING</p><strong>Checking systems</strong><p>Waiting for status data</p></div></div>`;

    if (!endpoint) return;
    try {
      const [componentsResponse, incidentsResponse] = await Promise.all([
        fetch(`${endpoint}/v1/components`),
        fetch(`${endpoint}/v1/incidents`),
      ]);
      if (!componentsResponse.ok || !incidentsResponse.ok) throw new Error("status unavailable");
      const components = (await componentsResponse.json()) as { components: StatusComponent[] };
      const incidents = (await incidentsResponse.json()) as { incidents: Incident[] };
      const style = shadow.querySelector("style")?.outerHTML ?? "";
      shadow.innerHTML = `${style}${renderHarborlineStatus({ ...components, ...incidents })}`;
    } catch {
      const status = shadow.querySelector("strong");
      const detail = shadow.querySelector("p:last-child");
      if (status) status.textContent = "Status unavailable";
      if (detail) detail.textContent = "Try again shortly";
    }
  }
}

/** Register `<harborline-status>` exactly once in the current document. */
export function defineHarborlineStatusWidget(): void {
  if (!customElements.get(TAG_NAME)) customElements.define(TAG_NAME, HarborlineStatusElement);
}
