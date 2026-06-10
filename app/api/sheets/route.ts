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

    // Debug: check normPO values in both sheets
    if (action === "debug_gr") {
      const poRows = await getSheetData(sheets, "OpenPO");
      const grRows = await getSheetData(sheets, "GRHistory");
      const poSample = poRows.slice(0, 8).map(r => ({
        raw_po: r[0], normed: normPO(String(r[0] || "")),
        sap1: r[3], sap2: r[4], remark: r[20],
      }));
      const grSample = grRows.slice(0, 8).map(r => ({
        raw_po: r[7], normed: normPO(String(r[7] || "")),
        mat: r[0], no_sj: r[8],
      }));
      return NextResponse.json({ po_sample: poSample, gr_sample: grSample });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
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

      // ── 1. Read GRHistory BEFORE appending (to determine slot & accumulation) ─
      const GR_HEADER = [
        "material_code","batch","qty","uom","description",
        "received_by","notes","no_po","no_sj","shift","created_at",
      ];

      let grBeforeAppend = await getSheetData(sheets, "GRHistory");

      // Auto-create header row if sheet is empty or has no header
      const hasHeader = grBeforeAppend.length > 0 &&
        String(grBeforeAppend[0][0] || "").toLowerCase().trim() === "material_code";
      if (!hasHeader) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: "GRHistory!A1",
          valueInputOption: "USER_ENTERED",
          requestBody: { values: [GR_HEADER] },
        });
        // Re-read after inserting header
        grBeforeAppend = await getSheetData(sheets, "GRHistory");
      }

      // Parse existing GR history for this PO + material
      const grObjsBefore = rowsToObjects(grBeforeAppend);
      const matCode = String(material_code || "").trim();
      const THREE_H = 3 * 60 * 60 * 1000;
      const nowMs   = now.getTime();

      const itemGRBefore = grObjsBefore.filter(h =>
        normPO(h["no_po"]) === noPONorm &&
        String(h["material_code"]).trim() === matCode
      );

      // Build SJ → slot map from EXISTING history (chronological)
      const sjSlot: Record<string, number> = {};
      let nextSlot = 1;
      const sortedBefore = [...itemGRBefore].sort(
        (a, b) => new Date(a["created_at"]).getTime() - new Date(b["created_at"]).getTime()
      );
      for (const h of sortedBefore) {
        const sj = h["no_sj"];
        if (sj && !sjSlot[sj] && nextSlot <= 3) {
          sjSlot[sj] = nextSlot++;
        }
      }

      // Determine slot for current SJ
      let currentSlot: number;
      if (sjSlot[no_sj]) {
        currentSlot = sjSlot[no_sj]; // existing SJ → same slot
      } else if (nextSlot <= 3) {
        currentSlot = nextSlot;      // new SJ → next available slot
        sjSlot[no_sj] = currentSlot;
      } else {
        currentSlot = -1;            // all 3 slots taken by different SJs
      }

      // Check if this SJ already has recent entries (within 3h) → accumulate
      const recentSameSJ = itemGRBefore.filter(h => {
        if (h["no_sj"] !== no_sj) return false;
        const ts = new Date(h["created_at"]).getTime();
        return !isNaN(ts) && (nowMs - ts) <= THREE_H;
      });
      const accumulate = recentSameSJ.length > 0;

      // Now append the new GR row
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "GRHistory!A:K",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [[
            material_code, batch, String(qtyNum), uom, description,
            received_by, notes || "", noPONorm, no_sj || "", shift || "", nowISO,
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

      // Find data row matching No.PO + SAP Code
      let targetIdx = -1;
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

      if (currentSlot === -1) {
        return NextResponse.json({ success: true, po_updated: false,
          message: "GR disimpan. Slot GR (1st/2nd/3rd) sudah penuh untuk item ini." });
      }

      // Clone the row and pad
      const row = [...poRows[targetIdx]];
      while (row.length <= C.RMK_RCV) row.push("");

      const q1 = parseFloat(row[C.Q1] || "0");
      const q2 = parseFloat(row[C.Q2] || "0");
      const q3 = parseFloat(row[C.Q3] || "0");
      const arrStr = formatArrival(now);

      // ── 3. Write qty into the correct slot ─────────────────────────────────
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

      if (totalGR >= qtyPO)  row[C.RMK_RCV] = "Full Received";
      else if (totalGR > 0)  row[C.RMK_RCV] = "Partial Received";
      else                   row[C.RMK_RCV] = "Not yet";

      const qtyFulfill = parseFloat(row[5] || "0");
      if (qtyFulfill >= qtyPO)      row[C.RMK_PO] = "Fulfill";
      else if (qtyFulfill > 0)      row[C.RMK_PO] = "Partial fulfill";

      // ── 5. Update that row in OpenPO ───────────────────────────────────────
      // poRows[0] = header → Google Sheets row 1
      // poRows[1] = first data row → Google Sheets row 2
      // So sheetRowNum = targetIdx + 1
      const sheetRowNum = targetIdx + 1;

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `OpenPO!A${sheetRowNum}:X${sheetRowNum}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
      });

      const slotLabel = currentSlot === 1 ? "1st" : currentSlot === 2 ? "2nd" : "3rd";
      return NextResponse.json({
        success: true, po_updated: true,
        slot: currentSlot, accumulated: accumulate,
        total_gr: totalGR,
        remark_received: row[C.RMK_RCV],
        // Debug info visible in UI feedback
        debug: {
          noPONorm, matCode, targetIdx, sheetRowNum,
          q_before: { q1, q2, q3 },
          q_after: { nq1, nq2, nq3 },
          accumulate,
        },
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
