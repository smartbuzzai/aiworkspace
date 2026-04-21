"use client";

// ═══════════════════════════════════════════════════════════════
//  Settings — email accounts, push notifications, account info
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import {
  Mail, Plus, Trash2, CheckCircle2, AlertCircle, Bell, BellOff,
  ChevronRight, X, Eye, EyeOff, RefreshCw
} from "lucide-react";

const theme = {
  navy950:"#0a0f1e", navy900:"#0f172a", navy800:"#1e293b",
  navy700:"#334155", navy600:"#475569", navy500:"#64748b",
  navy400:"#94a3b8", navy300:"#cbd5e1", navy200:"#e2e8f0",
  navy100:"#f1f5f9", navy50:"#f8fafc",
  blue600:"#2563eb", blue500:"#3b82f6",
  green500:"#10b981", red500:"#ef4444", amber500:"#f59e0b",
  white:"#ffffff"
};

export default function Settings({ user }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, maxWidth:720 }}>
      <AccountSection user={user} />
      <EmailAccountsSection />
      <PushSection />
    </div>
  );
}

// ─── Account info ────────────────────────────────────────────
function AccountSection({ user }) {
  return (
    <Card title="Your account">
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <Field label="Email" value={user.email} />
        <Field label="Name" value={user.name || "—"} />
        <Field label="Timezone" value={user.timezone || "UTC"} />
      </div>
    </Card>
  );
}

// ─── Email accounts ──────────────────────────────────────────
function EmailAccountsSection() {
  const [accounts, setAccounts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/accounts", { credentials:"include" });
      const d = await r.json();
      setAccounts(d.accounts || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function remove(id) {
    if (!confirm("Remove this email account? Past messages stay in the database.")) return;
    await fetch(`/api/accounts/${id}`, { method:"DELETE", credentials:"include" });
    refresh();
  }

  return (
    <Card title="Email accounts" action={
      <button onClick={() => setShowAdd(true)} style={btnPrimary()}>
        <Plus size={13} /> Add account
      </button>
    }>
      {loading ? (
        <div style={{ color:theme.navy500, fontSize:13 }}>Loading…</div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No email accounts connected"
          body="Connect IMAP/SMTP to start syncing your inbox. Gmail, Outlook, Fastmail, ProtonMail Bridge, and iCloud all work."
        />
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {accounts.map(a => (
            <div key={a.id} style={{
              display:"flex", alignItems:"center", gap:12,
              padding:14, border:`1px solid ${theme.navy200}`,
              borderRadius:10, background:theme.navy50
            }}>
              <div style={{
                width:36, height:36, borderRadius:9,
                background: a.sync_status === "error"
                  ? "rgba(239,68,68,0.1)"
                  : "rgba(59,130,246,0.1)",
                display:"flex", alignItems:"center", justifyContent:"center"
              }}>
                <Mail size={16} color={a.sync_status === "error" ? theme.red500 : theme.blue500} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600, color:theme.navy900 }}>
                  {a.label} <span style={{ color:theme.navy500, fontWeight:500 }}>· {a.email_address}</span>
                </div>
                <div style={{ fontSize:11, color:theme.navy500, marginTop:2, fontFamily:"'JetBrains Mono', monospace" }}>
                  {a.sync_status === "error"
                    ? <span style={{ color:theme.red500 }}>Error: {a.sync_error}</span>
                    : a.last_sync_at
                      ? `Last sync ${new Date(a.last_sync_at).toLocaleTimeString()}`
                      : "Waiting for first sync"}
                </div>
              </div>
              <button onClick={() => remove(a.id)} style={{
                background:"transparent", border:"none", padding:8,
                color:theme.navy500, cursor:"pointer"
              }}><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddAccountModal onClose={() => setShowAdd(false)} onSaved={() => { refresh(); setShowAdd(false); }} />}
    </Card>
  );
}

function AddAccountModal({ onClose, onSaved }) {
  const [presets, setPresets] = useState({});
  const [provider, setProvider] = useState("gmail");
  const [showPass, setShowPass] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [form, setForm] = useState({
    label: "Work",
    email_address: "",
    imap_host: "imap.gmail.com",
    imap_port: 993,
    imap_user: "",
    imap_pass: "",
    smtp_host: "smtp.gmail.com",
    smtp_port: 465,
    smtp_user: "",
    smtp_pass: ""
  });

  useEffect(() => {
    fetch("/api/accounts/presets", { credentials:"include" })
      .then(r => r.json())
      .then(d => setPresets(d.presets || {}));
  }, []);

  function selectProvider(key) {
    setProvider(key);
    const p = presets[key];
    if (p) setForm(f => ({ ...f, ...p }));
  }

  function set(k, v) {
    setForm(f => {
      const next = { ...f, [k]: v };
      // Auto-populate user fields from email if empty
      if (k === "email_address") {
        if (!next.imap_user) next.imap_user = v;
        if (!next.smtp_user) next.smtp_user = v;
      }
      return next;
    });
  }

  async function test() {
    setTesting(true); setError(null); setSuccess(null);
    try {
      const r = await fetch("/api/accounts/test", {
        method:"POST", credentials:"include",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(form)
      });
      const d = await r.json();
      if (!r.ok) setError(d.error || "Test failed");
      else setSuccess("Connection verified");
    } catch (err) { setError(err.message); }
    finally { setTesting(false); }
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      const r = await fetch("/api/accounts", {
        method:"POST", credentials:"include",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(form)
      });
      const d = await r.json();
      if (!r.ok) setError(d.error || "Failed to save");
      else onSaved();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(10,15,30,0.55)",
      zIndex:90, display:"flex", alignItems:"center", justifyContent:"center",
      padding:20, backdropFilter:"blur(4px)"
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:theme.white, borderRadius:16, width:"100%", maxWidth:520,
        maxHeight:"90vh", overflow:"auto",
        border:`1px solid ${theme.navy200}`
      }}>
        <div style={{
          padding:"18px 20px", borderBottom:`1px solid ${theme.navy200}`,
          display:"flex", alignItems:"center", gap:10
        }}>
          <Mail size={18} color={theme.blue500} />
          <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:theme.navy900 }}>Add email account</h3>
          <button onClick={onClose} style={{
            marginLeft:"auto", background:"transparent", border:"none",
            color:theme.navy500, cursor:"pointer", padding:4
          }}><X size={16} /></button>
        </div>

        <div style={{ padding:20, display:"flex", flexDirection:"column", gap:14 }}>
          {/* Provider presets */}
          <div>
            <Label>Provider</Label>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {Object.keys(presets).map(key => (
                <button key={key} onClick={() => selectProvider(key)} style={{
                  padding:"6px 11px", fontSize:12, fontWeight:600,
                  textTransform:"capitalize", cursor:"pointer",
                  borderRadius:7, fontFamily:"inherit",
                  background: provider === key ? theme.navy900 : theme.navy50,
                  color: provider === key ? theme.white : theme.navy700,
                  border: `1px solid ${provider === key ? theme.navy900 : theme.navy200}`
                }}>{key}</button>
              ))}
            </div>
          </div>

          <TextField label="Label" value={form.label} onChange={v => set("label", v)} placeholder="Work" />
          <TextField label="Email address" type="email" value={form.email_address}
                     onChange={v => set("email_address", v)} placeholder="you@example.com" />

          <div style={{
            padding:12, borderRadius:10,
            background:theme.navy50, border:`1px solid ${theme.navy200}`
          }}>
            <div style={{ fontSize:11, fontWeight:700, color:theme.navy600, textTransform:"uppercase", letterSpacing:0.8, marginBottom:10 }}>
              IMAP (incoming)
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10 }}>
              <TextField label="Host" value={form.imap_host} onChange={v => set("imap_host", v)} />
              <TextField label="Port" type="number" value={form.imap_port}
                         onChange={v => set("imap_port", Number(v))} />
            </div>
            <TextField label="Username" value={form.imap_user} onChange={v => set("imap_user", v)} />
            <PasswordField label="Password / App password" value={form.imap_pass}
                           onChange={v => set("imap_pass", v)}
                           show={showPass} onToggle={() => setShowPass(!showPass)} />
          </div>

          <div style={{
            padding:12, borderRadius:10,
            background:theme.navy50, border:`1px solid ${theme.navy200}`
          }}>
            <div style={{ fontSize:11, fontWeight:700, color:theme.navy600, textTransform:"uppercase", letterSpacing:0.8, marginBottom:10 }}>
              SMTP (outgoing)
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:10 }}>
              <TextField label="Host" value={form.smtp_host} onChange={v => set("smtp_host", v)} />
              <TextField label="Port" type="number" value={form.smtp_port}
                         onChange={v => set("smtp_port", Number(v))} />
            </div>
            <TextField label="Username" value={form.smtp_user} onChange={v => set("smtp_user", v)} />
            <PasswordField label="Password / App password" value={form.smtp_pass}
                           onChange={v => set("smtp_pass", v)}
                           show={showPass} onToggle={() => setShowPass(!showPass)} />
          </div>

          {error && (
            <div style={{
              background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.25)",
              color:theme.red500, padding:"10px 12px", borderRadius:9, fontSize:12,
              display:"flex", gap:8, alignItems:"flex-start"
            }}>
              <AlertCircle size={14} style={{ flexShrink:0, marginTop:1 }} /> {error}
            </div>
          )}
          {success && (
            <div style={{
              background:"rgba(16,185,129,0.08)", border:"1px solid rgba(16,185,129,0.25)",
              color:theme.green500, padding:"10px 12px", borderRadius:9, fontSize:12,
              display:"flex", gap:8, alignItems:"center"
            }}>
              <CheckCircle2 size={14} /> {success}
            </div>
          )}

          <div style={{ display:"flex", gap:8, marginTop:4 }}>
            <button onClick={test} disabled={testing || saving} style={{
              ...btnSecondary(), flex:1, justifyContent:"center",
              opacity: (testing || saving) ? 0.6 : 1
            }}>
              {testing ? <RefreshCw size={13} className="spin" /> : "Test connection"}
            </button>
            <button onClick={save} disabled={saving || testing} style={{
              ...btnPrimary(), flex:1, justifyContent:"center",
              opacity: (saving || testing) ? 0.6 : 1
            }}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>

          <div style={{ fontSize:11, color:theme.navy500, lineHeight:1.5 }}>
            <strong>Gmail:</strong> use an App Password — not your main password —
            from Google Account → Security → 2FA → App passwords.
            <br /><strong>Outlook:</strong> same pattern. <strong>ProtonMail:</strong> requires Bridge running on localhost.
          </div>
        </div>
      </div>

      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Push notifications ──────────────────────────────────────
function PushSection() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    const ok = "serviceWorker" in navigator && "PushManager" in window;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  async function enable() {
    setWorking(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      const { public_key } = await fetch("/api/push/vapid", { credentials:"include" }).then(r => r.json());
      if (!public_key) throw new Error("Push not configured on server");

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key)
      });
      await fetch("/api/push/subscribe", {
        method:"POST", credentials:"include",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(sub)
      });
      setSubscribed(true);
    } catch (err) {
      alert("Could not enable: " + err.message);
    } finally {
      setWorking(false);
    }
  }

  async function disable() {
    setWorking(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method:"POST", credentials:"include",
          headers:{ "Content-Type":"application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint })
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card title="Notifications">
      {!supported ? (
        <div style={{ fontSize:13, color:theme.navy500 }}>
          Your browser doesn't support web push.
        </div>
      ) : (
        <div style={{
          display:"flex", alignItems:"center", gap:12,
          padding:14, borderRadius:10, background:theme.navy50,
          border:`1px solid ${theme.navy200}`
        }}>
          <div style={{
            width:36, height:36, borderRadius:9,
            background: subscribed ? "rgba(16,185,129,0.1)" : "rgba(100,116,139,0.08)",
            display:"flex", alignItems:"center", justifyContent:"center"
          }}>
            {subscribed ? <Bell size={16} color={theme.green500} /> : <BellOff size={16} color={theme.navy500} />}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:600, color:theme.navy900 }}>
              {subscribed ? "Push notifications enabled" : "Push notifications off"}
            </div>
            <div style={{ fontSize:12, color:theme.navy500, marginTop:2 }}>
              Daily briefings, meeting reminders, and high-priority emails.
            </div>
          </div>
          <button onClick={subscribed ? disable : enable} disabled={working}
            style={subscribed ? btnSecondary() : btnPrimary()}>
            {working ? "…" : subscribed ? "Disable" : "Enable"}
          </button>
        </div>
      )}
    </Card>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
function urlBase64ToUint8Array(b64) {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function Card({ title, action, children }) {
  return (
    <div style={{
      background:theme.white, border:`1px solid ${theme.navy200}`,
      borderRadius:14, padding:18
    }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <h3 style={{ margin:0, fontSize:14, fontWeight:700, color:theme.navy900, letterSpacing:"-0.2px" }}>{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div style={{
      background:theme.navy50, border:`1px solid ${theme.navy200}`,
      borderRadius:9, padding:10
    }}>
      <div style={{ fontSize:10, color:theme.navy500, textTransform:"uppercase", letterSpacing:0.5 }}>{label}</div>
      <div style={{ fontSize:13, color:theme.navy900, fontWeight:500, marginTop:3 }}>{value}</div>
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontSize:11, fontWeight:600, color:theme.navy600,
      textTransform:"uppercase", letterSpacing:0.5, marginBottom:6
    }}>{children}</div>
  );
}

function TextField({ label, value, onChange, type="text", placeholder }) {
  return (
    <div style={{ marginBottom:8 }}>
      <Label>{label}</Label>
      <input type={type} value={value}
        onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{
          width:"100%", padding:"8px 11px", fontSize:13,
          border:`1px solid ${theme.navy200}`, borderRadius:8,
          outline:"none", fontFamily:"inherit", color:theme.navy900,
          background:theme.white, boxSizing:"border-box"
        }}
      />
    </div>
  );
}

function PasswordField({ label, value, onChange, show, onToggle }) {
  return (
    <div style={{ marginBottom:2 }}>
      <Label>{label}</Label>
      <div style={{ position:"relative" }}>
        <input type={show ? "text" : "password"} value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width:"100%", padding:"8px 36px 8px 11px", fontSize:13,
            border:`1px solid ${theme.navy200}`, borderRadius:8,
            outline:"none", fontFamily:"inherit", color:theme.navy900,
            background:theme.white, boxSizing:"border-box"
          }}
        />
        <button type="button" onClick={onToggle} style={{
          position:"absolute", right:6, top:"50%", transform:"translateY(-50%)",
          background:"transparent", border:"none", padding:6,
          color:theme.navy500, cursor:"pointer"
        }}>
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div style={{
      padding:"24px 16px", textAlign:"center",
      border:`1px dashed ${theme.navy200}`, borderRadius:10
    }}>
      <Icon size={26} color={theme.navy400} style={{ marginBottom:10 }} />
      <div style={{ fontSize:14, fontWeight:600, color:theme.navy800 }}>{title}</div>
      <div style={{ fontSize:12, color:theme.navy500, marginTop:6, lineHeight:1.5, maxWidth:380, margin:"6px auto 0" }}>
        {body}
      </div>
    </div>
  );
}

const btnPrimary = () => ({
  display:"inline-flex", alignItems:"center", gap:6,
  background: theme.blue600, color: theme.white, border:"none",
  padding:"7px 12px", borderRadius:8, fontSize:12, fontWeight:600,
  cursor:"pointer", fontFamily:"inherit"
});

const btnSecondary = () => ({
  display:"inline-flex", alignItems:"center", gap:6,
  background: theme.white, color: theme.navy800,
  border: `1px solid ${theme.navy200}`,
  padding:"7px 12px", borderRadius:8, fontSize:12, fontWeight:600,
  cursor:"pointer", fontFamily:"inherit"
});
