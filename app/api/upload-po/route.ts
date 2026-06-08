import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import * as XLSX from "xlsx";

function getAuth() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY || "{}");
  return new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    
    // Skip row 0 (summary row), use row 1 as header
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
    if (raw.length < 2) return NextResponse.json({ error: "Empty file" }, { status: 400 });
    
    const headers = raw[1] as string[];
    const rows = raw.slice(2).filter((r) => r[0]); // filter empty rows

    const mapped = rows.map((r) => {
      const formatDate = (v: any) => {
        if (!v) return "";
        if (v instanceof Date) return v.toISOString().split("T")[0];
        return String(v);
      };
      return [
        String(r[0] || ""),    // No. PO
        formatDate(r[1]),       // Date PO
        String(r[2] || ""),    // OCS Code
        String(r[3] || ""),    // SAP Code
        String(r[4] || ""),    // SAP Code 2
        String(r[5] || "0"),   // Quantity Fulfillment
        String(r[6] || ""),    // Tidak fulfill
        String(r[7] || "0"),   // Quantity PO
        String(r[8] || ""),    // Persentase SKU Diterima
        String(r[9] || ""),    // QTY UP STOCK
        formatDate(r[10]),      // DATE UP STOCK
        String(r[11] || ""),   // QTY Received 1st
        formatDate(r[12]),      // Arrival date 1st
        String(r[13] || ""),   // QTY Received 2nd
        formatDate(r[14]),      // Arrival date 2nd
        String(r[15] || ""),   // QTY Received 3th
        formatDate(r[16]),      // Arrival date 3th
        String(r[17] || "0"),  // Total QTY Received
        String(r[18] || ""),   // Persentase Received
        String(r[19] || ""),   // Remark PO
        String(r[20] || ""),   // Remark Received
        formatDate(r[21]),      // Today
        String(r[22] || ""),   // Lead Time PO
        String(r[23] || ""),   // Lead Time Arrival
      ];
    });

    const auth = await getAuth();
    const sheets = google.sheets({ version: "v4", auth });
    const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || "";

    // Clear and rewrite OpenPO sheet
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: "OpenPO!A:Z",
    });

    const headerRow = [
      "No. PO", "Date PO", "OCS Code", "SAP Code", "SAP Code 2",
      "Quantity Fulfillment", "Tidak Fulfill", "Quantity PO",
      "Persentase SKU Diterima", "QTY UP STOCK", "DATE UP STOCK",
      "QTY Received 1st", "Arrival date 1st",
      "QTY Received 2nd", "Arrival date 2nd",
      "QTY Received 3th", "Arrival date 3th",
      "Total QTY Received", "Persentase Received",
      "Remark PO", "Remark Received", "Today",
      "Lead Time PO", "Lead Time Arrival"
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: "OpenPO!A1",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headerRow, ...mapped] },
    });

    return NextResponse.json({ success: true, rows: mapped.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
