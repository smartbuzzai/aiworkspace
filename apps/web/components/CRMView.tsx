"use client";
import { useEffect, useState, useRef } from "react";
import { Search, Plus, Mail, Phone, X, Video, StickyNote, Pencil } from "lucide-react";
import { cn } from "../lib/cn";
import { useToast } from "./shared/Toast";
import { relTime } from "../lib/date";
import Modal from "./shared/Modal";
import TextInput from "./shared/TextInput";
import SelectInput from "./shared/SelectInput";

/* ------------------------------------------------------------------ */
/*  Interfaces                                                         */
/* ------------------------------------------------------------------ */

interface Contact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  status: "hot" | "active" | "nurture" | "cold";
  score: number;
  notes?: string;
  last_touch_at?: string;
}

interface Interaction {
  id: string;
  kind: string;
  summary: string;
  occurred_at: string;
}

interface NewContactForm {
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  status: string;
  score: number;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  hot: { label: "Hot", color: "red" },
  active: { label: "Active", color: "green" },
  nurture: { label: "Nurture", color: "blue" },
  cold: { label: "Cold", color: "gray" },
};

const TAG_COLORS: Record<string, string> = {
  red: "bg-red-500/[0.08] text-red-500 border border-red-500/[0.15]",
  green: "bg-green-500/[0.08] text-green-500 border border-green-500/[0.15]",
  blue: "bg-blue-500/[0.08] text-blue-500 border border-blue-500/[0.15]",
  gray: "bg-navy-100 text-navy-600 border border-navy-200",
};

const KIND_ICONS: Record<string, { icon: typeof Mail; bg: string; fg: string }> = {
  email: { icon: Mail, bg: "bg-blue-500/10", fg: "text-blue-500" },
  call: { icon: Phone, bg: "bg-green-500/10", fg: "text-green-500" },
  meeting: { icon: Video, bg: "bg-amber-500/10", fg: "text-amber-500" },
  note: { icon: StickyNote, bg: "bg-teal-500/10", fg: "text-teal-500" },
};

/* ------------------------------------------------------------------ */
/*  Main view                                                          */
/* ------------------------------------------------------------------ */

export default function CRMView() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);

  const initialLoad = useRef(true);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [q, statusFilter]);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const qs = params.toString();
      const r = await fetch(`/api/contacts${qs ? `?${qs}` : ""}`, { credentials: "include" });
      const d = await r.json();
      const list = d.contacts || [];
      setContacts(list);
      if (initialLoad.current && list.length > 0) {
        selectContact(list[0]);
        initialLoad.current = false;
      }
    } finally {
      setLoading(false);
    }
  }

  async function selectContact(c: Contact) {
    setSelected(c);
    try {
      const r = await fetch(`/api/contacts/${c.id}`, { credentials: "include" });
      const d = await r.json();
      setInteractions(d.interactions || []);
    } catch {
      setInteractions([]);
    }
  }

  const activeCount = contacts.filter(c => c.status !== "cold").length;

  return (
    <div className="flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <h1 className="text-[28px] font-extrabold text-navy-900 tracking-tight leading-tight m-0">Pipeline</h1>
          <div className="text-sm text-navy-500 mt-1">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""} &middot; {activeCount} active
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowNew(true)}
            className="bg-blue-500 text-white border-none px-4 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer flex items-center gap-2 font-[inherit] hover:bg-blue-600 transition-all"
          >
            <Plus size={14} /> Add contact
          </button>
        </div>
      </div>

      {/* Master-detail layout */}
      <div className="grid grid-cols-[1fr_320px] gap-6">
        {/* Left: table */}
        <div className="bg-white border border-navy-200 rounded-[14px] overflow-hidden">
          {/* Toolbar */}
          <div className="p-3.5 border-b border-navy-200 flex items-center gap-3">
            <div className="flex items-center gap-2 flex-1 bg-navy-50 border border-navy-200 rounded-lg px-3 py-2">
              <Search size={14} className="text-navy-500" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Search contacts, companies..."
                className="border-none outline-none bg-transparent text-[13px] w-full text-navy-800 font-[inherit]"
              />
            </div>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-white border border-navy-200 rounded-lg px-3 py-2 text-[13px] text-navy-700 font-semibold cursor-pointer font-[inherit] outline-none"
            >
              <option value="all">All status</option>
              <option value="hot">Hot</option>
              <option value="active">Active</option>
              <option value="nurture">Nurture</option>
              <option value="cold">Cold</option>
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-navy-500 text-[13px] p-6">Loading&hellip;</div>
          ) : contacts.length === 0 ? (
            <div className="p-10 text-center text-navy-500 text-sm">
              {q || statusFilter !== "all" ? "No contacts match." : "No contacts yet."}
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-[11px] font-bold text-navy-500 uppercase tracking-wider text-left px-5 py-3 border-b border-navy-200 bg-navy-50">Contact</th>
                  <th className="text-[11px] font-bold text-navy-500 uppercase tracking-wider text-left px-5 py-3 border-b border-navy-200 bg-navy-50">Status</th>
                  <th className="text-[11px] font-bold text-navy-500 uppercase tracking-wider text-left px-5 py-3 border-b border-navy-200 bg-navy-50">Score</th>
                  <th className="text-[11px] font-bold text-navy-500 uppercase tracking-wider text-left px-5 py-3 border-b border-navy-200 bg-navy-50">Last touch</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => {
                  const initial = (c.name || "?")[0].toUpperCase();
                  const isSelected = selected?.id === c.id;
                  const sm = STATUS_MAP[c.status] || STATUS_MAP.active;
                  const scoreColor = c.score >= 80 ? "text-green-500" : c.score >= 60 ? "text-amber-500" : "text-navy-500";
                  return (
                    <tr
                      key={c.id}
                      onClick={() => selectContact(c)}
                      className={cn(
                        "cursor-pointer transition-colors",
                        isSelected ? "bg-blue-500/[0.04]" : "hover:bg-navy-50"
                      )}
                    >
                      <td className="px-5 py-3.5 border-b border-navy-100">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 text-white flex items-center justify-center font-bold text-[11px] font-mono shrink-0">
                            {initial}
                          </div>
                          <div>
                            <div className="text-[13px] font-semibold text-navy-900">{c.name}</div>
                            <div className="text-[11px] text-navy-500">{c.company || "\u2014"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 border-b border-navy-100">
                        <span className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-[5px] uppercase tracking-wide font-mono",
                          TAG_COLORS[sm.color]
                        )}>
                          {sm.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 border-b border-navy-100">
                        <span className={cn("font-mono text-[13px] font-bold", scoreColor)}>{c.score}</span>
                      </td>
                      <td className="px-5 py-3.5 border-b border-navy-100 text-navy-500 font-mono text-[12px]">
                        {c.last_touch_at ? relTime(c.last_touch_at) : "\u2014"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Right: detail panel */}
        <div className="bg-white border border-navy-200 rounded-[14px] p-6 sticky top-[88px] self-start max-h-[calc(100vh-110px)] overflow-y-auto">
          {selected ? (
            <DetailPanel contact={selected} interactions={interactions} onEdit={() => setEditContact(selected)} />
          ) : (
            <div className="text-navy-400 text-[13px] text-center py-10">
              Select a contact to view details.
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <ContactModal
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}
      {editContact && (
        <ContactModal
          contact={editContact}
          onClose={() => setEditContact(null)}
          onSaved={(updated) => {
            setEditContact(null);
            setSelected(updated);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Detail panel                                                       */
/* ------------------------------------------------------------------ */

function DetailPanel({ contact, interactions, onEdit }: { contact: Contact; interactions: Interaction[]; onEdit: () => void }) {
  const initial = (contact.name || "?")[0].toUpperCase();
  const sm = STATUS_MAP[contact.status] || STATUS_MAP.active;
  const [showCompose, setShowCompose] = useState(false);
  const [showAllInteractions, setShowAllInteractions] = useState(false);

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3.5 pb-5 border-b border-navy-200 mb-5">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-teal-500 text-white flex items-center justify-center font-bold text-sm font-mono shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-bold text-navy-900">{contact.name}</div>
          <div className="text-[12px] text-navy-500">{[contact.role, contact.company].filter(Boolean).join(" \u00b7 ") || "\u2014"}</div>
          <span className={cn(
            "inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-[5px] uppercase tracking-wide font-mono",
            TAG_COLORS[sm.color]
          )}>
            {sm.label}
          </span>
        </div>
        <button
          onClick={onEdit}
          className="bg-navy-50 border border-navy-200 text-navy-600 p-1.5 rounded-lg cursor-pointer hover:bg-navy-100 transition-colors shrink-0"
          title="Edit contact"
        >
          <Pencil size={13} />
        </button>
      </div>

      {/* Contact details */}
      <div className="mb-5">
        <div className="text-[10px] font-bold text-navy-500 uppercase tracking-[1.5px] mb-2">Contact</div>
        {contact.email && (
          <div className="flex justify-between py-1.5 text-[13px]">
            <span className="text-navy-500">Email</span>
            <span className="text-navy-800 font-medium">{contact.email}</span>
          </div>
        )}
        {contact.phone && (
          <div className="flex justify-between py-1.5 text-[13px]">
            <span className="text-navy-500">Phone</span>
            <span className="text-navy-800 font-medium">{contact.phone}</span>
          </div>
        )}
        <div className="flex justify-between py-1.5 text-[13px]">
          <span className="text-navy-500">Score</span>
          <span className="text-navy-800 font-bold font-mono">{contact.score}</span>
        </div>
        <div className="flex justify-between py-1.5 text-[13px]">
          <span className="text-navy-500">Last touch</span>
          <span className="text-navy-800 font-medium">{contact.last_touch_at ? relTime(contact.last_touch_at) : "\u2014"}</span>
        </div>
      </div>

      {/* Notes */}
      {contact.notes && (
        <div className="mb-5">
          <div className="text-[10px] font-bold text-navy-500 uppercase tracking-[1.5px] mb-2">Notes</div>
          <p className="text-[13px] text-navy-700 leading-relaxed whitespace-pre-wrap m-0">{contact.notes}</p>
        </div>
      )}

      {/* Activity timeline */}
      {interactions.length > 0 && (
        <div className="mb-5">
          <div className="text-[10px] font-bold text-navy-500 uppercase tracking-[1.5px] mb-2">Recent activity</div>
          <div className="flex flex-col">
            {(showAllInteractions ? interactions : interactions.slice(0, 8)).map(i => {
              const kind = KIND_ICONS[i.kind] || KIND_ICONS.note;
              const Icon = kind.icon;
              return (
                <div key={i.id} className="flex gap-2.5 py-2.5 border-b border-navy-100 last:border-b-0">
                  <div className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0", kind.bg)}>
                    <Icon size={12} className={kind.fg} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-navy-800 truncate">{i.summary}</div>
                    <div className="text-[10px] text-navy-500 font-mono mt-0.5">{relTime(i.occurred_at).toUpperCase()}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {interactions.length > 8 && (
            <button
              onClick={() => setShowAllInteractions(v => !v)}
              className="mt-1.5 w-full text-[11px] font-semibold text-blue-600 bg-transparent border-none cursor-pointer py-1 hover:text-blue-700 font-[inherit]"
            >
              {showAllInteractions ? "Show less" : `Show ${interactions.length - 8} more`}
            </button>
          )}
        </div>
      )}

      {/* Action */}
      <button
        onClick={() => contact.email ? setShowCompose(true) : undefined}
        disabled={!contact.email}
        className={cn(
          "w-full bg-blue-500 text-white border-none py-2.5 px-4 rounded-lg text-[13px] font-semibold font-[inherit] transition-all mt-2",
          contact.email ? "cursor-pointer hover:bg-blue-600" : "opacity-50 cursor-not-allowed"
        )}
      >
        Compose follow-up
      </button>

      {showCompose && contact.email && (
        <FollowUpModal
          contactName={contact.name}
          contactEmail={contact.email}
          onClose={() => setShowCompose(false)}
          onSent={() => setShowCompose(false)}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  FollowUpModal — compose email to contact                           */
/* ------------------------------------------------------------------ */

interface EmailAccount {
  id: string;
  email_address: string;
  label: string;
  smtp_host: string;
}

function FollowUpModal({ contactName, contactEmail, onClose, onSent }: {
  contactName: string;
  contactEmail: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [subject, setSubject] = useState(`Following up — ${contactName}`);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    async function loadAccounts() {
      try {
        const r = await fetch("/api/accounts", { credentials: "include" });
        const d = await r.json();
        const active = (d.accounts || []).filter((a: EmailAccount) => a.smtp_host);
        setAccounts(active);
        if (active.length > 0) setAccountId(active[0].id);
      } finally {
        setLoadingAccounts(false);
      }
    }
    loadAccounts();
  }, []);

  async function send() {
    if (!accountId || !subject.trim() || !body.trim() || sending) return;
    setSending(true);
    try {
      const r = await fetch("/api/emails/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: accountId,
          to: [contactEmail],
          subject: subject.trim(),
          body_text: body.trim(),
        }),
      });
      if (r.ok) {
        toast("success", `Follow-up sent to ${contactName}.`);
        onSent();
      } else {
        const d = await r.json().catch(() => ({}));
        toast("error", d.error || "Failed to send email.");
      }
    } finally {
      setSending(false);
    }
  }

  const disabled = !accountId || !subject.trim() || !body.trim() || sending;

  return (
    <Modal onClose={onClose}>
      <div className="px-5 py-4 border-b border-navy-200 flex items-center">
        <h3 className="m-0 text-base font-bold text-navy-900">Follow up with {contactName}</h3>
        <button onClick={onClose} className="ml-auto bg-transparent border-none text-navy-500 cursor-pointer p-1">
          <X size={16} />
        </button>
      </div>
      <div className="p-5 flex flex-col gap-2.5">
        {loadingAccounts ? (
          <div className="text-navy-500 text-[13px]">Loading accounts&hellip;</div>
        ) : accounts.length === 0 ? (
          <div className="text-red-500 text-[13px]">No email accounts with SMTP configured. Add one in Settings first.</div>
        ) : (
          <>
            {accounts.length > 1 && (
              <div>
                <div className="text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-[5px]">From</div>
                <select
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  className="w-full px-[11px] py-2 text-[13px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white box-border cursor-pointer"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.email_address}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex justify-between py-1 text-[13px]">
              <span className="text-navy-500">To</span>
              <span className="text-navy-800 font-medium">{contactEmail}</span>
            </div>
            <TextInput label="Subject" value={subject} onChange={v => setSubject(v)} />
            <div>
              <div className="text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-[5px]">Message</div>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={6}
                autoFocus
                placeholder="Write your follow-up..."
                className="w-full px-[11px] py-2 text-[13px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white box-border resize-y"
              />
            </div>
            <button
              onClick={send}
              disabled={disabled}
              className={cn(
                "bg-blue-600 text-white border-none px-4 py-2.5 rounded-lg text-[13px] font-semibold font-[inherit] mt-1 flex items-center justify-center gap-2",
                disabled ? "opacity-60 cursor-wait" : "cursor-pointer",
              )}
            >
              <Mail size={14} /> {sending ? "Sending\u2026" : "Send follow-up"}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  ContactModal \u2014 create or edit                                      */
/* ------------------------------------------------------------------ */

function ContactModal({ contact, onClose, onSaved }: {
  contact?: Contact;
  onClose: () => void;
  onSaved: (c: Contact) => void;
}) {
  const isEdit = !!contact;
  const { toast } = useToast();
  const [f, setF] = useState({
    name: contact?.name ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    company: contact?.company ?? "",
    role: contact?.role ?? "",
    status: contact?.status ?? "active",
    score: contact?.score ?? 50,
    notes: contact?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!f.name.trim()) return;
    setSaving(true);
    try {
      const r = await fetch(isEdit ? `/api/contacts/${contact!.id}` : "/api/contacts", {
        method: isEdit ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const d = await r.json();
      toast("success", isEdit ? "Contact saved." : "Contact created.");
      onSaved(d.contact || d);
    } finally {
      setSaving(false);
    }
  }

  const disabled = !f.name.trim() || saving;

  return (
    <Modal onClose={onClose}>
      <div className="px-5 py-4 border-b border-navy-200 flex items-center">
        <h3 className="m-0 text-base font-bold text-navy-900">{isEdit ? "Edit contact" : "New contact"}</h3>
        <button onClick={onClose} className="ml-auto bg-transparent border-none text-navy-500 cursor-pointer p-1">
          <X size={16} />
        </button>
      </div>
      <div className="p-5 flex flex-col gap-2.5">
        <TextInput label="Name *" value={f.name} onChange={v => setF({ ...f, name: v })} />
        <TextInput label="Email" value={f.email} onChange={v => setF({ ...f, email: v })} />
        <div className="grid grid-cols-2 gap-2.5">
          <TextInput label="Company" value={f.company} onChange={v => setF({ ...f, company: v })} />
          <TextInput label="Role" value={f.role} onChange={v => setF({ ...f, role: v })} />
        </div>
        <TextInput label="Phone" value={f.phone} onChange={v => setF({ ...f, phone: v })} />
        {isEdit && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <SelectInput
                label="Status"
                value={f.status}
                onChange={v => setF({ ...f, status: v as Contact["status"] })}
                options={[["hot","Hot"],["active","Active"],["nurture","Nurture"],["cold","Cold"]]}
              />
              <div>
                <div className="text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-[5px]">Score (0\u2013100)</div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={f.score}
                  onChange={e => setF({ ...f, score: Number(e.target.value) })}
                  className="w-full px-[11px] py-2 text-[13px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white box-border"
                />
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-[5px]">Notes</div>
              <textarea
                value={f.notes}
                onChange={e => setF({ ...f, notes: e.target.value })}
                rows={3}
                className="w-full px-[11px] py-2 text-[13px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white box-border resize-y"
              />
            </div>
          </>
        )}
        <button
          onClick={save}
          disabled={disabled}
          className={cn(
            "bg-blue-600 text-white border-none px-4 py-2.5 rounded-lg text-[13px] font-semibold font-[inherit] mt-1",
            disabled ? "opacity-60 cursor-wait" : "cursor-pointer",
          )}
        >
          {saving ? (isEdit ? "Saving\u2026" : "Creating\u2026") : (isEdit ? "Save changes" : "Create contact")}
        </button>
      </div>
    </Modal>
  );
}

