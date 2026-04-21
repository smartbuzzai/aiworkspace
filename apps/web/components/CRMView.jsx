"use client";
import { useEffect, useState } from "react";
import { Search, Plus, Mail, Phone, Clock, X, Sparkles, Filter } from "lucide-react";
import { theme } from "../lib/theme";

export default function CRMView() {
  const [contacts, setContacts] = useState([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [q]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/contacts${q ? `?q=${encodeURIComponent(q)}` : ""}`, {
        credentials:"include"
      });
      const d = await r.json();
      setContacts(d.contacts || []);
    } finally {
      setLoading(false);
    }
  }

  async function openContact(c) {
    setSelected(c);
    try {
      const r = await fetch(`/api/contacts/${c.id}`, { credentials:"include" });
      const d = await r.json();
      setInteractions(d.interactions || []);
    } catch {}
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Filter bar */}
      <div style={{
        background:theme.white, border:`1px solid ${theme.navy200}`,
        borderRadius:12, padding:14,
        display:"flex", gap:10, alignItems:"center", flexWrap:"wrap"
      }}>
        <div style={{
          display:"flex", alignItems:"center", gap:8,
          flex:1, minWidth:200,
          background:theme.navy50, border:`1px solid ${theme.navy200}`,
          borderRadius:9, padding:"7px 12px"
        }}>
          <Search size={15} color={theme.navy500} />
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search by name, company, or email"
            style={{
              border:"none", outline:"none", background:"transparent",
              fontSize:13, width:"100%", color:theme.navy800, fontFamily:"inherit"
            }}
          />
        </div>
        <button onClick={() => setShowNew(true)} style={{
          background:theme.blue600, color:theme.white, border:"none",
          padding:"7px 12px", borderRadius:8, fontSize:12, fontWeight:600,
          cursor:"pointer", display:"flex", alignItems:"center", gap:6,
          fontFamily:"inherit"
        }}><Plus size={13} /> New contact</button>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ color:theme.navy500, fontSize:13, padding:24 }}>Loading…</div>
      ) : contacts.length === 0 ? (
        <div style={{
          background:theme.white, border:`1px solid ${theme.navy200}`,
          borderRadius:12, padding:40, textAlign:"center",
          color:theme.navy500, fontSize:14
        }}>
          {q ? "No contacts match that search." : "No contacts yet. Click \"New contact\" above."}
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(320px, 1fr))", gap:12 }}>
          {contacts.map(c => <ContactCard key={c.id} contact={c} onClick={() => openContact(c)} />)}
        </div>
      )}

      {selected && (
        <ContactModal
          contact={selected} interactions={interactions}
          onClose={() => { setSelected(null); setInteractions([]); }}
          onSaved={(updated) => { setSelected(updated); load(); }}
        />
      )}
      {showNew && (
        <NewContactModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load(); }} />
      )}
    </div>
  );
}

function ContactCard({ contact, onClick }) {
  const initial = (contact.name || "?")[0].toUpperCase();
  const scoreColor = contact.score >= 80 ? theme.green500
                   : contact.score >= 60 ? theme.amber500 : theme.navy500;

  return (
    <div onClick={onClick} style={{
      background:theme.white, border:`1px solid ${theme.navy200}`,
      borderRadius:14, padding:16,
      display:"flex", gap:14, cursor:"pointer",
      transition:"all 0.15s"
    }}
    onMouseEnter={e => {
      e.currentTarget.style.borderColor = "#60a5fa";
      e.currentTarget.style.transform = "translateY(-1px)";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.borderColor = theme.navy200;
      e.currentTarget.style.transform = "translateY(0)";
    }}>
      <div style={{
        width:46, height:46, borderRadius:"50%",
        background:`linear-gradient(135deg, ${theme.blue500}, ${theme.teal500})`,
        color:theme.white, display:"flex", alignItems:"center", justifyContent:"center",
        fontWeight:700, fontSize:14, flexShrink:0
      }}>{initial}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:14, fontWeight:700, color:theme.navy900 }}>{contact.name}</span>
          <StatusPill status={contact.status} />
        </div>
        <div style={{ fontSize:12, color:theme.navy500, marginTop:2 }}>
          {[contact.role, contact.company].filter(Boolean).join(" · ") || "—"}
        </div>
        <div style={{
          display:"flex", gap:14, marginTop:10,
          fontSize:11, color:theme.navy600, flexWrap:"wrap"
        }}>
          {contact.email && (
            <span style={{ display:"flex", alignItems:"center", gap:4, overflow:"hidden", textOverflow:"ellipsis" }}>
              <Mail size={11} /> {contact.email}
            </span>
          )}
          {contact.last_touch_at && (
            <span style={{ display:"flex", alignItems:"center", gap:4 }}>
              <Clock size={11} /> {relTime(contact.last_touch_at)}
            </span>
          )}
        </div>
      </div>
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
        <div style={{
          fontFamily:"'JetBrains Mono', monospace",
          fontSize:22, fontWeight:800, color:scoreColor,
          letterSpacing:"-0.5px"
        }}>{contact.score}</div>
        <div style={{ fontSize:10, color:theme.navy500, textTransform:"uppercase", letterSpacing:0.5 }}>
          score
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    hot:     { bg:"rgba(239,68,68,0.1)",  fg:theme.red500 },
    active:  { bg:"rgba(16,185,129,0.1)", fg:theme.green500 },
    nurture: { bg:"rgba(59,130,246,0.1)", fg:theme.blue500 },
    cold:    { bg:theme.navy100,           fg:theme.navy500 }
  };
  const c = map[status] || map.active;
  return (
    <span style={{
      fontSize:10, fontWeight:700, padding:"2px 8px",
      borderRadius:5, background:c.bg, color:c.fg,
      textTransform:"uppercase", letterSpacing:0.5
    }}>{status}</span>
  );
}

function ContactModal({ contact, interactions, onClose, onSaved }) {
  return (
    <Modal onClose={onClose}>
      <div style={{
        padding:24,
        background:`linear-gradient(135deg, ${theme.navy900}, ${theme.navy800})`,
        color:theme.white
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:12 }}>
          <div style={{ display:"flex", gap:14, alignItems:"center" }}>
            <div style={{
              width:58, height:58, borderRadius:"50%",
              background:`linear-gradient(135deg, ${theme.blue500}, ${theme.teal500})`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontWeight:700, fontSize:20
            }}>{(contact.name || "?")[0].toUpperCase()}</div>
            <div>
              <div style={{ fontSize:20, fontWeight:700, letterSpacing:"-0.4px" }}>{contact.name}</div>
              <div style={{ fontSize:13, color:theme.navy300, marginTop:2 }}>
                {[contact.role, contact.company].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background:"rgba(255,255,255,0.08)", border:"none",
            color:theme.white, padding:6, borderRadius:8, cursor:"pointer"
          }}><X size={16} /></button>
        </div>
      </div>

      <div style={{ padding:24 }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
          {contact.email && <DetailCell label="Email" value={contact.email} />}
          {contact.phone && <DetailCell label="Phone" value={contact.phone} />}
          <DetailCell label="Score" value={contact.score} mono />
          <DetailCell label="Last touch" value={contact.last_touch_at ? relTime(contact.last_touch_at) : "—"} />
        </div>

        {contact.notes && (
          <div style={{
            padding:12, borderRadius:10,
            background:theme.navy50, border:`1px solid ${theme.navy200}`,
            marginBottom:14
          }}>
            <div style={{ fontSize:10, color:theme.navy500, textTransform:"uppercase", letterSpacing:0.5, marginBottom:6 }}>
              Notes
            </div>
            <div style={{ fontSize:13, color:theme.navy700, whiteSpace:"pre-wrap", lineHeight:1.5 }}>
              {contact.notes}
            </div>
          </div>
        )}

        {interactions.length > 0 && (
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:theme.navy600, textTransform:"uppercase", letterSpacing:0.5, marginBottom:10 }}>
              Recent interactions
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
              {interactions.slice(0, 8).map(i => (
                <div key={i.id} style={{
                  padding:10, background:theme.navy50,
                  border:`1px solid ${theme.navy200}`, borderRadius:8,
                  fontSize:12, color:theme.navy700,
                  display:"flex", justifyContent:"space-between", gap:10
                }}>
                  <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                    <b style={{ textTransform:"capitalize" }}>{i.kind}</b> · {i.summary}
                  </span>
                  <span style={{ color:theme.navy500, fontFamily:"'JetBrains Mono', monospace", fontSize:11, flexShrink:0 }}>
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

function NewContactModal({ onClose, onCreated }) {
  const [f, setF] = useState({ name:"", email:"", phone:"", company:"", role:"", status:"active", score:50 });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/contacts", {
        method:"POST", credentials:"include",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(f)
      });
      onCreated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <div style={{
        padding:"16px 20px", borderBottom:`1px solid ${theme.navy200}`,
        display:"flex", alignItems:"center"
      }}>
        <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:theme.navy900 }}>New contact</h3>
        <button onClick={onClose} style={{
          marginLeft:"auto", background:"transparent", border:"none",
          color:theme.navy500, cursor:"pointer", padding:4
        }}><X size={16} /></button>
      </div>
      <div style={{ padding:20, display:"flex", flexDirection:"column", gap:10 }}>
        <TextInput label="Name *" value={f.name} onChange={v => setF({...f, name:v})} />
        <TextInput label="Email" value={f.email} onChange={v => setF({...f, email:v})} />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          <TextInput label="Company" value={f.company} onChange={v => setF({...f, company:v})} />
          <TextInput label="Role" value={f.role} onChange={v => setF({...f, role:v})} />
        </div>
        <TextInput label="Phone" value={f.phone} onChange={v => setF({...f, phone:v})} />
        <button onClick={save} disabled={!f.name || saving} style={{
          background:theme.blue600, color:theme.white, border:"none",
          padding:"10px 16px", borderRadius:9, fontSize:13, fontWeight:600,
          cursor: (saving || !f.name) ? "wait" : "pointer",
          fontFamily:"inherit", marginTop:4,
          opacity: (saving || !f.name) ? 0.6 : 1
        }}>
          {saving ? "Saving…" : "Create contact"}
        </button>
      </div>
    </Modal>
  );
}

function TextInput({ label, value, onChange }) {
  return (
    <div>
      <div style={{
        fontSize:11, fontWeight:600, color:theme.navy600,
        textTransform:"uppercase", letterSpacing:0.5, marginBottom:5
      }}>{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} style={{
        width:"100%", padding:"8px 11px", fontSize:13,
        border:`1px solid ${theme.navy200}`, borderRadius:8,
        outline:"none", fontFamily:"inherit", color:theme.navy900,
        background:theme.white, boxSizing:"border-box"
      }} />
    </div>
  );
}

function Modal({ onClose, children }) {
  return (
    <div onClick={onClose} style={{
      position:"fixed", inset:0, background:"rgba(10,15,30,0.55)",
      zIndex:90, display:"flex", alignItems:"center", justifyContent:"center",
      padding:20, backdropFilter:"blur(4px)"
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:theme.white, borderRadius:16, maxWidth:560, width:"100%",
        maxHeight:"90vh", overflow:"auto",
        border:`1px solid ${theme.navy200}`
      }}>{children}</div>
    </div>
  );
}

function DetailCell({ label, value, mono }) {
  return (
    <div style={{
      background:theme.navy50, border:`1px solid ${theme.navy200}`,
      borderRadius:9, padding:10
    }}>
      <div style={{ fontSize:10, color:theme.navy500, textTransform:"uppercase", letterSpacing:0.5 }}>{label}</div>
      <div style={{
        fontSize:13, color:theme.navy900, fontWeight:600, marginTop:3,
        fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit",
        wordBreak:"break-all"
      }}>{value}</div>
    </div>
  );
}

function relTime(iso) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}
