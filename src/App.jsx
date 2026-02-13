import React, { useEffect, useMemo, useState } from "react";
import AIAgent from "./AIAgent.jsx";

const STORAGE_KEY = "rr_demo_state_v1";

const fmt = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function levelFromStatus(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("red")) return "red";
  if (s.includes("orange")) return "orange";
  if (s.includes("advis")) return "advisory";
  if (s.includes("resolv")) return "resolved";
  return "advisory";
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

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return makeDefaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return makeDefaultState();
    return parsed;
  } catch {
    return makeDefaultState();
  }
}

function saveState(s) {
  const next = { ...s, lastUpdateIso: nowIso() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

function clampInt(n, min, max) {
  const x = Number.isFinite(n) ? Math.trunc(n) : parseInt(String(n), 10);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function NavLink({ active, onClick, children }) {
  return (
    <button className={`nav__link ${active ? "is-active" : ""}`} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

export default function App() {
  const [route, setRoute] = useState("home");
  const [state, setState] = useState(() => loadState());
  const [globalSearch, setGlobalSearch] = useState("");

  useEffect(() => {
    const onHash = () => {
      const m = (location.hash || "#/home").match(/^#\/([a-z-]+)/i);
      setRoute((m?.[1] || "home").toLowerCase());
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    setState((s) => saveState(s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.disasters, state.alerts, state.resources, state.allocations, state.messages]);

  const activeDisasters = useMemo(
    () => state.disasters.filter((d) => levelFromStatus(d.status) !== "resolved"),
    [state.disasters],
  );

  const highAlerts = useMemo(() => state.alerts.filter((a) => !a.acknowledged && a.level === "red"), [state.alerts]);

  const readiness = useMemo(() => {
    const entries = Object.values(state.resources);
    const total = entries.reduce((acc, r) => acc + (r.qty || 0), 0);
    const per = entries.length ? Math.round(total / entries.length) : 0;
    return { total, per };
  }, [state.resources]);

  function resetDemo() {
    localStorage.removeItem(STORAGE_KEY);
    setState(makeDefaultState());
    location.hash = "#/home";
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

  function onImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    file
      .text()
      .then((text) => {
        const obj = JSON.parse(text);
        if (!obj || typeof obj !== "object") throw new Error("Invalid JSON");
        setState(obj);
      })
      .catch(() => alert("Could not import. Please choose a valid JSON export file."))
      .finally(() => {
        e.target.value = "";
      });
  }

  const topAlert = useMemo(() => {
    const sorted = state.alerts
      .filter((a) => !a.acknowledged)
      .slice()
      .sort((a, b) => new Date(b.createdAtIso) - new Date(a.createdAtIso));
    return sorted.find((a) => a.level === "red") || sorted[0] || null;
  }, [state.alerts]);

  const feed = useMemo(() => {
    const items = [];
    const newestDisasters = state.disasters
      .slice()
      .sort((a, b) => new Date(b.updatedAtIso) - new Date(a.updatedAtIso))
      .slice(0, 3)
      .map((d) => ({
        when: d.updatedAtIso,
        title: `${d.type} — ${d.location}`,
        meta: d.status,
        route: "disasters",
        icon: "🛰️",
      }));
    const newestAlerts = state.alerts
      .slice()
      .sort((a, b) => new Date(b.createdAtIso) - new Date(a.createdAtIso))
      .slice(0, 3)
      .map((a) => ({
        when: a.createdAtIso,
        title: `${a.type} — ${a.location}`,
        meta: `${a.level.toUpperCase()}${a.acknowledged ? " · Ack" : ""}`,
        route: "alerts",
        icon: "📣",
      }));
    items.push(...newestAlerts, ...newestDisasters);
    items.sort((a, b) => new Date(b.when) - new Date(a.when));
    return items.slice(0, 5);
  }, [state.alerts, state.disasters]);

  return (
    <>
      <header className="topbar">
        <div className="container topbar__inner">
          <div className="brand" role="banner" aria-label="RescueRelief AI">
            <div className="brand__logo" aria-hidden="true">
              RR
            </div>
            <div className="brand__meta">
              <div className="brand__name">RescueRelief AI</div>
              <div className="brand__tag">National Disaster Management Dashboard (Demo)</div>
            </div>
          </div>

          <nav className="nav" aria-label="Primary">
            <NavLink active={route === "home"} onClick={() => (location.hash = "#/home")}>
              Home
            </NavLink>
            <NavLink active={route === "disasters"} onClick={() => (location.hash = "#/disasters")}>
              Disasters
            </NavLink>
            <NavLink active={route === "resources"} onClick={() => (location.hash = "#/resources")}>
              Resources
            </NavLink>
            <NavLink active={route === "alerts"} onClick={() => (location.hash = "#/alerts")}>
              Alerts
            </NavLink>
            <NavLink active={route === "analytics"} onClick={() => (location.hash = "#/analytics")}>
              Analytics
            </NavLink>
            <NavLink active={route === "contact"} onClick={() => (location.hash = "#/contact")}>
              Contact
            </NavLink>
          </nav>

          <div className="topbar__right">
            <div className="topbar__search">
              <input
                className="input input--sm"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  location.hash = "#/disasters";
                }}
                placeholder="Search disasters, alerts, locations…"
              />
            </div>
            <div className="pill" title="Demo data saved in your browser">
              <span className="pill__dot" aria-hidden="true"></span>
              Local demo
            </div>
            <button className="btn btn--ghost" type="button" onClick={exportState}>
              Export
            </button>
            <label className="btn btn--ghost" style={{ display: "inline-flex", alignItems: "center" }}>
              Import
              <input type="file" accept="application/json" hidden onChange={onImportFile} />
            </label>
            <button className="btn btn--ghost" type="button" onClick={() => confirm("Reset demo data?") && resetDemo()}>
              Reset
            </button>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="grid grid--stats" aria-label="Overview stats">
          <article className="card stat">
            <div className="stat__label">Active disasters</div>
            <div className="stat__value">{activeDisasters.length}</div>
            <div className="stat__hint">Tracked in your area</div>
          </article>
          <article className="card stat">
            <div className="stat__label">High priority alerts</div>
            <div className="stat__value">{highAlerts.length}</div>
            <div className="stat__hint">Red / critical</div>
          </article>
          <article className="card stat">
            <div className="stat__label">Resource readiness</div>
            <div className="stat__value">{readiness.per}</div>
            <div className="stat__hint">Across all supplies</div>
          </article>
          <article className="card stat">
            <div className="stat__label">Last update</div>
            <div className="stat__value stat__value--small">
              {state.lastUpdateIso ? fmt.format(new Date(state.lastUpdateIso)) : "—"}
            </div>
            <div className="stat__hint">Saved locally</div>
          </article>
        </section>

        {route === "home" && (
          <section className="card hero" aria-label="Home">
            <div className="hero__left">
              <div className="homeBadge">National Command View</div>
              <h1 className="hero__title">Real‑Time Disaster Monitoring</h1>
              <p className="hero__subtitle">
                RescueRelief AI helps authorities monitor disasters, allocate resources, and issue early warnings using
                data‑driven insights.
              </p>

              <div className="hero__actions">
                <button className="btn btn--primary" onClick={() => (location.hash = "#/alerts")} type="button">
                  Issue alert
                </button>
                <button className="btn" onClick={() => (location.hash = "#/resources")} type="button">
                  Allocate resources
                </button>
                <button className="btn btn--ghost" onClick={() => (location.hash = "#/disasters")} type="button">
                  Manage disasters
                </button>
              </div>

              <div className="homeHighlights" aria-label="Quick overview">
                <div className="homeHighlight">
                  <div className="homeHighlight__title">Fast triage</div>
                  <div className="homeHighlight__desc">Spot red alerts instantly and respond with simple workflows.</div>
                </div>
                <div className="homeHighlight">
                  <div className="homeHighlight__title">Resource readiness</div>
                  <div className="homeHighlight__desc">Keep kits, boats, food and teams ready to deploy.</div>
                </div>
                <div className="homeHighlight">
                  <div className="homeHighlight__title">Clear communication</div>
                  <div className="homeHighlight__desc">Publish actionable alerts with consistent guidance.</div>
                </div>
              </div>

              {topAlert && (
                <div className="card" style={{ padding: 14, borderColor: "rgba(255,77,95,.30)" }}>
                  <div style={{ fontWeight: 950 }}>⚠️ High Priority Alert</div>
                  <div style={{ marginTop: 8, fontWeight: 800 }}>
                    {topAlert.type}: {topAlert.location} — {topAlert.level.toUpperCase()} alert issued
                  </div>
                  <div className="muted" style={{ marginTop: 6, lineHeight: 1.45 }}>
                    {topAlert.message}
                  </div>
                </div>
              )}
            </div>

            <div className="hero__right" aria-label="Home side panels">
              <div className="stack">
                <div className="panel">
                  <div className="panel__header">
                    <div>
                      <div className="panel__title">Live feed</div>
                      <div className="panel__subtitle">Latest changes (demo)</div>
                    </div>
                  </div>
                  <div className="panel__body">
                    {feed.length === 0 ? (
                      <div className="muted">No activity yet.</div>
                    ) : (
                      feed.map((x) => (
                        <div className="card" key={`${x.route}-${x.when}`} style={{ padding: 12 }}>
                          <div style={{ fontWeight: 900 }}>
                            {x.icon} {x.title}
                          </div>
                          <div className="muted" style={{ marginTop: 4 }}>
                            {x.meta} · {fmt.format(new Date(x.when))}
                          </div>
                          <div style={{ marginTop: 10 }}>
                            <button className="btn btn--sm btn--ghost" type="button" onClick={() => (location.hash = `#/${x.route}`)}>
                              Open
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="panel">
                  <div className="panel__header">
                    <div>
                      <div className="panel__title">Quick actions</div>
                      <div className="panel__subtitle">Simple workflows</div>
                    </div>
                  </div>
                  <div className="panel__body">
                    <button className="action" type="button" onClick={() => (location.hash = "#/disasters")}>
                      <div className="action__title">Create a new disaster</div>
                      <div className="action__desc">Add incident, set location + status</div>
                    </button>
                    <button className="action" type="button" onClick={() => (location.hash = "#/resources")}>
                      <div className="action__title">Allocate resources</div>
                      <div className="action__desc">Assign kits/boats/workers</div>
                    </button>
                    <button className="action" type="button" onClick={() => (location.hash = "#/alerts")}>
                      <div className="action__title">Issue an alert</div>
                      <div className="action__desc">Publish warning + guidance</div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {(route === "disasters" || route === "resources" || route === "alerts" || route === "analytics" || route === "contact") && (
          <div className="card" style={{ padding: 16 }}>
            <div style={{ fontWeight: 950, marginBottom: 6 }}>React migration in progress</div>
            <div className="muted">
              I’ve wired the shell + Home view in React. Next I’ll port the other pages and all actions (add/edit/allocate/alerts/contact) into React components.
            </div>
            {globalSearch ? (
              <div className="muted" style={{ marginTop: 10 }}>
                Global search: <strong>{globalSearch}</strong>
              </div>
            ) : null}
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="container footer__inner">
          <div className="muted">© 2026 RescueRelief AI | Academic Project Demo</div>
          <div className="footer__links">
            <button className="link" type="button" onClick={() => (location.hash = "#/home")}>
              Home
            </button>
            <button className="link" type="button" onClick={() => (location.hash = "#/alerts")}>
              Alerts
            </button>
            <button className="link" type="button" onClick={() => (location.hash = "#/resources")}>
              Resources
            </button>
          </div>
        </div>
      </footer>
      <AIAgent state={state} />
    </>
  );
}

