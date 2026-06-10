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
  const hasFilter = search || filterPO !== "all" || filterReceive !== "all" || filterPONum !== "all";

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload-po", { method: "POST", body: fd });
    const json = await res.json();
    if (json.success) { setMsg(`✓ Berhasil upload ${json.rows} baris data PO`); load(); }
    else setMsg(`✗ Error: ${json.error}`);
    setUploading(false);
    e.target.value = "";
  };

  const grCells = (item: POItem) => {
    const entries = [
      { qty: item["QTY Received 1st"], date: item["Arrival date 1st"] },
      { qty: item["QTY Received 2nd"], date: item["Arrival date 2nd"] },
      { qty: item["QTY Received 3th"], date: item["Arrival date 3th"] },
    ].filter(e => e.qty && e.qty !== "0" && e.qty !== "");
    if (!entries.length) return <span style={{ color: "var(--muted)" }}>–</span>;
    return (
      <div style={{ fontSize: 11 }}>
        {entries.map((e, i) => (
          <div key={i}>
            <span style={{ color: "var(--success)", fontWeight: 600 }}>{e.qty}</span>
            {e.date && <span style={{ color: "var(--muted)", marginLeft: 4 }}>{e.date?.slice(0, 10)}</span>}
          </div>
        ))}
      </div>
    );
  };

  const badge = (status: string) => {
    const cls = status === "Fulfill" ? "badge badge-fulfill" : status === "Not yet" ? "badge badge-notyet" : "badge badge-partial";
    return <span className={cls}>{status || "–"}</span>;
  };

  return (
    <div>
      <div className="section-header">
        <div className="section-header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <h1>Open PO Monitoring</h1>
            <p>{filtered.length} dari {data.length} items</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <><span className="spin">⟳</span> Upload...</> : "⬆ Upload PO"}
            </button>
            <button className="btn-ghost" onClick={load}>↻</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleUpload} style={{ display: "none" }} />
          </div>
        </div>
      </div>

      {msg && (
        <div className={`alert ${msg.startsWith("✓") ? "alert-success" : "alert-danger"}`} style={{ marginBottom: 14 }}>
          {msg}
        </div>
      )}

      {/* Filters */}
      <div className="glass" style={{ borderRadius: 8, padding: 12, marginBottom: 14 }}>
        <div className="filter-row">
          <input placeholder="Cari OCS / SAP / No. PO..." value={search}
            onChange={e => setSearch(e.target.value)} />
          <select value={filterPONum} onChange={e => setFilterPONum(e.target.value)} style={{ width: "auto" }}>
            <option value="all">Semua PO</option>
            {uniquePOs.map(p => <option key={p} value={p}>PO {p}</option>)}
          </select>
          <select value={filterPO} onChange={e => setFilterPO(e.target.value)} style={{ width: "auto" }}>
            <option value="all">Semua Status PO</option>
            <option value="Fulfill">Fulfill</option>
            <option value="Not yet">Not Yet</option>
            <option value="Partial fulfill">Partial</option>
          </select>
          <select value={filterReceive} onChange={e => setFilterReceive(e.target.value)} style={{ width: "auto" }}>
            <option value="all">Semua Status GR</option>
            <option value="Full Received">Full Received</option>
            <option value="Not yet">Not Yet</option>
            <option value="Partial Received">Partial</option>
          </select>
          {hasFilter && (
            <button className="btn-ghost" onClick={() => { setSearch(""); setFilterPO("all"); setFilterReceive("all"); setFilterPONum("all"); }}>
              ✕ Reset
            </button>
          )}
        </div>
      </div>

      <div className="glass" style={{ borderRadius: 10, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
            <span className="spin" style={{ fontSize: 20 }}>⟳</span>
          </div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>No. PO</th><th>Tanggal</th><th>OCS Code</th>
                  <th>SAP Code 1</th><th>SAP Code 2</th>
                  <th>Qty PO</th><th>Tdk Fulfill</th>
                  <th>GR (3 Terakhir)</th>
                  <th>Total GR</th><th>% GR</th>
                  <th>Status PO</th><th>Status GR</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={12} style={{ textAlign: "center", color: "var(--muted)", padding: 24 }}>Tidak ada data</td></tr>
                ) : filtered.map((item, i) => (
                  <tr key={i}>
                    <td style={{ color: "var(--accent)", fontFamily: "monospace", fontWeight: 600, whiteSpace: "nowrap" }}>
                      PO-{String(item["No. PO"]).padStart(3, "0")}
                    </td>
                    <td style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>{item["Date PO"]?.slice(0, 10)}</td>
                    <td style={{ fontWeight: 500, whiteSpace: "nowrap", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>{item["OCS Code"]}</td>
                    <td style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)", whiteSpace: "nowrap" }}>{item["SAP Code"]}</td>
                    <td style={{ fontSize: 11, fontFamily: "monospace", color: "var(--muted)", whiteSpace: "nowrap" }}>{item["SAP Code 2"]}</td>
                    <td style={{ fontWeight: 600 }}>{item["Quantity PO"]}</td>
                    <td style={{ color: item["Tidak Fulfill"] ? "var(--danger)" : "var(--muted)" }}>{item["Tidak Fulfill"] || "–"}</td>
                    <td>{grCells(item)}</td>
                    <td style={{ fontWeight: 600, color: "var(--accent)" }}>{item["Total QTY Received"] || "0"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
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
