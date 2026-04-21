"use client";
import { useEffect, useState } from "react";

export default function Verify({ searchParams }) {
  const [status, setStatus] = useState("verifying");
  const token = searchParams?.token;

  useEffect(() => {
    if (!token) { setStatus("error"); return; }
    fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token })
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(() => { window.location.href = "/"; })
      .catch(() => setStatus("error"));
  }, [token]);

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0a0f1e", color: "#cbd5e1", fontSize: 14
    }}>
      {status === "verifying" ? "Signing you in…" : "Link expired or invalid. Request a new one."}
    </div>
  );
}
