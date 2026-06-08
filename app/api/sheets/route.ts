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

// Helper: get all rows from a sheet
async function getSheetData(sheets: any, sheetName: string) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
  });
  return res.data.values || [];
}

// GET endpoints
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  try {
    const sheets = await getSheets();

    if (action === "open_po") {
      const rows = await getSheetData(sheets, "OpenPO");
      if (rows.length < 2) return NextResponse.json({ data: [] });
      const headers = rows[0];
      const data = rows.slice(1).map((r: string[]) => {
        const obj: Record<string, string> = {};
        headers.forEach((h: string, i: number) => { obj[h] = r[i] || ""; });
        return obj;
      });
      return NextResponse.json({ data });
    }

    if (action === "stock") {
      const rows = await getSheetData(sheets, "Stock");
      if (rows.length < 2) return NextResponse.json({ data: [] });
      const headers = rows[0];
      const data = rows.slice(1).map((r: string[]) => {
        const obj: Record<string, string> = {};
        headers.forEach((h: string, i: number) => { obj[h] = r[i] || ""; });
        return obj;
      });
      return NextResponse.json({ data });
    }

    if (action === "master_item") {
      const rows = await getSheetData(sheets, "MasterItem");
      if (rows.length < 2) return NextResponse.json({ data: [] });
      const headers = rows[0];
      const data = rows.slice(1).map((r: string[]) => {
        const obj: Record<string, string> = {};
        headers.forEach((h: string, i: number) => { obj[h] = r[i] || ""; });
        return obj;
      });
      return NextResponse.json({ data });
    }

    if (action === "gr_history") {
      const rows = await getSheetData(sheets, "GRHistory");
      if (rows.length < 2) return NextResponse.json({ data: [] });
      const headers = rows[0];
      const data = rows.slice(1).map((r: string[]) => {
        const obj: Record<string, string> = {};
        headers.forEach((h: string, i: number) => { obj[h] = r[i] || ""; });
        return obj;
      });
      return NextResponse.json({ data });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST endpoints
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  try {
    const sheets = await getSheets();

    if (action === "add_gr") {
      const { material_code, batch, qty, uom, description, received_by, notes } = body;
      const now = new Date().toISOString();
      const row = [material_code, batch, qty, uom, description, received_by, notes, now];
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "GRHistory!A:H",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [row] },
      });
      return NextResponse.json({ success: true });
    }

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

    if (action === "update_stock") {
      // Expects array of {ocs_code, qty_on_hand, last_updated}
      const { items } = body;
      // Clear existing stock and rewrite
      await sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: "Stock!A2:Z",
      });
      if (items && items.length > 0) {
        const rows = items.map((i: any) => [i.ocs_code, i.sap_code1, i.sap_code2, i.item_name, i.qty_on_hand, i.uom, i.last_updated]);
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
