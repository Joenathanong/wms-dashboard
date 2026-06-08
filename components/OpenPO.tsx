"use client";
import { useEffect, useState, useRef } from "react";

interface POItem {
  "No. PO": string;
  "Date PO": string;
  "OCS Code": string;
  "SAP Code": string;
  "SAP Code 2": string;
  "Quantity Fulfillment": string;
  "Tidak Fulfill": string;
  "Quantity PO": string;
  "QTY Received 1st": string;
  "Arrival date 1st": string;
  "QTY Received 2nd": string;
  "Arrival date 2nd": string;
  "QTY Received 3th": string;
  "Arrival date 3th": string;
  "Total QTY Received": string;
  "Persentase Received": string;
  "Remark PO": string;
  "Remark Received": string;
}

export default function OpenPO() {
  const [data, setData] = useState<POItem[]>([]);
  const [filtered, setFiltered] = useState<POItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterPO, setFilterPO] = useState("all");
  const [filterReceive, setFilterReceive] = useState("all");
  const [filterPONum, setFilterPONum] = useState("all");
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/sheets?action=open_po")
      .then(r => r.json())
      .then(res => { setData(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let f = [...data];
    if (search) {
      const q = search.toLowerCase();
      f = f.filter(d =>
        d["OCS Code"]?.toLowerCase().includes(q) ||
        d["SAP Code"]?.toLowerCase().includes(q) ||
        d["No. PO"]?.toLowerCase().includes(q)
      );
    }
    if (filterPO !== "all") f = f.filter(d => d["Remark PO"] === filterPO);
    if (filterReceive !== "all") f = f.filter(d => d["Remark Received"] === filterReceive);
    if (filterPONum !== "all") f = f.filter(d => d["No. PO"] === filterPONum);
    setFiltered(f);
  }, [data, search, filterPO, filterReceive, filterPONum]);

  const uniquePOs = [...new Set(data.map(d => d["No. PO"]).filter(Boolean))].sort();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload-po", { method: "POST", body: fd });
    const json = await res.json();
    if (json.success) {
      setMsg(`✓ Berhasil upload ${json.rows} baris data PO`);
      load();
    } else {
      setMsg(`✗ Error: ${json.error}`);
    }
    setUploading(false);
    e.target.value = "";
  };

  const grCells = (item: POItem) => {
    const entries = [
      { qty: item["QTY Received 1st"], date: item["Arrival date 1st"] },
      { qty: item["QTY Received 2nd"], date: item["Arrival date 2nd"] },
      { qty: item["QTY Received 3th"], date: item["Arrival date 3th"] },
    ].filter(e => e.qty && e.qty !== "0" && e.qty !== "");

    if (entries.length === 0) return <span style={{ color: "var(--muted)", fontSize: 11 }}>–</span>;
    return (
      <div style={{ fontSize: 11 }}>
        {entries.map((e, i) => (
          <div key={i} style={{ marginBottom: 2 }}>
            <span style={{ color: "var(--success)" }}>{e.qty}</span>
            {e.date && <span style={{ color: "var(--muted)", marginLeft: 4 }}>{e.date?.slice(0, 10)}</span>}
          </div>
        ))}
      </div>
    );
  };

  const badge = (status: string) => {
    const cls = status === "Fulfill" ? "badge-fulfill" : status === "Not yet" ? "badge-notyet" : "badge-partial";
    return <span className={cls} style={{ padding: "3px 8px", borderRadius: 4, fontSize: 11 }}>{status}</span>;
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>Open PO Monitoring</h1>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{filtered.length} dari {data.length} items</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {uploading ? "⟳ Upload..." : "⬆ Upload PO (.xlsx)"}
          </button>
          <button className="btn-ghost" onClick={load}>↻ Refresh</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleUpload} style={{ display: "none" }} />
        </div>
      </div>

      {msg && (
        <div style={{ padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 13,
          background: msg.startsWith("✓") ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${msg.startsWith("✓") ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
          color: msg.startsWith("✓") ? "var(--success)" : "var(--danger)" }}>
          {msg}
        </div>
      )}

      {/* Filters */}
      <div className="glass" style={{ borderRadius: 8, padding: 14, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="Cari OCS Code / SAP Code / No. PO..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <select value={filterPONum} onChange={e => setFilterPONum(e.target.value)}>
          <option value="all">Semua PO</option>
          {uniquePOs.map(p => <option key={p} value={p}>PO {p}</option>)}
        </select>
        <select value={filterPO} onChange={e => setFilterPO(e.target.value)}>
          <option value="all">Semua Status PO</option>
          <option value="Fulfill">Fulfill</option>
          <option value="Not yet">Not Yet</option>
          <option value="Partial fulfill">Partial Fulfill</option>
        </select>
        <select value={filterReceive} onChange={e => setFilterReceive(e.target.value)}>
          <option value="all">Semua Status GR</option>
          <option value="Full Received">Full Received</option>
          <option value="Not yet">Not Yet Received</option>
          <option value="Partial Received">Partial Received</option>
        </select>
        {(search || filterPO !== "all" || filterReceive !== "all" || filterPONum !== "all") && (
          <button className="btn-ghost" onClick={() => { setSearch(""); setFilterPO("all"); setFilterReceive("all"); setFilterPONum("all"); }}>
            ✕ Reset
          </button>
        )}
      </div>

      <div className="glass" style={{ borderRadius: 10, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Loading data...</div>
        ) : (
          <div style={{ overflowX: "auto", maxHeight: "60vh", overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>No. PO</th><th>Tanggal</th><th>OCS Code</th>
                  <th>SAP Code 1</th><th>SAP Code 2</th>
                  <th>Qty PO</th><th>Tdk Fulfill</th>
                  <th>GR (3 Terakhir)</th>
                  <th>Total GR</th><th>% GR</th>
                  <th>Status PO</th><th>Status Receive</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={12} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>Tidak ada data</td></tr>
                ) : filtered.map((item, i) => (
                  <tr key={i}>
                    <td style={{ color: "var(--accent)", fontFamily: "monospace", fontWeight: 600 }}>
                      PO-{String(item["No. PO"]).padStart(3, "0")}
                    </td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>{item["Date PO"]?.slice(0, 10)}</td>
                    <td style={{ fontWeight: 500, maxWidth: 160 }}>{item["OCS Code"]}</td>
                    <td style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)" }}>{item["SAP Code"]}</td>
                    <td style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)" }}>{item["SAP Code 2"]}</td>
                    <td style={{ fontWeight: 600 }}>{item["Quantity PO"]}</td>
                    <td style={{ color: item["Tidak Fulfill"] ? "var(--danger)" : "var(--muted)" }}>
                      {item["Tidak Fulfill"] || "–"}
                    </td>
                    <td>{grCells(item)}</td>
                    <td style={{ fontWeight: 600, color: "var(--accent)" }}>{item["Total QTY Received"] || "0"}</td>
                    <td style={{ fontSize: 11 }}>
                      {item["Persentase Received"] ? `${Math.round(parseFloat(item["Persentase Received"]) * 100)}%` : "0%"}
                    </td>
                    <td>{badge(item["Remark PO"])}</td>
                    <td>{badge(item["Remark Received"] || "Not yet")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
