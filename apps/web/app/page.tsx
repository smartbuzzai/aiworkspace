"use client";
import { useEffect, useState } from "react";
import App from "../components/App";
import Login from "../components/Login";
import type { User } from "../lib/types";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy-950 text-navy-400 text-[13px]">
        Loading…
      </div>
    );
  }

  if (!user) return <Login onSuccess={setUser} />;
  return <App user={user} onLogout={() => setUser(null)} />;
}
