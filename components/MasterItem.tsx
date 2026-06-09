"use client";
import { useEffect, useState } from "react";

interface MasterItem {
  "OCS Code": string;
  "SAP Code 1": string;
  "SAP Code 2": string;
  "Item Name": string;
  "Category": string;
  "UOM": string;
}

const EMPTY_FORM = { ocs_code: "", sap_code1: "", sap_code2: "", item_name: "", category: "", unit: "PCS" };

export default function MasterItem() {
  const [data, setData] = useState<MasterItem[]>([]);
  const [filtered, setFiltered] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/sheets?action=master_item")
      .then(r => r.json())
      .then(res => { setData(res.data || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? data.filter(d =>
      d["OCS Code"]?.toLowerCase().includes(q) ||
      d["SAP Code 1"]?.toLowerCase().includes(q) ||
      d["Item Name"]?.toLowerCase().includes(q)
    ) : data);
  }, [data, search]);

  const handleSave = async () => {
    if (!form.ocs_code || !form.item_name) { setMsg("⚠ OCS Code dan Nama Item wajib diisi"); return; }
    setSaving(true);
    const res = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_master_item", ...form }),
    });
    const json = await res.json();
    setSaving(false);
    if (json.success) { setMsg("✓ Item berhasil ditambahkan"); setForm(EMPTY_FORM); setShowForm(false); load(); }
    else setMsg(`✗ ${json.error}`);
  };

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  return (
    <div>
      <div className="section-header">
        <div className="section-header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <h1>Master Item</h1>
            <p>Mapping OCS Code ↔ SAP Code · Dual SKU support</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button className="btn-primary" onClick={() => setShowForm(o => !o)}>+ Tambah</button>
            <button className="btn-ghost" onClick={load}>↻</button>
          </div>
        </div>
      </div>

      {msg && <div className={`alert ${msg.startsWith("✓") ? "alert-success" : msg.startsWith("⚠") ? "alert-warn" : "alert-danger"}`} style={{ marginBottom: 14 }}>{msg}</div>}

      {/* Dual SKU Info */}
      <div className="alert alert-info" style={{ marginBottom: 14, fontSize: 12 }}>
        <div>
          <span style={{ fontWeight: 600 }}>◈ Dual SKU Handling</span><br />
          Produk PP Board & Master Box punya 2 SAP Code → 1 OCS Code di WMS.<br />
          <span style={{ opacity: 0.8 }}>Contoh: </span>
          <code style={{ background: "var(--surface2)", padding: "1px 5px", borderRadius: 3 }}>1207050305</code>
          {" + "}
          <code style={{ background: "var(--surface2)", padding: "1px 5px", borderRadius: 3 }}>1227050305</code>
          {" → "}
          <code style={{ background: "var(--surface2)", padding: "1px 5px", borderRadius: 3, color: "var(--success)" }}>FYNE-EXTRAIT-AMBER-WOOD</code>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="glass fade-in" style={{ borderRadius: 10, padding: 18, marginBottom: 16, borderLeft: "3px solid var(--accent)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Tambah Master Item Baru</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>OCS Code *</label>
              <input value={form.ocs_code} onChange={f("ocs_code")} placeholder="FYNE-EXTRAIT-AMBER-WOOD" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>SAP Code 1 (PP Board)</label>
              <input value={form.sap_code1} onChange={f("sap_code1")} placeholder="1207050305" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>SAP Code 2 (Master Box)</label>
              <input value={form.sap_code2} onChange={f("sap_code2")} placeholder="1227050305" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Nama Item *</label>
              <input value={form.item_name} onChange={f("item_name")} placeholder="Fyne Extrait Amber Wood 50ml" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Kategori</label>
              <input value={form.category} onChange={f("category")} placeholder="Parfum / Skincare" />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Satuan</label>
              <select value={form.unit} onChange={f("unit")}>
                <option>PCS</option><option>CTN</option><option>BOX</option><option>SET</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <><span className="spin">⟳</span> Menyimpan...</> : "✓ Simpan"}
            </button>
            <button className="btn-ghost" onClick={() => { setShowForm(false); setMsg(""); }}>Batal</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="glass" style={{ borderRadius: 8, padding: 12, marginBottom: 14 }}>
        <input placeholder="Cari OCS Code / SAP Code / Nama..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="glass" style={{ borderRadius: 10, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}><span className="spin" style={{ fontSize: 20 }}>⟳</span></div>
        ) : data.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>◈</div>
            <div>Belum ada master item.</div>
          </div>
        ) : (
          <div className="table-wrap" style={{ maxHeight: "60vh", overflowY: "auto" }}>
            <table>
              <thead>
                <tr><th>#</th><th>OCS Code</th><th>SAP Code 1</th><th>SAP Code 2</th><th>Nama Item</th><th>Kategori</th><th>UOM</th></tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => (
                  <tr key={i}>
                    <td style={{ color: "var(--muted)", fontSize: 11 }}>{i + 1}</td>
                    <td style={{ fontWeight: 700, color: "var(--success)", whiteSpace: "nowrap" }}>{item["OCS Code"]}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--accent)", whiteSpace: "nowrap" }}>{item["SAP Code 1"]}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 11, color: "var(--accent2)", whiteSpace: "nowrap" }}>{item["SAP Code 2"]}</td>
                    <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item["Item Name"]}</td>
                    <td style={{ fontSize: 11, color: "var(--muted)" }}>{item["Category"]}</td>
                    <td style={{ fontSize: 11 }}>{item["UOM"]}</td>
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
