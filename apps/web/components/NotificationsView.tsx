"use client";
import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck, X } from "lucide-react";
import { cn } from "../lib/cn";
import { relTime } from "../lib/date";
import { useToast } from "./shared/Toast";
import Modal from "./shared/Modal";

interface Notification {
  id: string;
  title: string;
  body: string;
  tag: string | null;
  read_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 20;

export default function NotificationsView() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [confirmingMarkAll, setConfirmingMarkAll] = useState(false);
  const { toast } = useToast();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/push/notifications?limit=${PAGE_SIZE}&offset=0`, { credentials: "include" });
      const d = await r.json();
      setNotifications(d.notifications || []);
      setHasMore(d.hasMore || false);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const r = await fetch(`/api/push/notifications?limit=${PAGE_SIZE}&offset=${notifications.length}`, { credentials: "include" });
      const d = await r.json();
      setNotifications(prev => [...prev, ...(d.notifications || [])]);
      setHasMore(d.hasMore || false);
    } finally {
      setLoadingMore(false);
    }
  }

  function markRead(id: string) {
    const now = new Date().toISOString();
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: now } : n));
    fetch(`/api/push/notifications/${id}/read`, { method: "POST", credentials: "include" })
      .catch(() => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: null } : n));
      });
  }

  const unreadCount = notifications.filter(n => !n.read_at).length;

  function markAllRead() {
    if (unreadCount === 0) return;
    setConfirmingMarkAll(true);
  }

  function confirmMarkAllRead() {
    const now = new Date().toISOString();
    const unread = notifications.filter(n => !n.read_at);
    setConfirmingMarkAll(false);
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? now })));
    toast("success", `${unread.length} notification${unread.length !== 1 ? "s" : ""} marked as read.`);
    Promise.all(
      unread.map(n => fetch(`/api/push/notifications/${n.id}/read`, { method: "POST", credentials: "include" }))
    ).catch(() => load());
  }

  return (
    <>
    <div className="flex flex-col gap-4">
      {/* Header bar */}
      <div className="bg-white border border-navy-200 rounded-xl p-3.5 flex gap-2.5 items-center">
        <div className="flex items-center gap-2 text-sm font-semibold text-navy-700">
          <Bell size={16} className="text-blue-500" />
          {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="ml-auto bg-navy-100 text-navy-700 border border-navy-200 px-3 py-[6px] rounded-lg text-xs font-semibold cursor-pointer font-[inherit] flex items-center gap-1.5"
          >
            <CheckCheck size={13} /> Mark all read
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col gap-1.5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white border border-navy-200 rounded-xl px-4 py-3 flex gap-3 items-start animate-pulse">
              <div className="w-2 h-2 rounded-full mt-1.5 bg-navy-200 shrink-0" />
              <div className="flex-1 space-y-2 py-0.5">
                <div className="h-3.5 bg-navy-100 rounded w-1/3" />
                <div className="h-3 bg-navy-100 rounded w-full" />
                <div className="h-2.5 bg-navy-100 rounded w-2/5" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-white border border-navy-200 rounded-xl p-10 text-center text-navy-500 text-sm">
          No notifications yet.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {notifications.map(n => (
            <div
              key={n.id}
              className={cn(
                "bg-white border rounded-xl px-4 py-3 flex gap-3 items-start transition-all",
                n.read_at ? "border-navy-200 opacity-60" : "border-blue-400/30 bg-blue-500/[0.02]"
              )}
            >
              <div className={cn(
                "w-2 h-2 rounded-full mt-1.5 shrink-0",
                n.read_at ? "bg-navy-200" : "bg-blue-500"
              )} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-navy-900">{n.title}</div>
                <div className="text-[13px] text-navy-600 mt-0.5">{n.body}</div>
                <div className="flex items-center gap-2 mt-1.5 text-[11px] text-navy-500">
                  <span>{relTime(n.created_at)}</span>
                  {n.tag && (
                    <>
                      <span>&middot;</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-[5px] uppercase tracking-wide bg-navy-100 text-navy-600">
                        {n.tag}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {!n.read_at && (
                <button
                  onClick={() => markRead(n.id)}
                  className="bg-transparent border-none cursor-pointer p-1.5 text-navy-400 rounded-lg hover:text-green-500"
                  title="Mark as read"
                >
                  <Check size={14} />
                </button>
              )}
            </div>
          ))}
          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className={cn(
                "bg-white border border-navy-200 rounded-xl py-3 text-[13px] font-semibold text-navy-600 cursor-pointer font-[inherit] hover:bg-navy-50 transition-colors",
                loadingMore && "opacity-60 cursor-wait"
              )}
            >
              {loadingMore ? "Loading\u2026" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>

    {confirmingMarkAll && (
      <Modal onClose={() => setConfirmingMarkAll(false)}>
        <div className="p-6">
          <h3 className="text-base font-bold text-navy-900 mb-2">Mark all as read</h3>
          <p className="text-sm text-navy-600 mb-6">
            Mark all {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""} as read?
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setConfirmingMarkAll(false)}
              className="bg-navy-50 text-navy-700 border border-navy-200 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer font-[inherit] hover:bg-navy-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={confirmMarkAllRead}
              className="bg-blue-600 text-white border-none px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer font-[inherit] hover:bg-blue-700 transition-colors"
            >
              Mark all read
            </button>
          </div>
        </div>
      </Modal>
    )}
  </>
  );
}
