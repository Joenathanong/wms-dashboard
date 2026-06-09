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
  material_name: string;
  warehouse: string;
}

function parseBarcode(raw: string): ParsedBarcode | null {
  const parts = raw.split(";");
  if (parts.length < 7) return null;
  return {
    material_code: parts[0]?.trim(),
    batch: parts[1]?.trim(),
    uom_type: parts[2]?.trim(),
    qty_default: parts[3]?.trim(),
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
  useEffect(() => { if (mode === "scan") setTimeout(() => inputRef.current?.focus(), 100); }, [mode]);

  const handleBarcode = (val: string) => {
    setBarcodeInput(val);
    const p = parseBarcode(val);
    if (p) { setParsed(p); setQty(p.qty_default || ""); }
    else if (!val) setParsed(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && barcodeInput) {
      const p = parseBarcode(barcodeInput);
      if (p) { setParsed(p); setQty(p.qty_default || ""); }
    }
  };

  const handleSubmit = async () => {
    if (!parsed || !qty || !receivedBy) { setMsg("⚠ Harap scan barcode, isi jumlah & nama penerima"); return; }
    setSubmitting(true); setMsg("");
    const res = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add_gr",
        material_code: parsed.material_code,
        batch: parsed.batch,
        qty, uom: parsed.uom_type,
        description: parsed.material_name,
        received_by: receivedBy, notes,
      }),
    });
    const json = await res.json();
    if (json.success) {
      setMsg("✓ GR berhasil disimpan!");
      setBarcodeInput(""); setParsed(null); setQty(""); setNotes("");
      loadHistory();
      setTimeout(() => inputRef.current?.focus(), 100);
    } else setMsg(`✗ ${json.error}`);
    setSubmitting(false);
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </label>
      {children}
    </div>
  );

  return (
    <div>
      <div className="section-header">
        <div className="section-header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <h1>PDA Receiving</h1>
            <p>Scan barcode Zebra Android untuk input penerimaan barang</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button className={mode === "scan" ? "btn-primary" : "btn-ghost"} onClick={() => setMode("scan")}>⬡ Scan</button>
            <button className={mode === "history" ? "btn-primary" : "btn-ghost"} onClick={() => setMode("history")}>↓ Riwayat</button>
          </div>
        </div>
      </div>

      {mode === "scan" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>

          {/* Left: Scan input + parsed */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="glass" style={{ borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                Input Barcode
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input ref={inputRef} placeholder="Scan / ketik barcode..." value={barcodeInput}
                  onChange={e => handleBarcode(e.target.value)}
                  onKeyDown={handleKeyDown}
                  style={{ flex: 1, fontSize: 14, padding: "10px 12px" }}
                  autoComplete="off" autoCapitalize="none" />
                <button className="btn-ghost" onClick={() => { setBarcodeInput(""); setParsed(null); }}>✕</button>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 6 }}>Format scan Zebra:</div>
              <div style={{ fontSize: 10, background: "var(--surface2)", padding: "8px 10px", borderRadius: 6,
                fontFamily: "monospace", color: "var(--accent)", marginBottom: 12, wordBreak: "break-all", lineHeight: 1.6 }}>
                MatCode;Batch;UOM;Qty;UOM2;MatNo;Nama;Gudang
              </div>
              <button className="btn-ghost" style={{ width: "100%", fontSize: 12, justifyContent: "center" }}
                onClick={() => handleBarcode("1201020711;D26158;CTN;12.00000;PCS;852600153;Hanasui Glow Expert Package 4pack x 12;WH")}>
                ▶ Test Contoh Scan
              </button>
            </div>

            {parsed && (
              <div className="glass fade-in" style={{ borderRadius: 10, padding: 16, borderLeft: "3px solid var(--success)" }}>
                <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 600, marginBottom: 10 }}>✓ Barcode Terbaca</div>
                {([
                  ["Kode Material", parsed.material_code, "var(--accent)"],
                  ["Batch", parsed.batch, "var(--text)"],
                  ["Nama Barang", parsed.material_name, "var(--text)"],
                  ["UOM", parsed.uom_type, "var(--text)"],
                  ["Gudang", parsed.warehouse, "var(--muted)"],
                ] as [string, string, string][]).map(([k, v, c]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0",
                    borderBottom: "1px solid var(--border)", fontSize: 12, gap: 8 }}>
                    <span style={{ color: "var(--muted)", flexShrink: 0 }}>{k}</span>
                    <span style={{ fontWeight: 600, color: c, textAlign: "right", wordBreak: "break-all" }}>{v || "–"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Form */}
          <div>
            <div className="glass" style={{ borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
                Data Penerimaan
              </div>

              <Field label="Kode Material *">
                <input value={parsed?.material_code || ""} readOnly
                  style={{ background: "rgba(0,212,255,0.05)", color: "var(--accent)", fontWeight: 700 }} />
              </Field>

              <Field label="Batch">
                <input value={parsed?.batch || ""} readOnly />
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>Jumlah Terima *</label>
                  <input type="number" value={qty} onChange={e => setQty(e.target.value)}
                    placeholder="0" style={{ fontSize: 18, fontWeight: 700, textAlign: "center" }}
                    inputMode="numeric" />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em" }}>UOM</label>
                  <input value={parsed?.uom_type || ""} readOnly />
                </div>
              </div>

              <Field label="Diterima Oleh *">
                <input value={receivedBy} onChange={e => setReceivedBy(e.target.value)}
                  placeholder="Nama petugas inbound..." />
              </Field>

              <Field label="Catatan">
                <textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Kondisi barang, dsb..." rows={2}
                  style={{ resize: "vertical" }} />
              </Field>

              {msg && (
                <div className={`alert ${msg.startsWith("✓") ? "alert-success" : "alert-warn"}`} style={{ marginBottom: 12 }}>
                  {msg}
                </div>
              )}

              <button className="btn-primary" onClick={handleSubmit}
                disabled={submitting || !parsed}
                style={{ width: "100%", padding: "13px", fontSize: 14, fontWeight: 700, justifyContent: "center",
                  opacity: !parsed ? 0.5 : 1 }}>
                {submitting ? <><span className="spin">⟳</span> Menyimpan...</> : "✓ Simpan GR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {mode === "history" && (
        <div className="glass" style={{ borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Riwayat GR · {history.length} records</span>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={loadHistory}>↻ Refresh</button>
          </div>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}><span className="spin" style={{ fontSize: 20 }}>⟳</span></div>
          ) : history.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>Belum ada riwayat penerimaan</div>
          ) : (
            <div className="table-wrap" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              <table>
                <thead>
                  <tr><th>Kode Material</th><th>Batch</th><th>Deskripsi</th><th>Qty</th><th>UOM</th><th>Diterima Oleh</th><th>Catatan</th><th>Waktu</th></tr>
                </thead>
                <tbody>
                  {[...history].reverse().map((h, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: "monospace", color: "var(--accent)", fontWeight: 600, whiteSpace: "nowrap" }}>{h.material_code}</td>
                      <td style={{ fontFamily: "monospace", fontSize: 11, whiteSpace: "nowrap" }}>{h.batch}</td>
                      <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.description}</td>
                      <td style={{ fontWeight: 700, color: "var(--success)", whiteSpace: "nowrap" }}>{h.qty}</td>
                      <td style={{ fontSize: 11 }}>{h.uom}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{h.received_by}</td>
                      <td style={{ fontSize: 11, color: "var(--muted)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.notes}</td>
                      <td style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>{h.created_at?.slice(0, 16).replace("T", " ")}</td>
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
