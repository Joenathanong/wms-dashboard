"use client";
import { useState } from "react";

const modules = [
  { id: "dashboard", label: "Dashboard", icon: "▦" },
  { id: "master_item", label: "Master Item", icon: "◈" },
  { id: "open_po", label: "Open PO", icon: "◉" },
  { id: "stock", label: "Stock Monitor", icon: "▣" },
  { id: "pda", label: "PDA Receiving", icon: "⬡" },
];

export default function Sidebar({ active, onSelect }: { active: string; onSelect: (id: string) => void }) {
  return (
    <aside style={{
      width: 220, minHeight: "100vh", background: "var(--surface)",
      borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column",
      padding: "0", position: "fixed", top: 0, left: 0, zIndex: 50
    }}>
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.15em", marginBottom: 4 }}>WAREHOUSE</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--accent)", fontFamily: "'Space Grotesk', sans-serif" }}>
          WMS · INBOUND
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>v1.0 · 2026</div>
      </div>

      <nav style={{ flex: 1, padding: "12px 8px" }}>
        {modules.map((m) => (
          <button key={m.id} onClick={() => onSelect(m.id)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", borderRadius: 6, marginBottom: 2,
              background: active === m.id ? "rgba(0,212,255,0.1)" : "transparent",
              border: active === m.id ? "1px solid rgba(0,212,255,0.3)" : "1px solid transparent",
              color: active === m.id ? "var(--accent)" : "var(--muted)",
              textAlign: "left", fontSize: 13, fontFamily: "inherit",
              cursor: "pointer", transition: "all 0.15s"
            }}>
            <span style={{ fontSize: 16 }}>{m.icon}</span>
            {m.label}
          </button>
        ))}
      </nav>

      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--muted)" }}>
        Backend: Google Sheets<br />
        Deploy: Vercel
      </div>
    </aside>
  );
}
