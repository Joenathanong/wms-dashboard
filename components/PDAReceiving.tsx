"use client";
import { useEffect, useRef, useState } from "react";

interface GREntry {
  material_code: string;
  batch: string;
  qty: string;
  uom: string;
  description: string;
  received_by: string;
  notes: string;
  created_at: string;
}

interface ParsedBarcode {
  material_code: string;
  batch: string;
  uom_type: string;
  qty_default: string;
  uom_pcs: string;
  material_name: string;
  warehouse: string;
}

function parseBarcode(raw: string): ParsedBarcode | null {
  // Format: 1201020711;D26158;CTN;12.00000;PCS;852600153;Hanasui Glow Expert Package 4pack x 12;WH
  const parts = raw.split(";");
  if (parts.length < 7) return null;
  return {
    material_code: parts[0]?.trim(),
    batch: parts[1]?.trim(),
    uom_type: parts[2]?.trim(),
    qty_default: parts[3]?.trim(),
    uom_pcs: parts[4]?.trim(),
    material_name: parts[6]?.trim(),
    warehouse: parts[7]?.trim() || "",
  };
}

export default function PDAReceiving() {
  const [barcodeInput, setBarcodeInput] = useState("");
  const [parsed, setParsed] = useState<ParsedBarcode | null>(null);
  const [qty, setQty] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<GREntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
  const [mode, setMode] = useState<"scan" | "history">("scan");
  const inputRef = useRef<HTMLInputElement>(null);

  const loadHistory = () => {
    setLoading(true);
    fetch("/api/sheets?action=gr_history")
      .then(r => r.json())
      .then(res => { setHistory(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    if (mode === "scan") inputRef.current?.focus();
  }, [mode]);

  const handleBarcodeScan = (val: string) => {
    setBarcodeInput(val);
    const p = parseBarcode(val);
    if (p) {
      setParsed(p);
      setQty(p.qty_default || "");
    } else {
      setParsed(null);
    }
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Zebra scanner sends Enter after scan
    if (e.key === "Enter" && barcodeInput) {
      const p = parseBarcode(barcodeInput);
      if (p) { setParsed(p); setQty(p.qty_default || ""); }
    }
  };

  const handleSubmit = async () => {
    if (!parsed || !qty || !receivedBy) {
      setMsg("⚠ Harap scan barcode, isi jumlah, dan nama penerima");
      return;
    }
    setSubmitting(true);
    setMsg("");
    const res = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_gr",
        material_code: parsed.material_code,
        batch: parsed.batch,
        qty,
        uom: parsed.uom_type,
        description: parsed.material_name,
        received_by: receivedBy,
        notes,
      }),
    });
    const json = await res.json();
    if (json.success) {
      setMsg("✓ GR berhasil disimpan!");
      setBarcodeInput("");
      setParsed(null);
      setQty("");
      setNotes("");
      loadHistory();
      inputRef.current?.focus();
    } else setMsg(`✗ ${json.error}`);
    setSubmitting(false);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>PDA Receiving</h1>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Scan barcode untuk input penerimaan barang (Zebra Android)</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className={mode === "scan" ? "btn-primary" : "btn-ghost"} onClick={() => setMode("scan")}>⬡ Scan</button>
          <button className={mode === "history" ? "btn-primary" : "btn-ghost"} onClick={() => setMode("history")}>↓ Riwayat GR</button>
        </div>
      </div>

      {mode === "scan" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Scan Panel */}
          <div>
            <div className="glass" style={{ borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Input Barcode
              </div>
              
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input
                  ref={inputRef}
                  placeholder="Scan / ketik barcode di sini..."
                  value={barcodeInput}
                  onChange={e => handleBarcodeScan(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  style={{ flex: 1, fontSize: 14, padding: "10px 12px" }}
                  autoComplete="off"
                />
                <button className="btn-ghost" onClick={() => { setBarcodeInput(""); setParsed(null); }}>✕</button>
              </div>

              {/* Manual test */}
              <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>Contoh format scan Zebra:</div>
              <div style={{ fontSize: 10, background: "var(--surface2)", padding: "8px 12px", borderRadius: 6, fontFamily: "monospace",
                color: "var(--accent)", marginBottom: 16, wordBreak: "break-all" }}>
                1201020711;D26158;CTN;12.00000;PCS;852600153;Hanasui Glow Expert Package 4pack x 12;WH
              </div>
              <button className="btn-ghost" style={{ fontSize: 11, width: "100%" }}
                onClick={() => handleBarcodeScan("1201020711;D26158;CTN;12.00000;PCS;852600153;Hanasui Glow Expert Package 4pack x 12;WH")}>
                ▶ Test Contoh Scan
              </button>
            </div>

            {/* Parsed result */}
            {parsed && (
              <div className="glass" style={{ borderRadius: 10, padding: 20, marginTop: 12, borderLeft: "3px solid var(--success)" }}>
                <div style={{ fontSize: 12, color: "var(--success)", marginBottom: 12, fontWeight: 600 }}>✓ Barcode Terbaca</div>
                {[
                  ["Kode Material", parsed.material_code],
                  ["Batch", parsed.batch],
                  ["Nama Barang", parsed.material_name],
                  ["UOM", parsed.uom_type],
                  ["Gudang", parsed.warehouse],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0",
                    borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                    <span style={{ color: "var(--muted)" }}>{k}</span>
                    <span style={{ fontWeight: 600, textAlign: "right", maxWidth: "60%", wordBreak: "break-all" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input Form */}
          <div>
            <div className="glass" style={{ borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Data Penerimaan
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>Kode Material *</label>
                <input value={parsed?.material_code || ""} readOnly
                  style={{ width: "100%", background: "rgba(0,212,255,0.05)", color: "var(--accent)", fontWeight: 600 }} />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>Batch</label>
                <input value={parsed?.batch || ""} readOnly style={{ width: "100%" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 8, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>Jumlah Terima *</label>
                  <input type="number" value={qty} onChange={e => setQty(e.target.value)}
                    placeholder="Input jumlah..." style={{ width: "100%", fontSize: 16, fontWeight: 700 }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>UOM</label>
                  <input value={parsed?.uom_type || ""} readOnly style={{ width: "100%" }} />
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>Diterima Oleh *</label>
                <input value={receivedBy} onChange={e => setReceivedBy(e.target.value)}
                  placeholder="Nama petugas inbound..." style={{ width: "100%" }} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: "var(--muted)", display: "block", marginBottom: 6 }}>Catatan</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Kondisi barang, dsb..." rows={3}
                  style={{ width: "100%", resize: "vertical" }} />
              </div>

              {msg && (
                <div style={{ padding: "10px 12px", borderRadius: 6, marginBottom: 12, fontSize: 13,
                  background: msg.startsWith("✓") ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
                  color: msg.startsWith("✓") ? "var(--success)" : "var(--warning)" }}>
                  {msg}
                </div>
              )}

              <button className="btn-primary" onClick={handleSubmit} disabled={submitting || !parsed}
                style={{ width: "100%", padding: "12px", fontSize: 14, fontWeight: 700 }}>
                {submitting ? "⟳ Menyimpan..." : "✓ Simpan GR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === "history" && (
        <div className="glass" style={{ borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 600 }}>Riwayat GR</span>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={loadHistory}>↻ Refresh</button>
          </div>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Loading...</div>
          ) : history.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>Belum ada riwayat penerimaan</div>
          ) : (
            <div style={{ overflowX: "auto", maxHeight: "65vh", overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Kode Material</th><th>Batch</th><th>Deskripsi</th>
                    <th>Qty</th><th>UOM</th><th>Diterima Oleh</th>
                    <th>Catatan</th><th>Waktu</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map((h, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: "monospace", color: "var(--accent)", fontWeight: 600 }}>{h.material_code}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 11 }}>{h.batch}</td>
                      <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.description}</td>
                      <td style={{ fontWeight: 700, color: "var(--success)" }}>{h.qty}</td>
                      <td style={{ fontSize: 11 }}>{h.uom}</td>
                      <td>{h.received_by}</td>
                      <td style={{ fontSize: 11, color: "var(--muted)" }}>{h.notes}</td>
                      <td style={{ fontSize: 11, color: "var(--muted)" }}>{h.created_at?.slice(0, 16).replace("T", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
