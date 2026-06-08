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
  "Total QTY Received": string;
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
    if (filterAlert === "low") f = f.filter(s => parseFloat(s["Qty On Hand"] || "0") < 100 && parseFloat(s["Qty On Hand"] || "0") > 0);
    if (filterAlert === "zero") f = f.filter(s => parseFloat(s["Qty On Hand"] || "0") === 0);
    if (filterAlert === "ok") f = f.filter(s => parseFloat(s["Qty On Hand"] || "0") >= 100);
    setFiltered(f);
  }, [stock, search, filterAlert]);

  // Build open PO map
  const openPOMap: Record<string, { qty: number; status: string }> = {};
  po.filter(p => p["Remark PO"] !== "Fulfill").forEach(p => {
    openPOMap[p["OCS Code"]] = {
      qty: parseFloat(p["Quantity PO"] || "0"),
      status: p["Remark PO"],
    };
  });

  const getStockStatus = (qty: number) => {
    if (qty === 0) return { label: "KOSONG", color: "var(--danger)" };
    if (qty < 100) return { label: "LOW", color: "var(--warning)" };
    return { label: "OK", color: "var(--success)" };
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg("");
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      // Try to map common OCS/SAP columns
      const items = rows.map(r => ({
        ocs_code: r["OCS Code"] || r["ocs_code"] || r["OCSCode"] || "",
        sap_code1: r["SAP Code"] || r["SAP Code 1"] || r["SAPCode"] || "",
        sap_code2: r["SAP Code 2"] || r["SAPCode2"] || "",
        item_name: r["Item Name"] || r["Description"] || r["Deskripsi"] || "",
        qty_on_hand: String(r["Qty On Hand"] || r["QtyOnHand"] || r["Stock"] || r["qty"] || "0"),
        uom: r["UOM"] || r["Satuan"] || "PCS",
        last_updated: new Date().toISOString().split("T")[0],
      })).filter(i => i.ocs_code || i.sap_code1);

      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_stock", items }),
      });
      const json = await res.json();
      if (json.success) {
        setMsg(`✓ Upload ${items.length} item stock berhasil`);
        load();
      } else setMsg(`✗ ${json.error}`);
    } catch (err: any) {
      setMsg(`✗ Error: ${err.message}`);
    }
    setUploading(false);
    e.target.value = "";
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>Stock Monitoring</h1>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Upload dari SAP / OCS (WMS)</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "⟳ Upload..." : "⬆ Upload Stock (.xlsx)"}
          </button>
          <button className="btn-ghost" onClick={load}>↻ Refresh</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleUpload} style={{ display: "none" }} />
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

      {/* Info box for dual SKU */}
      <div className="glass" style={{ borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, borderLeft: "3px solid var(--accent2)" }}>
        <span style={{ color: "var(--accent2)", fontWeight: 600 }}>ℹ Dual SKU Handling: </span>
        <span style={{ color: "var(--muted)" }}>
          1 produk dapat memiliki 2 kode SAP (PP Board & Master Box). Keduanya dipetakan ke 1 OCS Code.
          Contoh: SAP 1207050305 + 1227050305 → OCS: FYNE-EXTRAIT-AMBER-WOOD
        </span>
      </div>

      {/* Filters */}
      <div className="glass" style={{ borderRadius: 8, padding: 14, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <input placeholder="Cari OCS Code / Nama Item..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        <select value={filterAlert} onChange={e => setFilterAlert(e.target.value)}>
          <option value="all">Semua Status Stock</option>
          <option value="zero">🔴 Kosong (0)</option>
          <option value="low">🟡 Low (&lt;100)</option>
          <option value="ok">🟢 OK (≥100)</option>
        </select>
      </div>

      <div className="glass" style={{ borderRadius: 10, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Loading...</div>
        ) : stock.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
            <div>Belum ada data stock. Upload file dari SAP/OCS.</div>
            <div style={{ fontSize: 11, marginTop: 8 }}>Format kolom: OCS Code, SAP Code, SAP Code 2, Item Name, Qty On Hand, UOM</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto", maxHeight: "62vh", overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>OCS Code</th><th>SAP Code 1</th><th>SAP Code 2</th>
                  <th>Item Name</th><th>Qty On Hand</th><th>UOM</th>
                  <th>Open PO</th><th>Status Stock</th><th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => {
                  const qty = parseFloat(item["Qty On Hand"] || "0");
                  const status = getStockStatus(qty);
                  const openPO = openPOMap[item["OCS Code"]];
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{item["OCS Code"]}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 11 }}>{item["SAP Code 1"]}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)" }}>{item["SAP Code 2"]}</td>
                      <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item["Item Name"]}</td>
                      <td style={{ fontWeight: 700, color: status.color, fontSize: 14 }}>{qty.toLocaleString()}</td>
                      <td style={{ color: "var(--muted)", fontSize: 11 }}>{item["UOM"]}</td>
                      <td>
                        {openPO ? (
                          <div style={{ fontSize: 11 }}>
                            <span style={{ color: "var(--warning)", fontWeight: 600 }}>{openPO.qty.toLocaleString()}</span>
                            <span style={{ color: "var(--muted)", marginLeft: 4 }}>({openPO.status})</span>
                          </div>
                        ) : <span style={{ color: "var(--muted)", fontSize: 11 }}>–</span>}
                      </td>
                      <td>
                        <span style={{ padding: "3px 8px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                          background: `${status.color}20`, color: status.color, border: `1px solid ${status.color}40` }}>
                          {status.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, color: "var(--muted)" }}>{item["Last Updated"]?.slice(0, 10)}</td>
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
