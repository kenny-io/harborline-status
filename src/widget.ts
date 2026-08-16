/** Embeddable Harborline beacon widget implemented as an isolated Web Component. */

import type { StatusSummary } from "./types.js";

const TAG_NAME = "harborline-status";

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

const widgetStyles = `<style>
  :host { display: block; color: var(--harborline-ink, #f4f0e6); font: 500 14px/1.4 Georgia, serif; }
  .beacon { --signal: #e6ff57; position: relative; display: grid; grid-template-columns: 44px 1fr; gap: 15px; align-items: start; overflow: hidden; padding: 18px; border: 1px solid #37413d; border-radius: 4px; background: var(--harborline-surface, #101815); box-shadow: 0 16px 42px rgb(1 12 8 / 28%); }
  .beacon::after { content: ""; position: absolute; inset: 0; opacity: .12; pointer-events: none; background: repeating-linear-gradient(90deg, transparent 0 23px, #a7b2ab 24px); }
  .beacon--outage { --signal: #ff6b35; }
  .beacon--degraded { --signal: #ffc857; }
  .beacon__signal { position: relative; z-index: 1; display: grid; width: 38px; height: 38px; place-items: center; border: 1px solid color-mix(in srgb, var(--signal) 55%, #37413d); border-radius: 50%; }
  .beacon__signal::before { content: ""; position: absolute; inset: 7px; border-radius: inherit; background: var(--signal); opacity: .2; animation: harborline-pulse 2.4s ease-out infinite; }
  .beacon__signal span { width: 8px; height: 8px; border-radius: 50%; background: var(--signal); box-shadow: 0 0 18px var(--signal); }
  .beacon__content { position: relative; z-index: 1; min-width: 0; }
  .beacon__eyebrow { margin: 0 0 3px; color: #91a098; font: 700 9px/1.1 ui-monospace, monospace; letter-spacing: .18em; }
  strong { display: block; font-size: 17px; letter-spacing: -.01em; }
  .beacon__detail { margin: 2px 0 0; color: #aeb9b2; font-family: ui-monospace, monospace; font-size: 11px; }
  .beacon__subscribe { display: flex; gap: 6px; margin-top: 13px; }
  .beacon__subscribe input { min-width: 0; flex: 1; border: 1px solid #46534d; border-radius: 2px; padding: 8px 9px; color: inherit; background: #19231f; font: 500 11px/1.2 ui-monospace, monospace; outline: none; }
  .beacon__subscribe input:focus { border-color: var(--signal); box-shadow: 0 0 0 2px color-mix(in srgb, var(--signal) 20%, transparent); }
  .beacon__subscribe button { border: 0; border-radius: 2px; padding: 8px 11px; color: #0f1714; background: var(--signal); font: 800 10px/1 ui-monospace, monospace; letter-spacing: .04em; cursor: pointer; }
  .beacon__subscribe button:disabled { opacity: .55; cursor: wait; }
  .beacon__notice { margin: 9px 0 0; color: var(--signal); font: 600 10px/1.3 ui-monospace, monospace; }
  @keyframes harborline-pulse { 0% { transform: scale(.6); opacity: .5; } 80%, 100% { transform: scale(2.2); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .beacon__signal::before { animation: none; } }
</style>`;

/** Render the widget's complete, safely escaped status card. */
export function renderHarborlineStatus(
  payload: StatusSummary,
  options: { showSubscribe?: boolean } = {},
): string {
  const active = payload.activeIncidents;
  // Runtime payloads are untrusted even though TypeScript narrows the compile-
  // time contract. Normalizing before the value reaches innerHTML prevents a
  // compromised status origin from escaping the class attribute.
  const normalizedStatus = payload.status === "operational" || payload.status === "degraded"
    ? payload.status
    : "outage";
  const state = normalizedStatus === "operational"
    ? "All systems steady"
    : normalizedStatus === "degraded"
      ? "Service degraded"
      : "Incident active";
  const detail = active[0]?.title ?? `${payload.components.length} components reporting normally`;
  const form = options.showSubscribe
    ? `<form class="beacon__subscribe" aria-label="Subscribe to status alerts">
        <input name="email" type="email" autocomplete="email" required maxlength="320" placeholder="ops@example.com" aria-label="Email address">
        <button type="submit">WATCH</button>
      </form><p class="beacon__notice" role="status" aria-live="polite"></p>`
    : "";
  return `<div class="beacon beacon--${normalizedStatus}">
    <div class="beacon__signal" aria-hidden="true"><span></span></div>
    <div class="beacon__content"><p class="beacon__eyebrow">HARBORLINE / LIVE</p><strong>${escapeHtml(state)}</strong><p class="beacon__detail">${escapeHtml(detail)}</p>${form}</div>
  </div>`;
}

const safeEndpoint = (value: string): string | null => {
  try {
    const endpoint = new URL(value);
    return endpoint.protocol === "https:" || endpoint.protocol === "http:"
      ? endpoint.href.replace(/\/$/, "")
      : null;
  } catch {
    return null;
  }
};

class HarborlineStatusElement extends HTMLElement {
  async connectedCallback(): Promise<void> {
    const endpoint = safeEndpoint(this.getAttribute("endpoint") ?? "");
    const showSubscribe = this.hasAttribute("show-subscribe");
    const shadow = this.attachShadow({ mode: "open" });
    shadow.innerHTML = `${widgetStyles}<div class="beacon"><div class="beacon__signal"><span></span></div><div class="beacon__content"><p class="beacon__eyebrow">HARBORLINE / CONNECTING</p><strong>Checking systems</strong><p class="beacon__detail">Waiting for status data</p></div></div>`;

    if (!endpoint) return;
    try {
      const response = await fetch(`${endpoint}/v1/status`);
      if (!response.ok) throw new Error("status unavailable");
      const status = (await response.json()) as StatusSummary;
      shadow.innerHTML = `${widgetStyles}${renderHarborlineStatus(status, { showSubscribe })}`;

      const form = shadow.querySelector<HTMLFormElement>("form");
      const notice = shadow.querySelector<HTMLElement>(".beacon__notice");
      form?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const input = form.elements.namedItem("email") as HTMLInputElement;
        const button = form.querySelector<HTMLButtonElement>("button");
        if (!input.reportValidity() || !button || !notice) return;
        button.disabled = true;
        notice.textContent = "Registering alert destination…";
        try {
          const subscribeResponse = await fetch(`${endpoint}/v1/subscribers`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ channel: "email", address: input.value }),
          });
          if (!subscribeResponse.ok) throw new Error("subscription failed");
          form.hidden = true;
          notice.textContent = "Alert request received. Verification is pending.";
        } catch {
          notice.textContent = "Alerts could not be enabled. Try again.";
          button.disabled = false;
        }
      });
    } catch {
      const status = shadow.querySelector("strong");
      const detail = shadow.querySelector(".beacon__detail");
      if (status) status.textContent = "Status unavailable";
      if (detail) detail.textContent = "Try again shortly";
    }
  }
}

/** Register `<harborline-status>` exactly once in the current document. */
export function defineHarborlineStatusWidget(): void {
  if (!customElements.get(TAG_NAME)) customElements.define(TAG_NAME, HarborlineStatusElement);
}
