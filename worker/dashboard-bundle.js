/**
 * Avant Elevators — Cloudflare Worker (single-file bundle for the dashboard editor)
 *
 * This file is auto-generated from worker/src/*.js via esbuild — do not hand-edit it.
 * Regenerate after changing anything in worker/src with:
 *   cd worker && npx esbuild src/index.js --bundle --format=esm --platform=neutral --target=es2022 --outfile=dashboard-bundle.js
 *
 * Use this ONLY if you are deploying via the Cloudflare dashboard's Quick Edit /
 * inline code editor (no wrangler CLI). Paste the whole file in as-is.
 * If you can use "Workers & Pages -> Create -> Import a repository" (Git-connected
 * Workers Builds) instead, use worker/src/index.js as the entry point and ignore
 * this file — that path builds the multi-file project directly and stays in sync
 * automatically on every push.
 *
 * Required secrets/variables (Worker -> Settings -> Variables and Secrets):
 *   WORKER_SECRET       — any random string; same value goes in VITE_WORKER_SECRET
 *   SA_EMAIL            — Firebase service account client_email
 *   SA_PRIVATE_KEY      — Firebase service account private_key (keep \n as literal \n)
 *   FIREBASE_PROJECT_ID — avant-elevators
 *   MAILER_URL          — https://x4m2x4kscj.execute-api.ap-south-1.amazonaws.com/v1
 *   MAILER_API_KEY      — Ambivare@9822091922
 *
 * Cron Triggers (Worker -> Settings -> Triggers -> Cron Triggers), add all 5
 * (Cloudflare's Free plan caps a worker at 5 triggers total — these already
 * fan out to every reminder job, see the scheduled() switch below):
 *   0 2 * * *     30 2 1 * *     30 3 * * *     0 4 * * *     30 4 * * *
 */

// worker/src/auth.js
var _cachedToken = null;
var _cacheExpiry = 0;
async function getAccessToken(env) {
  if (_cachedToken && Date.now() < _cacheExpiry) return _cachedToken;
  const cryptoKey = await importPrivateKey(env.SA_PRIVATE_KEY);
  const now = Math.floor(Date.now() / 1e3);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({
    iss: env.SA_EMAIL,
    scope: [
      "https://www.googleapis.com/auth/firebase.messaging",
      "https://www.googleapis.com/auth/datastore"
    ].join(" "),
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600
  }));
  const toSign = `${header}.${payload}`;
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(toSign)
  );
  const jwt = `${toSign}.${b64urlBuf(sigBuf)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });
  const json = await res.json();
  if (!json.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(json)}`);
  _cachedToken = json.access_token;
  _cacheExpiry = Date.now() + ((json.expires_in || 3600) - 300) * 1e3;
  return _cachedToken;
}
async function importPrivateKey(pem) {
  const clean = pem.replace(/\\n/g, "\n").replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const binary = Uint8Array.from(atob(clean), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    binary,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}
function b64url(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlBuf(buf) {
  const bytes = new Uint8Array(buf);
  let raw = "";
  for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// worker/src/firestore.js
function base(projectId) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}
async function runQuery(token, projectId, structuredQuery) {
  const res = await fetch(`${base(projectId)}:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery })
  });
  if (!res.ok) return [];
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : []).filter((r) => r.document).map((r) => ({ _id: r.document.name.split("/").pop(), ...docToObj(r.document) }));
}
async function getDoc(token, projectId, collection, docId) {
  const res = await fetch(`${base(projectId)}/${collection}/${docId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const doc = await res.json();
  return { _id: docId, ...docToObj(doc) };
}
async function tokensByRole(token, projectId, ...roles) {
  const unique = [...new Set(roles)];
  const lists = await Promise.all(unique.map(
    (role) => runQuery(token, projectId, {
      from: [{ collectionId: "fcmTokens" }],
      where: fieldEq("role", role),
      select: { fields: [{ fieldPath: "token" }] }
    })
  ));
  return [...new Set(lists.flat().map((d) => d.token).filter(Boolean))];
}
async function tokenByUserId(token, projectId, userId) {
  if (!userId) return null;
  const doc = await getDoc(token, projectId, "fcmTokens", userId);
  return doc?.token || null;
}
async function tokensByUserName(token, projectId, userName) {
  if (!userName) return [];
  const docs = await runQuery(token, projectId, {
    from: [{ collectionId: "fcmTokens" }],
    where: fieldEq("userName", userName),
    select: { fields: [{ fieldPath: "token" }] }
  });
  return docs.map((d) => d.token).filter(Boolean);
}
async function tokensByUserNames(token, projectId, names = []) {
  const unique = [...new Set(names.filter(Boolean))];
  if (!unique.length) return [];
  const lists = await Promise.all(unique.map((n) => tokensByUserName(token, projectId, n)));
  return [...new Set(lists.flat())];
}
async function queryEqual(token, projectId, collection, field, value) {
  return runQuery(token, projectId, {
    from: [{ collectionId: collection }],
    where: fieldEq(field, value)
  });
}
async function queryWhere(token, projectId, collection, where, limit) {
  const q = { from: [{ collectionId: collection }] };
  if (where) q.where = where;
  if (limit) q.limit = limit;
  return runQuery(token, projectId, q);
}
async function getAll(token, projectId, collection) {
  return runQuery(token, projectId, { from: [{ collectionId: collection }] });
}
function fieldEq(path, value) {
  return {
    fieldFilter: {
      field: { fieldPath: path },
      op: "EQUAL",
      value: valueToFS(value)
    }
  };
}
function valueToFS(val) {
  if (val === null || val === void 0) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  return { stringValue: String(val) };
}
function fsToVal(field) {
  if (!field) return null;
  if ("nullValue" in field) return null;
  if ("booleanValue" in field) return field.booleanValue;
  if ("integerValue" in field) return Number(field.integerValue);
  if ("doubleValue" in field) return field.doubleValue;
  if ("timestampValue" in field) return new Date(field.timestampValue);
  if ("stringValue" in field) return field.stringValue;
  if ("mapValue" in field) return docToObj({ fields: field.mapValue.fields || {} });
  if ("arrayValue" in field) return (field.arrayValue.values || []).map(fsToVal);
  return null;
}
function docToObj(doc) {
  if (!doc?.fields) return {};
  return Object.fromEntries(Object.entries(doc.fields).map(([k, v]) => [k, fsToVal(v)]));
}

// worker/src/fcm.js
async function send(accessToken, projectId, tokens, notification, data = {}) {
  const clean = [...new Set(tokens.filter(Boolean))];
  if (!clean.length) return;
  const strData = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v ?? "")]));
  const channelId = strData.channel || "avant_general";
  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  await Promise.all(clean.map(
    (token) => fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification,
          data: strData,
          android: {
            priority: "high",
            notification: { channel_id: channelId, sound: "default" }
          },
          apns: { payload: { aps: { sound: "default", badge: 1 } } }
        }
      })
    }).catch((e) => console.error("[FCM] send error for token:", token.slice(-8), e.message))
  ));
}

// worker/src/notify.js
async function handleNotify(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return ok();
  }
  const { type, data = {}, before = {} } = body;
  try {
    const token = await getAccessToken(env);
    const pid = env.FIREBASE_PROJECT_ID;
    await dispatch(token, pid, type, data, before);
  } catch (e) {
    console.error("[notify] dispatch error:", e.message);
  }
  return ok();
}
function makeFs(token, pid) {
  return {
    byRole: (...roles) => tokensByRole(token, pid, ...roles),
    byId: (id) => tokenByUserId(token, pid, id),
    byName: (name) => tokensByUserName(token, pid, name),
    byNames: (names) => tokensByUserNames(token, pid, names),
    send: (tokens, notification, data) => send(token, pid, tokens, notification, data)
  };
}
async function dispatch(token, pid, type, d, b) {
  const fs = makeFs(token, pid);
  switch (type) {
    // ── Tasks ──────────────────────────────────────────────────────────────
    case "task_created": {
      if (!d.assignedTo) return;
      const tokens = await fs.byName(d.assignedTo);
      return fs.send(
        tokens,
        { title: "New Task Assigned", body: d.title || d.description || "You have a new task." },
        { type, docId: d.id || "", channel: "avant_assignments" }
      );
    }
    case "task_reassigned": {
      if (!d.assignedTo || d.assignedTo === b.assignedTo) return;
      const tokens = await fs.byName(d.assignedTo);
      return fs.send(
        tokens,
        { title: "Task Assigned to You", body: d.title || "A task has been assigned to you." },
        { type: "task_assigned", docId: d.id || "", channel: "avant_assignments" }
      );
    }
    case "task_completed": {
      const tokens = await fs.byRole("admin");
      return fs.send(
        tokens,
        { title: "Task Completed", body: `${d.title || "Task"} marked complete by ${d.assignedTo || "team"}.` },
        { type, docId: d.id || "", channel: "avant_updates" }
      );
    }
    // ── Leads ──────────────────────────────────────────────────────────────
    case "lead_created": {
      const names = d.assignedTo ? [d.assignedTo] : [];
      const [admin, name] = await Promise.all([fs.byRole("admin"), fs.byNames(names)]);
      return fs.send(
        [...admin, ...name],
        { title: "\u{1F195} New Lead", body: `${d.clientName || d.name || "New lead"}${d.source ? " via " + d.source : ""}` },
        { type, docId: d.id || "", channel: "avant_assignments" }
      );
    }
    case "lead_assigned": {
      if (!d.assignedTo || d.assignedTo === b.assignedTo) return;
      const tokens = await fs.byName(d.assignedTo);
      return fs.send(
        tokens,
        { title: "Lead Assigned to You", body: `${d.clientName || "Lead"} has been assigned to you.` },
        { type, docId: d.id || "", channel: "avant_assignments" }
      );
    }
    case "lead_won": {
      const positiveStatuses = ["won", "qualified", "converted"];
      if (!positiveStatuses.includes(d.status) || positiveStatuses.includes(b.status)) return;
      const tokens = await fs.byRole("admin");
      const s = d.status;
      return fs.send(
        tokens,
        { title: `Lead ${s.charAt(0).toUpperCase() + s.slice(1)}! \u{1F389}`, body: `${d.clientName || "Lead"} has been marked as ${s}.` },
        { type, docId: d.id || "", channel: "avant_updates" }
      );
    }
    // ── Complaints ─────────────────────────────────────────────────────────
    case "complaint_created": {
      const tokens = await fs.byRole("admin", "technician");
      return fs.send(
        tokens,
        { title: "\u{1F6A8} New Complaint", body: `${d.clientName || "Client"} \u2014 ${d.issueType || d.type || "Issue"} (${d.priority || "normal"} priority)` },
        { type, docId: d.id || "", channel: "avant_alerts" }
      );
    }
    case "complaint_assigned": {
      if (!d.assignedTo || d.assignedTo === b.assignedTo) return;
      const tokens = await fs.byName(d.assignedTo);
      return fs.send(
        tokens,
        { title: "Complaint Assigned to You", body: `${d.clientName || "Client"} \u2014 ${d.issueType || "Issue"}. Please attend promptly.` },
        { type, docId: d.id || "", channel: "avant_assignments" }
      );
    }
    case "complaint_resolved": {
      const resolved = ["resolved", "closed", "done"];
      if (!resolved.includes(d.status) || resolved.includes(b.status)) return;
      const tokens = await fs.byRole("admin");
      return fs.send(
        tokens,
        { title: "Complaint Resolved \u2713", body: `${d.clientName || "Client"} complaint resolved by ${d.assignedTo || "team"}.` },
        { type, docId: d.id || "", channel: "avant_updates" }
      );
    }
    // ── QR Tickets ─────────────────────────────────────────────────────────
    case "ticket_created": {
      const tokens = await fs.byRole("admin");
      const ref = d.ticketRef || (d.id || "").slice(0, 8).toUpperCase();
      const lift = d.liftId ? ` \xB7 Lift ${d.liftId}` : "";
      return fs.send(
        tokens,
        { title: `\u{1F3AB} New QR Ticket \u2014 ${ref}`, body: `${d.reporterName || "Anonymous"}${lift} \u2014 ${d.issueType || "Issue reported"}` },
        { type, docId: d.id || "", ticketRef: ref, channel: "avant_alerts" }
      );
    }
    // ── Installation ────────────────────────────────────────────────────────
    case "installation_created": {
      const names = [d.assignedTo, d.assignedTechnician, d.technicianName].filter(Boolean);
      const [tech, admin] = await Promise.all([fs.byNames(names), fs.byRole("admin")]);
      if (tech.length) await fs.send(
        tech,
        { title: "\u{1F527} Installation Assigned to You", body: `${d.projectName || d.clientName || "Project"} \u2014 ${d.liftType || "Lift"} installation. Report at site.` },
        { type: "installation_assigned", docId: d.id || "", channel: "avant_assignments" }
      );
      return fs.send(
        admin,
        { title: "New Installation Scheduled", body: `${d.projectName || d.clientName || "Installation"} assigned to ${names[0] || "technician"}.` },
        { type, docId: d.id || "", channel: "avant_updates" }
      );
    }
    case "installation_reassigned": {
      const newNames = [d.assignedTo, d.assignedTechnician, d.technicianName].filter(Boolean);
      const oldNames = [b.assignedTo, b.assignedTechnician, b.technicianName].filter(Boolean);
      const added = newNames.filter((n) => !oldNames.includes(n));
      if (!added.length) return;
      const tech = await fs.byNames(added);
      return fs.send(
        tech,
        { title: "\u{1F527} Installation Assigned to You", body: `${d.projectName || d.clientName || "Project"} \u2014 ${d.liftType || "Lift"} installation job has been assigned to you.` },
        { type: "installation_assigned", docId: d.id || "", channel: "avant_assignments" }
      );
    }
    case "installation_completed": {
      const done = ["completed", "done", "finished"];
      if (!done.includes(d.status) || done.includes(b.status)) return;
      const tokens = await fs.byRole("admin");
      return fs.send(
        tokens,
        { title: "Installation Completed \u2713", body: `${d.projectName || d.clientName || "Installation"} marked complete.` },
        { type, docId: d.id || "", channel: "avant_updates" }
      );
    }
    // ── Repair ─────────────────────────────────────────────────────────────
    case "repair_created": {
      const names = [d.assignedTo, d.assignedTechnician, d.technicianName].filter(Boolean);
      const [tech, admin] = await Promise.all([fs.byNames(names), fs.byRole("admin")]);
      if (tech.length) await fs.send(
        tech,
        { title: "\u{1F528} Repair Job Assigned to You", body: `${d.projectName || d.clientName || "Site"} \u2014 ${d.issueType || d.type || "Repair"}. Please attend promptly.` },
        { type: "repair_assigned", docId: d.id || "", channel: "avant_assignments" }
      );
      return fs.send(
        admin,
        { title: "New Repair Job Created", body: `${d.projectName || d.clientName || "Repair"} logged.` },
        { type, docId: d.id || "", channel: "avant_updates" }
      );
    }
    case "repair_reassigned": {
      const newNames = [d.assignedTo, d.assignedTechnician, d.technicianName].filter(Boolean);
      const oldNames = [b.assignedTo, b.assignedTechnician, b.technicianName].filter(Boolean);
      const added = newNames.filter((n) => !oldNames.includes(n));
      if (!added.length) return;
      const tech = await fs.byNames(added);
      return fs.send(
        tech,
        { title: "\u{1F528} Repair Job Assigned to You", body: `${d.projectName || d.clientName || "Site"} \u2014 ${d.issueType || d.type || "Repair"} has been assigned to you.` },
        { type: "repair_assigned", docId: d.id || "", channel: "avant_assignments" }
      );
    }
    case "repair_completed": {
      const done = ["completed", "done"];
      if (!done.includes(d.status) || done.includes(b.status)) return;
      const tokens = await fs.byRole("admin");
      return fs.send(
        tokens,
        { title: "Repair Completed \u2713", body: `${d.projectName || d.clientName || "Repair"} completed by ${d.assignedTo || "technician"}.` },
        { type, docId: d.id || "", channel: "avant_updates" }
      );
    }
    // ── Modernisation ──────────────────────────────────────────────────────
    case "modernisation_created": {
      const names = [d.assignedTo, d.assignedTechnician].filter(Boolean);
      const [tech, admin] = await Promise.all([fs.byNames(names), fs.byRole("admin")]);
      if (tech.length) await fs.send(
        tech,
        { title: "\u2699\uFE0F Modernisation Assigned to You", body: `${d.projectName || d.clientName || "Project"} modernisation job has been assigned to you.` },
        { type: "modernisation_assigned", docId: d.id || "", channel: "avant_assignments" }
      );
      return fs.send(
        admin,
        { title: "Modernisation Scheduled", body: `${d.projectName || d.clientName || "Modernisation"} assigned to ${names[0] || "technician"}.` },
        { type, docId: d.id || "", channel: "avant_updates" }
      );
    }
    case "modernisation_reassigned": {
      const newNames = [d.assignedTo, d.assignedTechnician].filter(Boolean);
      const oldNames = [b.assignedTo, b.assignedTechnician].filter(Boolean);
      const added = newNames.filter((n) => !oldNames.includes(n));
      if (!added.length) return;
      const tech = await fs.byNames(added);
      return fs.send(
        tech,
        { title: "\u2699\uFE0F Modernisation Assigned to You", body: `${d.projectName || d.clientName || "Project"} modernisation job has been assigned to you.` },
        { type: "modernisation_assigned", docId: d.id || "", channel: "avant_assignments" }
      );
    }
    case "modernisation_completed": {
      const done = ["completed", "done"];
      if (!done.includes(d.status) || done.includes(b.status)) return;
      const tokens = await fs.byRole("admin");
      return fs.send(
        tokens,
        { title: "Modernisation Complete \u2713", body: `${d.projectName || d.clientName || "Job"} modernisation completed.` },
        { type, docId: d.id || "", channel: "avant_updates" }
      );
    }
    // ── Project Assignment ─────────────────────────────────────────────────
    case "project_assigned": {
      const newTechs = [d.assignedTechnician, d.installedBy, ...d.technicians || []].filter(Boolean);
      const oldTechs = [b.assignedTechnician, b.installedBy, ...b.technicians || []].filter(Boolean);
      const added = newTechs.filter((n) => !oldTechs.includes(n));
      if (!added.length) return;
      const tech = await fs.byNames(added);
      return fs.send(
        tech,
        { title: "\u{1F3D7}\uFE0F Project Assigned to You", body: `${d.projectName || d.clientName || "Project"} \u2014 ${d.projectType || d.type || "Project"} has been assigned to you.` },
        { type: "project_assigned", docId: d.id || "", channel: "avant_assignments" }
      );
    }
    // ── Maintenance ────────────────────────────────────────────────────────
    case "maintenance_created": {
      const names = [d.technicianName, d.assignedTo, d.assignedTechnician].filter(Boolean);
      const dateStr = d.scheduledDate ? ` on ${d.scheduledDate}` : "";
      const project = d.projectName || d.clientName || "Site";
      const [tech, admin] = await Promise.all([fs.byNames(names), fs.byRole("admin")]);
      if (tech.length) await fs.send(
        tech,
        { title: "\u{1F527} Maintenance Scheduled for You", body: `${project}${dateStr} \u2014 ${d.maintenanceType || "Routine"} maintenance.` },
        { type: "job_scheduled", docId: d.id || "", channel: "avant_assignments" }
      );
      return fs.send(
        admin,
        { title: "Maintenance Scheduled", body: `${project} \u2014 ${d.maintenanceType || "Maintenance"} scheduled${dateStr}.` },
        { type: "maintenance_scheduled", docId: d.id || "", channel: "avant_updates" }
      );
    }
    // ── AMC ────────────────────────────────────────────────────────────────
    case "amc_created": {
      const tokens = await fs.byRole("admin");
      return fs.send(
        tokens,
        { title: "New AMC Contract", body: `${d.clientName || "Client"} \u2014 ${d.contractNumber || ""} | Value: Rs.${Number(d.totalWithGST || d.contractValue || 0).toLocaleString("en-IN")}` },
        { type, docId: d.id || "", channel: "avant_updates" }
      );
    }
    case "amc_payment": {
      const prevLen = (b.paymentHistory || []).length;
      const newLen = (d.paymentHistory || []).length;
      if (newLen <= prevLen) return;
      const latest = d.paymentHistory[newLen - 1];
      const tokens = await fs.byRole("admin");
      return fs.send(
        tokens,
        { title: "AMC Payment Received \u{1F4B0}", body: `${d.clientName || "Client"} \u2014 Rs.${Number(latest?.amount || 0).toLocaleString("en-IN")} via ${latest?.method || "cash"}` },
        { type, docId: d.id || "", channel: "avant_updates" }
      );
    }
    // ── AMC Monthly Maintenance ────────────────────────────────────────────
    case "amc_monthly_log_created": {
      const tokens = await fs.byRole("admin");
      const loc = [d.buildingName, d.wingName, d.liftNo ? "Lift " + d.liftNo : ""].filter(Boolean).join(" \xB7 ");
      return fs.send(
        tokens,
        { title: "Maintenance Logged \u2713", body: `${d.clientName || "Contract"} \u2014 ${d.monthKey || ""}${loc ? " | " + loc : ""} by ${d.technician || d.completedBy || "Tech"}` },
        { type, docId: d.id || "", channel: "avant_updates" }
      );
    }
    case "amc_monthly_completed": {
      const done = ["completed", "done"];
      if (!done.includes(d.status) || done.includes(b.status)) return;
      const tokens = await fs.byRole("admin");
      return fs.send(
        tokens,
        { title: "Monthly Maintenance Done \u2713", body: `${d.projectName || d.clientName || "Maintenance"} completed by ${d.technician || d.assignedTo || "technician"}.` },
        { type, docId: d.id || "", channel: "avant_updates" }
      );
    }
    // ── Attendance ─────────────────────────────────────────────────────────
    case "attendance_created": {
      const tokens = await fs.byRole("admin");
      let timeStr = "\u2014";
      let isLate = false;
      if (d.checkInTime) {
        const t = d.checkInTime instanceof Date ? d.checkInTime : new Date(d.checkInTime);
        if (!isNaN(t)) {
          const istH = (t.getUTCHours() + 5) % 24;
          const istM = (t.getUTCMinutes() + 30) % 60;
          isLate = istH * 60 + istM > 10 * 60;
          timeStr = `${String(istH).padStart(2, "0")}:${String(istM).padStart(2, "0")}`;
        }
      }
      if (isLate) {
        return fs.send(
          tokens,
          { title: "\u23F0 Late Check-In", body: `${d.employeeName || "Employee"} checked in at ${timeStr} (late).` },
          { type: "attendance_late", docId: d.id || "", employeeId: d.employeeId || "", channel: "avant_alerts" }
        );
      }
      return fs.send(
        tokens,
        { title: "Employee Checked In", body: `${d.employeeName || "Employee"} checked in at ${timeStr}.` },
        { type: "attendance_checkin", docId: d.id || "", employeeId: d.employeeId || "", channel: "avant_general" }
      );
    }
    case "attendance_edited": {
      if (!b.adminEdited && d.adminEdited && d.employeeId) {
        const token2 = await fs.byId(d.employeeId);
        if (token2) return fs.send(
          [token2],
          { title: "Attendance Record Updated", body: `Your attendance for ${d.date || "a recent date"} was updated by admin.` },
          { type, docId: d.id || "", channel: "avant_updates" }
        );
      }
      break;
    }
    case "attendance_checkout": {
      if (b.checkOutTime || !d.checkOutTime) return;
      const tokens = await fs.byRole("admin");
      let timeStr = "\u2014";
      const t = d.checkOutTime instanceof Date ? d.checkOutTime : new Date(d.checkOutTime);
      if (!isNaN(t)) {
        const istH = (t.getUTCHours() + 5) % 24;
        const istM = (t.getUTCMinutes() + 30) % 60;
        timeStr = `${String(istH).padStart(2, "0")}:${String(istM).padStart(2, "0")}`;
      }
      return fs.send(
        tokens,
        { title: "Employee Checked Out", body: `${d.employeeName || "Employee"} checked out at ${timeStr}.` },
        { type, docId: d.id || "", channel: "avant_general" }
      );
    }
    // ── Quotations & Invoices ──────────────────────────────────────────────
    case "quotation_created": {
      const tokens = await fs.byRole("admin");
      return fs.send(
        tokens,
        { title: "New Quotation Created", body: `${d.clientName || "Client"} \u2014 ${d.docNumber || ""} | Rs.${Number(d.grandTotal || d.total || 0).toLocaleString("en-IN")}` },
        { type, docId: d.id || "", channel: "avant_updates" }
      );
    }
    case "proforma_created":
    case "tax_invoice_created":
    case "invoice_created": {
      const label = type === "proforma_created" ? "Proforma Invoice" : type === "tax_invoice_created" ? "Tax Invoice" : "Invoice";
      const tokens = await fs.byRole("admin");
      return fs.send(
        tokens,
        { title: `New ${label}`, body: `${d.clientName || "Client"} \u2014 ${d.docNumber || ""} | Rs.${Number(d.grandTotal || d.total || 0).toLocaleString("en-IN")}` },
        { type: "invoice_created", docId: d.id || "", channel: "avant_updates" }
      );
    }
    // ── BOM ────────────────────────────────────────────────────────────────
    case "bom_created": {
      const tokens = await fs.byRole("admin");
      return fs.send(
        tokens,
        { title: "New BOM Created", body: `${d.bomNumber || ""} \u2014 ${d.clientName || d.projectName || "Project"} | Items: ${(d.items || []).length}` },
        { type, docId: d.id || "", channel: "avant_updates" }
      );
    }
    // ── Salary Slips ───────────────────────────────────────────────────────
    case "salary_slip_created": {
      const empToken = d.employeeId ? await fs.byId(d.employeeId) : null;
      if (empToken) await fs.send(
        [empToken],
        { title: "Salary Slip Generated \u{1F4B5}", body: `Your salary slip for ${d.month || d.period || "the month"} is ready. Net Pay: Rs.${Number(d.netPay || 0).toLocaleString("en-IN")}` },
        { type: "salary_slip", docId: d.id || "", channel: "avant_updates" }
      );
      const hrTokens = await fs.byRole("admin", "hr");
      return fs.send(
        hrTokens,
        { title: "Salary Slip Created", body: `${d.employeeName || "Employee"} \u2014 ${d.month || d.period || ""} | Rs.${Number(d.netPay || 0).toLocaleString("en-IN")}` },
        { type: "salary_slip_admin", docId: d.id || "", channel: "avant_updates" }
      );
    }
    // ── Leave Requests ─────────────────────────────────────────────────────
    case "leave_created": {
      const tokens = await fs.byRole("admin", "hr");
      return fs.send(
        tokens,
        { title: "Leave Request Submitted", body: `${d.employeeName || "Employee"} \u2014 ${d.leaveType || "Leave"} from ${d.startDate || ""} to ${d.endDate || d.startDate || ""}` },
        { type, docId: d.id || "", channel: "avant_alerts" }
      );
    }
    case "leave_decision": {
      const decided = ["approved", "rejected"];
      if (!decided.includes(d.status) || decided.includes(b.status)) return;
      const empToken = d.employeeId ? await fs.byId(d.employeeId) : null;
      const nameTokens = d.employeeName ? await fs.byName(d.employeeName) : [];
      const all = [...empToken ? [empToken] : [], ...nameTokens];
      const approved = d.status === "approved";
      return fs.send(
        all,
        {
          title: approved ? "Leave Approved \u2713" : "Leave Rejected \u2717",
          body: `Your ${d.leaveType || "leave"} request (${d.startDate || ""}) has been ${d.status}.`
        },
        { type, docId: d.id || "", channel: approved ? "avant_updates" : "avant_alerts" }
      );
    }
    // ── Projects ───────────────────────────────────────────────────────────
    case "project_created": {
      const tokens = await fs.byRole("admin");
      return fs.send(
        tokens,
        { title: "New Project Added", body: `${d.projectName || d.name || "New Project"} \u2014 ${d.clientName || ""}` },
        { type, docId: d.id || "", channel: "avant_updates" }
      );
    }
    case "project_status_changed": {
      if (d.status === b.status) return;
      const tokens = await fs.byRole("admin");
      return fs.send(
        tokens,
        { title: `Project: ${d.status}`, body: `${d.projectName || d.name || "Project"} status changed to ${d.status}.` },
        { type: "project_status", docId: d.id || "", channel: "avant_updates" }
      );
    }
    // ── Purchase Orders ────────────────────────────────────────────────────
    case "po_created": {
      const tokens = await fs.byRole("admin");
      return fs.send(
        tokens,
        { title: "New Purchase Order", body: `PO ${d.poNumber || ""} \u2014 ${d.vendorName || d.vendor || "Vendor"} | Rs.${Number(d.total || d.grandTotal || 0).toLocaleString("en-IN")}` },
        { type, docId: d.id || "", channel: "avant_updates" }
      );
    }
    // ── Reconnect request ─────────────────────────────────────────────────
    case "reconnect_request": {
      if (!d.userId) return;
      const token2 = await fs.byId(d.userId);
      if (!token2) return;
      return fs.send(
        [token2],
        { title: "\u{1F4CD} Reconnect Location", body: `${d.requestedBy || "Admin"} has requested you to reconnect your location tracking.` },
        { type, route: "/tracking", channel: "avant_general", userId: d.userId }
      );
    }
    // ── Security alert ─────────────────────────────────────────────────────
    case "security_alert": {
      const tokens = await fs.byRole("admin");
      return fs.send(
        tokens,
        { title: "\u{1F6A8} Suspicious Activity Detected", body: `${d.failedVerifyAttempts || 0} failed verifications after ${d.deleteCount || 0} deletes. User: ${d.attemptedUsername || "Unknown"}.` },
        { type, alertId: d.alertId || "", channel: "avant_alerts" }
      );
    }
    default:
      console.warn("[notify] unknown event type:", type);
  }
}
function ok() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}

// worker/src/schedule.js
function todayIST() {
  return new Date(Date.now() + 5.5 * 36e5).toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  const d = /* @__PURE__ */ new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function toDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (val.toDate) return val.toDate();
  return new Date(val);
}
async function runAmcExpiryReminder(env) {
  const token = await getAccessToken(env);
  const pid = env.FIREBASE_PROJECT_ID;
  const today = /* @__PURE__ */ new Date();
  const docs = await queryEqual(token, pid, "amc", "status", "active");
  const tokens = await tokensByRole(token, pid, "admin", "sales");
  for (const amc of docs) {
    if (!amc.endDate) continue;
    const end = toDate(amc.endDate);
    if (!end) continue;
    const daysLeft = Math.ceil((end - today) / 864e5);
    if (![1, 7, 30].includes(daysLeft)) continue;
    const label = daysLeft === 1 ? "Tomorrow" : `In ${daysLeft} days`;
    await send(
      token,
      pid,
      tokens,
      { title: `\u26A0\uFE0F AMC Expiring ${label}`, body: `${amc.clientName || "Client"} \u2014 ${amc.contractNumber || ""} expires ${label.toLowerCase()}` },
      { type: "amc_expiry", docId: amc._id || "", daysLeft: String(daysLeft), channel: "avant_reminders" }
    );
  }
}
var FREQ_MONTHS = { monthly: 1, "bi-monthly": 2, quarterly: 3, "4-monthly": 4, "half-yearly": 6, yearly: 12 };
async function runAmcInstallmentReminder(env) {
  const token = await getAccessToken(env);
  const pid = env.FIREBASE_PROJECT_ID;
  const today = todayIST();
  const in3 = addDays(today, 3);
  const in7 = addDays(today, 7);
  const docs = await queryWhere(token, pid, "amc", {
    compositeFilter: {
      op: "AND",
      filters: [
        { fieldFilter: { field: { fieldPath: "paymentType" }, op: "EQUAL", value: { stringValue: "installments" } } },
        { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "active" } } }
      ]
    }
  });
  if (!docs.length) return;
  const tokens = await tokensByRole(token, pid, "admin", "sales");
  for (const c of docs) {
    const total = c.totalWithGST || c.contractValue || 0;
    const dur = c.durationMonths || 12;
    const freq = FREQ_MONTHS[c.frequency] || 3;
    const count = Math.max(1, Math.ceil(dur / freq));
    const amount = Math.round(total / count);
    const startDate = c.startDate ? /* @__PURE__ */ new Date(c.startDate + "T00:00:00Z") : null;
    const paid = (c.paymentHistory || []).length;
    for (let i = paid; i < count; i++) {
      if (!startDate) continue;
      const d = new Date(startDate);
      d.setUTCMonth(d.getUTCMonth() + i * freq);
      const dueStr = d.toISOString().slice(0, 10);
      if (dueStr !== in3 && dueStr !== in7) continue;
      const label = dueStr === in3 ? "3 days" : "7 days";
      await send(
        token,
        pid,
        tokens,
        { title: `\u{1F4B3} AMC Installment Due in ${label}`, body: `${c.clientName || "Client"} \u2014 Installment ${i + 1}/${count} of Rs.${amount.toLocaleString("en-IN")} due on ${dueStr}` },
        { type: "amc_installment_due", docId: c._id || "", installmentNo: String(i + 1), dueDate: dueStr, channel: "avant_reminders" }
      );
    }
  }
}
async function runMaintenanceReminder(env) {
  const token = await getAccessToken(env);
  const pid = env.FIREBASE_PROJECT_ID;
  const docs = await queryEqual(token, pid, "amcMonthlyMaintenance", "status", "pending");
  if (!docs.length) return;
  const byTech = {};
  docs.forEach((d) => {
    const tech = d.assignedTo || d.technician || "__unassigned__";
    (byTech[tech] = byTech[tech] || []).push(d);
  });
  for (const [techName, jobs] of Object.entries(byTech)) {
    if (techName === "__unassigned__") continue;
    const tkns = await tokensByUserName(token, pid, techName);
    const count = jobs.length;
    await send(
      token,
      pid,
      tkns,
      { title: "\u{1F527} Maintenance Jobs Due This Month", body: `You have ${count} AMC maintenance job${count > 1 ? "s" : ""} pending.` },
      { type: "maintenance_due", count: String(count), channel: "avant_reminders" }
    );
  }
  const adminTokens = await tokensByRole(token, pid, "admin");
  await send(
    token,
    pid,
    adminTokens,
    { title: "Monthly Maintenance Summary", body: `${docs.length} maintenance job${docs.length > 1 ? "s" : ""} pending this month.` },
    { type: "maintenance_summary", count: String(docs.length), channel: "avant_reminders" }
  );
}
async function runOverdueTasksReminder(env) {
  const token = await getAccessToken(env);
  const pid = env.FIREBASE_PROJECT_ID;
  const today = todayIST();
  const docs = await queryWhere(token, pid, "tasks", {
    fieldFilter: { field: { fieldPath: "dueDate" }, op: "LESS_THAN", value: { stringValue: today } }
  });
  const active = docs.filter((d) => !["completed", "done", "cancelled"].includes(d.status));
  if (!active.length) return;
  const byUser = {};
  active.forEach((d) => {
    const u = d.assignedTo || "";
    (byUser[u] = byUser[u] || []).push(d);
  });
  for (const [userName, tasks] of Object.entries(byUser)) {
    if (!userName) continue;
    const tkns = await tokensByUserName(token, pid, userName);
    const count = tasks.length;
    await send(
      token,
      pid,
      tkns,
      { title: `\u26A0\uFE0F ${count} Overdue Task${count > 1 ? "s" : ""}`, body: `You have ${count} overdue task${count > 1 ? "s" : ""} awaiting attention.` },
      { type: "overdue_tasks", count: String(count), channel: "avant_reminders" }
    );
  }
  const total = active.length;
  const adminTokens = await tokensByRole(token, pid, "admin");
  await send(
    token,
    pid,
    adminTokens,
    { title: "Overdue Tasks Summary", body: `${total} task${total > 1 ? "s are" : " is"} overdue across all team members.` },
    { type: "overdue_summary", count: String(total), channel: "avant_reminders" }
  );
}
async function runLeadFollowUpReminder(env) {
  const token = await getAccessToken(env);
  const pid = env.FIREBASE_PROJECT_ID;
  const today = todayIST();
  const docs = await queryWhere(token, pid, "leads", {
    compositeFilter: {
      op: "AND",
      filters: [
        { fieldFilter: { field: { fieldPath: "followUpDate" }, op: "EQUAL", value: { stringValue: today } } },
        { fieldFilter: { field: { fieldPath: "status" }, op: "NOT_EQUAL", value: { stringValue: "won" } } }
      ]
    }
  });
  const active = docs.filter((d) => !["won", "lost", "closed"].includes(d.status));
  if (!active.length) return;
  const byUser = {};
  active.forEach((d) => {
    const u = d.assignedTo || "__admin__";
    (byUser[u] = byUser[u] || []).push(d);
  });
  for (const [userName, leads] of Object.entries(byUser)) {
    const count = leads.length;
    const tkns = userName === "__admin__" ? await tokensByRole(token, pid, "admin", "sales") : await tokensByUserName(token, pid, userName);
    const names = leads.slice(0, 3).map((l) => l.clientName || "Lead").join(", ");
    await send(
      token,
      pid,
      tkns,
      { title: `\u{1F4DE} Follow-Up Due Today (${count})`, body: `${names}${count > 3 ? ` and ${count - 3} more` : ""}` },
      { type: "followup_reminder", count: String(count), channel: "avant_reminders" }
    );
  }
}
async function runInvoiceOverdueReminder(env) {
  const token = await getAccessToken(env);
  const pid = env.FIREBASE_PROJECT_ID;
  const today = todayIST();
  const tokens = await tokensByRole(token, pid, "admin", "sales");
  for (const coll of ["invoices", "taxInvoices", "proformaInvoices"]) {
    const docs = await queryWhere(token, pid, coll, {
      fieldFilter: { field: { fieldPath: "dueDate" }, op: "LESS_THAN", value: { stringValue: today } }
    });
    const overdue = docs.filter((d) => !["paid", "cancelled"].includes(d.status));
    if (!overdue.length) continue;
    const total = overdue.length;
    const amount = overdue.reduce((s, d) => s + (d.grandTotal || d.total || 0), 0);
    await send(
      token,
      pid,
      tokens,
      { title: `\u26A0\uFE0F ${total} Overdue Invoice${total > 1 ? "s" : ""}`, body: `Total outstanding: Rs.${amount.toLocaleString("en-IN")} across ${total} invoice${total > 1 ? "s" : ""}.` },
      { type: "invoice_overdue", count: String(total), amount: String(amount), collection: coll, channel: "avant_reminders" }
    );
  }
}
async function runPunchInReminder(env) {
  const token = await getAccessToken(env);
  const pid = env.FIREBASE_PROJECT_ID;
  const today = todayIST();
  const [employees, attDocs] = await Promise.all([
    getAll(token, pid, "employees"),
    queryEqual(token, pid, "attendance", "date", today)
  ]);
  const checkedInIds = new Set(attDocs.map((d) => d.employeeId || d.userId).filter(Boolean));
  const checkedInNames = new Set(attDocs.map((d) => d.employeeName).filter(Boolean));
  for (const emp of employees) {
    if (emp.status === "inactive") continue;
    if (emp.role === "admin") continue;
    if (checkedInIds.has(emp._id)) continue;
    if (checkedInNames.has(emp.fullName || emp.username)) continue;
    const tkn = await tokenByUserId(token, pid, emp._id);
    if (!tkn) continue;
    await send(
      token,
      pid,
      [tkn],
      { title: "\u23F0 Punch-In Reminder", body: "You haven't marked your attendance yet today. Please check in now." },
      { type: "punch_in_reminder", date: today, channel: "avant_reminders" }
    );
  }
}
async function runServiceScheduleReminder(env) {
  const token = await getAccessToken(env);
  const pid = env.FIREBASE_PROJECT_ID;
  const today = todayIST();
  const tomorrow = addDays(today, 1);
  const collMap = {
    repairActivities: "Repair",
    installationActivities: "Installation",
    modernisationActivities: "Modernisation"
  };
  for (const [coll, label] of Object.entries(collMap)) {
    const docs = await queryWhere(token, pid, coll, {
      compositeFilter: {
        op: "AND",
        filters: [
          { fieldFilter: { field: { fieldPath: "scheduledDate" }, op: "IN", value: { arrayValue: { values: [{ stringValue: today }, { stringValue: tomorrow }] } } } }
        ]
      }
    });
    const active = docs.filter((d) => !["completed", "done", "cancelled"].includes(d.status));
    for (const job of active) {
      const when = job.scheduledDate === today ? "Today" : "Tomorrow";
      const names = [job.assignedTo, job.assignedTechnician, job.technicianName].filter(Boolean);
      const [techTokens, adminTokens] = await Promise.all([
        tokensByUserNames(token, pid, names),
        tokensByRole(token, pid, "admin")
      ]);
      const body = `${when}: ${job.projectName || job.clientName || "Job"} \u2014 ${job.liftType || job.issueType || label}`;
      await send(
        token,
        pid,
        [...techTokens, ...adminTokens],
        { title: `\u{1F4C5} ${label} Scheduled ${when}`, body },
        { type: "job_scheduled", docId: job._id || "", collection: coll, channel: "avant_reminders" }
      );
    }
  }
}
async function runDailyPreventiveAlert(env) {
  const token = await getAccessToken(env);
  const pid = env.FIREBASE_PROJECT_ID;
  const now = new Date(Date.now() + 5.5 * 36e5);
  const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const [allAmc, logsThisMonth] = await Promise.all([
    queryWhere(token, pid, "amc", {
      fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "active" } }
    }),
    queryWhere(token, pid, "amcMonthlyMaintenance", {
      fieldFilter: { field: { fieldPath: "monthKey" }, op: "EQUAL", value: { stringValue: monthKey } }
    })
  ]);
  const doneIds = new Set(logsThisMonth.map((l) => l.contractId).filter(Boolean));
  for (const amc of allAmc) {
    if (doneIds.has(amc._id)) continue;
    const techNames = [amc.technician, ...amc.technicians || []].filter(Boolean);
    if (!techNames.length) continue;
    const techTokens = await tokensByUserNames(token, pid, techNames);
    if (!techTokens.length) continue;
    const client = amc.clientName || "Client";
    const contractNo = amc.contractNumber || "";
    const freq = amc.frequency || "monthly";
    await send(
      token,
      pid,
      techTokens,
      {
        title: `\u{1F527} Preventive Maintenance Due \u2014 ${client}`,
        body: `${contractNo ? contractNo + " \xB7 " : ""}${freq} maintenance pending for ${client}. Please log your visit today.`
      },
      { type: "preventive_maintenance_due", docId: amc._id || "", monthKey, channel: "avant_reminders" }
    );
  }
}

// worker/src/index.js
var index_default = {
  // ── HTTP requests ───────────────────────────────────────────────────────────
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-API-Key"
        }
      });
    }
    if (method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    const key = request.headers.get("X-API-Key") || "";
    if (!env.WORKER_SECRET || key !== env.WORKER_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (url.pathname === "/notify") return handleNotify(request, env);
    return new Response("Not Found", { status: 404 });
  },
  // ── Cron triggers ───────────────────────────────────────────────────────────
  async scheduled(controller, env, ctx) {
    const { cron } = controller;
    console.log("[cron] trigger:", cron);
    const run = (fn) => ctx.waitUntil(fn(env).catch((e) => console.error("[cron] error:", e.message)));
    if (cron === "0 2 * * *") {
      run(runServiceScheduleReminder);
      run(runOverdueTasksReminder);
      run(runLeadFollowUpReminder);
      return;
    }
    if (cron === "30 2 1 * *") {
      run(runMaintenanceReminder);
      return;
    }
    if (cron === "30 3 * * *") {
      run(runAmcExpiryReminder);
      run(runAmcInstallmentReminder);
      return;
    }
    if (cron === "0 4 * * *") {
      run(runInvoiceOverdueReminder);
      run(runPunchInReminder);
      return;
    }
    if (cron === "30 4 * * *") {
      run(runDailyPreventiveAlert);
      return;
    }
    console.warn("[cron] unrecognised cron expression:", cron);
  }
};
export {
  index_default as default
};
