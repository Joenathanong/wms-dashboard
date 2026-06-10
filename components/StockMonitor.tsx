"use client";
import { useEffect, useState, useRef } from "react";
import * as XLSX from "xlsx";

interface StockItem {
  "OCS Code": string;
  "SAP Code 1": string;
  "SAP Code 2": string;
  "Item Name": string;
  "Qty On Hand": string;
  "UOM": string;
  "Last Updated": string;
}

interface POItem {
  "OCS Code": string;
  "Quantity PO": string;
  "Remark PO": string;
}

export default function StockMonitor() {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [po, setPO] = useState<POItem[]>([]);
  const [filtered, setFiltered] = useState<StockItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterAlert, setFilterAlert] = useState("all");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/sheets?action=stock").then(r => r.json()),
      fetch("/api/sheets?action=open_po").then(r => r.json()),
    ]).then(([s, p]) => {
      setStock(s.data || []);
      setPO(p.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    let f = [...stock];
    if (search) {
      const q = search.toLowerCase();
      f = f.filter(s => s["OCS Code"]?.toLowerCase().includes(q) || s["Item Name"]?.toLowerCase().includes(q));
    }
    if (filterAlert === "low") f = f.filter(s => { const q = parseFloat(s["Qty On Hand"] || "0"); return q > 0 && q < 100; });
    if (filterAlert === "zero") f = f.filter(s => parseFloat(s["Qty On Hand"] || "0") === 0);
    if (filterAlert === "ok") f = f.filter(s => parseFloat(s["Qty On Hand"] || "0") >= 100);
    setFiltered(f);
  }, [stock, search, filterAlert]);

  const openPOMap: Record<string, { qty: number; status: string }> = {};
  po.filter(p => p["Remark PO"] !== "Fulfill").forEach(p => {
    openPOMap[p["OCS Code"]] = { qty: parseFloat(p["Quantity PO"] || "0"), status: p["Remark PO"] };
  });

  const getStatus = (qty: number) => {
    if (qty === 0) return { label: "KOSONG", color: "var(--danger)" };
    if (qty < 100) return { label: "LOW", color: "var(--warning)" };
    return { label: "OK", color: "var(--success)" };
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const items = rows.map((r: any) => ({
        ocs_code: r["OCS Code"] || r["ocs_code"] || "",
        sap_code1: r["SAP Code"] || r["SAP Code 1"] || "",
        sap_code2: r["SAP Code 2"] || "",
        item_name: r["Item Name"] || r["Description"] || r["Deskripsi"] || "",
        qty_on_hand: String(r["Qty On Hand"] || r["QtyOnHand"] || r["Stock"] || "0"),
        uom: r["UOM"] || r["Satuan"] || "PCS",
        last_updated: new Date().toISOString().split("T")[0],
      })).filter((i: any) => i.ocs_code || i.sap_code1);

      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_stock", items }),
      });
      const json = await res.json();
      if (json.success) { setMsg(`✓ Upload ${items.length} item stock berhasil`); load(); }
      else setMsg(`✗ ${json.error}`);
    } catch (err: any) { setMsg(`✗ ${err.message}`); }
    setUploading(false); e.target.value = "";
  };

  const summaryZero = stock.filter(s => parseFloat(s["Qty On Hand"] || "0") === 0).length;
  const summaryLow  = stock.filter(s => { const q = parseFloat(s["Qty On Hand"] || "0"); return q > 0 && q < 100; }).length;

  return (
    <div>
      <div className="section-header">
        <div className="section-header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <h1>Stock Monitoring</h1>
            <p>Upload dari SAP / OCS (WMS) · {filtered.length} dari {stock.length} items</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <><span className="spin">⟳</span> Upload...</> : "⬆ Upload Stock"}
            </button>
            <button className="btn-ghost" onClick={load}>↻</button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} style={{ display: "none" }} />
          </div>
        </div>
      </div>

      {msg && <div className={`alert ${msg.startsWith("✓") ? "alert-success" : "alert-danger"}`} style={{ marginBottom: 14 }}>{msg}</div>}

      {/* Summary chips */}
      {stock.length > 0 && (summaryZero > 0 || summaryLow > 0) && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {summaryZero > 0 && (
            <button onClick={() => setFilterAlert(filterAlert === "zero" ? "all" : "zero")}
              style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, fontFamily: "inherit", cursor: "pointer",
                background: filterAlert === "zero" ? "var(--danger)" : "rgba(239,68,68,0.12)",
                color: filterAlert === "zero" ? "#fff" : "var(--danger)",
                border: "1px solid rgba(239,68,68,0.3)" }}>
              🔴 {summaryZero} item kosong
            </button>
          )}
          {summaryLow > 0 && (
            <button onClick={() => setFilterAlert(filterAlert === "low" ? "all" : "low")}
              style={{ padding: "6px 12px", borderRadius: 20, fontSize: 12, fontFamily: "inherit", cursor: "pointer",
                background: filterAlert === "low" ? "var(--warning)" : "rgba(245,158,11,0.12)",
                color: filterAlert === "low" ? "#000" : "var(--warning)",
                border: "1px solid rgba(245,158,11,0.3)" }}>
              🟡 {summaryLow} item low stock
            </button>
          )}
        </div>
      )}

      <div className="alert alert-info" style={{ marginBottom: 14, fontSize: 12 }}>
        <span style={{ fontWeight: 600 }}>◈ Dual SKU:</span>
        {" "}1 produk bisa punya 2 kode SAP (PP Board + Master Box) → 1 OCS Code di WMS
      </div>

      {/* Filters */}
      <div className="glass" style={{ borderRadius: 8, padding: 12, marginBottom: 14 }}>
        <div className="filter-row">
          <input placeholder="Cari OCS Code / Nama Item..." value={search} onChange={e => setSearch(e.target.value)} />
          <select value={filterAlert} onChange={e => setFilterAlert(e.target.value)} style={{ width: "auto", minWidth: 160 }}>
            <option value="all">Semua Status</option>
            <option value="zero">🔴 Kosong (0)</option>
            <option value="low">🟡 Low (&lt;100)</option>
            <option value="ok">🟢 OK (≥100)</option>
          </select>
        </div>
      </div>

      <div className="glass" style={{ borderRadius: 10, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}><span className="spin" style={{ fontSize: 20 }}>⟳</span></div>
        ) : stock.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            <div style={{ fontSize: 13 }}>Belum ada data stock.</div>
            <div style={{ fontSize: 11, marginTop: 6 }}>Kolom: OCS Code, SAP Code, SAP Code 2, Item Name, Qty On Hand, UOM</div>
          </div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: "62vh", overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>OCS Code</th><th>SAP Code 1</th><th>SAP Code 2</th>
                  <th>Item Name</th><th>Qty On Hand</th><th>UOM</th>
                  <th>Open PO</th><th>Status</th><th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => {
                  const qty = parseFloat(item["Qty On Hand"] || "0");
                  const status = getStatus(qty);
                  const openPO = openPOMap[item["OCS Code"]];
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{item["OCS Code"]}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--accent)", whiteSpace: "nowrap" }}>{item["SAP Code 1"]}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--accent2)", whiteSpace: "nowrap" }}>{item["SAP Code 2"]}</td>
                      <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item["Item Name"]}</td>
                      <td style={{ fontWeight: 700, color: status.color, fontSize: 14 }}>{qty.toLocaleString()}</td>
                      <td style={{ color: "var(--muted)", fontSize: 11 }}>{item["UOM"]}</td>
                      <td>
                        {openPO ? (
                          <span style={{ fontSize: 11 }}>
                            <span style={{ color: "var(--warning)", fontWeight: 600 }}>{openPO.qty.toLocaleString()}</span>
                            <span style={{ color: "var(--muted)", marginLeft: 4, fontSize: 10 }}>({openPO.status})</span>
                          </span>
                        ) : <span style={{ color: "var(--muted)", fontSize: 11 }}>–</span>}
                      </td>
                      <td>
                        <span style={{ padding: "3px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700,
                          background: `${status.color}18`, color: status.color, border: `1px solid ${status.color}35` }}>
                          {status.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>{item["Last Updated"]?.slice(0, 10)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
