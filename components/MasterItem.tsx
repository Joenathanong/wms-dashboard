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

export default function MasterItem() {
  const [data, setData] = useState<MasterItem[]>([]);
  const [filtered, setFiltered] = useState<MasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ocs_code: "", sap_code1: "", sap_code2: "", item_name: "", category: "", unit: "PCS" });
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
    if (json.success) {
      setMsg("✓ Item berhasil ditambahkan");
      setForm({ ocs_code: "", sap_code1: "", sap_code2: "", item_name: "", category: "", unit: "PCS" });
      setShowForm(false);
      load();
    } else setMsg(`✗ ${json.error}`);
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>Master Item</h1>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>Mapping OCS Code → SAP Code (Dual SKU support)</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn-primary" onClick={() => setShowForm(!showForm)}>+ Tambah Item</button>
          <button className="btn-ghost" onClick={load}>↻</button>
        </div>
      </div>

      {msg && (
        <div style={{ padding: "10px 14px", borderRadius: 6, marginBottom: 16, fontSize: 13,
          background: msg.startsWith("✓") ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
          border: `1px solid ${msg.startsWith("✓") ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`,
          color: msg.startsWith("✓") ? "var(--success)" : "var(--warning)" }}>
          {msg}
        </div>
      )}

      {/* Dual SKU explanation */}
      <div className="glass" style={{ borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 12 }}>
        <div style={{ color: "var(--accent)", fontWeight: 600, marginBottom: 8 }}>◈ Dual SKU Handling</div>
        <div style={{ color: "var(--muted)", lineHeight: 1.8 }}>
          Produk dengan 2 kemasan berbeda (PP Board & Master Box) memiliki 2 kode SAP namun 1 kode OCS di WMS.<br/>
          <span style={{ color: "var(--text)" }}>Contoh:</span>{" "}
          <code style={{ background: "var(--surface2)", padding: "2px 6px", borderRadius: 3, color: "var(--accent)" }}>
            SAP: 1207050305
          </code>{" "}
          +{" "}
          <code style={{ background: "var(--surface2)", padding: "2px 6px", borderRadius: 3, color: "var(--accent2)" }}>
            1227050305
          </code>{" "}
          →{" "}
          <code style={{ background: "var(--surface2)", padding: "2px 6px", borderRadius: 3, color: "var(--success)" }}>
            FYNE-EXTRAIT-AMBER-WOOD
          </code>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="glass" style={{ borderRadius: 10, padding: 20, marginBottom: 16, borderLeft: "3px solid var(--accent)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Tambah Master Item Baru</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>OCS Code *</label>
              <input value={form.ocs_code} onChange={e => setForm({ ...form, ocs_code: e.target.value })}
                placeholder="FYNE-EXTRAIT-AMBER-WOOD" style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>SAP Code 1 (PP Board)</label>
              <input value={form.sap_code1} onChange={e => setForm({ ...form, sap_code1: e.target.value })}
                placeholder="1207050305" style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>SAP Code 2 (Master Box)</label>
              <input value={form.sap_code2} onChange={e => setForm({ ...form, sap_code2: e.target.value })}
                placeholder="1227050305" style={{ width: "100%" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Nama Item *</label>
              <input value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })}
                placeholder="Fyne Extrait Amber Wood 50ml" style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Kategori</label>
              <input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                placeholder="Parfum / Skincare / dll" style={{ width: "100%" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 4 }}>Satuan</label>
              <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} style={{ width: "100%" }}>
                <option>PCS</option><option>CTN</option><option>BOX</option><option>SET</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Menyimpan..." : "✓ Simpan"}
            </button>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>Batal</button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="glass" style={{ borderRadius: 8, padding: 12, marginBottom: 14 }}>
        <input placeholder="Cari OCS Code / SAP Code / Nama..." value={search}
          onChange={e => setSearch(e.target.value)} style={{ width: "100%", maxWidth: 400 }} />
      </div>

      <div className="glass" style={{ borderRadius: 10, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Loading...</div>
        ) : data.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>◈</div>
            <div>Belum ada master item. Tambahkan item pertama.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto", maxHeight: "60vh", overflowY: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>#</th><th>OCS Code</th><th>SAP Code 1 (PP Board)</th>
                  <th>SAP Code 2 (Master Box)</th><th>Nama Item</th>
                  <th>Kategori</th><th>Satuan</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, i) => (
                  <tr key={i}>
                    <td style={{ color: "var(--muted)", fontSize: 11 }}>{i + 1}</td>
                    <td style={{ fontWeight: 700, color: "var(--success)" }}>{item["OCS Code"]}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--accent)" }}>{item["SAP Code 1"]}</td>
                    <td style={{ fontFamily: "monospace", fontSize: 12, color: "var(--accent2)" }}>{item["SAP Code 2"]}</td>
                    <td>{item["Item Name"]}</td>
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
