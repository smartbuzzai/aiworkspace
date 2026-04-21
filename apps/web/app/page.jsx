"use client";
import { useEffect, useState } from "react";
import App from "../components/App";
import Login from "../components/Login";

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) setUser(data.user);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0a0f1e", color: "#94a3b8", fontSize: 13
      }}>Loading…</div>
    );
  }

  if (!user) return <Login onSuccess={setUser} />;
  return <App user={user} onLogout={() => setUser(null)} />;
}
