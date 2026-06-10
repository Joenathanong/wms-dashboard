"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import OpenPO from "@/components/OpenPO";
import StockMonitor from "@/components/StockMonitor";
import PDAReceiving from "@/components/PDAReceiving";
import MasterItem from "@/components/MasterItem";
import { useTheme } from "@/components/ThemeProvider";

const moduleLabels: Record<string, string> = {
  dashboard:   "Dashboard",
  master_item: "Master Item",
  open_po:     "Open PO Monitoring",
  stock:       "Stock Monitor",
  pda:         "PDA Receiving",
};

export default function Home() {
  const [active, setActive] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggle } = useTheme();

  const renderModule = () => {
    switch (active) {
      case "dashboard":   return <Dashboard />;
      case "open_po":     return <OpenPO />;
      case "stock":       return <StockMonitor />;
      case "pda":         return <PDAReceiving />;
      case "master_item": return <MasterItem />;
      default:            return <Dashboard />;
    }
  };

  return (
    <div>
      <Sidebar active={active} onSelect={setActive} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-layout">
        {/* ── Topbar ── */}
        <header className="topbar">
          {/* Hamburger */}
          <button className="btn-icon" style={{ marginRight: 10, flexShrink: 0 }}
            onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle menu">
            <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
              <rect y="0"  width="18" height="2" rx="1" fill="currentColor"/>
              <rect y="6"  width="14" height="2" rx="1" fill="currentColor"/>
              <rect y="12" width="18" height="2" rx="1" fill="currentColor"/>
            </svg>
          </button>

          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14 }}>
            {moduleLabels[active]}
          </span>

          {/* Right side */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
            {/* Connection status */}
            <div className="hide-mobile" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--muted)" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--success)",
                display: "inline-block", boxShadow: "0 0 6px var(--success)" }} />
              Sheets OK
            </div>

            {/* Date – hidden on smallest screens */}
            <div className="hide-mobile" style={{ fontSize: 11, color: "var(--muted)" }}>
              {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
            </div>

            {/* ── Single theme toggle — always in topbar ── */}
            <button
              onClick={toggle}
              aria-label="Toggle dark/light mode"
              title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 20,
                background: "var(--surface2)", border: "1px solid var(--border2)",
                color: "var(--muted)", fontSize: 12, cursor: "pointer",
                transition: "all 0.2s", fontFamily: "inherit", flexShrink: 0,
              }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>
                {theme === "dark" ? "☀️" : "🌙"}
              </span>
              <span className="hide-mobile">
                {theme === "dark" ? "Light" : "Dark"}
              </span>
            </button>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="page-content fade-in" key={active}>
          {renderModule()}
        </main>
      </div>
    </div>
  );
}
