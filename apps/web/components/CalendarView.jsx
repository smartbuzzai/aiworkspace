"use client";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Clock, MapPin } from "lucide-react";

const theme = {
  navy950:"#0a0f1e", navy900:"#0f172a", navy800:"#1e293b",
  navy700:"#334155", navy500:"#64748b", navy400:"#94a3b8",
  navy300:"#cbd5e1", navy200:"#e2e8f0", navy100:"#f1f5f9", navy50:"#f8fafc",
  blue600:"#2563eb", blue500:"#3b82f6", blue400:"#60a5fa",
  green500:"#10b981", green400:"#34d399", teal500:"#14b8a6",
  white:"#ffffff"
};

const TYPE_COLORS = {
  meeting:  { bg:"rgba(59,130,246,0.12)", text:"#2563eb", border:"rgba(59,130,246,0.3)" },
  call:     { bg:"rgba(139,92,246,0.12)", text:"#7c3aed", border:"rgba(139,92,246,0.3)" },
  focus:    { bg:"rgba(16,185,129,0.12)", text:"#059669", border:"rgba(16,185,129,0.3)" },
  task:     { bg:"rgba(245,158,11,0.12)", text:"#d97706", border:"rgba(245,158,11,0.3)" },
  personal: { bg:"rgba(236,72,153,0.12)", text:"#db2777", border:"rgba(236,72,153,0.3)" },
};

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function startOfWeek(d) {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function CalendarView() {
  const [events, setEvents] = useState([]);
  const [viewMode, setViewMode] = useState("month"); // month | week
  const [cursor, setCursor] = useState(new Date());
  const [creating, setCreating] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => { loadEvents(); }, [cursor, viewMode]);

  async function loadEvents() {
    let from, to;
    if (viewMode === "month") {
      from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
      // Extend to cover visible days from prev/next month
      from.setDate(from.getDate() - from.getDay());
      to.setDate(to.getDate() + (6 - to.getDay()));
    } else {
      from = startOfWeek(cursor);
      to = new Date(from);
      to.setDate(to.getDate() + 7);
    }
    try {
      const r = await fetch(`/api/events?from=${from.toISOString()}&to=${to.toISOString()}`, { credentials:"include" });
      const d = await r.json();
      setEvents(d.events || []);
    } catch {
      setEvents([]);
    }
  }

  function navigate(dir) {
    const d = new Date(cursor);
    if (viewMode === "month") d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + 7 * dir);
    setCursor(d);
  }

  function goToday() { setCursor(new Date()); }

  const title = viewMode === "month"
    ? cursor.toLocaleDateString("en-US", { month:"long", year:"numeric" })
    : (() => {
        const s = startOfWeek(cursor);
        const e = new Date(s); e.setDate(e.getDate() + 6);
        return `${s.toLocaleDateString("en-US", { month:"short", day:"numeric" })} – ${e.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}`;
      })();

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Toolbar */}
      <div style={{
        display:"flex", alignItems:"center", gap:10, flexWrap:"wrap"
      }}>
        <div style={{ display:"flex", gap:4 }}>
          <NavBtn onClick={() => navigate(-1)}><ChevronLeft size={16} /></NavBtn>
          <button onClick={goToday} style={{
            padding:"7px 14px", borderRadius:8, fontSize:12, fontWeight:600,
            background:theme.white, border:`1px solid ${theme.navy200}`,
            color:theme.navy700, cursor:"pointer", fontFamily:"inherit"
          }}>Today</button>
          <NavBtn onClick={() => navigate(1)}><ChevronRight size={16} /></NavBtn>
        </div>
        <h2 style={{ fontSize:18, fontWeight:700, color:theme.navy900, margin:0, flex:1 }}>{title}</h2>
        <div style={{ display:"flex", gap:4 }}>
          {["month","week"].map(m => (
            <button key={m} onClick={() => setViewMode(m)} style={{
              padding:"7px 14px", borderRadius:8, fontSize:12, fontWeight:600,
              background: viewMode === m ? theme.navy900 : theme.white,
              color: viewMode === m ? theme.white : theme.navy700,
              border:`1px solid ${viewMode === m ? theme.navy900 : theme.navy200}`,
              cursor:"pointer", fontFamily:"inherit", textTransform:"capitalize"
            }}>{m}</button>
          ))}
        </div>
        <button onClick={() => setCreating(true)} style={{
          display:"flex", alignItems:"center", gap:6,
          padding:"8px 14px", borderRadius:10, fontSize:12, fontWeight:600,
          background:theme.blue600, color:theme.white, border:"none",
          cursor:"pointer", fontFamily:"inherit"
        }}>
          <Plus size={14} /> New Event
        </button>
      </div>

      {/* Grid */}
      {viewMode === "month" ? (
        <MonthGrid cursor={cursor} events={events} onSelect={setSelectedEvent} />
      ) : (
        <WeekGrid cursor={cursor} events={events} onSelect={setSelectedEvent} isMobile={isMobile} />
      )}

      {/* Create modal */}
      {creating && (
        <EventModal
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); loadEvents(); }}
        />
      )}

      {/* Event detail popup */}
      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={async () => {
            await fetch(`/api/events/${selectedEvent.id}`, { method:"DELETE", credentials:"include" });
            setSelectedEvent(null);
            loadEvents();
          }}
        />
      )}
    </div>
  );
}

// ─── Month Grid ──────────────────────────────────────────────
function MonthGrid({ cursor, events, onSelect }) {
  const year = cursor.getFullYear(), month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const weeks = [];
  const d = new Date(startDate);
  for (let w = 0; w < 6; w++) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    weeks.push(week);
    // Stop if we've passed this month's last day and started a new week
    if (d.getMonth() !== month && d.getDay() === 0) break;
  }

  const today = new Date();

  return (
    <div style={{
      background:theme.white, border:`1px solid ${theme.navy200}`,
      borderRadius:14, overflow:"hidden"
    }}>
      {/* Day headers */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", borderBottom:`1px solid ${theme.navy200}` }}>
        {DAYS.map(d => (
          <div key={d} style={{
            padding:"10px 8px", textAlign:"center",
            fontSize:11, fontWeight:700, color:theme.navy500,
            textTransform:"uppercase", letterSpacing:1
          }}>{d}</div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", minHeight:100 }}>
          {week.map((day, di) => {
            const isToday = sameDay(day, today);
            const isOtherMonth = day.getMonth() !== month;
            const dayEvents = events.filter(e => sameDay(new Date(e.starts_at), day));
            return (
              <div key={di} style={{
                borderRight: di < 6 ? `1px solid ${theme.navy100}` : "none",
                borderBottom: wi < weeks.length - 1 ? `1px solid ${theme.navy100}` : "none",
                padding:6, minHeight:90,
                background: isToday ? "rgba(59,130,246,0.03)" : "transparent",
                opacity: isOtherMonth ? 0.4 : 1
              }}>
                <div style={{
                  width:26, height:26, borderRadius:"50%",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:12, fontWeight: isToday ? 700 : 500,
                  color: isToday ? theme.white : theme.navy700,
                  background: isToday ? theme.blue600 : "transparent",
                  marginBottom:4
                }}>{day.getDate()}</div>
                {dayEvents.slice(0, 3).map(e => {
                  const c = TYPE_COLORS[e.event_type] || TYPE_COLORS.meeting;
                  return (
                    <div key={e.id} onClick={() => onSelect(e)} style={{
                      fontSize:11, padding:"2px 6px", borderRadius:4, marginBottom:2,
                      background:c.bg, color:c.text, borderLeft:`2px solid ${c.border}`,
                      cursor:"pointer", overflow:"hidden", textOverflow:"ellipsis",
                      whiteSpace:"nowrap", fontWeight:500
                    }}>
                      {new Date(e.starts_at).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" })} {e.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div style={{ fontSize:10, color:theme.navy500, paddingLeft:6 }}>+{dayEvents.length - 3} more</div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Week Grid ───────────────────────────────────────────────
function WeekGrid({ cursor, events, onSelect, isMobile }) {
  const weekStart = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const today = new Date();

  return (
    <div style={{
      background:theme.white, border:`1px solid ${theme.navy200}`,
      borderRadius:14, overflow:"hidden"
    }}>
      {/* Day headers */}
      <div style={{
        display:"grid",
        gridTemplateColumns: `50px repeat(7, 1fr)`,
        borderBottom:`1px solid ${theme.navy200}`
      }}>
        <div />
        {days.map((d, i) => (
          <div key={i} style={{
            padding:"10px 4px", textAlign:"center",
            borderLeft:`1px solid ${theme.navy100}`
          }}>
            <div style={{ fontSize:11, fontWeight:600, color:theme.navy500 }}>{DAYS[d.getDay()]}</div>
            <div style={{
              width:28, height:28, borderRadius:"50%", margin:"4px auto 0",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:14, fontWeight:700,
              background: sameDay(d, today) ? theme.blue600 : "transparent",
              color: sameDay(d, today) ? theme.white : theme.navy900
            }}>{d.getDate()}</div>
          </div>
        ))}
      </div>

      {/* Hour rows */}
      <div style={{ maxHeight:600, overflowY:"auto" }}>
        {HOURS.filter(h => h >= 6 && h <= 22).map(hour => (
          <div key={hour} style={{
            display:"grid",
            gridTemplateColumns: `50px repeat(7, 1fr)`,
            minHeight:48, borderBottom:`1px solid ${theme.navy100}`
          }}>
            <div style={{
              fontSize:10, color:theme.navy500, padding:"4px 8px",
              fontFamily:"'JetBrains Mono', monospace", textAlign:"right"
            }}>
              {hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`}
            </div>
            {days.map((day, di) => {
              const slotEvents = events.filter(e => {
                const s = new Date(e.starts_at);
                return sameDay(s, day) && s.getHours() === hour;
              });
              return (
                <div key={di} style={{
                  borderLeft:`1px solid ${theme.navy100}`,
                  padding:2, position:"relative"
                }}>
                  {slotEvents.map(e => {
                    const c = TYPE_COLORS[e.event_type] || TYPE_COLORS.meeting;
                    const duration = (new Date(e.ends_at) - new Date(e.starts_at)) / 3600000;
                    return (
                      <div key={e.id} onClick={() => onSelect(e)} style={{
                        fontSize:11, padding:"3px 6px", borderRadius:5,
                        background:c.bg, color:c.text, borderLeft:`3px solid ${c.border}`,
                        cursor:"pointer", fontWeight:500,
                        minHeight: Math.max(22, duration * 44),
                        overflow:"hidden", lineHeight:1.3
                      }}>
                        <div style={{ fontWeight:600 }}>{e.title}</div>
                        {!isMobile && <div style={{ fontSize:10, opacity:0.8 }}>
                          {new Date(e.starts_at).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" })}
                        </div>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Event Create Modal ──────────────────────────────────────
function EventModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    title: "", location: "", event_type: "meeting",
    date: new Date().toISOString().slice(0, 10),
    start_time: "09:00", end_time: "10:00",
    description: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      const starts_at = new Date(`${form.date}T${form.start_time}:00`).toISOString();
      const ends_at = new Date(`${form.date}T${form.end_time}:00`).toISOString();
      const r = await fetch("/api/events", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          location: form.location || undefined,
          description: form.description || undefined,
          event_type: form.event_type,
          starts_at, ends_at,
        })
      });
      if (r.ok) onSaved();
    } finally {
      setSaving(false);
    }
  }

  const field = (label, key, type = "text", extra = {}) => (
    <div style={{ marginBottom:12 }}>
      <label style={{ display:"block", fontSize:12, fontWeight:600, color:theme.navy700, marginBottom:4 }}>{label}</label>
      <input type={type} value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        style={{
          width:"100%", padding:"9px 12px", borderRadius:8, fontSize:13,
          border:`1px solid ${theme.navy200}`, outline:"none",
          fontFamily:"inherit", color:theme.navy900, boxSizing:"border-box",
          ...extra
        }}
      />
    </div>
  );

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.4)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:100
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:theme.white, borderRadius:16, padding:24,
        width:420, maxWidth:"95vw", maxHeight:"90vh", overflowY:"auto",
        boxShadow:"0 20px 60px rgba(0,0,0,0.2)"
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:700, color:theme.navy900 }}>New Event</h3>
          <button onClick={onClose} style={{
            background:"transparent", border:"none", cursor:"pointer", color:theme.navy500, padding:4
          }}><X size={18} /></button>
        </div>

        {field("Title", "title")}
        {field("Location", "location")}
        {field("Date", "date", "date")}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {field("Start", "start_time", "time")}
          {field("End", "end_time", "time")}
        </div>
        <div style={{ marginBottom:12 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:600, color:theme.navy700, marginBottom:4 }}>Type</label>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {Object.keys(TYPE_COLORS).map(t => (
              <button key={t} onClick={() => setForm(f => ({ ...f, event_type: t }))} style={{
                padding:"6px 12px", borderRadius:8, fontSize:12, fontWeight:600,
                background: form.event_type === t ? TYPE_COLORS[t].bg : theme.navy50,
                color: form.event_type === t ? TYPE_COLORS[t].text : theme.navy500,
                border:`1px solid ${form.event_type === t ? TYPE_COLORS[t].border : theme.navy200}`,
                cursor:"pointer", fontFamily:"inherit", textTransform:"capitalize"
              }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom:16 }}>
          <label style={{ display:"block", fontSize:12, fontWeight:600, color:theme.navy700, marginBottom:4 }}>Notes</label>
          <textarea value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={3}
            style={{
              width:"100%", padding:"9px 12px", borderRadius:8, fontSize:13,
              border:`1px solid ${theme.navy200}`, outline:"none", resize:"vertical",
              fontFamily:"inherit", color:theme.navy900, boxSizing:"border-box"
            }}
          />
        </div>

        <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
          <button onClick={onClose} style={{
            padding:"9px 16px", borderRadius:8, fontSize:13, fontWeight:600,
            background:"transparent", border:`1px solid ${theme.navy200}`,
            color:theme.navy700, cursor:"pointer", fontFamily:"inherit"
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.title.trim()} style={{
            padding:"9px 18px", borderRadius:8, fontSize:13, fontWeight:600,
            background:theme.blue600, color:theme.white, border:"none",
            cursor:"pointer", fontFamily:"inherit",
            opacity: (saving || !form.title.trim()) ? 0.5 : 1
          }}>{saving ? "Saving…" : "Create Event"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Event Detail Popup ──────────────────────────────────────
function EventDetail({ event, onClose, onDelete }) {
  const c = TYPE_COLORS[event.event_type] || TYPE_COLORS.meeting;
  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.4)",
      display:"flex", alignItems:"center", justifyContent:"center", zIndex:100
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background:theme.white, borderRadius:16, padding:24,
        width:380, maxWidth:"95vw",
        boxShadow:"0 20px 60px rgba(0,0,0,0.2)"
      }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:16 }}>
          <span style={{
            padding:"4px 10px", borderRadius:6, fontSize:11, fontWeight:600,
            background:c.bg, color:c.text, textTransform:"capitalize"
          }}>{event.event_type}</span>
          <button onClick={onClose} style={{
            background:"transparent", border:"none", cursor:"pointer", color:theme.navy500
          }}><X size={16} /></button>
        </div>
        <h3 style={{ margin:"0 0 12px", fontSize:18, fontWeight:700, color:theme.navy900 }}>
          {event.title}
        </h3>
        <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:theme.navy700, marginBottom:8 }}>
          <Clock size={14} color={theme.navy500} />
          {new Date(event.starts_at).toLocaleString("en-US", {
            weekday:"short", month:"short", day:"numeric", hour:"numeric", minute:"2-digit"
          })}
          {" – "}
          {new Date(event.ends_at).toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit" })}
        </div>
        {event.location && (
          <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, color:theme.navy700, marginBottom:8 }}>
            <MapPin size={14} color={theme.navy500} />
            {event.location}
          </div>
        )}
        {event.description && (
          <p style={{ fontSize:13, color:theme.navy700, lineHeight:1.6, margin:"12px 0" }}>
            {event.description}
          </p>
        )}
        <div style={{ display:"flex", gap:8, justifyContent:"flex-end", marginTop:16 }}>
          <button onClick={onDelete} style={{
            padding:"8px 14px", borderRadius:8, fontSize:12, fontWeight:600,
            background:"rgba(239,68,68,0.08)", color:"#dc2626",
            border:"1px solid rgba(239,68,68,0.2)",
            cursor:"pointer", fontFamily:"inherit"
          }}>Delete</button>
          <button onClick={onClose} style={{
            padding:"8px 14px", borderRadius:8, fontSize:12, fontWeight:600,
            background:theme.navy900, color:theme.white, border:"none",
            cursor:"pointer", fontFamily:"inherit"
          }}>Close</button>
        </div>
      </div>
    </div>
  );
}

function NavBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      width:34, height:34, borderRadius:8,
      background:theme.white, border:`1px solid ${theme.navy200}`,
      cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
      color:theme.navy700
    }}>{children}</button>
  );
}
