/* RescueRelief AI — demo dashboard (no backend)
   - Single page navigation (hash routing)
   - LocalStorage persistence
   - CRUD-ish: disasters, alerts, resources, allocations, messages
*/

const STORAGE_KEY = "rr_demo_state_v1";

const fmt = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? Math.trunc(n) : parseInt(String(n), 10);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function levelFromStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("red")) return "red";
  if (s.includes("orange")) return "orange";
  if (s.includes("advis")) return "advisory";
  if (s.includes("resolv")) return "resolved";
  return "advisory";
}

function chipForStatus(status) {
  const lvl = levelFromStatus(status);
  const label = status || "—";
  const klass =
    lvl === "red"
      ? "chip chip--red"
      : lvl === "orange"
        ? "chip chip--orange"
        : lvl === "resolved"
          ? "chip chip--resolved"
          : "chip chip--advisory";
  return `<span class="${klass}"><span class="chip__dot" aria-hidden="true"></span>${escapeHtml(label)}</span>`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeDefaultState();
    const parsed = JSON.parse(raw);
    return validateState(parsed) ? parsed : makeDefaultState();
  } catch {
    return makeDefaultState();
  }
}

function saveState() {
  state.lastUpdateIso = nowIso();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  renderAll();
}

function validateState(s) {
  if (!s || typeof s !== "object") return false;
  if (!Array.isArray(s.disasters)) return false;
  if (!Array.isArray(s.alerts)) return false;
  if (!Array.isArray(s.allocations)) return false;
  if (!Array.isArray(s.messages)) return false;
  if (!s.resources || typeof s.resources !== "object") return false;
  return true;
}

function makeDefaultState() {
  const t = nowIso();
  return {
    lastUpdateIso: t,
    disasters: [
      {
        id: uid("dis"),
        type: "Flood",
        location: "Chennai",
        status: "Red Alert",
        notes: "Evacuation teams are active. Emergency services on standby.",
        createdAtIso: t,
        updatedAtIso: t,
      },
      {
        id: uid("dis"),
        type: "Cyclone",
        location: "Odisha Coast",
        status: "Orange Alert",
        notes: "Coastal shelters prepared. Fishermen warned.",
        createdAtIso: t,
        updatedAtIso: t,
      },
      {
        id: uid("dis"),
        type: "Heatwave",
        location: "Rajasthan",
        status: "Advisory",
        notes: "Hydration points increased; avoid peak hours.",
        createdAtIso: t,
        updatedAtIso: t,
      },
    ],
    resources: {
      medicalKits: { key: "medicalKits", label: "Medical Kits", emoji: "🚑", qty: 450, unit: "kits" },
      foodPackets: { key: "foodPackets", label: "Food Packets", emoji: "🍱", qty: 1200, unit: "packets" },
      rescueBoats: { key: "rescueBoats", label: "Rescue Boats", emoji: "🚤", qty: 75, unit: "boats" },
      reliefWorkers: { key: "reliefWorkers", label: "Relief Workers", emoji: "👷", qty: 980, unit: "workers" },
    },
    allocations: [
      {
        id: uid("al"),
        disasterId: null,
        resourceKey: "reliefWorkers",
        qty: 60,
        priority: "High",
        note: "Pre-positioned rapid response teams",
        createdAtIso: t,
      },
    ],
    alerts: [
      {
        id: uid("alrt"),
        level: "red",
        type: "Flood Warning",
        location: "Chennai",
        message: "Red alert issued. Move to higher ground. Follow evacuation instructions.",
        acknowledged: false,
        createdAtIso: t,
      },
      {
        id: uid("alrt"),
        level: "orange",
        type: "Cyclone Alert",
        location: "Odisha Coast",
        message: "Orange alert. Secure boats and avoid coastal travel.",
        acknowledged: false,
        createdAtIso: t,
      },
      {
        id: uid("alrt"),
        level: "advisory",
        type: "Heatwave Advisory",
        location: "Rajasthan",
        message: "Stay hydrated and avoid outdoor work during noon hours.",
        acknowledged: false,
        createdAtIso: t,
      },
    ],
    messages: [],
  };
}

let state = loadState();

// ----- DOM helpers -----
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function setText(sel, text) {
  const el = $(sel);
  if (el) el.textContent = text;
}

function openModal(dialogEl) {
  if (!dialogEl) return;
  if (typeof dialogEl.showModal === "function") dialogEl.showModal();
}

function closeModal(dialogEl) {
  if (!dialogEl) return;
  dialogEl.close();
}

// ----- Routing -----
function currentRoute() {
  const h = location.hash || "#/home";
  const m = h.match(/^#\/([a-z-]+)/i);
  return (m?.[1] || "home").toLowerCase();
}

function setActiveRoute(route) {
  const viewEls = $$("[data-view]");
  for (const v of viewEls) v.classList.toggle("is-active", v.dataset.view === route);
  const navLinks = $$(".nav__link");
  for (const a of navLinks) a.classList.toggle("is-active", a.dataset.route === route);
}

function go(route) {
  location.hash = `#/${route}`;
}

window.addEventListener("hashchange", () => {
  setActiveRoute(currentRoute());
});

// ----- Renderers -----
function getActiveDisasters() {
  return state.disasters.filter((d) => levelFromStatus(d.status) !== "resolved");
}

function getHighAlerts() {
  return state.alerts.filter((a) => !a.acknowledged && a.level === "red");
}

function computeReadiness() {
  const entries = Object.values(state.resources);
  const total = entries.reduce((acc, r) => acc + (r.qty || 0), 0);
  const per = entries.length ? Math.round(total / entries.length) : 0;
  return { total, per };
}

function renderStats() {
  setText("#stat-active-disasters", String(getActiveDisasters().length));
  setText("#stat-high-alerts", String(getHighAlerts().length));
  const r = computeReadiness();
  setText("#stat-readiness", `${r.per}`);
  setText("#stat-last-update", state.lastUpdateIso ? fmt.format(new Date(state.lastUpdateIso)) : "—");
}

function renderHomeHighAlert() {
  const top = state.alerts
    .filter((a) => !a.acknowledged)
    .sort((a, b) => new Date(b.createdAtIso) - new Date(a.createdAtIso))
    .find((a) => a.level === "red") || state.alerts[0];

  if (!top) return;
  const headline = `${top.type}: ${top.location} – ${top.level.toUpperCase()} alert issued`;
  setText("#home-high-alert-headline", headline);
  setText("#home-high-alert-detail", top.message);
  $("#btn-ack-home-alert")?.setAttribute("data-alert-id", top.id);
}

function renderHomeFeed() {
  const wrap = $("#home-feed");
  if (!wrap) return;

  const items = [];
  const newestDisasters = state.disasters
    .slice()
    .sort((a, b) => new Date(b.updatedAtIso) - new Date(a.updatedAtIso))
    .slice(0, 3)
    .map((d) => ({
      kind: "disaster",
      when: d.updatedAtIso,
      title: `${d.type} — ${d.location}`,
      meta: d.status,
      route: "#/disasters",
      icon: "🛰️",
    }));

  const newestAlerts = state.alerts
    .slice()
    .sort((a, b) => new Date(b.createdAtIso) - new Date(a.createdAtIso))
    .slice(0, 3)
    .map((a) => ({
      kind: "alert",
      when: a.createdAtIso,
      title: `${a.type} — ${a.location}`,
      meta: `${a.level.toUpperCase()}${a.acknowledged ? " · Ack" : ""}`,
      route: "#/alerts",
      icon: "📣",
    }));

  items.push(...newestAlerts, ...newestDisasters);
  items.sort((a, b) => new Date(b.when) - new Date(a.when));

  if (items.length === 0) {
    wrap.innerHTML = `<div class="item"><div class="muted">No activity yet.</div></div>`;
    return;
  }

  wrap.innerHTML = items
    .slice(0, 5)
    .map((x) => {
      const when = x.when ? fmt.format(new Date(x.when)) : "—";
      return `
        <div class="item">
          <div class="item__top">
            <div>
              <div class="item__title">${x.icon} ${escapeHtml(x.title)}</div>
              <div class="item__meta">${escapeHtml(x.meta)} · <span class="muted">${escapeHtml(when)}</span></div>
            </div>
            <div class="item__actions">
              <a class="btn btn--sm btn--ghost" href="${x.route}">Open</a>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderDisasters() {
  const tbody = $("#disasters-tbody");
  if (!tbody) return;

  const q = ($("#disaster-search")?.value || "").trim().toLowerCase();
  const rows = state.disasters
    .slice()
    .sort((a, b) => new Date(b.updatedAtIso) - new Date(a.updatedAtIso))
    .filter((d) => {
      if (!q) return true;
      return (
        d.type.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q) ||
        d.status.toLowerCase().includes(q)
      );
    });

  tbody.innerHTML = rows
    .map((d) => {
      const updated = d.updatedAtIso ? fmt.format(new Date(d.updatedAtIso)) : "—";
      const canResolve = levelFromStatus(d.status) !== "resolved";
      return `
        <tr data-id="${d.id}" class="row-click">
          <td><strong>${escapeHtml(d.type)}</strong></td>
          <td>${escapeHtml(d.location)}</td>
          <td>${chipForStatus(d.status)}</td>
          <td class="muted">${escapeHtml(updated)}</td>
          <td class="right">
            <button class="btn btn--sm" data-action="edit" data-id="${d.id}">Edit</button>
            <button class="btn btn--sm ${canResolve ? "" : "btn--ghost"}" data-action="toggle" data-id="${d.id}">
              ${canResolve ? "Resolve" : "Reopen"}
            </button>
          </td>
        </tr>
      `;
    })
    .join("");

  setText("#disasters-count", `${rows.length} disaster(s)`);
}

function renderResources() {
  const grid = $("#resources-grid");
  if (!grid) return;

  const items = Object.values(state.resources);
  grid.innerHTML = items
    .map((r) => {
      return `
        <article class="kpi">
          <div class="kpi__left">
            <div class="kpi__emoji" aria-hidden="true">${r.emoji}</div>
            <div>
              <div class="kpi__title">${escapeHtml(r.label)}</div>
              <div class="kpi__sub">Available inventory</div>
              <div class="kpi__controls">
                <button class="icon-btn" data-action="dec-resource" data-key="${r.key}" aria-label="Decrease">−</button>
                <button class="icon-btn" data-action="inc-resource" data-key="${r.key}" aria-label="Increase">＋</button>
              </div>
            </div>
          </div>
          <div>
            <div class="kpi__qty">${escapeHtml(String(r.qty ?? 0))}</div>
            <div class="kpi__sub" style="text-align:right">${escapeHtml(r.unit || "")}</div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderAllocations() {
  const wrap = $("#allocations-list");
  if (!wrap) return;

  const disById = new Map(state.disasters.map((d) => [d.id, d]));
  const items = state.allocations
    .slice()
    .sort((a, b) => new Date(b.createdAtIso) - new Date(a.createdAtIso))
    .slice(0, 14);

  if (items.length === 0) {
    wrap.innerHTML = `<div class="item"><div class="muted">No allocations yet. Allocate resources to see logs.</div></div>`;
    return;
  }

  wrap.innerHTML = items
    .map((a) => {
      const res = state.resources[a.resourceKey];
      const dis = a.disasterId ? disById.get(a.disasterId) : null;
      const when = a.createdAtIso ? fmt.format(new Date(a.createdAtIso)) : "—";
      const title = `${res?.emoji ?? "📦"} ${a.qty} ${res?.label ?? a.resourceKey}`;
      const meta = dis
        ? `Assigned to <strong>${escapeHtml(dis.type)}</strong> — ${escapeHtml(dis.location)} · Priority: ${escapeHtml(a.priority)}`
        : `Assigned (general) · Priority: ${escapeHtml(a.priority)}`;
      return `
        <div class="item">
          <div class="item__top">
            <div>
              <div class="item__title">${title}</div>
              <div class="item__meta">${meta}<br/><span class="muted">${escapeHtml(when)}</span></div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderAlerts() {
  const list = $("#alerts-list");
  if (!list) return;

  const filter = $("#alerts-filter")?.value || "all";
  const items = state.alerts
    .slice()
    .sort((a, b) => new Date(b.createdAtIso) - new Date(a.createdAtIso))
    .filter((a) => {
      if (filter === "all") return true;
      if (filter === "acknowledged") return a.acknowledged;
      return a.level === filter;
    });

  if (items.length === 0) {
    list.innerHTML = `<div class="item"><div class="muted">No alerts match this filter.</div></div>`;
    return;
  }

  list.innerHTML = items
    .map((a) => {
      const when = a.createdAtIso ? fmt.format(new Date(a.createdAtIso)) : "—";
      const chip =
        a.level === "red"
          ? `<span class="chip chip--red"><span class="chip__dot" aria-hidden="true"></span>Red</span>`
          : a.level === "orange"
            ? `<span class="chip chip--orange"><span class="chip__dot" aria-hidden="true"></span>Orange</span>`
            : `<span class="chip chip--advisory"><span class="chip__dot" aria-hidden="true"></span>Advisory</span>`;
      return `
        <div class="item" data-alert-id="${a.id}">
          <div class="item__top">
            <div>
              <div class="item__title">${escapeHtml(a.type)} — ${escapeHtml(a.location)}</div>
              <div class="item__meta">${chip} <span class="muted">· ${escapeHtml(when)}${a.acknowledged ? " · Acknowledged" : ""}</span></div>
              <div class="item__meta" style="margin-top:8px">${escapeHtml(a.message)}</div>
            </div>
            <div class="item__actions">
              <button class="btn btn--sm" data-action="preview-alert" data-id="${a.id}">Preview</button>
              <button class="btn btn--sm ${a.acknowledged ? "btn--ghost" : ""}" data-action="ack-alert" data-id="${a.id}">
                ${a.acknowledged ? "Unack" : "Acknowledge"}
              </button>
              <button class="btn btn--sm btn--ghost" data-action="delete-alert" data-id="${a.id}">Delete</button>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderBroadcastPreview(alertId = null) {
  const wrap = $("#broadcast-preview");
  if (!wrap) return;

  const a = alertId ? state.alerts.find((x) => x.id === alertId) : null;
  wrap.classList.remove("broadcast--red", "broadcast--orange", "broadcast--advisory");

  if (!a) {
    wrap.innerHTML = `
      <div class="broadcast__level">—</div>
      <div class="broadcast__headline">Select an alert</div>
      <div class="broadcast__message muted">Your message preview will appear here.</div>
    `;
    return;
  }

  wrap.classList.add(a.level === "red" ? "broadcast--red" : a.level === "orange" ? "broadcast--orange" : "broadcast--advisory");
  wrap.innerHTML = `
    <div class="broadcast__level">${escapeHtml(a.level.toUpperCase())} ALERT</div>
    <div class="broadcast__headline">${escapeHtml(a.type)} — ${escapeHtml(a.location)}</div>
    <div class="broadcast__message">${escapeHtml(a.message)}</div>
  `;
}

function renderMessages() {
  const list = $("#messages-list");
  if (!list) return;
  const items = state.messages.slice().sort((a, b) => new Date(b.createdAtIso) - new Date(a.createdAtIso)).slice(0, 10);
  if (items.length === 0) {
    list.innerHTML = `<div class="item"><div class="muted">No messages yet.</div></div>`;
    return;
  }
  list.innerHTML = items
    .map((m) => {
      const when = m.createdAtIso ? fmt.format(new Date(m.createdAtIso)) : "—";
      return `
        <div class="item">
          <div class="item__top">
            <div>
              <div class="item__title">${escapeHtml(m.name)} <span class="muted" style="font-weight:600">(${escapeHtml(m.email)})</span></div>
              <div class="item__meta">${escapeHtml(when)}</div>
              <div class="item__meta" style="margin-top:8px">${escapeHtml(m.message)}</div>
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderAnalytics() {
  const kpiWrap = $("#analytics-kpis");
  const hotspots = $("#analytics-hotspots");
  const pressure = $("#analytics-pressure");
  if (!kpiWrap || !hotspots || !pressure) return;

  const disasters = state.disasters;
  const active = getActiveDisasters();
  const byLevel = { red: 0, orange: 0, advisory: 0, resolved: 0 };
  const byType = new Map();
  const byLocation = new Map();

  for (const d of disasters) {
    const lvl = levelFromStatus(d.status);
    byLevel[lvl] = (byLevel[lvl] || 0) + 1;
    byType.set(d.type, (byType.get(d.type) || 0) + 1);
    byLocation.set(d.location, (byLocation.get(d.location) || 0) + 1);
  }

  const topType = Array.from(byType.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  const openAlerts = state.alerts.filter((a) => !a.acknowledged).length;
  const readiness = computeReadiness();

  kpiWrap.innerHTML = `
    <div class="kpi">
      <div class="kpi__left">
        <div class="kpi__emoji" aria-hidden="true">🧭</div>
        <div><div class="kpi__title">Active</div><div class="kpi__sub">Disasters ongoing</div></div>
      </div>
      <div><div class="kpi__qty">${active.length}</div><div class="kpi__sub" style="text-align:right">events</div></div>
    </div>
    <div class="kpi">
      <div class="kpi__left">
        <div class="kpi__emoji" aria-hidden="true">📣</div>
        <div><div class="kpi__title">Open alerts</div><div class="kpi__sub">Not acknowledged</div></div>
      </div>
      <div><div class="kpi__qty">${openAlerts}</div><div class="kpi__sub" style="text-align:right">alerts</div></div>
    </div>
    <div class="kpi">
      <div class="kpi__left">
        <div class="kpi__emoji" aria-hidden="true">📊</div>
        <div><div class="kpi__title">Top type</div><div class="kpi__sub">Most frequent</div></div>
      </div>
      <div><div class="kpi__qty" style="font-size:18px">${escapeHtml(topType)}</div><div class="kpi__sub" style="text-align:right">${byType.get(topType) || 0} events</div></div>
    </div>
  `;

  const topHotspots = Array.from(byLocation.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  hotspots.innerHTML =
    topHotspots.length === 0
      ? `<div class="item"><div class="muted">No locations yet.</div></div>`
      : topHotspots
          .map(
            ([loc, count]) => `
              <div class="item">
                <div class="item__top">
                  <div>
                    <div class="item__title">${escapeHtml(loc)}</div>
                    <div class="item__meta">${count} incident(s)</div>
                  </div>
                  <div class="item__actions"><a class="btn btn--sm btn--ghost" href="#/disasters" data-jump-search="${escapeHtml(loc)}">View</a></div>
                </div>
              </div>
            `,
          )
          .join("");

  const lowest = Object.values(state.resources)
    .slice()
    .sort((a, b) => (a.qty || 0) - (b.qty || 0))
    .slice(0, 4);
  pressure.innerHTML =
    lowest.length === 0
      ? `<div class="item"><div class="muted">No resources configured.</div></div>`
      : lowest
          .map(
            (r) => `
              <div class="item">
                <div class="item__top">
                  <div>
                    <div class="item__title">${r.emoji} ${escapeHtml(r.label)}</div>
                    <div class="item__meta">${escapeHtml(String(r.qty))} available</div>
                  </div>
                  <div class="item__actions">
                    <a class="btn btn--sm" href="#/resources">Replenish</a>
                  </div>
                </div>
              </div>
            `,
          )
          .join("");

  // Recommendations (simple heuristics)
  const triage =
    byLevel.red > 0
      ? `Prioritize ${byLevel.red} red-severity event(s). Confirm evacuation routes and hospital capacity.`
      : `No red-severity events detected. Monitor orange/advisory events and keep rapid response on standby.`;
  const allocation =
    readiness.total < 2000
      ? `Inventory looks tight. Replenish food/medical kits and consider staging teams near hotspots.`
      : `Inventory looks stable. Allocate resources based on hotspot intensity and response time.`;
  const guidance =
    openAlerts > 0
      ? `There are ${openAlerts} active public alerts. Review messages for clarity and include helpline + shelter locations.`
      : `No active public alerts. Prepare templates for flood/cyclone/heatwave to publish quickly.`;

  setText("#rec-triage", triage);
  setText("#rec-allocation", allocation);
  setText("#rec-guidance", guidance);
}

function renderAllocationModalOptions() {
  const disSel = $("#allocate-disaster");
  const resSel = $("#allocate-resource");
  if (!disSel || !resSel) return;

  const active = getActiveDisasters();
  disSel.innerHTML = active.length
    ? active
        .map((d) => `<option value="${d.id}">${escapeHtml(d.type)} — ${escapeHtml(d.location)} (${escapeHtml(d.status)})</option>`)
        .join("")
    : `<option value="" disabled selected>No active disasters (create one)</option>`;

  resSel.innerHTML = Object.values(state.resources)
    .map((r) => `<option value="${r.key}">${r.emoji} ${escapeHtml(r.label)} (Available: ${escapeHtml(String(r.qty))})</option>`)
    .join("");
}

function renderAll() {
  renderStats();
  renderHomeHighAlert();
  renderHomeFeed();
  renderDisasters();
  renderResources();
  renderAllocations();
  renderAlerts();
  renderMessages();
  renderAnalytics();
  renderAllocationModalOptions();
}

// ----- Actions -----
function upsertDisaster(payload) {
  const id = payload.id || uid("dis");
  const existing = state.disasters.find((d) => d.id === id);
  const t = nowIso();

  const data = {
    id,
    type: String(payload.type || "").trim(),
    location: String(payload.location || "").trim(),
    status: String(payload.status || "Advisory").trim(),
    notes: String(payload.notes || "").trim(),
    createdAtIso: existing?.createdAtIso ?? t,
    updatedAtIso: t,
  };

  if (!data.type || !data.location) return { ok: false, error: "Type and location are required." };

  if (existing) Object.assign(existing, data);
  else state.disasters.push(data);
  return { ok: true, id };
}

function toggleResolveDisaster(disasterId) {
  const d = state.disasters.find((x) => x.id === disasterId);
  if (!d) return;
  const isResolved = levelFromStatus(d.status) === "resolved";
  d.status = isResolved ? "Advisory" : "Resolved";
  d.updatedAtIso = nowIso();
}

function allocateResource({ disasterId, resourceKey, qty, priority }) {
  const dis = state.disasters.find((d) => d.id === disasterId);
  const res = state.resources[resourceKey];
  if (!dis) return { ok: false, error: "Pick a valid disaster." };
  if (!res) return { ok: false, error: "Pick a valid resource." };

  const q = clampInt(qty, 1, 1_000_000);
  if (res.qty < q) return { ok: false, error: `Not enough ${res.label}. Available: ${res.qty}` };

  res.qty -= q;
  state.allocations.push({
    id: uid("al"),
    disasterId,
    resourceKey,
    qty: q,
    priority: String(priority || "Medium"),
    note: "",
    createdAtIso: nowIso(),
  });

  // Nudge disaster status if it was only advisory
  if (levelFromStatus(dis.status) === "advisory") {
    dis.status = "Orange Alert";
    dis.updatedAtIso = nowIso();
  }

  return { ok: true };
}

function adjustResource(key, delta) {
  const res = state.resources[key];
  if (!res) return;
  const next = clampInt((res.qty || 0) + delta, 0, 9_999_999);
  res.qty = next;
}

function replenish() {
  adjustResource("medicalKits", 50);
  adjustResource("foodPackets", 200);
  adjustResource("rescueBoats", 5);
  adjustResource("reliefWorkers", 40);
}

function createAlert({ level, type, location, message }) {
  const a = {
    id: uid("alrt"),
    level: String(level || "orange").toLowerCase(),
    type: String(type || "").trim(),
    location: String(location || "").trim(),
    message: String(message || "").trim(),
    acknowledged: false,
    createdAtIso: nowIso(),
  };
  if (!a.type || !a.location || !a.message) return { ok: false, error: "All fields are required." };
  if (!["red", "orange", "advisory"].includes(a.level)) a.level = "advisory";
  state.alerts.push(a);
  return { ok: true, id: a.id };
}

function toggleAckAlert(alertId) {
  const a = state.alerts.find((x) => x.id === alertId);
  if (!a) return;
  a.acknowledged = !a.acknowledged;
}

function deleteAlert(alertId) {
  state.alerts = state.alerts.filter((x) => x.id !== alertId);
}

function addMessage({ name, email, message }) {
  const m = {
    id: uid("msg"),
    name: String(name || "").trim(),
    email: String(email || "").trim(),
    message: String(message || "").trim(),
    createdAtIso: nowIso(),
  };
  if (!m.name || !m.email || !m.message) return { ok: false, error: "All fields are required." };
  state.messages.push(m);
  return { ok: true };
}

function resetDemo() {
  localStorage.removeItem(STORAGE_KEY);
  state = makeDefaultState();
  renderAll();
  go("home");
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rescue-relief-demo-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importStateFromObject(obj) {
  if (!validateState(obj)) return { ok: false, error: "Invalid file: JSON is missing required fields." };
  state = obj;
  saveState();
  return { ok: true };
}

// ----- Event wiring -----
function wire() {
  // default route
  if (!location.hash) location.hash = "#/home";
  setActiveRoute(currentRoute());

  // Home quick actions
  $("#qa-create-disaster")?.addEventListener("click", () => {
    go("disasters");
    openAddDisaster();
  });
  $("#qa-allocate-resources")?.addEventListener("click", () => {
    go("resources");
    openAllocate();
  });
  $("#qa-issue-alert")?.addEventListener("click", () => {
    go("alerts");
    openAlertModal();
  });

  $("#btn-reset-demo")?.addEventListener("click", () => {
    const ok = confirm("Reset demo data? This will remove your saved changes.");
    if (ok) resetDemo();
  });

  // Export / Import
  $("#btn-export")?.addEventListener("click", () => exportState());
  $("#btn-import")?.addEventListener("click", () => $("#import-file")?.click());
  $("#import-file")?.addEventListener("change", async (e) => {
    const file = e.target?.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const obj = JSON.parse(text);
      const res = importStateFromObject(obj);
      if (!res.ok) alert(res.error);
    } catch {
      alert("Could not read that file as JSON.");
    } finally {
      e.target.value = "";
    }
  });

  // Global search: routes to best view
  $("#global-search")?.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = String(e.currentTarget.value || "").trim();
    if (!q) return;
    go("disasters");
    const ds = $("#disaster-search");
    if (ds) {
      ds.value = q;
      renderDisasters();
    }
  });

  // Home: acknowledge current top alert
  $("#btn-ack-home-alert")?.addEventListener("click", (e) => {
    const id = e.currentTarget?.getAttribute("data-alert-id");
    if (!id) return;
    toggleAckAlert(id);
    saveState();
  });

  // Disasters: search
  $("#disaster-search")?.addEventListener("input", () => renderDisasters());

  // Disasters: add
  $("#btn-add-disaster")?.addEventListener("click", openAddDisaster);

  // Disasters: table actions
  $("#disasters-table")?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("button[data-action]");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    const action = btn.getAttribute("data-action");
    if (!id || !action) return;

    if (action === "edit") openEditDisaster(id);
    if (action === "toggle") {
      toggleResolveDisaster(id);
      saveState();
    }
  });

  // Resource grid +/- controls
  $("#resources-grid")?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("button[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const key = btn.getAttribute("data-key");
    if (!action || !key) return;
    if (action === "inc-resource") adjustResource(key, 10);
    if (action === "dec-resource") adjustResource(key, -10);
    saveState();
  });

  $("#btn-replenish")?.addEventListener("click", () => {
    replenish();
    saveState();
  });
  $("#btn-allocate")?.addEventListener("click", openAllocate);

  // Alerts controls
  $("#alerts-filter")?.addEventListener("change", () => renderAlerts());
  $("#btn-create-alert")?.addEventListener("click", openAlertModal);

  $("#alerts-list")?.addEventListener("click", (e) => {
    const btn = e.target?.closest?.("button[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (!action || !id) return;

    if (action === "preview-alert") {
      renderBroadcastPreview(id);
      return;
    }
    if (action === "ack-alert") {
      toggleAckAlert(id);
      saveState();
      return;
    }
    if (action === "delete-alert") {
      const ok = confirm("Delete this alert?");
      if (!ok) return;
      deleteAlert(id);
      renderBroadcastPreview(null);
      saveState();
    }
  });

  // Contact form
  $("#contact-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = addMessage({
      name: fd.get("name"),
      email: fd.get("email"),
      message: fd.get("message"),
    });
    const toast = $("#contact-toast");
    if (toast) {
      toast.hidden = false;
      toast.textContent = res.ok ? "Saved. Thanks — your message was recorded (demo)." : `Error: ${res.error}`;
      setTimeout(() => {
        toast.hidden = true;
      }, 2200);
    }
    if (res.ok) e.currentTarget.reset();
    saveState();
  });

  // Modal close helpers
  $$("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const dlg = e.currentTarget?.closest?.("dialog");
      if (dlg) closeModal(dlg);
    });
  });

  // Disaster modal submit
  $("#disaster-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = upsertDisaster({
      id: fd.get("id"),
      type: fd.get("type"),
      location: fd.get("location"),
      status: fd.get("status"),
      notes: fd.get("notes"),
    });
    if (!res.ok) {
      alert(res.error);
      return;
    }
    closeModal($("#modal-disaster"));
    saveState();
  });

  // Allocate modal submit
  $("#allocate-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = allocateResource({
      disasterId: fd.get("disasterId"),
      resourceKey: fd.get("resourceKey"),
      qty: Number(fd.get("qty")),
      priority: fd.get("priority"),
    });
    if (!res.ok) {
      alert(res.error);
      return;
    }
    closeModal($("#modal-allocate"));
    saveState();
    go("disasters"); // show impact + logs
  });

  // Alert modal submit
  $("#alert-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = createAlert({
      level: fd.get("level"),
      type: fd.get("type"),
      location: fd.get("location"),
      message: fd.get("message"),
    });
    if (!res.ok) {
      alert(res.error);
      return;
    }
    closeModal($("#modal-alert"));
    renderBroadcastPreview(res.id);
    saveState();
    go("alerts");
  });

  // Analytics
  $("#btn-generate-report")?.addEventListener("click", () => {
    const out = $("#report-output");
    if (!out) return;
    const active = getActiveDisasters();
    const high = getHighAlerts();
    const readiness = computeReadiness();
    out.innerHTML = `
      <div><strong>Summary</strong></div>
      <div class="muted">Active disasters: <strong>${active.length}</strong> · Red alerts: <strong>${high.length}</strong> · Avg readiness: <strong>${readiness.per}</strong></div>
      <div class="divider"></div>
      <div><strong>Next actions</strong></div>
      <ul class="muted">
        <li>Validate hotspot locations and update statuses.</li>
        <li>Allocate critical resources to red/orange incidents.</li>
        <li>Ensure alert messages include shelters and emergency contacts.</li>
      </ul>
    `;
  });

  $("#btn-simulate-update")?.addEventListener("click", () => {
    // Quick demo: add a random advisory or escalate an advisory
    const active = getActiveDisasters();
    if (active.length > 0) {
      const pick = active[Math.floor(Math.random() * active.length)];
      if (levelFromStatus(pick.status) === "advisory") pick.status = "Orange Alert";
      else if (levelFromStatus(pick.status) === "orange") pick.status = "Red Alert";
      pick.updatedAtIso = nowIso();
    } else {
      state.disasters.push({
        id: uid("dis"),
        type: "Flood",
        location: "New Area",
        status: "Advisory",
        notes: "Simulated incident update.",
        createdAtIso: nowIso(),
        updatedAtIso: nowIso(),
      });
    }
    saveState();
  });

  // Analytics hotspot "View" buttons
  document.body.addEventListener("click", (e) => {
    const a = e.target?.closest?.("a[data-jump-search]");
    if (!a) return;
    const q = a.getAttribute("data-jump-search");
    if (!q) return;
    go("disasters");
    const ds = $("#disaster-search");
    if (ds) {
      ds.value = q;
      renderDisasters();
    }
  });
}

function openAddDisaster() {
  const dlg = $("#modal-disaster");
  const form = $("#disaster-form");
  if (!dlg || !form) return;
  $("#disaster-modal-title").textContent = "Add disaster";
  form.reset();
  form.querySelector('input[name="id"]').value = "";
  openModal(dlg);
}

function openEditDisaster(id) {
  const d = state.disasters.find((x) => x.id === id);
  const dlg = $("#modal-disaster");
  const form = $("#disaster-form");
  if (!dlg || !form || !d) return;
  $("#disaster-modal-title").textContent = "Edit disaster";
  form.querySelector('input[name="id"]').value = d.id;
  form.querySelector('select[name="type"]').value = d.type;
  form.querySelector('input[name="location"]').value = d.location;
  form.querySelector('select[name="status"]').value = d.status;
  form.querySelector('textarea[name="notes"]').value = d.notes || "";
  openModal(dlg);
}

function openAllocate() {
  const dlg = $("#modal-allocate");
  const form = $("#allocate-form");
  if (!dlg || !form) return;
  renderAllocationModalOptions();
  form.reset();
  openModal(dlg);
}

function openAlertModal() {
  const dlg = $("#modal-alert");
  const form = $("#alert-form");
  if (!dlg || !form) return;
  form.reset();
  openModal(dlg);
}

// AI Chatbot functionality with comprehensive FAQs
const faqDatabase = {
  // General Disaster Management FAQs
  "what is disaster management": "Disaster management involves coordinating resources and responsibilities to address all aspects of emergencies, including preparedness, response, recovery, and mitigation.",
  "how to prepare for disasters": "Prepare by creating an emergency kit, developing a family communication plan, staying informed about local risks, and participating in community drills.",
  "what are the types of disasters": "Common types include natural disasters (floods, earthquakes, hurricanes) and man-made disasters (chemical spills, fires, terrorist attacks).",
  "how to create an emergency kit": "Include water, non-perishable food, medications, first aid supplies, flashlights, batteries, important documents, and cash.",
  "what is evacuation": "Evacuation is the immediate and urgent movement of people away from a threat or actual occurrence of a hazard.",
  "how to stay safe during floods": "Move to higher ground, avoid walking or driving through flood waters, and follow local authorities' instructions.",
  "what to do in an earthquake": "Drop, cover, and hold on. Stay indoors until shaking stops, then evacuate if necessary.",
  "how to respond to wildfires": "Evacuate immediately if ordered, close all windows and doors, and remove flammable materials from around your home.",
  "what is a tsunami warning": "A tsunami warning indicates that a tsunami may occur. Evacuate to higher ground immediately.",
  "how to help after a disaster": "Donate to reputable organizations, volunteer through official channels, and avoid putting yourself in danger.",

  // Resource Management FAQs
  "how to allocate resources": "Resources are allocated based on priority, need, and availability. Use the dashboard to assign supplies to active disasters.",
  "what resources are available": "Available resources include medical kits, food packets, rescue boats, and relief workers.",
  "how to replenish resources": "Use the 'Quick replenish' button or manually adjust quantities in the Resources section.",
  "what is resource readiness": "Resource readiness measures how prepared your supplies are across all categories.",
  "how to track allocations": "View allocation logs in the Disasters section to see what resources have been assigned to which incidents.",

  // Alert System FAQs
  "how to create an alert": "Go to the Alerts section and click 'Create alert'. Fill in the level, type, location, and message.",
  "what are alert levels": "Alert levels are Red (critical), Orange (high), and Advisory (information).",
  "how to acknowledge alerts": "Click the 'Acknowledge' button on active alerts to mark them as handled.",
  "what is broadcast preview": "Broadcast preview shows how alerts will appear to the public before publishing.",
  "how to manage alerts": "Use the Alerts section to create, view, acknowledge, and delete alerts.",

  // Disaster Tracking FAQs
  "how to add a disaster": "Click 'Add disaster' in the Disasters section. Enter type, location, status, and notes.",
  "what disaster statuses": "Statuses include Red Alert, Orange Alert, Advisory, and Resolved.",
  "how to update disaster status": "Edit disasters in the table to change their status or details.",
  "how to resolve disasters": "Change the status to 'Resolved' when the incident is under control.",
  "what is disaster triage": "Triage involves prioritizing disasters based on severity and impact.",

  // Analytics and Reporting FAQs
  "how to generate reports": "Click 'Generate report' in the Analytics section for quick summaries.",
  "what are hotspots": "Hotspots are locations with the highest number of disaster incidents.",
  "how to simulate updates": "Use 'Simulate update' to test the system with new disaster data.",
  "what is resource pressure": "Resource pressure shows which supplies are running low.",
  "how to view operational notes": "Check the Analytics section for AI-generated recommendations.",

  // Contact and Communication FAQs
  "how to send messages": "Use the Contact form to send reports or requests. Messages are stored locally.",
  "what is the contact form for": "The contact form allows authorities to communicate with the disaster management team.",
  "how to export data": "Click the 'Export' button to download demo data as a JSON file.",
  "how to import data": "Click 'Import' and select a previously exported JSON file.",
  "how to reset demo": "Click 'Reset' to clear all demo data and start fresh.",

  // Technical FAQs
  "how does the dashboard work": "The dashboard uses local storage to save data in your browser. No internet connection required.",
  "is data saved": "Yes, all changes are automatically saved to your browser's local storage.",
  "how to search disasters": "Use the search bar to filter by type, location, or status.",
  "what is local demo": "Local demo means data is stored only on your device, not on any server.",
  "how to navigate the app": "Use the top navigation or hash links (#/home, #/disasters, etc.) to switch sections.",

  // Emergency Response FAQs
  "what to do if trapped": "Stay calm, conserve energy, signal for help, and wait for rescue teams.",
  "how to identify safe shelters": "Look for official shelters designated by local authorities.",
  "what is emergency communication": "Use battery-powered radios, text messaging, or official apps for updates.",
  "how to help injured people": "Call emergency services, provide first aid if trained, and avoid moving seriously injured people.",
  "what is chain of command": "Follow instructions from local authorities, emergency services, and designated coordinators.",

  // Recovery and Mitigation FAQs
  "what is disaster recovery": "Recovery involves restoring infrastructure, providing aid, and helping communities rebuild.",
  "how to prevent disasters": "Implement building codes, maintain infrastructure, and educate communities about risks.",
  "what is mitigation": "Mitigation reduces disaster impacts through planning, insurance, and structural improvements.",
  "how to get insurance": "Contact insurance providers for policies covering flood, earthquake, and other disaster damage.",
  "what is community resilience": "Community resilience is the ability to prepare for, respond to, and recover from disasters.",

  // Specific Disaster Types FAQs
  "how to prepare for floods": "Elevate electrical systems, use sandbags, and have an evacuation plan.",
  "what causes earthquakes": "Earthquakes are caused by tectonic plate movements releasing energy.",
  "how to survive hurricanes": "Board up windows, stock supplies, and evacuate if ordered.",
  "what is heatwave danger": "Heatwaves can cause heat exhaustion and stroke. Stay hydrated and avoid peak sun.",
  "how to handle landslides": "Avoid building on slopes, plant vegetation, and evacuate during heavy rain.",

  // More FAQs to reach over 100
  "what is emergency preparedness": "Emergency preparedness is planning and training for potential disasters.",
  "how to make a family plan": "Discuss risks, assign responsibilities, choose meeting points, and practice drills.",
  "what is a go bag": "A go bag contains essentials for 72 hours: water, food, clothes, documents, and medications.",
  "how to stay informed": "Monitor local news, weather alerts, and official emergency broadcasts.",
  "what is situational awareness": "Situational awareness means understanding your environment and potential threats.",
  "how to help neighbors": "Check on elderly or disabled neighbors and share resources if safe.",
  "what is emergency lighting": "Use flashlights, candles, or generators during power outages.",
  "how to purify water": "Boil water, use purification tablets, or filters to make contaminated water safe.",
  "what is carbon monoxide danger": "Carbon monoxide is odorless and deadly. Use generators outdoors only.",
  "how to handle power outages": "Unplug electronics, use flashlights, and keep refrigerator closed.",
  "what is structural damage": "Inspect buildings for cracks, leaning walls, or foundation issues after disasters.",
  "how to document damage": "Take photos and videos for insurance claims and recovery planning.",
  "what is psychological first aid": "Provide emotional support, listen actively, and connect people to resources.",
  "how to deal with trauma": "Seek professional help, talk about experiences, and engage in self-care.",
  "what is community recovery": "Community recovery involves rebuilding infrastructure and supporting affected residents.",
  "how to volunteer safely": "Register with official organizations and follow their guidelines.",
  "what is donation best practices": "Donate to established charities and give cash for flexible use.",
  "how to avoid scams": "Verify organizations and avoid unsolicited requests for personal information.",
  "what is business continuity": "Business continuity plans ensure operations continue during and after disasters.",
  "how to protect pets": "Include pets in evacuation plans and have carriers, food, and identification.",
  "what is school safety": "Schools should have emergency plans, drills, and communication systems.",
  "how to teach children": "Use age-appropriate language, practice drills, and reassure children.",
  "what is elderly vulnerability": "Elderly may need extra help with mobility, medications, and communication.",
  "how to assist disabled": "Understand specific needs and include them in planning and response.",
  "what is cultural sensitivity": "Respect diverse backgrounds and provide multilingual support.",
  "how to coordinate with agencies": "Work with local, state, and federal agencies for comprehensive response.",
  "what is incident command": "Incident command system organizes response efforts with clear leadership.",
  "how to manage volunteers": "Train, assign tasks, and supervise volunteer activities.",
  "what is resource sharing": "Share resources between jurisdictions when local supplies are depleted.",
  "how to handle donations": "Sort, store, and distribute donations efficiently and fairly.",
  "what is debris management": "Remove hazardous debris safely and recycle when possible.",
  "how to assess damage": "Use systematic methods to evaluate infrastructure and property damage.",
  "what is rebuilding standards": "Follow updated building codes for safer reconstruction.",
  "how to fund recovery": "Use government aid, insurance, donations, and loans for rebuilding.",
  "what is long-term recovery": "Long-term recovery can take months or years to fully restore communities.",
  "how to learn from disasters": "Conduct after-action reviews to improve future responses.",
  "what is risk assessment": "Risk assessment identifies hazards and evaluates potential impacts.",
  "how to create hazard maps": "Use historical data and expert analysis to map high-risk areas.",
  "what is early warning systems": "Early warning systems detect threats and alert populations in advance.",
  "how to test alerts": "Conduct regular tests of sirens, apps, and communication systems.",
  "what is public education": "Educate communities about risks and preparedness through campaigns.",
  "how to involve stakeholders": "Include government, businesses, and residents in planning.",
  "what is multi-hazard planning": "Plan for multiple types of disasters simultaneously.",
  "how to update plans": "Review and revise emergency plans regularly based on lessons learned.",
  "what is technology in disasters": "Use drones, apps, and AI for monitoring, response, and recovery.",
  "how to secure data": "Protect sensitive information during and after disasters.",
  "what is cyber security": "Cyber security prevents attacks on critical infrastructure during crises.",
  "how to handle media": "Provide accurate information and designate spokespeople.",
  "what is rumor control": "Monitor social media and correct misinformation quickly.",
  "how to international aid": "Coordinate with international organizations for large-scale disasters.",
  "what is climate change impact": "Climate change increases frequency and intensity of some disasters.",
  "how to adapt to climate": "Implement measures to reduce vulnerability to climate-related hazards.",
  "what is sustainable recovery": "Sustainable recovery considers environmental and economic factors.",
  "how to green rebuilding": "Use eco-friendly materials and designs for reconstruction.",
  "what is equity in recovery": "Ensure fair distribution of aid and opportunities for all groups.",
  "how to measure success": "Use metrics like recovery time, lives saved, and community satisfaction.",
  "what is continuous improvement": "Regularly evaluate and enhance disaster management capabilities.",
  "how to build partnerships": "Collaborate with NGOs, businesses, and other stakeholders.",
  "what is national strategy": "National strategies provide frameworks for coordinated disaster management.",
  "how to local implementation": "Adapt national strategies to local conditions and needs.",
  "what is training programs": "Provide regular training for responders, officials, and volunteers.",
  "how to exercise plans": "Conduct drills and simulations to test emergency plans.",
  "what is certification": "Certifications ensure competency in disaster response skills.",
  "how to mental health support": "Provide counseling and support for responders and survivors.",
  "how to prevent burnout": "Monitor workloads and provide rest periods for emergency workers.",
  "what is family support": "Support families of responders and affected individuals.",
  "how to recognize heroes": "Acknowledge contributions of responders and volunteers.",
  "what is legacy of disasters": "Disasters can lead to improved policies and community strength.",
  "how to honor victims": "Create memorials and support ongoing remembrance efforts.",
  "what is research in disasters": "Research improves understanding and response to disasters.",
  "how to fund research": "Support studies through grants and partnerships.",
  "what is innovation": "Develop new technologies and methods for disaster management.",
  "how to technology transfer": "Share innovations with other regions and countries.",
  "what is global cooperation": "Work internationally to address transboundary disasters.",
  "how to capacity building": "Strengthen abilities of vulnerable communities.",
  "what is gender considerations": "Address specific needs and roles of men and women in disasters.",
  "how to child protection": "Protect children from exploitation and ensure their needs are met.",
  "what is animal welfare": "Include animal rescue and welfare in disaster plans.",
  "how to environmental protection": "Minimize environmental damage during response and recovery.",
  "what is ecosystem restoration": "Restore natural systems affected by disasters.",
  "how to sustainable development": "Integrate disaster risk reduction into development planning.",
  "what is resilience building": "Enhance ability to withstand and recover from disasters.",
  "how to measure resilience": "Use indicators like infrastructure strength and community preparedness.",
  "what is adaptive management": "Adjust strategies based on changing conditions and new information.",
  "how to scenario planning": "Develop plans for various disaster scenarios.",
  "what is risk communication": "Communicate risks clearly and effectively to the public.",
  "how to behavioral insights": "Use psychology to improve public response to warnings.",
  "what is social media use": "Leverage social media for information sharing and coordination.",
  "how to digital divide": "Ensure access to technology for all during disasters.",
  "what is inclusive design": "Design systems accessible to people with disabilities.",
  "how to language access": "Provide information in multiple languages.",
  "how to cultural competence": "Understand and respect diverse cultural contexts.",
  "what is faith-based organizations": "Partner with religious groups for support and aid.",
  "how to private sector role": "Involve businesses in preparedness and response.",
  "what is public-private partnerships": "Collaborate between government and private entities.",
  "how to supply chain management": "Ensure reliable supply chains for emergency goods.",
  "how to logistics coordination": "Manage transportation and distribution of resources.",
  "what is warehousing": "Store supplies strategically for quick deployment.",
  "how to inventory management": "Track and maintain emergency supplies.",
  "what is procurement": "Acquire goods and services quickly during disasters.",
  "how to vendor management": "Establish relationships with reliable suppliers.",
  "what is financial management": "Handle funding, budgeting, and accountability.",
  "how to grant administration": "Manage grants for disaster recovery.",
  "what is insurance programs": "Develop programs to cover disaster losses.",
  "how to taxation relief": "Provide tax breaks for disaster-affected areas.",
  "what is economic recovery": "Support economic revitalization after disasters.",
  "how to job creation": "Create employment opportunities in recovery efforts.",
  "how to small business support": "Assist businesses in rebuilding and resuming operations.",
  "what is housing recovery": "Provide temporary and permanent housing solutions.",
  "how to rental assistance": "Help with rent payments during recovery.",
  "what is mortgage relief": "Offer loan modifications and forbearance.",
  "how to infrastructure repair": "Restore roads, bridges, utilities, and public buildings.",
  "what is utility restoration": "Reestablish power, water, and communication services.",
  "how to transportation recovery": "Repair and reopen transportation systems.",
  "what is healthcare recovery": "Restore medical facilities and services.",
  "how to education continuity": "Ensure schools reopen and provide support for students.",
  "how to school rebuilding": "Construct or repair educational facilities.",
  "what is childcare services": "Provide care for children during recovery.",
  "how to elder care": "Support elderly populations with special needs.",
  "what is disability services": "Assist people with disabilities in recovery.",
  "how to mental health services": "Offer counseling and therapy.",
  "how to substance abuse support": "Address increased substance use during crises.",
  "what is domestic violence prevention": "Monitor and prevent increased domestic violence.",
  "how to human trafficking prevention": "Protect vulnerable populations from exploitation.",
  "what is legal aid": "Provide legal assistance for disaster-related issues.",
  "how to notary services": "Offer document notarization for recovery paperwork.",
  "what is translation services": "Provide language assistance for non-English speakers.",
  "how to immigration support": "Assist immigrants and refugees affected by disasters.",
  "what is tribal consultation": "Work with tribal governments for culturally appropriate response.",
  "how to rural considerations": "Address unique challenges in rural areas.",
  "what is urban planning": "Incorporate disaster resilience into city planning.",
  "how to coastal management": "Protect coastal areas from storms and erosion.",
  "what is wildfire prevention": "Implement measures to reduce wildfire risks.",
  "how to drought management": "Plan for water shortages and agricultural impacts.",
  "what is pandemic preparedness": "Prepare for health emergencies like disease outbreaks.",
  "how to bioterrorism response": "Respond to deliberate biological attacks.",
  "what is chemical hazard response": "Handle chemical spills and releases.",
  "how to radiological incidents": "Manage nuclear or radiological emergencies.",
  "what is explosive incidents": "Respond to bombings or explosions.",
  "how to transportation accidents": "Handle plane, train, or vehicle crashes.",
  "what is structural collapse": "Respond to building or bridge failures.",
  "how to confined space rescue": "Conduct rescues in tight or hazardous spaces.",
  "what is water rescue": "Perform rescues in water environments.",
  "how to mountain rescue": "Handle incidents in mountainous terrain.",
  "what is cave rescue": "Conduct rescues in cave systems.",
  "how to ice rescue": "Respond to incidents on frozen water.",
  "what is swiftwater rescue": "Handle fast-moving water rescues.",
  "how to urban search and rescue": "Search for victims in collapsed structures.",
  "what is trench rescue": "Respond to trench collapses.",
  "how to machinery entrapment": "Free people trapped in machinery.",
  "what is farm accident response": "Handle agricultural machinery incidents.",
  "how to industrial accident response": "Respond to factory or plant emergencies.",
  "what is amusement park incidents": "Handle accidents at recreational facilities.",
  "how to stadium events": "Manage emergencies at large public events.",
  "how to concert security": "Ensure safety at music and entertainment events.",
  "how to festival management": "Plan for large outdoor gatherings.",
  "what is protest management": "Handle large demonstrations safely.",
  "how to civil disturbance response": "Respond to riots or unrest.",
  "what is active shooter response": "Protocol for armed intruder incidents.",
  "how to hostage situations": "Manage situations with hostages.",
  "what is bomb threat response": "Evaluate and respond to bomb threats.",
  "how to suspicious package handling": "Safely handle potentially dangerous packages.",
  "what is cyber incident response": "Respond to computer system attacks.",
  "how to data breach management": "Handle unauthorized data access.",
  "what is identity theft prevention": "Protect personal information during disasters.",
  "how to phishing awareness": "Educate about email scams during crises.",
  "what is social engineering defense": "Prevent manipulation for information access.",
  "how to secure communications": "Protect emergency communication channels.",
  "what is redundant systems": "Have backup systems for critical functions.",
  "how to continuity of operations": "Ensure essential services continue.",
  "what is alternate facilities": "Have backup locations for operations.",
  "how to mutual aid agreements": "Agreements to share resources between jurisdictions.",
  "what is emergency management assistance": "Federal and state support for disasters.",
  "how to Stafford Act": "Federal law providing disaster assistance.",
  "what is FEMA role": "Federal Emergency Management Agency coordinates response.",
  "how to state emergency management": "State agencies coordinate local responses.",
  "what is local emergency management": "City and county level coordination.",
  "how to volunteer coordination": "Organize and manage volunteer efforts.",
  "what is CERT programs": "Community Emergency Response Teams.",
  "how to neighborhood groups": "Local groups for mutual support.",
  "what is buddy systems": "Paired support for vulnerable individuals.",
  "how to emergency notification systems": "Systems for mass communication.",
  "what is reverse 911": "Automated calling systems for emergencies.",
  "how to wireless emergency alerts": "Cell phone emergency notifications.",
  "what is NOAA weather radio": "Weather alert radios.",
  "how to siren systems": "Outdoor warning sirens.",
  "what is cable overrides": "Emergency messages on television.",
  "how to EAS system": "Emergency Alert System for broadcasting.",
  "what is IPAWS": "Integrated Public Alert and Warning System.",
  "how to FEMA app": "Mobile app for emergency information.",
  "what is Red Cross app": "American Red Cross emergency app.",
  "how to local apps": "City-specific emergency applications.",
  "what is social media monitoring": "Track social media for emergency information.",
  "how to crisis communication": "Official communication during disasters.",
  "what is joint information center": "Centralized information coordination.",
  "how to press conferences": "Official briefings for media.",
  "what is rumor control center": "Monitor and correct misinformation.",
  "how to multilingual communication": "Provide information in multiple languages.",
  "what is accessible communication": "Ensure information reaches people with disabilities.",
  "how to visual alerts": "Use lights and signs for alerts.",
  "what is tactile alerts": "Vibrating alerts for deaf individuals.",
  "how to service animals": "Accommodate service animals in shelters.",
  "what is emotional support animals": "Guidelines for comfort animals.",
  "how to pet friendly shelters": "Shelters that accept pets.",
  "what is livestock evacuation": "Plans for farm animals.",
  "how to wildlife management": "Handle displaced wildlife.",
  "what is invasive species": "Prevent introduction of non-native species.",
  "how to hazardous materials": "Handle dangerous substances safely.",
  "how to biohazards": "Manage biological contamination.",
  "what is radiation monitoring": "Detect and measure radiation levels.",
  "how to decontamination": "Remove hazardous materials from people and areas.",
  "what is personal protective equipment": "Gear to protect responders.",
  "how to respiratory protection": "Masks and breathing apparatus.",
  "what is chemical suits": "Protective clothing for hazardous environments.",
  "how to decontamination showers": "Facilities to wash off contaminants.",
  "what is medical monitoring": "Health checks for exposed individuals.",
  "how to quarantine procedures": "Isolate infected or exposed people.",
  "what is contact tracing": "Track people exposed to contagious diseases.",
  "how to vaccination programs": "Administer vaccines during outbreaks.",
  "what is antiviral distribution": "Provide medications for viral infections.",
  "how to antibiotic stockpiles": "Reserve antibiotics for emergencies.",
  "what is ventilator management": "Allocate breathing machines during pandemics.",
  "how to hospital surge capacity": "Expand hospital capacity during crises.",
  "what is alternate care sites": "Temporary medical facilities.",
  "how to telemedicine": "Remote medical consultations.",
  "what is home health services": "Medical care at home during disasters.",
  "how to prescription assistance": "Help with medication access.",
  "what is medical supply chains": "Ensure availability of medical supplies.",
  "how to blood supply management": "Maintain blood banks during disasters.",
  "how to organ transplant coordination": "Continue life-saving transplants.",
  "what is mental health hotlines": "Telephone support for emotional distress.",
  "how to crisis counseling": "Professional mental health support.",
  "what is peer support": "Support from others with similar experiences.",
  "how to resilience training": "Build mental toughness for emergencies.",
  "what is stress management": "Techniques to handle stress during crises.",
  "how to sleep hygiene": "Maintain healthy sleep during disasters.",
  "what is nutrition during disasters": "Healthy eating under stress.",
  "how to exercise during recovery": "Physical activity for mental health.",
  "what is mindfulness practices": "Meditation and awareness techniques.",
  "how to spiritual support": "Religious and spiritual care.",
  "what is art therapy": "Creative expression for healing.",
  "how to music therapy": "Music for emotional support.",
  "what is pet therapy": "Animal-assisted therapy.",
  "how to family counseling": "Support for family units.",
  "what is group therapy": "Therapy in group settings.",
  "how to trauma-informed care": "Care sensitive to trauma experiences.",
  "what is vicarious trauma": "Trauma experienced by helpers.",
  "how to self-care for responders": "Prevent burnout in emergency workers.",
  "what is critical incident stress management": "Immediate support after incidents.",
  "how to debriefing sessions": "Discuss and process traumatic events.",
  "what is follow-up care": "Ongoing support after initial response.",
  "how to referral services": "Connect to long-term mental health care.",
  "what is substance abuse prevention": "Prevent increased drug/alcohol use.",
  "how to gambling awareness": "Monitor for increased gambling during stress.",
  "what is domestic violence intervention": "Support for abuse victims.",
  "how to child abuse prevention": "Protect children during crises.",
  "what is elder abuse prevention": "Protect elderly from exploitation.",
  "how to human rights protection": "Ensure rights during emergencies.",
  "what is privacy protection": "Safeguard personal information.",
  "how to data security": "Protect digital information.",
  "what is cybersecurity during disasters": "Prevent cyber attacks on systems.",
  "how to phishing protection": "Avoid email scams during crises.",
  "what is identity protection": "Prevent identity theft.",
  "how to financial fraud prevention": "Avoid scams targeting finances.",
  "what is insurance fraud detection": "Prevent false insurance claims.",
  "how to legal protections": "Laws protecting disaster victims.",
  "how to consumer protections": "Prevent price gouging and scams.",
  "what is anti-discrimination laws": "Protect against discrimination during disasters.",
  "how to accessibility laws": "Ensure access for people with disabilities.",
  "what is environmental laws": "Regulations for environmental protection.",
  "what is historic preservation": "Protect cultural and historic sites.",
  "how to archaeological protection": "Safeguard archaeological sites.",
  "what is cultural resource management": "Manage cultural heritage during disasters.",
  "how to museum protection": "Protect artifacts and collections.",
  "what is library preservation": "Save books and documents.",
  "how to archive protection": "Protect historical records.",
  "what is digital preservation": "Save digital cultural heritage.",
  "how to intangible heritage": "Protect traditions and knowledge.",
  "what is indigenous rights": "Respect indigenous peoples' rights.",
  "how to traditional knowledge": "Incorporate indigenous wisdom.",
  "what is community-based management": "Local control of disaster response.",
  "how to participatory planning": "Include communities in planning.",
  "what is bottom-up approaches": "Grassroots disaster management.",
  "how to empowerment": "Build community capacity.",
  "what is social capital": "Leverage community networks.",
  "how to trust building": "Build trust between authorities and communities.",
  "what is transparency": "Open communication and accountability.",
  "how to accountability": "Ensure responsible use of resources.",
  "what is corruption prevention": "Prevent misuse of disaster funds.",
  "how to auditing": "Monitor and verify disaster spending.",
  "what is oversight committees": "Groups to oversee disaster management.",
  "how to whistleblower protection": "Protect people reporting misconduct.",
  "what is ethics in disasters": "Moral principles in emergency response.",
  "how to triage ethics": "Ethical decision-making in resource allocation.",
  "what is equity in response": "Fair treatment of all affected groups.",
  "how to justice in recovery": "Ensure fair recovery processes.",
  "what is human dignity": "Respect for all people during disasters.",
  "how to compassion": "Show empathy and care.",
  "what is solidarity": "Support between affected communities.",
  "how to international solidarity": "Global support for disaster victims.",
  "what is humanitarian principles": "Core principles of humanitarian aid.",
  "how to neutrality": "Impartial aid provision.",
  "how to impartiality": "Fair distribution of aid.",
  "what is independence": "Independent aid organizations.",
  "how to humanity": "Protect and assist all in need.",
  "what is professionalism": "Competent and ethical response.",
  "how to innovation in aid": "New approaches to humanitarian work.",
  "what is technology in humanitarianism": "Use of tech for aid delivery.",
  "how to drones in disasters": "Drones for assessment and delivery.",
  "what is blockchain for aid": "Transparent aid tracking.",
  "how to AI in disasters": "Artificial intelligence for response.",
  "what is machine learning": "Learning algorithms for prediction.",
  "how to predictive analytics": "Forecast disaster impacts.",
  "what is early warning AI": "AI-powered warning systems.",
  "how to chatbots for information": "AI assistants for public queries.",
  "what is virtual reality training": "VR for responder training.",
  "how to augmented reality": "AR for damage assessment.",
  "what is 3D printing": "Rapid manufacturing of supplies.",
  "how to satellite imagery": "Space-based disaster monitoring.",
  "what is GIS mapping": "Geographic information systems.",
  "how to remote sensing": "Data collection from distance.",
  "what is crowdsourcing": "Public contribution of information.",
  "how to social media analytics": "Analyze social media for insights.",
  "what is big data in disasters": "Large-scale data analysis.",
  "how to Internet of Things": "Connected devices for monitoring.",
  "what is smart cities": "Technology-integrated urban areas.",
  "how to resilient infrastructure": "Infrastructure designed for disasters.",
  "what is green infrastructure": "Natural systems for resilience.",
  "how to circular economy": "Sustainable resource use.",
  "what is regenerative design": "Design that restores ecosystems.",
  "how to biophilic design": "Nature-inspired building design.",
  "what is passive design": "Buildings that work with nature.",
  "how to renewable energy": "Sustainable power sources.",
  "what is microgrids": "Local power systems.",
  "how to energy storage": "Store energy for emergencies.",
  "what is water resilience": "Water systems resistant to disasters.",
  "how to wastewater management": "Handle sewage during disasters.",
  "what is stormwater management": "Manage rainwater and flooding.",
  "how to food systems resilience": "Sustainable food production.",
  "how to urban agriculture": "City-based food production.",
  "what is vertical farming": "High-density indoor farming.",
  "how to community gardens": "Local food production.",
  "what is food banks": "Emergency food distribution.",
  "how to nutrition programs": "Ensure healthy eating during disasters.",
  "what is school feeding": "Meals for school children.",
  "how to food security": "Access to sufficient food.",
  "what is livelihood support": "Economic assistance for recovery.",
  "how to cash transfers": "Direct financial aid.",
  "how to vouchers": "Redeemable aid certificates.",
  "what is microfinance": "Small loans for recovery.",
  "how to cooperative businesses": "Community-owned enterprises.",
  "what is skill training": "Vocational training for employment.",
  "how to entrepreneurship support": "Help starting businesses.",
  "what is job placement": "Connect people to employment.",
  "how to wage subsidies": "Government support for wages.",
  "what is unemployment benefits": "Financial support during job loss.",
  "how to social protection": "Systems to protect vulnerable groups.",
  "what is universal basic income": "Regular cash payments.",
  "how to conditional cash transfers": "Aid with conditions.",
  "what is social insurance": "Insurance against social risks.",
  "how to pension systems": "Retirement income security.",
  "what is disability benefits": "Support for people with disabilities.",
  "how to maternity leave": "Paid leave for new parents.",
  "what is sick leave": "Paid time off for illness.",
  "how to workers' compensation": "Benefits for work-related injuries.",
  "what is occupational health": "Health and safety at work.",
  "how to labor rights": "Protections for workers.",
  "what is collective bargaining": "Negotiations between workers and employers.",
  "how to unionization": "Formation of labor unions.",
  "what is minimum wage": "Lowest legal pay rate.",
  "how to living wage": "Wage sufficient for basic needs.",
  "what is fair trade": "Ethical trade practices.",
  "how to supply chain ethics": "Moral supply chain management.",
  "what is corporate social responsibility": "Business ethics and sustainability.",
  "how to ESG investing": "Environmental, social, governance investing.",
  "how to impact investing": "Investing for social good.",
  "what is social entrepreneurship": "Businesses solving social problems.",
  "how to nonprofit management": "Running charitable organizations.",
  "what is philanthropy": "Private giving for public good.",
  "how to foundations": "Organizations distributing charitable funds.",
  "what is endowments": "Permanent funds for charities.",
  "how to crowdfunding": "Online fundraising.",
  "what is peer-to-peer lending": "Direct loans between individuals.",
  "how to microloans": "Small loans for entrepreneurs.",
  "what is impact measurement": "Measuring social change.",
  "how to theory of change": "Framework for social impact.",
  "what is logic models": "Planning social programs.",
  "how to evaluation methods": "Assessing program effectiveness.",
  "what is randomized controlled trials": "Scientific evaluation method.",
  "how to qualitative research": "In-depth understanding methods.",
  "what is quantitative research": "Numerical data analysis.",
  "how to mixed methods": "Combining research approaches.",
  "what is participatory research": "Research with community involvement.",
  "how to action research": "Research for social change.",
  "what is community-based research": "Local knowledge generation.",
  "how to indigenous research": "Research respecting indigenous methods.",
  "what is decolonizing research": "Challenging colonial research paradigms.",
  "how to feminist research": "Research addressing gender issues.",
  "what is intersectional research": "Research on multiple identities.",
  "what is critical research": "Research challenging power structures.",
  "how to transformative research": "Research for social transformation.",
  "what is emancipatory research": "Research freeing oppressed groups.",
  "how to policy research": "Research informing policy.",
  "what is advocacy research": "Research for policy change.",
  "how to knowledge mobilization": "Sharing research findings.",
  "what is science communication": "Communicating complex ideas.",
  "how to public engagement": "Involving public in research.",
  "what is citizen science": "Public participation in research.",
  "how to open science": "Transparent and accessible research.",
  "what is open data": "Freely available data.",
  "how to open access": "Free access to research.",
  "what is open source": "Freely available software.",
  "how to collaborative platforms": "Tools for group work.",
  "what is digital collaboration": "Online teamwork.",
  "how to virtual teams": "Remote work groups.",
  "what is asynchronous communication": "Communication not in real-time.",
  "how to synchronous communication": "Real-time interaction.",
  "what is video conferencing": "Online meetings with video.",
  "how to webinars": "Online seminars.",
  "how to online learning": "Education via internet.",
  "what is e-learning": "Electronic learning.",
  "how to MOOCs": "Massive open online courses.",

function addMessageToChat(text, sender) {
  const messagesDiv = $("#ai-agent-messages");
  if (!messagesDiv) return;
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${sender}`;
  messageDiv.innerHTML = text.split("\n").map((line) => `<div>${escapeHtml(line)}</div>`).join("");
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Boot
renderAll();
wire();

// Wire AI Chatbot
const aiToggle = $("#ai-agent-toggle");
const aiChat = $("#ai-agent-chat");
const aiClose = $("#ai-agent-close");
const aiInput = $("#ai-agent-input");
const aiSend = $("#ai-agent-send");

if (aiToggle && aiChat && aiClose && aiInput && aiSend) {
  aiToggle.addEventListener("click", () => {
    aiChat.style.display = aiChat.style.display === "none" ? "flex" : "none";
  });

  aiClose.addEventListener("click", () => {
    aiChat.style.display = "none";
  });

  aiSend.addEventListener("click", () => {
    const text = aiInput.value.trim();
    if (!text) return;
    addMessageToChat(text, "user");
    aiInput.value = "";
    setTimeout(() => {
      const response = generateAIResponse(text, state);
      addMessageToChat(response, "ai");
    }, 500);
  });

  aiInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") aiSend.click();
  });
}
