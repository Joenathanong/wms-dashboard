"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface GREntry {
  material_code: string;
  batch: string;
  qty: string;
  uom: string;
  description: string;
  received_by: string;
  notes: string;
  no_po: string;
  no_sj: string;
  shift: string;
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

interface POOption {
  value: string;
  label: string;
}

// ── Format angka: hapus trailing zero setelah desimal ────────────────────────
// 12.00000 → "12"    |    12.50000 → "12.5"    |    0.00000 → "0"
function cleanQty(raw: string): string {
  const n = parseFloat(raw);
  if (isNaN(n)) return "";
  // Gunakan toPrecision untuk hindari floating-point noise, lalu strip trailing zeros
  return n.toString(); // JS toString() sudah melakukan ini secara native
}

function parseBarcode(raw: string): ParsedBarcode | null {
  const parts = raw.split(";");
  if (parts.length < 7) return null;
  return {
    material_code: parts[0]?.trim(),
    batch:         parts[1]?.trim(),
    uom_type:      "PCS",                             // ← always PCS
    qty_default:   cleanQty(parts[3]?.trim() || ""),
    material_name: parts[6]?.trim(),
    warehouse:     parts[7]?.trim() || "",
  };
}

const SHIFTS = ["1", "2", "3", "Non Shift"];

const EMPTY_FORM = {
  no_po:       "",
  no_sj:       "",
  shift:       "",
  received_by: "",
  notes:       "",
};

// Label helper
const Field = ({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{
      fontSize: 11, color: "var(--muted)", display: "block",
      marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.06em",
    }}>
      {label}{required && <span style={{ color: "var(--danger)", marginLeft: 2 }}>*</span>}
    </label>
    {children}
  </div>
);

export default function PDAReceiving() {
  const [barcodeInput, setBarcodeInput] = useState("");
  const [parsed, setParsed]             = useState<ParsedBarcode | null>(null);
  const [qty, setQty]                   = useState("");
  const [form, setForm]                 = useState(EMPTY_FORM);
  const [poOptions, setPOOptions]       = useState<POOption[]>([]);
  const [showPODropdown, setShowPODropdown] = useState(false);
  const [poSearch, setPOSearch]         = useState("");

  const [history, setHistory]     = useState<GREntry[]>([]);
  const [loading, setLoading]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg]             = useState<{ type: "success" | "warn" | "danger"; text: string } | null>(null);
  const [mode, setMode]           = useState<"scan" | "history">("scan");

  const inputRef   = useRef<HTMLInputElement>(null);
  const poInputRef = useRef<HTMLInputElement>(null);

  // ── Load helpers ────────────────────────────────────────────────────────────
  const loadHistory = useCallback(() => {
    setLoading(true);
    fetch("/api/sheets?action=gr_history")
      .then(r => r.json())
      .then(res => { setHistory(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const loadPOOptions = useCallback(() => {
    fetch("/api/sheets?action=pending_po")
      .then(r => r.json())
      .then(res => setPOOptions(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadHistory(); loadPOOptions(); }, [loadHistory, loadPOOptions]);
  useEffect(() => {
    if (mode === "scan") setTimeout(() => inputRef.current?.focus(), 120);
  }, [mode]);

  // ── Barcode handling ────────────────────────────────────────────────────────
  const handleBarcode = (val: string) => {
    setBarcodeInput(val);
    const p = parseBarcode(val);
    if (p) {
      setParsed(p);
      setQty(p.qty_default);
    } else if (!val) {
      setParsed(null);
      setQty("");
    }
  };

  const handleBarcodeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && barcodeInput) {
      const p = parseBarcode(barcodeInput);
      if (p) { setParsed(p); setQty(p.qty_default); }
    }
  };

  // ── PO dropdown filter ──────────────────────────────────────────────────────
  const filteredPOs = poOptions.filter(o =>
    o.label.toLowerCase().includes(poSearch.toLowerCase()) ||
    o.value.includes(poSearch)
  );

  const selectPO = (opt: POOption) => {
    setForm(f => ({ ...f, no_po: opt.value }));
    setPOSearch(opt.label);
    setShowPODropdown(false);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!parsed)         { setMsg({ type: "warn", text: "⚠ Scan barcode terlebih dahulu" }); return; }
    if (!qty || parseFloat(qty) <= 0) { setMsg({ type: "warn", text: "⚠ Jumlah terima harus lebih dari 0" }); return; }
    if (!form.no_po)     { setMsg({ type: "warn", text: "⚠ No. PO wajib diisi" }); return; }
    if (!form.no_sj.trim()) { setMsg({ type: "warn", text: "⚠ No. Surat Jalan wajib diisi" }); return; }
    if (!form.shift)     { setMsg({ type: "warn", text: "⚠ Shift wajib dipilih" }); return; }
    if (!form.received_by.trim()) { setMsg({ type: "warn", text: "⚠ Nama penerima wajib diisi" }); return; }

    setSubmitting(true);
    setMsg(null);

    const res = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action:        "add_gr",
        material_code: parsed.material_code,
        batch:         parsed.batch,
        qty:           String(parseFloat(qty)), // clean format
        uom:           "PCS",                   // always PCS
        description:   parsed.material_name,
        received_by:   form.received_by,
        notes:         form.notes,
        no_po:         form.no_po,
        no_sj:         form.no_sj.trim(),
        shift:         form.shift,
      }),
    });

    const json = await res.json();
    setSubmitting(false);

    if (json.success) {
      const slotLabel = json.slot === 1 ? "1st" : json.slot === 2 ? "2nd" : json.slot === 3 ? "3rd" : "–";
      const detail = json.po_updated
        ? ` · Slot ${slotLabel}${json.accumulated ? " (akumulasi)" : ""} · Total GR: ${json.total_gr}`
        : ` · ${json.message || ""}`;
      setMsg({ type: "success", text: `✓ GR disimpan!${detail}` });

      // ── Reset HANYA barcode + qty. Form (PO, SJ, Shift, nama) tetap untuk scan item berikutnya.
      setBarcodeInput("");
      setParsed(null);
      setQty("");
      loadHistory();
      loadPOOptions();
      setTimeout(() => inputRef.current?.focus(), 120);
    } else {
      setMsg({ type: "danger", text: `✗ ${json.error}` });
    }
  };

  // ── Reset All ───────────────────────────────────────────────────────────────
  const handleResetAll = () => {
    setBarcodeInput(""); setParsed(null); setQty("");
    setForm(EMPTY_FORM); setPOSearch(""); setMsg(null);
    setTimeout(() => inputRef.current?.focus(), 120);
  };

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <div className="section-header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <h1>PDA Receiving</h1>
            <p>Scan barcode Zebra Android · Input penerimaan per palet</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button className={mode === "scan"    ? "btn-primary" : "btn-ghost"} onClick={() => setMode("scan")}>⬡ Scan</button>
            <button className={mode === "history" ? "btn-primary" : "btn-ghost"} onClick={() => { setMode("history"); loadHistory(); }}>↓ Riwayat</button>
          </div>
        </div>
      </div>

      {/* ── SCAN MODE ──────────────────────────────────────────────────────── */}
      {mode === "scan" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: 14 }}>

          {/* ── Kolom Kiri: Barcode + Hasil Scan ─────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Barcode Input */}
            <div className="glass" style={{ borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase",
                letterSpacing: "0.08em", marginBottom: 12 }}>
                Input Barcode
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input
                  ref={inputRef}
                  placeholder="Scan / ketik barcode di sini..."
                  value={barcodeInput}
                  onChange={e => handleBarcode(e.target.value)}
                  onKeyDown={handleBarcodeKeyDown}
                  style={{ flex: 1, fontSize: 14, padding: "10px 12px" }}
                  autoComplete="off" autoCapitalize="none" spellCheck={false}
                />
                <button className="btn-ghost"
                  onClick={() => { setBarcodeInput(""); setParsed(null); setQty(""); }}>✕</button>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 5 }}>Format Zebra (separator <code style={{ background: "var(--surface3)", padding: "1px 4px", borderRadius: 3 }}>;</code>):</div>
              <div style={{ fontSize: 10, background: "var(--surface2)", padding: "8px 10px", borderRadius: 6,
                fontFamily: "monospace", color: "var(--accent)", marginBottom: 12, wordBreak: "break-all", lineHeight: 1.8 }}>
                MatCode;Batch;UOM;Qty;UOM2;MatNo;Nama;Gudang
              </div>
              <button className="btn-ghost" style={{ width: "100%", fontSize: 12, justifyContent: "center" }}
                onClick={() => handleBarcode("1201020711;D26158;CTN;12.00000;PCS;852600153;Hanasui Glow Expert Package 4pack x 12;WH")}>
                ▶ Test Contoh Scan
              </button>
            </div>

            {/* Hasil Scan */}
            {parsed ? (
              <div className="glass fade-in" style={{ borderRadius: 10, padding: 16, borderLeft: "3px solid var(--success)" }}>
                <div style={{ fontSize: 12, color: "var(--success)", fontWeight: 600, marginBottom: 10 }}>
                  ✓ Barcode Terbaca
                </div>
                {([
                  ["Kode Material", parsed.material_code, "var(--accent)"],
                  ["Batch",         parsed.batch,         "var(--text)"],
                  ["Nama Barang",   parsed.material_name, "var(--text)"],
                  ["UOM",           parsed.uom_type,      "var(--text)"],
                  ["Gudang",        parsed.warehouse,     "var(--muted)"],
                ] as [string, string, string][]).map(([k, v, c]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0",
                    borderBottom: "1px solid var(--border)", fontSize: 12, gap: 8 }}>
                    <span style={{ color: "var(--muted)", flexShrink: 0 }}>{k}</span>
                    <span style={{ fontWeight: 600, color: c, textAlign: "right", wordBreak: "break-all" }}>{v || "–"}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass" style={{ borderRadius: 10, padding: 20, textAlign: "center",
                color: "var(--muted)", fontSize: 12, border: "1px dashed var(--border)" }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>⬡</div>
                Arahkan scanner Zebra ke barcode
              </div>
            )}
          </div>

          {/* ── Kolom Kanan: Form Data Penerimaan ────────────────────────── */}
          <div>
            <div className="glass" style={{ borderRadius: 10, padding: 18 }}>
              <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase",
                letterSpacing: "0.08em", marginBottom: 16 }}>
                Data Penerimaan
              </div>

              {/* Kode Material (read-only dari scan) */}
              <Field label="Kode Material">
                <input value={parsed?.material_code || ""}  readOnly
                  style={{ background: parsed ? "rgba(0,212,255,0.05)" : "var(--surface2)",
                    color: "var(--accent)", fontWeight: 700,
                    fontFamily: "monospace", letterSpacing: "0.05em" }} />
              </Field>

              {/* Jumlah + UOM */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 5,
                    textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Jumlah Terima<span style={{ color: "var(--danger)", marginLeft: 2 }}>*</span>
                  </label>
                  <input
                    type="number"
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    placeholder="0"
                    inputMode="decimal"
                    style={{ fontSize: 20, fontWeight: 700, textAlign: "center",
                      color: parseFloat(qty) > 0 ? "var(--success)" : "var(--text)" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 5,
                    textTransform: "uppercase", letterSpacing: "0.06em" }}>UOM</label>
                  {/* Always PCS */}
                  <input value="PCS" readOnly style={{ textAlign: "center", fontWeight: 700, color: "var(--accent)" }} />
                </div>
              </div>

              {/* No. PO — combo: dropdown + manual */}
              <Field label="No. PO" required>
                <div style={{ position: "relative" }}>
                  <input
                    ref={poInputRef}
                    placeholder="Ketik atau pilih No. PO..."
                    value={poSearch || form.no_po}
                    onChange={e => {
                      setPOSearch(e.target.value);
                      setForm(f => ({ ...f, no_po: e.target.value }));
                      setShowPODropdown(true);
                    }}
                    onFocus={() => setShowPODropdown(true)}
                    onBlur={() => setTimeout(() => setShowPODropdown(false), 180)}
                    autoComplete="off"
                    style={{ paddingRight: 32 }}
                  />
                  <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    color: "var(--muted)", fontSize: 10, pointerEvents: "none" }}>▼</span>

                  {showPODropdown && filteredPOs.length > 0 && (
                    <div style={{
                      position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 200,
                      background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 8,
                      boxShadow: "var(--shadow)", maxHeight: 220, overflowY: "auto",
                    }}>
                      {filteredPOs.map(opt => (
                        <button key={opt.value}
                          onMouseDown={() => selectPO(opt)}
                          style={{
                            width: "100%", padding: "10px 14px", textAlign: "left",
                            background: "transparent", border: "none",
                            borderBottom: "1px solid var(--border)", color: "var(--text)",
                            fontSize: 13, fontFamily: "inherit", cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 8,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                          <span style={{ fontFamily: "monospace", color: "var(--accent)", fontWeight: 700 }}>
                            {opt.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {poOptions.length === 0 && (
                  <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                    (Tidak ada PO pending — ketik manual jika perlu)
                  </div>
                )}
              </Field>

              {/* No. Surat Jalan */}
              <Field label="No. Surat Jalan" required>
                <input
                  value={form.no_sj}
                  onChange={e => setForm(f => ({ ...f, no_sj: e.target.value }))}
                  placeholder="Contoh: SJ-2026-00123"
                  autoCapitalize="characters"
                />
              </Field>

              {/* Shift */}
              <Field label="Shift" required>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                  {SHIFTS.map(s => (
                    <button key={s}
                      onClick={() => setForm(f => ({ ...f, shift: s }))}
                      style={{
                        padding: "9px 4px", borderRadius: 8, fontSize: 12, fontFamily: "inherit",
                        cursor: "pointer", fontWeight: 600, textAlign: "center",
                        border: form.shift === s ? "none" : "1px solid var(--border)",
                        background: form.shift === s ? "var(--accent)" : "var(--surface2)",
                        color: form.shift === s ? "#000" : "var(--muted)",
                        transition: "all 0.15s",
                      }}>
                      {s === "Non Shift" ? "Non" : `Shift ${s}`}
                    </button>
                  ))}
                </div>
              </Field>

              {/* Diterima Oleh */}
              <Field label="Diterima Oleh" required>
                <input
                  value={form.received_by}
                  onChange={e => setForm(f => ({ ...f, received_by: e.target.value }))}
                  placeholder="Nama petugas inbound..."
                />
              </Field>

              {/* Catatan */}
              <Field label="Catatan">
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Kondisi barang, dsb..."
                  rows={2}
                  style={{ resize: "vertical" }}
                />
              </Field>

              {/* Message */}
              {msg && (
                <div className={`alert alert-${msg.type === "success" ? "success" : msg.type === "danger" ? "danger" : "warn"}`}
                  style={{ marginBottom: 12, lineHeight: 1.5, fontSize: 12 }}>
                  {msg.text}
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  className="btn-primary"
                  onClick={handleSubmit}
                  disabled={submitting || !parsed}
                  style={{ flex: 1, padding: "13px", fontSize: 14, fontWeight: 700,
                    justifyContent: "center", opacity: !parsed ? 0.5 : 1 }}>
                  {submitting
                    ? <><span className="spin">⟳</span> Menyimpan...</>
                    : "✓ Simpan GR"}
                </button>
                <button
                  className="btn-ghost"
                  onClick={handleResetAll}
                  title="Reset semua field (ganti sesi / SJ baru)"
                  style={{ padding: "13px 14px", flexShrink: 0 }}>
                  ↺ Reset
                </button>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 8, textAlign: "center" }}>
                Setelah simpan: barcode &amp; jumlah di-reset otomatis · PO/SJ/Shift/Nama tetap
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY MODE ───────────────────────────────────────────────────── */}
      {mode === "history" && (
        <div className="glass" style={{ borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)",
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>Riwayat GR · {history.length} records</span>
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={loadHistory}>↻ Refresh</button>
          </div>

          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
              <span className="spin" style={{ fontSize: 20 }}>⟳</span>
            </div>
          ) : history.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
              Belum ada riwayat penerimaan
            </div>
          ) : (
            <div className="table-wrap" style={{ maxHeight: "65vh", overflowY: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>No. PO</th>
                    <th>No. SJ</th>
                    <th>Shift</th>
                    <th>Kode Material</th>
                    <th>Batch</th>
                    <th>Deskripsi</th>
                    <th>Qty</th>
                    <th>UOM</th>
                    <th>Diterima Oleh</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map((h, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>
                        {h.created_at?.slice(0, 16).replace("T", " ")}
                      </td>
                      <td style={{ fontFamily: "monospace", color: "var(--accent)", fontWeight: 600, whiteSpace: "nowrap" }}>
                        {h.no_po ? `PO-${String(h.no_po).padStart(3, "0")}` : "–"}
                      </td>
                      <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>{h.no_sj || "–"}</td>
                      <td style={{ fontSize: 11, whiteSpace: "nowrap" }}>
                        {h.shift ? (
                          <span style={{ padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 600,
                            background: "rgba(0,212,255,0.1)", color: "var(--accent)",
                            border: "1px solid rgba(0,212,255,0.25)" }}>
                            {h.shift === "Non Shift" ? "Non Shift" : `Shift ${h.shift}`}
                          </span>
                        ) : "–"}
                      </td>
                      <td style={{ fontFamily: "monospace", fontWeight: 600, whiteSpace: "nowrap", fontSize: 12 }}>
                        {h.material_code}
                      </td>
                      <td style={{ fontFamily: "monospace", fontSize: 11, whiteSpace: "nowrap" }}>{h.batch}</td>
                      <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12 }}>
                        {h.description}
                      </td>
                      <td style={{ fontWeight: 700, color: "var(--success)", whiteSpace: "nowrap", fontSize: 14 }}>
                        {h.qty}
                      </td>
                      <td style={{ fontSize: 11 }}>{h.uom}</td>
                      <td style={{ whiteSpace: "nowrap", fontSize: 12 }}>{h.received_by}</td>
                      <td style={{ fontSize: 11, color: "var(--muted)", maxWidth: 120,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {h.notes || "–"}
                      </td>
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
