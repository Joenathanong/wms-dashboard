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

async function getSheetData(sheets: any, sheetName: string): Promise<string[][]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  return (res.data.values || []) as string[][];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(r => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = r[i] || ""; });
    return obj;
  });
}

// Normalise No. PO: strip leading apostrophe (Excel text prefix), then padStart 3
// Sheet stores '012 → Sheets API returns "012". We always compare padded strings.
function normPO(v: string): string {
  return String(v || "").replace(/^'/, "").trim().padStart(3, "0");
}

// Format datetime for Arrival columns: "DD/MM/YYYY HH:MM"
function formatArrival(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// ─── Column indices for OpenPO sheet (0-based) ────────────────────────────────
// 0  No. PO            11 QTY Received 1st   17 Total QTY Received
// 1  Date PO           12 Arrival date 1st   18 Persentase Received
// 2  OCS Code          13 QTY Received 2nd   19 Remark PO
// 3  SAP Code          14 Arrival date 2nd   20 Remark Received
// 4  SAP Code 2        15 QTY Received 3th   21 Today
// 5  Quantity Fulfill  16 Arrival date 3th   22 Lead Time PO
// 6  Tidak Fulfill                           23 Lead Time Arrival
// 7  Quantity PO
const C = {
  NO_PO: 0, SAP1: 3, SAP2: 4, QTY_PO: 7,
  Q1: 11, A1: 12,
  Q2: 13, A2: 14,
  Q3: 15, A3: 16,
  TOTAL: 17, PCT: 18, RMK_PO: 19, RMK_RCV: 20,
};

// ─── GET ──────────────────────────────────────────────────────────────────────
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

    // Pending POs for PDA dropdown — sorted ascending, unique
    if (action === "pending_po") {
      const rows = await getSheetData(sheets, "OpenPO");
      const all = rowsToObjects(rows);
      const pending = all.filter(r => r["Remark Received"] !== "Full Received");
      // Sort by numeric PO value ascending
      pending.sort((a, b) => parseInt(a["No. PO"] || "0") - parseInt(b["No. PO"] || "0"));
      const seen = new Set<string>();
      const pos: { value: string; label: string }[] = [];
      for (const r of pending) {
        const raw = String(r["No. PO"] || "").trim();
        if (!raw) continue;
        const normed = normPO(raw); // "012"
        if (!seen.has(normed)) {
          seen.add(normed);
          // value = normalised "012" so it matches sheet; label = "PO-012"
          pos.push({ value: normed, label: `PO-${normed}` });
        }
      }
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

    // ── add_gr ────────────────────────────────────────────────────────────────
    if (action === "add_gr") {
      const { material_code, batch, qty, uom, description,
              received_by, notes, no_po, no_sj, shift } = body;

      const qtyNum  = parseFloat(qty) || 0;
      const now     = new Date();
      const nowISO  = now.toISOString();

      // Normalise PO for consistent storage & matching
      const noPONorm = normPO(String(no_po || ""));

      // ── 1. Append one row to GRHistory ─────────────────────────────────────
      // BUG FIX: values must be [[row]], not [row]
      // Columns: material_code | batch | qty | uom | description |
      //          received_by | notes | no_po | no_sj | shift | created_at
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "GRHistory!A:K",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[                           // ← double-array = one row ↓
            material_code,
            batch,
            String(qtyNum),
            uom,
            description,
            received_by,
            notes || "",
            noPONorm,
            no_sj || "",
            shift || "",
            nowISO,
          ]],
        },
      });

      // ── 2. Find matching row in OpenPO ─────────────────────────────────────
      if (!noPONorm) {
        return NextResponse.json({ success: true, po_updated: false,
          message: "GR disimpan. No. PO kosong, OpenPO tidak diupdate." });
      }

      const poRows = await getSheetData(sheets, "OpenPO");
      if (poRows.length < 2) {
        return NextResponse.json({ success: true, po_updated: false,
          message: "GR disimpan. Sheet OpenPO kosong." });
      }

      // Find the data row (index 1..n in poRows array) that matches No.PO + SAP Code
      const matCode = String(material_code || "").trim();
      let targetIdx = -1; // index inside poRows (0 = header row)

      for (let i = 1; i < poRows.length; i++) {
        const r = poRows[i];
        const rowPO   = normPO(String(r[C.NO_PO] || ""));
        const rowSAP1 = String(r[C.SAP1] || "").trim();
        const rowSAP2 = String(r[C.SAP2] || "").trim();

        if (rowPO === noPONorm && (rowSAP1 === matCode || rowSAP2 === matCode)) {
          targetIdx = i;
          break;
        }
      }

      if (targetIdx === -1) {
        return NextResponse.json({ success: true, po_updated: false,
          message: `GR disimpan. Tidak ada match PO-${noPONorm} + kode ${matCode} di OpenPO.` });
      }

      // Clone the target row, pad to at least col RMK_RCV+1
      const row = [...poRows[targetIdx]];
      while (row.length <= C.RMK_RCV) row.push("");

      const q1 = parseFloat(row[C.Q1] || "0");
      const q2 = parseFloat(row[C.Q2] || "0");
      const q3 = parseFloat(row[C.Q3] || "0");
      const arrStr = formatArrival(now);
      const THREE_H = 3 * 60 * 60 * 1000;

      // ── 3. Determine slot & whether to accumulate ──────────────────────────
      // Read GRHistory again (fresh after our append) to determine SJ→slot mapping
      const grRows  = await getSheetData(sheets, "GRHistory");
      const grObjs  = rowsToObjects(grRows);

      // All GR for this PO+material (includes the row we just saved)
      const itemGR = grObjs.filter(h =>
        normPO(h["no_po"]) === noPONorm && String(h["material_code"]).trim() === matCode
      );

      // Build SJ → slot map chronologically (earlier SJ gets lower slot)
      const sjSlot: Record<string, number> = {};
      let nextSlot = 1;
      const sorted = [...itemGR].sort(
        (a, b) => new Date(a["created_at"]).getTime() - new Date(b["created_at"]).getTime()
      );
      for (const h of sorted) {
        const sj = h["no_sj"];
        if (sj && !sjSlot[sj] && nextSlot <= 3) {
          sjSlot[sj] = nextSlot++;
        }
      }

      const currentSlot = sjSlot[no_sj] ?? -1;

      if (currentSlot === -1) {
        return NextResponse.json({ success: true, po_updated: false,
          message: "GR disimpan. Slot GR (1st/2nd/3rd) sudah penuh untuk item ini." });
      }

      // Within-3-hour accumulation: are there OTHER rows (not the one we just saved)
      // with same PO+mat+SJ and timestamp within 3h?
      const nowMs = now.getTime();
      const recentSameSJ = itemGR.filter(h => {
        if (h["no_sj"] !== no_sj) return false;
        const ts = new Date(h["created_at"]).getTime();
        return !isNaN(ts) && (nowMs - ts) <= THREE_H;
      });
      // If more than 1 entry (the one we just inserted + older ones), accumulate
      const accumulate = recentSameSJ.length > 1;

      if (currentSlot === 1) {
        if (accumulate) row[C.Q1] = String(q1 + qtyNum);
        else { row[C.Q1] = String(qtyNum); row[C.A1] = arrStr; }
      } else if (currentSlot === 2) {
        if (accumulate) row[C.Q2] = String(q2 + qtyNum);
        else { row[C.Q2] = String(qtyNum); row[C.A2] = arrStr; }
      } else {
        if (accumulate) row[C.Q3] = String(q3 + qtyNum);
        else { row[C.Q3] = String(qtyNum); row[C.A3] = arrStr; }
      }

      // ── 4. Recalculate totals & remarks ────────────────────────────────────
      const nq1 = parseFloat(row[C.Q1] || "0");
      const nq2 = parseFloat(row[C.Q2] || "0");
      const nq3 = parseFloat(row[C.Q3] || "0");
      const totalGR = nq1 + nq2 + nq3;
      const qtyPO   = parseFloat(row[C.QTY_PO] || "1") || 1;
      const pct     = totalGR / qtyPO;

      row[C.TOTAL] = String(totalGR);
      row[C.PCT]   = pct.toFixed(4);

      if (totalGR >= qtyPO)    row[C.RMK_RCV] = "Full Received";
      else if (totalGR > 0)    row[C.RMK_RCV] = "Partial Received";
      else                     row[C.RMK_RCV] = "Not yet";

      const qtyFulfill = parseFloat(row[5] || "0"); // col 5 = Quantity Fulfillment
      if (qtyFulfill >= qtyPO)       row[C.RMK_PO] = "Fulfill";
      else if (qtyFulfill > 0)       row[C.RMK_PO] = "Partial fulfill";

      // ── 5. Update only that row in OpenPO ──────────────────────────────────
      // targetIdx is 0-based in poRows; row 0 is header.
      // Sheet row number (1-based) = targetIdx + 1 (because header = row 1).
      const sheetRowNum = targetIdx + 1; // e.g. targetIdx=1 → sheetRowNum=2

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `OpenPO!A${sheetRowNum}:X${sheetRowNum}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },   // ← double-array = one row
      });

      const slotLabel = currentSlot === 1 ? "1st" : currentSlot === 2 ? "2nd" : "3rd";
      return NextResponse.json({
        success: true, po_updated: true,
        slot: currentSlot, accumulated: accumulate,
        total_gr: totalGR,
        remark_received: row[C.RMK_RCV],
        message: `GR disimpan & OpenPO diupdate · Slot ${slotLabel}${accumulate ? " (akumulasi)" : ""} · Total diterima: ${totalGR}`,
      });
    }

    // ── add_master_item ────────────────────────────────────────────────────────
    if (action === "add_master_item") {
      const { ocs_code, sap_code1, sap_code2, item_name, category, unit } = body;
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "MasterItem!A:F",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[ocs_code, sap_code1, sap_code2, item_name, category, unit]] },
      });
      return NextResponse.json({ success: true });
    }

    // ── update_stock ───────────────────────────────────────────────────────────
    if (action === "update_stock") {
      const { items } = body;
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID, range: "Stock!A2:Z",
      });
      if (items?.length > 0) {
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
