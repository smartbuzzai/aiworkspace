"use client";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Plus, X, Clock, MapPin } from "lucide-react";
import { cn } from "../lib/cn";

// ─── TypeScript Interfaces ──────────────────────────────────
interface CalendarEvent {
  id: string;
  title: string;
  location?: string;
  description?: string;
  event_type: string;
  starts_at: string;
  ends_at: string;
}

interface MonthGridProps {
  cursor: Date;
  events: CalendarEvent[];
  onSelect: (event: CalendarEvent) => void;
}

interface WeekGridProps {
  cursor: Date;
  events: CalendarEvent[];
  onSelect: (event: CalendarEvent) => void;
  isMobile: boolean;
}

interface EventModalProps {
  onClose: () => void;
  onSaved: () => void;
}

interface EventDetailProps {
  event: CalendarEvent;
  onClose: () => void;
  onDelete: () => void;
}

interface NavBtnProps {
  children: ReactNode;
  onClick: () => void;
}

// ─── Type Color Map (Tailwind classes) ──────────────────────
const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  meeting:  { bg: "bg-blue-500/[0.12]",    text: "text-blue-600",   border: "border-l-blue-500/30" },
  call:     { bg: "bg-violet-500/[0.12]",   text: "text-violet-600", border: "border-l-violet-500/30" },
  focus:    { bg: "bg-emerald-500/[0.12]",   text: "text-emerald-600", border: "border-l-emerald-500/30" },
  task:     { bg: "bg-amber-500/[0.12]",     text: "text-amber-600",  border: "border-l-amber-500/30" },
  personal: { bg: "bg-pink-500/[0.12]",      text: "text-pink-600",   border: "border-l-pink-500/30" },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function startOfWeek(d: Date): Date {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function CalendarView() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState<Date>(new Date());
  const [creating, setCreating] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isMobile, setIsMobile] = useState<boolean>(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    loadEvents();
  }, [cursor, viewMode]);

  async function loadEvents(): Promise<void> {
    let from: Date, to: Date;
    if (viewMode === "month") {
      from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
      from.setDate(from.getDate() - from.getDay());
      to.setDate(to.getDate() + (6 - to.getDay()));
    } else {
      from = startOfWeek(cursor);
      to = new Date(from);
      to.setDate(to.getDate() + 7);
    }
    try {
      const r = await fetch(
        `/api/events?from=${from.toISOString()}&to=${to.toISOString()}`,
        { credentials: "include" }
      );
      const d = await r.json();
      setEvents(d.events || []);
    } catch {
      setEvents([]);
    }
  }

  function navigate(dir: number): void {
    const d = new Date(cursor);
    if (viewMode === "month") d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + 7 * dir);
    setCursor(d);
  }

  function goToday(): void {
    setCursor(new Date());
  }

  const title =
    viewMode === "month"
      ? cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : (() => {
          const s = startOfWeek(cursor);
          const e = new Date(s);
          e.setDate(e.getDate() + 6);
          return `${s.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${e.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
        })();

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="flex gap-1">
          <NavBtn onClick={() => navigate(-1)}>
            <ChevronLeft size={16} />
          </NavBtn>
          <button
            onClick={goToday}
            className="px-3.5 py-[7px] rounded-lg text-xs font-semibold bg-white border border-navy-200 text-navy-700 cursor-pointer font-sans"
          >
            Today
          </button>
          <NavBtn onClick={() => navigate(1)}>
            <ChevronRight size={16} />
          </NavBtn>
        </div>
        <h2 className="text-lg font-bold text-navy-900 m-0 flex-1">{title}</h2>
        <div className="flex gap-1">
          {(["month", "week"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={cn(
                "px-3.5 py-[7px] rounded-lg text-xs font-semibold cursor-pointer font-sans capitalize",
                viewMode === m
                  ? "bg-navy-900 text-white border border-navy-900"
                  : "bg-white text-navy-700 border border-navy-200"
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] text-xs font-semibold bg-blue-600 text-white border-none cursor-pointer font-sans"
        >
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
          onSaved={() => {
            setCreating(false);
            loadEvents();
          }}
        />
      )}

      {/* Event detail popup */}
      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={async () => {
            await fetch(`/api/events/${selectedEvent.id}`, {
              method: "DELETE",
              credentials: "include",
            });
            setSelectedEvent(null);
            loadEvents();
          }}
        />
      )}
    </div>
  );
}

// ─── Month Grid ──────────────────────────────────────────────
function MonthGrid({ cursor, events, onSelect }: MonthGridProps) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - startDate.getDay());

  const weeks: Date[][] = [];
  const d = new Date(startDate);
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    weeks.push(week);
    if (d.getMonth() !== month && d.getDay() === 0) break;
  }

  const today = new Date();

  return (
    <div className="bg-white border border-navy-200 rounded-[14px] overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-navy-200">
        {DAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-2.5 text-center text-[11px] font-bold text-navy-500 uppercase tracking-wider"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 min-h-[100px]">
          {week.map((day, di) => {
            const isToday = sameDay(day, today);
            const isOtherMonth = day.getMonth() !== month;
            const dayEvents = events.filter((e) =>
              sameDay(new Date(e.starts_at), day)
            );
            return (
              <div
                key={di}
                className={cn(
                  "p-1.5 min-h-[90px]",
                  di < 6 && "border-r border-navy-100",
                  wi < weeks.length - 1 && "border-b border-navy-100",
                  isToday && "bg-blue-500/[0.03]",
                  isOtherMonth && "opacity-40"
                )}
              >
                <div
                  className={cn(
                    "w-[26px] h-[26px] rounded-full flex items-center justify-center text-xs mb-1",
                    isToday
                      ? "font-bold text-white bg-blue-600"
                      : "font-medium text-navy-700 bg-transparent"
                  )}
                >
                  {day.getDate()}
                </div>
                {dayEvents.slice(0, 3).map((e) => {
                  const c = TYPE_COLORS[e.event_type] || TYPE_COLORS.meeting;
                  return (
                    <div
                      key={e.id}
                      onClick={() => onSelect(e)}
                      className={cn(
                        "text-[11px] px-1.5 py-0.5 rounded mb-0.5 border-l-2 cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap font-medium",
                        c.bg,
                        c.text,
                        c.border
                      )}
                    >
                      {new Date(e.starts_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}{" "}
                      {e.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-navy-500 pl-1.5">
                    +{dayEvents.length - 3} more
                  </div>
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
function WeekGrid({ cursor, events, onSelect, isMobile }: WeekGridProps) {
  const weekStart = startOfWeek(cursor);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const today = new Date();

  return (
    <div className="bg-white border border-navy-200 rounded-[14px] overflow-hidden">
      {/* Day headers */}
      <div
        className="grid border-b border-navy-200"
        style={{ gridTemplateColumns: "50px repeat(7, 1fr)" }}
      >
        <div />
        {days.map((d, i) => (
          <div key={i} className="px-1 py-2.5 text-center border-l border-navy-100">
            <div className="text-[11px] font-semibold text-navy-500">
              {DAYS[d.getDay()]}
            </div>
            <div
              className={cn(
                "w-7 h-7 rounded-full mx-auto mt-1 flex items-center justify-center text-sm font-bold",
                sameDay(d, today)
                  ? "bg-blue-600 text-white"
                  : "bg-transparent text-navy-900"
              )}
            >
              {d.getDate()}
            </div>
          </div>
        ))}
      </div>

      {/* Hour rows */}
      <div className="max-h-[600px] overflow-y-auto">
        {HOURS.filter((h) => h >= 6 && h <= 22).map((hour) => (
          <div
            key={hour}
            className="grid min-h-[48px] border-b border-navy-100"
            style={{ gridTemplateColumns: "50px repeat(7, 1fr)" }}
          >
            <div className="text-[10px] text-navy-500 p-1 pr-2 font-mono text-right">
              {hour === 0
                ? "12 AM"
                : hour < 12
                  ? `${hour} AM`
                  : hour === 12
                    ? "12 PM"
                    : `${hour - 12} PM`}
            </div>
            {days.map((day, di) => {
              const slotEvents = events.filter((e) => {
                const s = new Date(e.starts_at);
                return sameDay(s, day) && s.getHours() === hour;
              });
              return (
                <div key={di} className="border-l border-navy-100 p-0.5 relative">
                  {slotEvents.map((e) => {
                    const c = TYPE_COLORS[e.event_type] || TYPE_COLORS.meeting;
                    const duration =
                      (new Date(e.ends_at).getTime() - new Date(e.starts_at).getTime()) /
                      3600000;
                    return (
                      <div
                        key={e.id}
                        onClick={() => onSelect(e)}
                        className={cn(
                          "text-[11px] px-1.5 py-[3px] rounded-[5px] border-l-[3px] cursor-pointer font-medium overflow-hidden leading-snug",
                          c.bg,
                          c.text,
                          c.border
                        )}
                        style={{ minHeight: Math.max(22, duration * 44) }}
                      >
                        <div className="font-semibold">{e.title}</div>
                        {!isMobile && (
                          <div className="text-[10px] opacity-80">
                            {new Date(e.starts_at).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </div>
                        )}
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
interface EventFormState {
  title: string;
  location: string;
  event_type: string;
  date: string;
  start_time: string;
  end_time: string;
  description: string;
}

function EventModal({ onClose, onSaved }: EventModalProps) {
  const [form, setForm] = useState<EventFormState>({
    title: "",
    location: "",
    event_type: "meeting",
    date: new Date().toISOString().slice(0, 10),
    start_time: "09:00",
    end_time: "10:00",
    description: "",
  });
  const [saving, setSaving] = useState<boolean>(false);

  async function handleSave(): Promise<void> {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      const starts_at = new Date(`${form.date}T${form.start_time}:00`).toISOString();
      const ends_at = new Date(`${form.date}T${form.end_time}:00`).toISOString();
      const r = await fetch("/api/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          location: form.location || undefined,
          description: form.description || undefined,
          event_type: form.event_type,
          starts_at,
          ends_at,
        }),
      });
      if (r.ok) onSaved();
    } finally {
      setSaving(false);
    }
  }

  const field = (
    label: string,
    key: keyof EventFormState,
    type: string = "text"
  ) => (
    <div className="mb-3">
      <label className="block text-xs font-semibold text-navy-700 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full px-3 py-[9px] rounded-lg text-[13px] border border-navy-200 outline-none font-sans text-navy-900 box-border"
      />
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 w-[420px] max-w-[95vw] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
      >
        <div className="flex justify-between mb-5">
          <h3 className="m-0 text-lg font-bold text-navy-900">New Event</h3>
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer text-navy-500 p-1"
          >
            <X size={18} />
          </button>
        </div>

        {field("Title", "title")}
        {field("Location", "location")}
        {field("Date", "date", "date")}
        <div className="grid grid-cols-2 gap-3">
          {field("Start", "start_time", "time")}
          {field("End", "end_time", "time")}
        </div>
        <div className="mb-3">
          <label className="block text-xs font-semibold text-navy-700 mb-1">
            Type
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {Object.keys(TYPE_COLORS).map((t) => {
              const tc = TYPE_COLORS[t];
              return (
                <button
                  key={t}
                  onClick={() => setForm((f) => ({ ...f, event_type: t }))}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer font-sans capitalize border",
                    form.event_type === t
                      ? cn(tc.bg, tc.text, "border-current")
                      : "bg-navy-50 text-navy-500 border-navy-200"
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs font-semibold text-navy-700 mb-1">
            Notes
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="w-full px-3 py-[9px] rounded-lg text-[13px] border border-navy-200 outline-none resize-y font-sans text-navy-900 box-border"
          />
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-[9px] rounded-lg text-[13px] font-semibold bg-transparent border border-navy-200 text-navy-700 cursor-pointer font-sans"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.title.trim()}
            className={cn(
              "px-[18px] py-[9px] rounded-lg text-[13px] font-semibold bg-blue-600 text-white border-none cursor-pointer font-sans",
              (saving || !form.title.trim()) && "opacity-50"
            )}
          >
            {saving ? "Saving\u2026" : "Create Event"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Event Detail Popup ──────────────────────────────────────
function EventDetail({ event, onClose, onDelete }: EventDetailProps) {
  const c = TYPE_COLORS[event.event_type] || TYPE_COLORS.meeting;
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl p-6 w-[380px] max-w-[95vw] shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
      >
        <div className="flex justify-between mb-4">
          <span
            className={cn(
              "px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize",
              c.bg,
              c.text
            )}
          >
            {event.event_type}
          </span>
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer text-navy-500"
          >
            <X size={16} />
          </button>
        </div>
        <h3 className="m-0 mb-3 text-lg font-bold text-navy-900">{event.title}</h3>
        <div className="flex items-center gap-2 text-[13px] text-navy-700 mb-2">
          <Clock size={14} className="text-navy-500" />
          {new Date(event.starts_at).toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
          {" – "}
          {new Date(event.ends_at).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
          })}
        </div>
        {event.location && (
          <div className="flex items-center gap-2 text-[13px] text-navy-700 mb-2">
            <MapPin size={14} className="text-navy-500" />
            {event.location}
          </div>
        )}
        {event.description && (
          <p className="text-[13px] text-navy-700 leading-relaxed my-3">
            {event.description}
          </p>
        )}
        <div className="flex gap-2 justify-end mt-4">
          <button
            onClick={onDelete}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-red-500/[0.08] text-red-600 border border-red-500/20 cursor-pointer font-sans"
          >
            Delete
          </button>
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-navy-900 text-white border-none cursor-pointer font-sans"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function NavBtn({ children, onClick }: NavBtnProps) {
  return (
    <button
      onClick={onClick}
      className="w-[34px] h-[34px] rounded-lg bg-white border border-navy-200 cursor-pointer flex items-center justify-center text-navy-700"
    >
      {children}
    </button>
  );
}
