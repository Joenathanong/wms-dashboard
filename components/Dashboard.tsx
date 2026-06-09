"use client";
import { useEffect, useState } from "react";

interface POItem {
  "No. PO": string;
  "Date PO": string;
  "OCS Code": string;
  "SAP Code": string;
  "SAP Code 2": string;
  "Quantity PO": string;
  "Total QTY Received": string;
  "Remark PO": string;
  "Remark Received": string;
  "Tidak Fulfill": string;
  "Persentase Received": string;
  "QTY Received 1st": string;
  "Arrival date 1st": string;
  "QTY Received 2nd": string;
  "Arrival date 2nd": string;
  "QTY Received 3th": string;
  "Arrival date 3th": string;
}

interface StockItem {
  "OCS Code": string;
  "Qty On Hand": string;
  "qty_on_hand": string;
}

type FilterKey = "urgent" | "all" | "fulfill" | "notyet" | "partial" | "full_received" | "pending_gr";

const FILTERS: { key: FilterKey; label: string; icon: string; color: string }[] = [
  { key: "all",          label: "Total PO Lines",    icon: "▦", color: "var(--accent)" },
  { key: "fulfill",      label: "Fulfill",            icon: "✓", color: "var(--success)" },
  { key: "notyet",       label: "Not Yet Fulfill",    icon: "✗", color: "var(--danger)" },
  { key: "partial",      label: "Partial Fulfill",    icon: "◑", color: "var(--warning)" },
  { key: "full_received",label: "Full Received",      icon: "↓", color: "var(--success)" },
  { key: "pending_gr",   label: "Pending GR",         icon: "⏳", color: "var(--danger)" },
];

const FILTER_LABELS: Record<FilterKey, string> = {
  urgent:       "⚠ Urgent — Open PO with Low Stock",
  all:          "▦ Semua PO Lines",
  fulfill:      "✓ Status: Fulfill",
  notyet:       "✗ Status: Not Yet Fulfill",
  partial:      "◑ Status: Partial Fulfill",
  full_received:"↓ Remark Received: Full Received",
  pending_gr:   "⏳ Remark Received: Pending (Not Yet)",
};

export default function Dashboard() {
  const [po, setPO] = useState<POItem[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("urgent");

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

  // Build stock map
  const stockMap: Record<string, number> = {};
  stock.forEach(s => {
    const qty = parseFloat(s["Qty On Hand"] || s["qty_on_hand"] || "0");
    stockMap[s["OCS Code"]] = qty;
  });

  const total        = po.length;
  const fulfill      = po.filter(p => p["Remark PO"] === "Fulfill").length;
  const notYet       = po.filter(p => p["Remark PO"] === "Not yet").length;
  const partial      = po.filter(p => p["Remark PO"] === "Partial fulfill").length;
  const fullReceived = po.filter(p => p["Remark Received"] === "Full Received").length;
  const pendingGR    = po.filter(p => p["Remark Received"] === "Not yet").length;

  const counts: Record<FilterKey, number> = {
    all: total, fulfill, notyet: notYet, partial,
    full_received: fullReceived, pending_gr: pendingGR,
    urgent: po.filter(p => p["Remark PO"] !== "Fulfill" && (stockMap[p["OCS Code"]] || 0) < 100).length,
  };

  // Get filtered list
  const getList = (): POItem[] => {
    switch (activeFilter) {
      case "all":           return po;
      case "fulfill":       return po.filter(p => p["Remark PO"] === "Fulfill");
      case "notyet":        return po.filter(p => p["Remark PO"] === "Not yet");
      case "partial":       return po.filter(p => p["Remark PO"] === "Partial fulfill");
      case "full_received": return po.filter(p => p["Remark Received"] === "Full Received");
      case "pending_gr":    return po.filter(p => p["Remark Received"] === "Not yet");
      case "urgent":        return po.filter(p => p["Remark PO"] !== "Fulfill" && (stockMap[p["OCS Code"]] || 0) < 100);
    }
  };

  const listData = getList();

  const badgeClass = (status: string) => {
    if (status === "Fulfill") return "badge badge-fulfill";
    if (status === "Not yet") return "badge badge-notyet";
    return "badge badge-partial";
  };

  const grCells = (item: POItem) => {
    const entries = [
      { qty: item["QTY Received 1st"], date: item["Arrival date 1st"] },
      { qty: item["QTY Received 2nd"], date: item["Arrival date 2nd"] },
      { qty: item["QTY Received 3th"], date: item["Arrival date 3th"] },
    ].filter(e => e.qty && e.qty !== "0" && e.qty !== "");
    if (!entries.length) return <span style={{ color: "var(--muted)" }}>–</span>;
    return (
      <div>
        {entries.map((e, i) => (
          <div key={i} style={{ whiteSpace: "nowrap" }}>
            <span style={{ color: "var(--success)", fontWeight: 600 }}>{e.qty}</span>
            {e.date && <span style={{ color: "var(--muted)", marginLeft: 4, fontSize: 10 }}>{e.date?.slice(0,10)}</span>}
          </div>
        ))}
      </div>
    );
  };

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 280, color: "var(--muted)" }}>
      <div style={{ textAlign: "center" }}>
        <span className="spin" style={{ fontSize: 22, display: "block", marginBottom: 8 }}>⟳</span>
        <div style={{ fontSize: 13 }}>Memuat data dashboard...</div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <h1>Dashboard Overview</h1>
        <p>Klik kartu untuk memfilter data · Real-time dari Google Sheets</p>
      </div>

      {/* Stat Cards — clickable */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(148px, 1fr))", gap: 10, marginBottom: 20 }}>
        {FILTERS.map(f => (
          <button key={f.key}
            className={`stat-card${activeFilter === f.key ? " active" : ""}`}
            onClick={() => setActiveFilter(f.key)}
            style={{ borderTop: `1px solid var(--border)`, borderRight: `1px solid var(--border)`, borderBottom: `1px solid var(--border)`, borderLeft: `3px solid ${f.color}`, textAlign: "left" }}>
            <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              {f.icon} {f.label}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, color: f.color, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
              {counts[f.key]}
            </div>
            {f.key === "fulfill" && total > 0 && (
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                {Math.round(fulfill / total * 100)}% dari total
              </div>
            )}
            {activeFilter === f.key && (
              <div style={{ position: "absolute", bottom: 6, right: 8, fontSize: 9, color: f.color, opacity: 0.7 }}>
                AKTIF ▲
              </div>
            )}
          </button>
        ))}

        {/* Urgent card always shown */}
        <button className={`stat-card${activeFilter === "urgent" ? " active" : ""}`}
          onClick={() => setActiveFilter("urgent")}
          style={{ borderTop: "1px solid var(--border)", borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)", borderLeft: "3px solid var(--danger)", textAlign: "left", gridColumn: counts.urgent > 0 ? "span 2" : undefined }}>
          <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            ⚠ Urgent Low Stock
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: counts.urgent > 0 ? "var(--danger)" : "var(--success)", fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
              {counts.urgent}
            </span>
            {counts.urgent === 0 && <span style={{ fontSize: 11, color: "var(--success)" }}>Semua aman ✓</span>}
            {counts.urgent > 0 && <span style={{ fontSize: 11, color: "var(--muted)" }}>Open PO + stok &lt;100</span>}
          </div>
          {activeFilter === "urgent" && (
            <div style={{ position: "absolute", bottom: 6, right: 8, fontSize: 9, color: "var(--danger)", opacity: 0.7 }}>AKTIF ▲</div>
          )}
        </button>
      </div>

      {/* Progress bar */}
      <div className="glass" style={{ borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
          PO Fulfillment Progress
        </div>
        <div style={{ display: "flex", height: 18, borderRadius: 4, overflow: "hidden", background: "var(--surface3)", gap: 1 }}>
          <div style={{ width: `${total ? fulfill/total*100 : 0}%`, background: "var(--success)", transition: "width 0.6s" }} title={`Fulfill: ${fulfill}`} />
          <div style={{ width: `${total ? partial/total*100 : 0}%`, background: "var(--warning)" }} title={`Partial: ${partial}`} />
          <div style={{ width: `${total ? notYet/total*100 : 0}%`, background: "var(--danger)" }} title={`Not Yet: ${notYet}`} />
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "var(--muted)", flexWrap: "wrap" }}>
          <span>🟢 Fulfill: {fulfill} ({total ? Math.round(fulfill/total*100) : 0}%)</span>
          <span>🟡 Partial: {partial}</span>
          <span>🔴 Not Yet: {notYet}</span>
        </div>
      </div>

      {/* Dynamic list */}
      <div className="glass" style={{ borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>{FILTER_LABELS[activeFilter]}</span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)",
            background: "var(--surface2)", padding: "3px 8px", borderRadius: 20 }}>
            {listData.length} items
          </span>
        </div>

        {listData.length === 0 ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
            ✓ Tidak ada data untuk kategori ini
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>No. PO</th>
                  <th>OCS Code</th>
                  <th>SAP Code</th>
                  <th>Qty PO</th>
                  {(activeFilter === "urgent" || activeFilter === "notyet" || activeFilter === "partial") && <th>Stock</th>}
                  <th>GR (3 Terakhir)</th>
                  <th>Total GR</th>
                  <th>Status PO</th>
                  <th>Status GR</th>
                </tr>
              </thead>
              <tbody>
                {listData.slice(0, 50).map((item, i) => {
                  const stockQty = stockMap[item["OCS Code"]] ?? null;
                  const showStock = activeFilter === "urgent" || activeFilter === "notyet" || activeFilter === "partial";
                  return (
                    <tr key={i}>
                      <td style={{ color: "var(--accent)", fontFamily: "monospace", fontWeight: 600, whiteSpace: "nowrap" }}>
                        PO-{String(item["No. PO"]).padStart(3, "0")}
                      </td>
                      <td style={{ fontWeight: 500, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item["OCS Code"]}
                      </td>
                      <td style={{ color: "var(--muted)", fontSize: 11, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                        {item["SAP Code"]}
                      </td>
                      <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{item["Quantity PO"]}</td>
                      {showStock && (
                        <td style={{ whiteSpace: "nowrap", fontWeight: 700,
                          color: stockQty === null ? "var(--muted)" : stockQty === 0 ? "var(--danger)" : stockQty < 100 ? "var(--warning)" : "var(--success)" }}>
                          {stockQty === null ? "–" : stockQty.toLocaleString()}
                        </td>
                      )}
                      <td style={{ minWidth: 100 }}>{grCells(item)}</td>
                      <td style={{ whiteSpace: "nowrap", fontWeight: 600 }}>{item["Total QTY Received"] || "0"}</td>
                      <td><span className={badgeClass(item["Remark PO"])}>{item["Remark PO"]}</span></td>
                      <td><span className={item["Remark Received"] === "Full Received" ? "badge badge-received" : item["Remark Received"] === "Not yet" ? "badge badge-notyet" : "badge badge-partial"}>
                        {item["Remark Received"] || "–"}
                      </span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {listData.length > 50 && (
              <div style={{ padding: "10px 16px", fontSize: 11, color: "var(--muted)", textAlign: "center", borderTop: "1px solid var(--border)" }}>
                Menampilkan 50 dari {listData.length} item. Gunakan modul Open PO untuk data lengkap.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
