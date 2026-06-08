"use client";
import { useEffect, useState } from "react";

interface POItem {
  "No. PO": string;
  "OCS Code": string;
  "SAP Code": string;
  "SAP Code 2": string;
  "Quantity PO": string;
  "Total QTY Received": string;
  "Remark PO": string;
  "Remark Received": string;
  "Date PO": string;
  "Tidak Fulfill": string;
}

interface StockItem {
  "OCS Code": string;
  "qty_on_hand": string;
}

export default function Dashboard() {
  const [po, setPO] = useState<POItem[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/sheets?action=open_po").then(r => r.json()),
      fetch("/api/sheets?action=stock").then(r => r.json()),
    ]).then(([poRes, stockRes]) => {
      setPO(poRes.data || []);
      setStock(stockRes.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const total = po.length;
  const fulfill = po.filter(p => p["Remark PO"] === "Fulfill").length;
  const notYet = po.filter(p => p["Remark PO"] === "Not yet").length;
  const partial = po.filter(p => p["Remark PO"] === "Partial fulfill").length;
  const fullReceived = po.filter(p => p["Remark Received"] === "Full Received").length;
  const pendingReceive = po.filter(p => p["Remark Received"] === "Not yet").length;

  // Urgent: open PO (not yet fulfill) with low/zero stock
  const stockMap: Record<string, number> = {};
  stock.forEach(s => { stockMap[s["OCS Code"]] = parseFloat(s["qty_on_hand"] || "0"); });

  const urgent = po.filter(p => {
    const isOpen = p["Remark PO"] !== "Fulfill";
    const qty = stockMap[p["OCS Code"]] || 0;
    return isOpen && qty < 100;
  }).slice(0, 10);

  const statCard = (label: string, val: number | string, color: string, sub?: string) => (
    <div className="glass" style={{ padding: "16px 20px", borderRadius: 10, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, fontFamily: "'Space Grotesk', sans-serif", margin: "4px 0" }}>{val}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--muted)" }}>{sub}</div>}
    </div>
  );

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "var(--muted)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>⟳</div>
        <div style={{ fontSize: 13 }}>Loading dashboard...</div>
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>Dashboard Overview</h1>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Monitoring real-time dari Google Sheets</p>
      </div>

      {/* Stats Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {statCard("Total PO Lines", total, "var(--accent)")}
        {statCard("Fulfill", fulfill, "var(--success)", `${total ? Math.round(fulfill/total*100) : 0}%`)}
        {statCard("Not Yet Fulfill", notYet, "var(--danger)")}
        {statCard("Partial", partial, "var(--warning)")}
        {statCard("Full Received", fullReceived, "var(--success)")}
        {statCard("Pending GR", pendingReceive, "var(--danger)")}
      </div>

      {/* Urgent Items */}
      <div className="glass" style={{ borderRadius: 10, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "var(--danger)", fontSize: 16 }}>⚠</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Urgent — Open PO with Low Stock</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>{urgent.length} items</span>
        </div>
        {urgent.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            ✓ Tidak ada item urgent saat ini
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>No. PO</th><th>OCS Code</th><th>SAP Code</th>
                  <th>Qty PO</th><th>Stock On Hand</th><th>Status PO</th>
                </tr>
              </thead>
              <tbody>
                {urgent.map((item, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: "monospace", color: "var(--accent)" }}>{item["No. PO"]}</td>
                    <td style={{ fontWeight: 500 }}>{item["OCS Code"]}</td>
                    <td style={{ color: "var(--muted)", fontSize: 11 }}>{item["SAP Code"]}</td>
                    <td>{item["Quantity PO"]}</td>
                    <td style={{ color: (stockMap[item["OCS Code"]] || 0) === 0 ? "var(--danger)" : "var(--warning)" }}>
                      {stockMap[item["OCS Code"]] ?? "–"}
                    </td>
                    <td>
                      <span className={item["Remark PO"] === "Not yet" ? "badge-notyet" : "badge-partial"}
                        style={{ padding: "3px 8px", borderRadius: 4, fontSize: 11 }}>
                        {item["Remark PO"]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="glass" style={{ borderRadius: 10, padding: "16px 20px" }}>
        <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>PO FULFILLMENT PROGRESS</div>
        <div style={{ display: "flex", gap: 4, height: 20, borderRadius: 4, overflow: "hidden", background: "var(--surface2)" }}>
          <div style={{ width: `${total ? fulfill/total*100 : 0}%`, background: "var(--success)", transition: "width 0.5s" }} title={`Fulfill: ${fulfill}`} />
          <div style={{ width: `${total ? partial/total*100 : 0}%`, background: "var(--warning)" }} title={`Partial: ${partial}`} />
          <div style={{ width: `${total ? notYet/total*100 : 0}%`, background: "var(--danger)" }} title={`Not Yet: ${notYet}`} />
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          <span>🟢 Fulfill: {fulfill}</span>
          <span>🟡 Partial: {partial}</span>
          <span>🔴 Not Yet: {notYet}</span>
        </div>
      </div>
    </div>
  );
}
