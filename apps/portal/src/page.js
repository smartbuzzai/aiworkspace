// ═══════════════════════════════════════════════════════════════
//  Portal page — server-rendered HTML shell + client-side JS
// ═══════════════════════════════════════════════════════════════

function esc(s) {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function errorPage(title, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;800&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'DM Sans', system-ui, sans-serif; background: #f8fafc; color: #1e293b; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 48px 40px; max-width: 440px; width: 100%; margin: 20px; text-align: center; }
.icon { font-size: 40px; margin-bottom: 20px; }
h1 { font-size: 22px; font-weight: 800; margin-bottom: 10px; }
p { font-size: 14px; color: #64748b; line-height: 1.6; }
</style>
</head>
<body>
<div class="card">
  <div class="icon">🔒</div>
  <h1>${esc(title)}</h1>
  <p>${esc(message)}</p>
</div>
</body>
</html>`;
}

export function portalPage(project, share, token) {
  const basePath = `/portal/${token}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(project.name)} — Project Portal</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'DM Sans', system-ui, sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; }
a { color: #2563eb; text-decoration: none; }

.container { max-width: 800px; margin: 0 auto; padding: 24px 20px 60px; }

/* Header */
.header { text-align: center; padding: 48px 0 32px; }
.header .dot { width: 14px; height: 14px; border-radius: 50%; display: inline-block; margin-bottom: 12px; }
.header h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 6px; }
.header .desc { color: #64748b; font-size: 14px; max-width: 500px; margin: 0 auto; }
.header .meta { margin-top: 16px; display: flex; justify-content: center; gap: 20px; font-size: 13px; color: #64748b; }
.header .meta .badge { background: #f1f5f9; padding: 4px 12px; border-radius: 20px; font-weight: 600; font-size: 12px; }
.welcome { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px 20px; margin-bottom: 24px; text-align: center; font-size: 13px; color: #64748b; }
.welcome strong { color: #1e293b; }

/* Progress bar */
.progress-wrap { background: white; border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; margin-bottom: 24px; }
.progress-label { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; margin-bottom: 8px; }
.progress-bar { background: #f1f5f9; border-radius: 8px; height: 8px; overflow: hidden; }
.progress-fill { height: 100%; border-radius: 8px; transition: width 0.5s ease; }
.stats-row { display: flex; gap: 16px; margin-top: 12px; }
.stat { font-size: 12px; color: #64748b; }
.stat strong { color: #1e293b; font-size: 18px; display: block; }

/* Tabs */
.tabs { display: flex; border-bottom: 2px solid #e2e8f0; margin-bottom: 20px; gap: 0; }
.tab { flex: 1; padding: 12px; text-align: center; font-size: 13px; font-weight: 600; cursor: pointer; border: none; background: none; color: #64748b; border-bottom: 2px solid transparent; margin-bottom: -2px; font-family: inherit; transition: all 0.2s; }
.tab:hover { color: #1e293b; }
.tab.active { color: #2563eb; border-bottom-color: #2563eb; }
.tab .count { background: #f1f5f9; padding: 2px 8px; border-radius: 10px; font-size: 11px; margin-left: 6px; }

/* Cards */
.card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px; transition: border-color 0.2s; }
.card:hover { border-color: #cbd5e1; }
.card-title { font-size: 14px; font-weight: 700; color: #0f172a; }
.card-meta { font-size: 12px; color: #94a3b8; margin-top: 4px; display: flex; gap: 12px; align-items: center; }
.card-desc { font-size: 13px; color: #475569; margin-top: 8px; }

/* Status badges */
.status { font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
.status-open { background: #f1f5f9; color: #475569; }
.status-in_progress { background: #dbeafe; color: #1d4ed8; }
.status-done { background: #dcfce7; color: #15803d; }
.priority-high { color: #dc2626; }
.priority-medium { color: #d97706; }
.priority-low { color: #64748b; }

/* Updates */
.update-body { font-size: 13px; color: #334155; white-space: pre-wrap; line-height: 1.7; }
.update-date { font-size: 11px; color: #94a3b8; margin-top: 8px; }

/* Comments */
.comment { padding: 12px 16px; border-radius: 12px; margin-bottom: 8px; }
.comment-client { background: white; border: 1px solid #e2e8f0; margin-right: 40px; }
.comment-owner { background: #eff6ff; border: 1px solid #bfdbfe; margin-left: 40px; }
.comment-author { font-size: 11px; font-weight: 700; color: #475569; margin-bottom: 4px; }
.comment-author span { font-weight: 400; color: #94a3b8; margin-left: 8px; }
.comment-body { font-size: 13px; color: #334155; white-space: pre-wrap; }

.comment-form { display: flex; gap: 8px; margin-top: 16px; }
.comment-input { flex: 1; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 13px; font-family: inherit; outline: none; resize: none; }
.comment-input:focus { border-color: #93c5fd; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
.comment-btn { background: #2563eb; color: white; border: none; padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
.comment-btn:hover { background: #1d4ed8; }
.comment-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.empty { text-align: center; color: #94a3b8; padding: 32px; font-size: 13px; }

.footer { text-align: center; padding: 40px 0 20px; font-size: 11px; color: #94a3b8; }

@media (max-width: 640px) {
  .container { padding: 16px 14px 40px; }
  .header { padding: 32px 0 20px; }
  .header h1 { font-size: 22px; }
  .stats-row { flex-wrap: wrap; }
  .comment-owner { margin-left: 20px; }
  .comment-client { margin-right: 20px; }
}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="dot" style="background:${esc(project.color)}"></div>
    <h1>${esc(project.name)}</h1>
    ${project.description ? `<div class="desc">${esc(project.description)}</div>` : ""}
    <div class="meta">
      <span class="badge">${esc(stageLabel(project.stage))}</span>
      ${project.due_date ? `<span>Due ${new Date(project.due_date).toLocaleDateString()}</span>` : ""}
    </div>
  </div>

  ${share.client_name ? `<div class="welcome">Welcome, <strong>${esc(share.client_name)}</strong></div>` : ""}

  <div class="progress-wrap">
    <div class="progress-label">
      <span>Progress</span>
      <span id="progress-pct">${project.progress}%</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" id="progress-fill" style="width:${project.progress}%;background:${esc(project.color)}"></div>
    </div>
    <div class="stats-row" id="stats-row">
      <div class="stat"><strong id="stat-total">-</strong> Tasks</div>
      <div class="stat"><strong id="stat-done">-</strong> Completed</div>
    </div>
  </div>

  <div class="tabs">
    <button class="tab active" data-tab="tasks">Tasks <span class="count" id="tab-tasks-count">0</span></button>
    <button class="tab" data-tab="updates">Updates <span class="count" id="tab-updates-count">0</span></button>
    <button class="tab" data-tab="comments">Discussion <span class="count" id="tab-comments-count">0</span></button>
  </div>

  <div id="panel-tasks"></div>
  <div id="panel-updates" style="display:none"></div>
  <div id="panel-comments" style="display:none"></div>
</div>

<div class="footer">Powered by Workspace</div>

<script>
(function() {
  const BASE = "${basePath}/api";
  const PERMS = "${esc(share.permissions)}";
  let currentTab = "tasks";

  // ─── Tabs ──────────────────────────────────────────────────
  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.dataset.tab;
      currentTab = tab;
      ["tasks","updates","comments"].forEach(t => {
        document.getElementById("panel-" + t).style.display = t === tab ? "" : "none";
      });
    });
  });

  // ─── Fetch helpers ─────────────────────────────────────────
  async function api(path) {
    const r = await fetch(BASE + path);
    return r.json();
  }

  function timeAgo(iso) {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s/60) + "m ago";
    if (s < 86400) return Math.floor(s/3600) + "h ago";
    return Math.floor(s/86400) + "d ago";
  }

  const statusClass = s => "status status-" + s;
  const statusLabel = s => ({open:"To Do",in_progress:"In Progress",done:"Done"})[s] || s;

  // ─── Load overview ─────────────────────────────────────────
  api("/overview").then(d => {
    const total = d.stats.visible_tasks;
    const done = d.stats.completed_tasks;
    const pct = total > 0 ? Math.round((done/total)*100) : 0;
    document.getElementById("progress-pct").textContent = pct + "%";
    document.getElementById("progress-fill").style.width = pct + "%";
    document.getElementById("stat-total").textContent = total;
    document.getElementById("stat-done").textContent = done;
  });

  // ─── Load tasks ────────────────────────────────────────────
  api("/tasks").then(d => {
    const el = document.getElementById("panel-tasks");
    document.getElementById("tab-tasks-count").textContent = d.tasks.length;
    if (!d.tasks.length) { el.innerHTML = '<div class="empty">No shared tasks yet.</div>'; return; }
    el.innerHTML = d.tasks.map(t => \`
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <div class="card-title">\${esc(t.title)}</div>
          <span class="\${statusClass(t.status)}">\${statusLabel(t.status)}</span>
        </div>
        <div class="card-meta">
          <span class="priority-\${t.priority}">\${t.priority} priority</span>
          \${t.due_at ? '<span>Due ' + new Date(t.due_at).toLocaleDateString() + '</span>' : ''}
        </div>
        \${t.description ? '<div class="card-desc">' + esc(t.description) + '</div>' : ''}
      </div>
    \`).join("");
  });

  // ─── Load updates ──────────────────────────────────────────
  api("/updates").then(d => {
    const el = document.getElementById("panel-updates");
    document.getElementById("tab-updates-count").textContent = d.updates.length;
    if (!d.updates.length) { el.innerHTML = '<div class="empty">No updates published yet.</div>'; return; }
    el.innerHTML = d.updates.map(u => \`
      <div class="card">
        <div class="card-title">\${esc(u.title || "Update")}</div>
        <div class="update-body">\${esc(u.body)}</div>
        <div class="update-date">\${new Date(u.published_at).toLocaleDateString("en-US", {month:"long",day:"numeric",year:"numeric"})}</div>
      </div>
    \`).join("");
  });

  // ─── Load comments ─────────────────────────────────────────
  function loadComments() {
    api("/comments").then(d => {
      const el = document.getElementById("panel-comments");
      document.getElementById("tab-comments-count").textContent = d.comments.length;
      let html = d.comments.map(c => \`
        <div class="comment comment-\${c.author_type}">
          <div class="comment-author">\${esc(c.author_name || c.author_type)}<span>\${timeAgo(c.created_at)}</span></div>
          <div class="comment-body">\${esc(c.body)}</div>
        </div>
      \`).join("");
      if (!d.comments.length) html = '<div class="empty">No discussion yet. Be the first to comment.</div>';
      if (PERMS === "comment") {
        html += \`
          <div class="comment-form">
            <textarea class="comment-input" id="comment-input" placeholder="Write a comment..." rows="2"></textarea>
            <button class="comment-btn" id="comment-btn" onclick="submitComment()">Send</button>
          </div>\`;
      }
      el.innerHTML = html;
    });
  }
  loadComments();

  window.submitComment = async function() {
    const input = document.getElementById("comment-input");
    const btn = document.getElementById("comment-btn");
    const body = input.value.trim();
    if (!body) return;
    btn.disabled = true;
    btn.textContent = "Sending...";
    try {
      await fetch(BASE + "/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body })
      });
      loadComments();
    } finally {
      btn.disabled = false;
      btn.textContent = "Send";
    }
  };

  function esc(s) {
    if (!s) return "";
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
})();
</script>
</body>
</html>`;
}

function stageLabel(s) {
  return { backlog: "Backlog", discovery: "Discovery", in_progress: "In Progress", review: "Review", done: "Done" }[s] || s;
}
