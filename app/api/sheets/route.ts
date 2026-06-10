import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}");
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function getSheets() {
  const auth = await getAuth();
  return google.sheets({ version: "v4", auth });
}

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "";

async function getSheetData(sheets: any, sheetName: string) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  return res.data.values || [];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(r => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = r[i] || ""; });
    return obj;
  });
}

// Format datetime untuk kolom Arrival: "DD/MM/YYYY HH:MM"
function formatArrival(date: Date): string {
  const dd   = String(date.getDate()).padStart(2, "0");
  const mm   = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh   = String(date.getHours()).padStart(2, "0");
  const min  = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
}

// ─── Column index map untuk OpenPO (0-based) ─────────────────────────────────
// Header row (row[0]) dari upload:
// 0  No. PO
// 1  Date PO
// 2  OCS Code
// 3  SAP Code
// 4  SAP Code 2
// 5  Quantity Fulfillment
// 6  Tidak Fulfill
// 7  Quantity PO
// 8  Persentase SKU Diterima
// 9  QTY UP STOCK
// 10 DATE UP STOCK
// 11 QTY Received 1st
// 12 Arrival date 1st
// 13 QTY Received 2nd
// 14 Arrival date 2nd
// 15 QTY Received 3th
// 16 Arrival date 3th
// 17 Total QTY Received
// 18 Persentase Received
// 19 Remark PO
// 20 Remark Received
// 21 Today
// 22 Lead Time PO
// 23 Lead Time Arrival

const COL = {
  NO_PO:         0,
  SAP_CODE:      3,
  SAP_CODE2:     4,
  QTY_PO:        7,
  QTY_1ST:       11,
  ARR_1ST:       12,
  QTY_2ND:       13,
  ARR_2ND:       14,
  QTY_3RD:       15,
  ARR_3RD:       16,
  TOTAL_GR:      17,
  PCT_RECEIVED:  18,
  REMARK_PO:     19,
  REMARK_RCV:    20,
};

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    const sheets = await getSheets();

    if (action === "open_po") {
      const rows = await getSheetData(sheets, "OpenPO");
      return NextResponse.json({ data: rowsToObjects(rows) });
    }

    if (action === "stock") {
      const rows = await getSheetData(sheets, "Stock");
      return NextResponse.json({ data: rowsToObjects(rows) });
    }

    if (action === "master_item") {
      const rows = await getSheetData(sheets, "MasterItem");
      return NextResponse.json({ data: rowsToObjects(rows) });
    }

    if (action === "gr_history") {
      const rows = await getSheetData(sheets, "GRHistory");
      return NextResponse.json({ data: rowsToObjects(rows) });
    }

    // Pending POs untuk dropdown PDA (Remark Received != Full Received), sorted No. PO asc
    if (action === "pending_po") {
      const rows = await getSheetData(sheets, "OpenPO");
      const all = rowsToObjects(rows);
      const pending = all
        .filter(r => r["Remark Received"] !== "Full Received")
        .sort((a, b) => {
          const na = parseInt(a["No. PO"] || "0");
          const nb = parseInt(b["No. PO"] || "0");
          return na - nb;
        });
      // Return unique PO numbers with a label
      const seen = new Set<string>();
      const pos: { value: string; label: string }[] = [];
      pending.forEach(r => {
        const v = r["No. PO"];
        if (v && !seen.has(v)) { seen.add(v); pos.push({ value: v, label: `PO-${String(v).padStart(3,"0")}` }); }
      });
      return NextResponse.json({ data: pos });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  try {
    const sheets = await getSheets();

    // ── add_gr: full logic with Open PO update ────────────────────────────────
    if (action === "add_gr") {
      const {
        material_code,   // from barcode pos 0
        batch,
        qty,             // jumlah terima (string, cleaned)
        uom,
        description,
        received_by,
        notes,
        no_po,           // new field
        no_sj,           // new field – surat jalan (wajib)
        shift,           // new field: "1" | "2" | "3" | "Non Shift"
      } = body;

      const qtyNum = parseFloat(qty) || 0;
      const now    = new Date();
      const nowISO = now.toISOString();

      // 1. Simpan ke GRHistory
      // Columns: material_code | batch | qty | uom | description | received_by | notes | no_po | no_sj | shift | created_at
      const grRow = [
        material_code, batch, String(qtyNum), uom, description,
        received_by, notes, no_po, no_sj, shift, nowISO,
      ];
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "GRHistory!A:K",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [grRow] },
      });

      // 2. Cari baris di OpenPO yang cocok (No. PO + SAP Code / SAP Code 2)
      const poRows = await getSheetData(sheets, "OpenPO");
      if (poRows.length < 2 || !no_po) {
        return NextResponse.json({ success: true, po_updated: false, message: "GR disimpan. Tidak ada match di Open PO." });
      }

      const headers = poRows[0] as string[];
      let targetRowIndex = -1; // 1-based row index in sheet (row 1 = header)

      for (let i = 1; i < poRows.length; i++) {
        const r = poRows[i] as string[];
        const rowPO       = String(r[COL.NO_PO] || "").trim();
        const rowSAP1     = String(r[COL.SAP_CODE] || "").trim();
        const rowSAP2     = String(r[COL.SAP_CODE2] || "").trim();
        const matTrimmed  = String(material_code || "").trim();

        if (rowPO === String(no_po).trim() &&
            (rowSAP1 === matTrimmed || rowSAP2 === matTrimmed)) {
          targetRowIndex = i; // 0-based in poRows → sheet row = i+1 (row 1 is header)
          break;
        }
      }

      if (targetRowIndex === -1) {
        return NextResponse.json({ success: true, po_updated: false, message: "GR disimpan. Kode material tidak ditemukan di PO tersebut." });
      }

      const targetRow = [...(poRows[targetRowIndex] as string[])];
      // Pad row to at least COL.REMARK_RCV+1 columns
      while (targetRow.length <= COL.REMARK_RCV) targetRow.push("");

      const q1 = parseFloat(targetRow[COL.QTY_1ST] || "0");
      const q2 = parseFloat(targetRow[COL.QTY_2ND] || "0");
      const q3 = parseFloat(targetRow[COL.QTY_3RD] || "0");

      const arrivalStr = formatArrival(now);
      const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

      // ── Logic: cari GRHistory untuk No.PO + material + SJ yang sama dalam 3 jam ──
      const grHistRows = await getSheetData(sheets, "GRHistory");
      const grHist = grHistRows.length > 1
        ? rowsToObjects(grHistRows).filter(h => {
            if (h["no_po"] !== String(no_po).trim()) return false;
            if (h["material_code"] !== material_code) return false;
            if (h["no_sj"] !== no_sj) return false;
            // exclude the row we just inserted (last row)
            const ts = new Date(h["created_at"]).getTime();
            return !isNaN(ts) && (now.getTime() - ts) <= THREE_HOURS_MS;
          })
        : [];

      // Tentukan apakah SJ ini sudah pernah ada di slot tertentu
      // Cek slot mana yang sudah diisi berdasarkan data OpenPO saat ini
      // Kita simpan "SJ per slot" di GRHistory — cari SJ mana yang pertama pakai slot 1, 2, 3
      // Approach: cek semua GRHistory untuk No.PO + material untuk tahu SJ → slot mapping
      const allGRForItem = grHistRows.length > 1
        ? rowsToObjects(grHistRows).filter(h =>
            h["no_po"] === String(no_po).trim() &&
            h["material_code"] === material_code
          )
        : [];

      // Map SJ → slot (1, 2, 3) dari riwayat yang sudah ada
      const sjSlotMap: Record<string, number> = {};
      const slotOrder = [1, 2, 3];
      let nextSlot = 1;
      // Determine slots chronologically
      const sortedSJs = allGRForItem
        .filter(h => h["no_sj"])
        .sort((a, b) => new Date(a["created_at"]).getTime() - new Date(b["created_at"]).getTime());

      for (const h of sortedSJs) {
        const sj = h["no_sj"];
        if (!sjSlotMap[sj] && nextSlot <= 3) {
          sjSlotMap[sj] = nextSlot;
          nextSlot++;
        }
      }

      // Assign slot for current SJ
      let currentSlot: number;
      if (sjSlotMap[no_sj]) {
        currentSlot = sjSlotMap[no_sj];
      } else {
        // New SJ — assign next available slot
        currentSlot = nextSlot <= 3 ? nextSlot : -1;
      }

      if (currentSlot === -1) {
        return NextResponse.json({
          success: true,
          po_updated: false,
          message: "GR disimpan. Slot GR (1st/2nd/3rd) di Open PO sudah penuh untuk item ini. Hubungi admin.",
        });
      }

      // Check if within 3-hour window for same SJ → ACCUMULATE (add to existing slot qty)
      const samesjRecent = grHist.length > 0; // we already filtered by SJ + 3h above

      if (currentSlot === 1) {
        if (samesjRecent) {
          targetRow[COL.QTY_1ST] = String(q1 + qtyNum);
        } else {
          targetRow[COL.QTY_1ST] = String(qtyNum);
          targetRow[COL.ARR_1ST] = arrivalStr;
        }
      } else if (currentSlot === 2) {
        if (samesjRecent) {
          targetRow[COL.QTY_2ND] = String(q2 + qtyNum);
        } else {
          targetRow[COL.QTY_2ND] = String(qtyNum);
          targetRow[COL.ARR_2ND] = arrivalStr;
        }
      } else if (currentSlot === 3) {
        if (samesjRecent) {
          targetRow[COL.QTY_3RD] = String(q3 + qtyNum);
        } else {
          targetRow[COL.QTY_3RD] = String(qtyNum);
          targetRow[COL.ARR_3RD] = arrivalStr;
        }
      }

      // Recalculate totals
      const newQ1    = parseFloat(targetRow[COL.QTY_1ST] || "0");
      const newQ2    = parseFloat(targetRow[COL.QTY_2ND] || "0");
      const newQ3    = parseFloat(targetRow[COL.QTY_3RD] || "0");
      const totalGR  = newQ1 + newQ2 + newQ3;
      const qtyPO    = parseFloat(targetRow[COL.QTY_PO] || "1") || 1;
      const pct      = totalGR / qtyPO;

      targetRow[COL.TOTAL_GR]     = String(totalGR);
      targetRow[COL.PCT_RECEIVED] = String(pct.toFixed(4));

      // Remark Received
      if (totalGR >= qtyPO) {
        targetRow[COL.REMARK_RCV] = "Full Received";
      } else if (totalGR > 0) {
        targetRow[COL.REMARK_RCV] = "Partial Received";
      } else {
        targetRow[COL.REMARK_RCV] = "Not yet";
      }

      // Remark PO (Fulfill = Qty Fulfillment >= Qty PO, keep existing logic)
      const qtyFulfill = parseFloat(targetRow[COL.NO_PO + 5] || "0"); // col 5 = Quantity Fulfillment
      if (qtyFulfill >= qtyPO) {
        targetRow[COL.REMARK_PO] = "Fulfill";
      } else if (qtyFulfill > 0) {
        targetRow[COL.REMARK_PO] = "Partial fulfill";
      }

      // Write back to sheet (row index in sheet = targetRowIndex + 2, because row 1=header, 0-based)
      const sheetRow = targetRowIndex + 2; // 1-indexed, +1 for header, +1 for 1-indexing
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `OpenPO!A${sheetRow}:Z${sheetRow}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [targetRow] },
      });

      return NextResponse.json({
        success: true,
        po_updated: true,
        slot: currentSlot,
        accumulated: samesjRecent,
        total_gr: totalGR,
        remark_received: targetRow[COL.REMARK_RCV],
        message: `GR disimpan & Open PO diupdate. Slot ${currentSlot === 1 ? "1st" : currentSlot === 2 ? "2nd" : "3rd"} — Total diterima: ${totalGR}`,
      });
    }

    // ── add_master_item ────────────────────────────────────────────────────────
    if (action === "add_master_item") {
      const { ocs_code, sap_code1, sap_code2, item_name, category, unit } = body;
      const row = [ocs_code, sap_code1, sap_code2, item_name, category, unit];
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "MasterItem!A:F",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
      });
      return NextResponse.json({ success: true });
    }

    // ── update_stock ───────────────────────────────────────────────────────────
    if (action === "update_stock") {
      const { items } = body;
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: "Stock!A2:Z",
      });
      if (items && items.length > 0) {
        const rows = items.map((i: any) => [
          i.ocs_code, i.sap_code1, i.sap_code2, i.item_name, i.qty_on_hand, i.uom, i.last_updated,
        ]);
        await sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: "Stock!A2",
          valueInputOption: "USER_ENTERED",
          requestBody: { values: rows },
        });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
