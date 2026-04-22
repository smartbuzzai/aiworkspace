"use client";

// ═══════════════════════════════════════════════════════════════
//  Settings — email accounts, push notifications, account info
// ═══════════════════════════════════════════════════════════════

import { useEffect, useState, type ReactNode } from "react";
import {
  Mail, Plus, Trash2, CheckCircle2, AlertCircle, Bell, BellOff,
  ChevronRight, X, Eye, EyeOff, RefreshCw, Monitor, Smartphone, Globe, LogOut,
  type LucideIcon,
} from "lucide-react";

import { cn } from "../lib/cn";
import type { User } from "../lib/types";

// ─── Interfaces ──────────────────────────────────────────────

interface SettingsProps {
  user: User;
}

interface EmailAccount {
  id: string;
  label: string;
  email_address: string;
  sync_status: string;
  sync_error: string | null;
  last_sync_at: string | null;
  is_active: boolean;
}

interface AddAccountModalProps {
  onClose: () => void;
  onSaved: () => void;
}

interface Session {
  id: string;
  ip: string;
  user_agent: string;
  is_current: boolean;
  last_seen_at: string;
  created_at: string;
}

interface CardProps {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}

interface FieldProps {
  label: string;
  value: string;
}

interface TextFieldProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body: string;
}

// ─── Button class constants ─────────────────────────────────

const btnPrimary =
  "inline-flex items-center gap-1.5 bg-blue-600 text-white border-none px-3 py-[7px] rounded-lg text-xs font-semibold cursor-pointer font-[inherit]";

const btnSecondary =
  "inline-flex items-center gap-1.5 bg-white text-navy-800 border border-navy-200 px-3 py-[7px] rounded-lg text-xs font-semibold cursor-pointer font-[inherit]";

// ─── Main ────────────────────────────────────────────────────

export default function Settings({ user }: SettingsProps) {
  return (
    <div className="flex flex-col gap-4 max-w-[720px]">
      <AccountSection user={user} />
      <EmailAccountsSection />
      <SessionsSection />
      <PushSection />
    </div>
  );
}

// ─── Account info ────────────────────────────────────────────
function AccountSection({ user }: SettingsProps) {
  return (
    <Card title="Your account">
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Email" value={user.email} />
        <Field label="Name" value={user.name || "—"} />
        <Field label="Timezone" value={user.timezone || "UTC"} />
      </div>
    </Card>
  );
}

// ─── Email accounts ──────────────────────────────────────────
function EmailAccountsSection() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [showAdd, setShowAdd] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/accounts", { credentials: "include" });
      const d = await r.json();
      setAccounts(d.accounts || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function remove(id: string) {
    if (!confirm("Remove this email account? Past messages stay in the database.")) return;
    await fetch(`/api/accounts/${id}`, { method: "DELETE", credentials: "include" });
    refresh();
  }

  return (
    <Card title="Email accounts" action={
      <button onClick={() => setShowAdd(true)} className={btnPrimary}>
        <Plus size={13} /> Add account
      </button>
    }>
      {loading ? (
        <div className="text-navy-500 text-[13px]">Loading…</div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No email accounts connected"
          body="Connect IMAP/SMTP to start syncing your inbox. Gmail, Outlook, Fastmail, ProtonMail Bridge, and iCloud all work."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center gap-3 p-3.5 border border-navy-200 rounded-[10px] bg-navy-50">
              <div className={cn(
                "w-9 h-9 rounded-[9px] flex items-center justify-center",
                a.sync_status === "error" ? "bg-red-500/10" : "bg-blue-500/10"
              )}>
                <Mail size={16} className={a.sync_status === "error" ? "text-red-500" : "text-blue-500"} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-navy-900">
                  {a.label} <span className="text-navy-500 font-medium">· {a.email_address}</span>
                </div>
                <div className="text-[11px] text-navy-500 mt-0.5 font-mono">
                  {a.sync_status === "error"
                    ? <span className="text-red-500">Error: {a.sync_error}</span>
                    : a.last_sync_at
                      ? `Last sync ${new Date(a.last_sync_at).toLocaleTimeString()}`
                      : "Waiting for first sync"}
                </div>
              </div>
              <button onClick={() => remove(a.id)} className="bg-transparent border-none p-2 text-navy-500 cursor-pointer">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showAdd && <AddAccountModal onClose={() => setShowAdd(false)} onSaved={() => { refresh(); setShowAdd(false); }} />}
    </Card>
  );
}

interface AccountFormState {
  label: string;
  email_address: string;
  imap_host: string;
  imap_port: number;
  imap_user: string;
  imap_pass: string;
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
}

function AddAccountModal({ onClose, onSaved }: AddAccountModalProps) {
  const [presets, setPresets] = useState<Record<string, Partial<AccountFormState>>>({});
  const [provider, setProvider] = useState<string>("gmail");
  const [showPass, setShowPass] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState<AccountFormState>({
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
    fetch("/api/accounts/presets", { credentials: "include" })
      .then(r => r.json())
      .then(d => setPresets(d.presets || {}));
  }, []);

  function selectProvider(key: string) {
    setProvider(key);
    const p = presets[key];
    if (p) setForm(f => ({ ...f, ...p }));
  }

  function set(k: keyof AccountFormState, v: string | number) {
    setForm(f => {
      const next = { ...f, [k]: v };
      // Auto-populate user fields from email if empty
      if (k === "email_address") {
        if (!next.imap_user) next.imap_user = v as string;
        if (!next.smtp_user) next.smtp_user = v as string;
      }
      return next;
    });
  }

  async function test() {
    setTesting(true); setError(null); setSuccess(null);
    try {
      const r = await fetch("/api/accounts/test", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const d = await r.json();
      if (!r.ok) setError(d.error || "Test failed");
      else setSuccess("Connection verified");
    } catch (err: unknown) { setError((err as Error).message); }
    finally { setTesting(false); }
  }

  async function save() {
    setSaving(true); setError(null);
    try {
      const r = await fetch("/api/accounts", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const d = await r.json();
      if (!r.ok) setError(d.error || "Failed to save");
      else onSaved();
    } catch (err: unknown) { setError((err as Error).message); }
    finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 bg-[rgba(10,15,30,0.55)] z-[90] flex items-center justify-center p-5 backdrop-blur-[4px]">
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-[520px] max-h-[90vh] overflow-auto border border-navy-200">
        <div className="px-5 py-[18px] border-b border-navy-200 flex items-center gap-2.5">
          <Mail size={18} className="text-blue-500" />
          <h3 className="m-0 text-base font-bold text-navy-900">Add email account</h3>
          <button onClick={onClose} className="ml-auto bg-transparent border-none text-navy-500 cursor-pointer p-1">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-3.5">
          {/* Provider presets */}
          <div>
            <Label>Provider</Label>
            <div className="flex gap-1.5 flex-wrap">
              {Object.keys(presets).map((key) => (
                <button key={key} onClick={() => selectProvider(key)} className={cn(
                  "px-[11px] py-1.5 text-xs font-semibold capitalize cursor-pointer rounded-[7px] font-[inherit] border",
                  provider === key
                    ? "bg-navy-900 text-white border-navy-900"
                    : "bg-navy-50 text-navy-700 border-navy-200"
                )}>{key}</button>
              ))}
            </div>
          </div>

          <TextField label="Label" value={form.label} onChange={(v) => set("label", v)} placeholder="Work" />
          <TextField label="Email address" type="email" value={form.email_address}
                     onChange={(v) => set("email_address", v)} placeholder="you@example.com" />

          <div className="p-3 rounded-[10px] bg-navy-50 border border-navy-200">
            <div className="text-[11px] font-bold text-navy-600 uppercase tracking-[0.8px] mb-2.5">
              IMAP (incoming)
            </div>
            <div className="grid grid-cols-[2fr_1fr] gap-2.5">
              <TextField label="Host" value={form.imap_host} onChange={(v) => set("imap_host", v)} />
              <TextField label="Port" type="number" value={form.imap_port}
                         onChange={(v) => set("imap_port", Number(v))} />
            </div>
            <TextField label="Username" value={form.imap_user} onChange={(v) => set("imap_user", v)} />
            <PasswordField label="Password / App password" value={form.imap_pass}
                           onChange={(v) => set("imap_pass", v)}
                           show={showPass} onToggle={() => setShowPass(!showPass)} />
          </div>

          <div className="p-3 rounded-[10px] bg-navy-50 border border-navy-200">
            <div className="text-[11px] font-bold text-navy-600 uppercase tracking-[0.8px] mb-2.5">
              SMTP (outgoing)
            </div>
            <div className="grid grid-cols-[2fr_1fr] gap-2.5">
              <TextField label="Host" value={form.smtp_host} onChange={(v) => set("smtp_host", v)} />
              <TextField label="Port" type="number" value={form.smtp_port}
                         onChange={(v) => set("smtp_port", Number(v))} />
            </div>
            <TextField label="Username" value={form.smtp_user} onChange={(v) => set("smtp_user", v)} />
            <PasswordField label="Password / App password" value={form.smtp_pass}
                           onChange={(v) => set("smtp_pass", v)}
                           show={showPass} onToggle={() => setShowPass(!showPass)} />
          </div>

          {error && (
            <div className="bg-red-500/[0.08] border border-red-500/25 text-red-500 px-3 py-2.5 rounded-[9px] text-xs flex gap-2 items-start">
              <AlertCircle size={14} className="shrink-0 mt-px" /> {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/[0.08] border border-green-500/25 text-green-500 px-3 py-2.5 rounded-[9px] text-xs flex gap-2 items-center">
              <CheckCircle2 size={14} /> {success}
            </div>
          )}

          <div className="flex gap-2 mt-1">
            <button onClick={test} disabled={testing || saving} className={cn(
              btnSecondary, "flex-1 justify-center",
              (testing || saving) && "opacity-60"
            )}>
              {testing ? <RefreshCw size={13} className="animate-spin" /> : "Test connection"}
            </button>
            <button onClick={save} disabled={saving || testing} className={cn(
              btnPrimary, "flex-1 justify-center",
              (saving || testing) && "opacity-60"
            )}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>

          <div className="text-[11px] text-navy-500 leading-normal">
            <strong>Gmail:</strong> use an App Password — not your main password —
            from Google Account → Security → 2FA → App passwords.
            <br /><strong>Outlook:</strong> same pattern. <strong>ProtonMail:</strong> requires Bridge running on localhost.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Active sessions ─────────────────────────────────────────
function SessionsSection() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/auth/sessions", { credentials: "include" });
      const d = await r.json();
      setSessions(d.sessions || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function revoke(id: string) {
    await fetch(`/api/auth/sessions/${id}`, { method: "DELETE", credentials: "include" });
    refresh();
  }

  async function revokeAll() {
    if (!confirm("Sign out of all devices? You will need to sign in again.")) return;
    await fetch("/api/auth/logout-all", { method: "POST", credentials: "include" });
    window.location.reload();
  }

  function deviceIcon(ua: string): LucideIcon {
    if (!ua) return Globe;
    const l = ua.toLowerCase();
    if (l.includes("mobile") || l.includes("android") || l.includes("iphone")) return Smartphone;
    return Monitor;
  }

  function deviceLabel(ua: string): string {
    if (!ua) return "Unknown device";
    if (ua.length > 60) return ua.slice(0, 57) + "…";
    return ua;
  }

  return (
    <Card title="Active sessions" action={
      sessions.length > 1 ? (
        <button onClick={revokeAll} className={cn(btnSecondary, "text-red-500 border-red-500/30")}>
          <LogOut size={12} /> Sign out all
        </button>
      ) : undefined
    }>
      {loading ? (
        <div className="text-navy-500 text-[13px]">Loading…</div>
      ) : sessions.length === 0 ? (
        <div className="text-navy-500 text-[13px]">No active sessions.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((s) => {
            const Icon = deviceIcon(s.user_agent);
            return (
              <div key={s.id} className={cn(
                "flex items-center gap-3 p-3.5 rounded-[10px] border",
                s.is_current
                  ? "border-blue-500/30 bg-blue-500/[0.04]"
                  : "border-navy-200 bg-navy-50"
              )}>
                <div className={cn(
                  "w-9 h-9 rounded-[9px] flex items-center justify-center",
                  s.is_current ? "bg-blue-500/10" : "bg-slate-500/[0.06]"
                )}>
                  <Icon size={16} className={s.is_current ? "text-blue-500" : "text-navy-500"} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-navy-900 flex items-center gap-1.5">
                    {s.ip || "Unknown IP"}
                    {s.is_current && (
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-500/10 px-[7px] py-0.5 rounded">
                        CURRENT
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-navy-500 mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                    {deviceLabel(s.user_agent)}
                  </div>
                  <div className="text-[11px] text-navy-400 mt-0.5 font-mono">
                    Last active {new Date(s.last_seen_at).toLocaleString()}
                  </div>
                </div>
                {!s.is_current && (
                  <button onClick={() => revoke(s.id)} title="Revoke this session" className="bg-transparent border-none p-2 text-navy-500 cursor-pointer">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Push notifications ──────────────────────────────────────
function PushSection() {
  const [supported, setSupported] = useState<boolean>(false);
  const [subscribed, setSubscribed] = useState<boolean>(false);
  const [working, setWorking] = useState<boolean>(false);

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
      const { public_key } = await fetch("/api/push/vapid", { credentials: "include" }).then(r => r.json());
      if (!public_key) throw new Error("Push not configured on server");

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key) as BufferSource
      });
      await fetch("/api/push/subscribe", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub)
      });
      setSubscribed(true);
    } catch (err: unknown) {
      alert("Could not enable: " + (err as Error).message);
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
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
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
        <div className="text-[13px] text-navy-500">
          Your browser doesn't support web push.
        </div>
      ) : (
        <div className="flex items-center gap-3 p-3.5 rounded-[10px] bg-navy-50 border border-navy-200">
          <div className={cn(
            "w-9 h-9 rounded-[9px] flex items-center justify-center",
            subscribed ? "bg-green-500/10" : "bg-slate-500/[0.08]"
          )}>
            {subscribed ? <Bell size={16} className="text-green-500" /> : <BellOff size={16} className="text-navy-500" />}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-navy-900">
              {subscribed ? "Push notifications enabled" : "Push notifications off"}
            </div>
            <div className="text-xs text-navy-500 mt-0.5">
              Daily briefings, meeting reminders, and high-priority emails.
            </div>
          </div>
          <button onClick={subscribed ? disable : enable} disabled={working}
            className={subscribed ? btnSecondary : btnPrimary}>
            {working ? "…" : subscribed ? "Disable" : "Enable"}
          </button>
        </div>
      )}
    </Card>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function Card({ title, action, children }: CardProps) {
  return (
    <div className="bg-white border border-navy-200 rounded-[14px] p-[18px]">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="m-0 text-sm font-bold text-navy-900 tracking-[-0.2px]">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: FieldProps) {
  return (
    <div className="bg-navy-50 border border-navy-200 rounded-[9px] p-2.5">
      <div className="text-[10px] text-navy-500 uppercase tracking-[0.5px]">{label}</div>
      <div className="text-[13px] text-navy-900 font-medium mt-[3px]">{value}</div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold text-navy-600 uppercase tracking-[0.5px] mb-1.5">
      {children}
    </div>
  );
}

function TextField({ label, value, onChange, type = "text", placeholder }: TextFieldProps) {
  return (
    <div className="mb-2">
      <Label>{label}</Label>
      <input type={type} value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-[11px] py-2 text-[13px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white box-border"
      />
    </div>
  );
}

function PasswordField({ label, value, onChange, show, onToggle }: PasswordFieldProps) {
  return (
    <div className="mb-0.5">
      <Label>{label}</Label>
      <div className="relative">
        <input type={show ? "text" : "password"} value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          className="w-full pl-[11px] pr-9 py-2 text-[13px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white box-border"
        />
        <button type="button" onClick={onToggle} className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-transparent border-none p-1.5 text-navy-500 cursor-pointer">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }: EmptyStateProps) {
  return (
    <div className="px-4 py-6 text-center border border-dashed border-navy-200 rounded-[10px]">
      <Icon size={26} className="text-navy-400 mb-2.5" />
      <div className="text-sm font-semibold text-navy-800">{title}</div>
      <div className="text-xs text-navy-500 mt-1.5 leading-normal max-w-[380px] mx-auto">
        {body}
      </div>
    </div>
  );
}
