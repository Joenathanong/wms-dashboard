"use client";

const modules = [
  { id: "dashboard",   label: "Dashboard",     icon: "▦" },
  { id: "master_item", label: "Master Item",   icon: "◈" },
  { id: "open_po",     label: "Open PO",       icon: "◉" },
  { id: "stock",       label: "Stock Monitor", icon: "▣" },
  { id: "pda",         label: "PDA Receiving", icon: "⬡" },
];

interface Props {
  active: string;
  onSelect: (id: string) => void;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ active, onSelect, open, onClose }: Props) {
  const handleSelect = (id: string) => { onSelect(id); onClose(); };

  return (
    <>
      <div className={`sidebar-overlay${open ? " open" : ""}`} onClick={onClose} />
      <aside className={`sidebar${open ? " open" : ""}`}>
        {/* Logo */}
        <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.15em", marginBottom: 3, textTransform: "uppercase" }}>
            Warehouse
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--accent)", fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>
            WMS · INBOUND
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            Hanasui / NCO / Fyne / Eomma
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 8px", overflowY: "auto" }}>
          <div style={{ fontSize: 10, color: "var(--muted)", padding: "6px 12px 4px", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Menu
          </div>
          {modules.map(m => (
            <button key={m.id} className={`nav-item${active === m.id ? " active" : ""}`}
              onClick={() => handleSelect(m.id)}>
              <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{m.icon}</span>
              <span>{m.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer info only */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
          <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.7 }}>
            Backend: Google Sheets<br />
            Deploy: Vercel
          </div>
        </div>
      </aside>
    </>
  );
}
