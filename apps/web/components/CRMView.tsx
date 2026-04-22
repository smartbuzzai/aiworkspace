"use client";
import { useEffect, useState } from "react";
import { Search, Plus, Mail, Phone, Clock, X, Sparkles, Filter } from "lucide-react";
import { cn } from "../lib/cn";

/* ------------------------------------------------------------------ */
/*  TypeScript interfaces                                              */
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

interface ContactCardProps {
  contact: Contact;
  onClick: () => void;
}

interface ContactModalProps {
  contact: Contact;
  interactions: Interaction[];
  onClose: () => void;
  onSaved: (updated: Contact) => void;
}

interface NewContactModalProps {
  onClose: () => void;
  onCreated: () => void;
}

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
}

interface DetailCellProps {
  label: string;
  value: string | number;
  mono?: boolean;
}

interface StatusPillProps {
  status: string;
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
/*  Main view                                                          */
/* ------------------------------------------------------------------ */

export default function CRMView() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [q, setQ] = useState<string>("");
  const [selected, setSelected] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showNew, setShowNew] = useState<boolean>(false);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [q]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/contacts${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
        credentials: "include",
      });
      const d = await r.json();
      setContacts(d.contacts || []);
    } finally {
      setLoading(false);
    }
  }

  async function openContact(c: Contact) {
    setSelected(c);
    try {
      const r = await fetch(`/api/contacts/${c.id}`, { credentials: "include" });
      const d = await r.json();
      setInteractions(d.interactions || []);
    } catch {
      /* swallow */
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter bar */}
      <div className="bg-white border border-navy-200 rounded-xl p-3.5 flex gap-2.5 items-center flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] bg-navy-50 border border-navy-200 rounded-lg px-3 py-[7px]">
          <Search size={15} className="text-navy-500" />
          <input
            value={q}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
            placeholder="Search by name, company, or email"
            className="border-none outline-none bg-transparent text-[13px] w-full text-navy-800 font-[inherit]"
          />
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="bg-blue-600 text-white border-none px-3 py-[7px] rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1.5 font-[inherit]"
        >
          <Plus size={13} /> New contact
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="text-navy-500 text-[13px] p-6">Loading&hellip;</div>
      ) : contacts.length === 0 ? (
        <div className="bg-white border border-navy-200 rounded-xl p-10 text-center text-navy-500 text-sm">
          {q ? "No contacts match that search." : 'No contacts yet. Click "New contact" above.'}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-3">
          {contacts.map((c) => (
            <ContactCard key={c.id} contact={c} onClick={() => openContact(c)} />
          ))}
        </div>
      )}

      {selected && (
        <ContactModal
          contact={selected}
          interactions={interactions}
          onClose={() => {
            setSelected(null);
            setInteractions([]);
          }}
          onSaved={(updated: Contact) => {
            setSelected(updated);
            load();
          }}
        />
      )}
      {showNew && (
        <NewContactModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ContactCard                                                        */
/* ------------------------------------------------------------------ */

function ContactCard({ contact, onClick }: ContactCardProps) {
  const initial = (contact.name || "?")[0].toUpperCase();
  const scoreColor =
    contact.score >= 80
      ? "text-green-500"
      : contact.score >= 60
        ? "text-amber-500"
        : "text-navy-500";

  return (
    <div
      onClick={onClick}
      className="bg-white border border-navy-200 rounded-[14px] p-4 flex gap-3.5 cursor-pointer transition-all hover:border-blue-400 hover:-translate-y-px"
    >
      <div className="w-[46px] h-[46px] rounded-full bg-gradient-to-br from-blue-500 to-teal-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
        {initial}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-navy-900">{contact.name}</span>
          <StatusPill status={contact.status} />
        </div>
        <div className="text-xs text-navy-500 mt-0.5">
          {[contact.role, contact.company].filter(Boolean).join(" \u00b7 ") || "\u2014"}
        </div>
        <div className="flex gap-3.5 mt-2.5 text-[11px] text-navy-600 flex-wrap">
          {contact.email && (
            <span className="flex items-center gap-1 overflow-hidden text-ellipsis">
              <Mail size={11} /> {contact.email}
            </span>
          )}
          {contact.last_touch_at && (
            <span className="flex items-center gap-1">
              <Clock size={11} /> {relTime(contact.last_touch_at)}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className={cn("font-mono text-[22px] font-extrabold tracking-tight", scoreColor)}>
          {contact.score}
        </div>
        <div className="text-[10px] text-navy-500 uppercase tracking-wide">score</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StatusPill                                                         */
/* ------------------------------------------------------------------ */

const statusClasses: Record<string, string> = {
  hot: "bg-red-500/10 text-red-500",
  active: "bg-green-500/10 text-green-500",
  nurture: "bg-blue-500/10 text-blue-500",
  cold: "bg-navy-100 text-navy-500",
};

function StatusPill({ status }: StatusPillProps) {
  const cls = statusClasses[status] || statusClasses.active;
  return (
    <span
      className={cn(
        "text-[10px] font-bold px-2 py-0.5 rounded-[5px] uppercase tracking-wide",
        cls,
      )}
    >
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  ContactModal                                                       */
/* ------------------------------------------------------------------ */

function ContactModal({ contact, interactions, onClose }: ContactModalProps) {
  return (
    <Modal onClose={onClose}>
      <div className="p-6 bg-gradient-to-br from-navy-900 to-navy-800 text-white">
        <div className="flex justify-between items-start gap-3">
          <div className="flex gap-3.5 items-center">
            <div className="w-[58px] h-[58px] rounded-full bg-gradient-to-br from-blue-500 to-teal-500 flex items-center justify-center font-bold text-xl">
              {(contact.name || "?")[0].toUpperCase()}
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight">{contact.name}</div>
              <div className="text-[13px] text-navy-300 mt-0.5">
                {[contact.role, contact.company].filter(Boolean).join(" \u00b7 ") || "\u2014"}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-white/[0.08] border-none text-white p-1.5 rounded-lg cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 gap-2.5 mb-[18px]">
          {contact.email && <DetailCell label="Email" value={contact.email} />}
          {contact.phone && <DetailCell label="Phone" value={contact.phone} />}
          <DetailCell label="Score" value={contact.score} mono />
          <DetailCell
            label="Last touch"
            value={contact.last_touch_at ? relTime(contact.last_touch_at) : "\u2014"}
          />
        </div>

        {contact.notes && (
          <div className="p-3 rounded-[10px] bg-navy-50 border border-navy-200 mb-3.5">
            <div className="text-[10px] text-navy-500 uppercase tracking-wide mb-1.5">Notes</div>
            <div className="text-[13px] text-navy-700 whitespace-pre-wrap leading-normal">
              {contact.notes}
            </div>
          </div>
        )}

        {interactions.length > 0 && (
          <div>
            <div className="text-xs font-bold text-navy-600 uppercase tracking-wide mb-2.5">
              Recent interactions
            </div>
            <div className="flex flex-col gap-1.5">
              {interactions.slice(0, 8).map((i) => (
                <div
                  key={i.id}
                  className="p-2.5 bg-navy-50 border border-navy-200 rounded-lg text-xs text-navy-700 flex justify-between gap-2.5"
                >
                  <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                    <b className="capitalize">{i.kind}</b> &middot; {i.summary}
                  </span>
                  <span className="text-navy-500 font-mono text-[11px] shrink-0">
                    {relTime(i.occurred_at)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  NewContactModal                                                    */
/* ------------------------------------------------------------------ */

function NewContactModal({ onClose, onCreated }: NewContactModalProps) {
  const [f, setF] = useState<NewContactForm>({
    name: "",
    email: "",
    phone: "",
    company: "",
    role: "",
    status: "active",
    score: 50,
  });
  const [saving, setSaving] = useState<boolean>(false);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/contacts", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  const disabled = !f.name || saving;

  return (
    <Modal onClose={onClose}>
      <div className="px-5 py-4 border-b border-navy-200 flex items-center">
        <h3 className="m-0 text-base font-bold text-navy-900">New contact</h3>
        <button
          onClick={onClose}
          className="ml-auto bg-transparent border-none text-navy-500 cursor-pointer p-1"
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-5 flex flex-col gap-2.5">
        <TextInput label="Name *" value={f.name} onChange={(v) => setF({ ...f, name: v })} />
        <TextInput label="Email" value={f.email} onChange={(v) => setF({ ...f, email: v })} />
        <div className="grid grid-cols-2 gap-2.5">
          <TextInput
            label="Company"
            value={f.company}
            onChange={(v) => setF({ ...f, company: v })}
          />
          <TextInput label="Role" value={f.role} onChange={(v) => setF({ ...f, role: v })} />
        </div>
        <TextInput label="Phone" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} />
        <button
          onClick={save}
          disabled={disabled}
          className={cn(
            "bg-blue-600 text-white border-none px-4 py-2.5 rounded-lg text-[13px] font-semibold font-[inherit] mt-1",
            disabled ? "opacity-60 cursor-wait" : "cursor-pointer",
          )}
        >
          {saving ? "Saving\u2026" : "Create contact"}
        </button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  TextInput                                                          */
/* ------------------------------------------------------------------ */

function TextInput({ label, value, onChange }: TextInputProps) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-navy-600 uppercase tracking-wide mb-[5px]">
        {label}
      </div>
      <input
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        className="w-full px-[11px] py-2 text-[13px] border border-navy-200 rounded-lg outline-none font-[inherit] text-navy-900 bg-white box-border"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Modal                                                              */
/* ------------------------------------------------------------------ */

function Modal({ onClose, children }: ModalProps) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-[rgba(10,15,30,0.55)] z-[90] flex items-center justify-center p-5 backdrop-blur-sm"
    >
      <div
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-[560px] w-full max-h-[90vh] overflow-auto border border-navy-200"
      >
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DetailCell                                                         */
/* ------------------------------------------------------------------ */

function DetailCell({ label, value, mono }: DetailCellProps) {
  return (
    <div className="bg-navy-50 border border-navy-200 rounded-lg p-2.5">
      <div className="text-[10px] text-navy-500 uppercase tracking-wide">{label}</div>
      <div
        className={cn(
          "text-[13px] text-navy-900 font-semibold mt-[3px] break-all",
          mono && "font-mono",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function relTime(iso: string): string {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
