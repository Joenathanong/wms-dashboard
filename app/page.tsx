"use client";
import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/components/Dashboard";
import OpenPO from "@/components/OpenPO";
import StockMonitor from "@/components/StockMonitor";
import PDAReceiving from "@/components/PDAReceiving";
import MasterItem from "@/components/MasterItem";

export default function Home() {
  const [active, setActive] = useState("dashboard");

  const renderModule = () => {
    switch (active) {
      case "dashboard": return <Dashboard />;
      case "open_po": return <OpenPO />;
      case "stock": return <StockMonitor />;
      case "pda": return <PDAReceiving />;
      case "master_item": return <MasterItem />;
      default: return <Dashboard />;
    }
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar active={active} onSelect={setActive} />
      <main style={{ marginLeft: 220, flex: 1, padding: "28px 32px", maxWidth: "calc(100vw - 220px)" }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 28, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>
            WMS Inbound · Hanasui / NCO / Fyne / Eomma
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "var(--muted)" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
            Google Sheets Connected
            <span style={{ color: "var(--border)" }}>|</span>
            {new Date().toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
          </div>
        </div>
        {renderModule()}
      </main>
    </div>
  );
}
