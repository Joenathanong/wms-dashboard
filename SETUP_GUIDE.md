# WMS Dashboard — Setup Guide

## 📋 Arsitektur
- **Frontend**: Next.js (deploy ke Vercel)
- **Backend/Database**: Google Sheets
- **PDA**: Kompatibel Zebra Android (scan barcode via browser)

---

## 🗂️ Google Sheets Setup

### 1. Buat Google Spreadsheet baru
Buat spreadsheet di Google Drive dengan 4 sheet (tab):

| Sheet Name | Keterangan |
|------------|------------|
| `OpenPO`   | Data fulfillment PO (upload dari file .xlsx) |
| `Stock`    | Data stock on hand (upload dari SAP/OCS) |
| `MasterItem` | Mapping OCS Code ↔ SAP Code (dual SKU) |
| `GRHistory` | Riwayat penerimaan barang via PDA |

### 2. Header kolom masing-masing sheet

**OpenPO** (A1:X1):
```
No. PO | Date PO | OCS Code | SAP Code | SAP Code 2 | Quantity Fulfillment | Tidak Fulfill | Quantity PO | Persentase SKU Diterima | QTY UP STOCK | DATE UP STOCK | QTY Received 1st | Arrival date 1st | QTY Received 2nd | Arrival date 2nd | QTY Received 3th | Arrival date 3th | Total QTY Received | Persentase Received | Remark PO | Remark Received | Today | Lead Time PO | Lead Time Arrival
```

**Stock** (A1:G1):
```
OCS Code | SAP Code 1 | SAP Code 2 | Item Name | Qty On Hand | UOM | Last Updated
```

**MasterItem** (A1:F1):
```
OCS Code | SAP Code 1 | SAP Code 2 | Item Name | Category | UOM
```

**GRHistory** (A1:H1):
```
material_code | batch | qty | uom | description | received_by | notes | created_at
```

---

## 🔑 Google Service Account Setup

### 1. Buat Project di Google Cloud Console
1. Buka [console.cloud.google.com](https://console.cloud.google.com)
2. Buat project baru atau gunakan yang ada
3. Enable **Google Sheets API**

### 2. Buat Service Account
1. IAM & Admin → Service Accounts → **Create Service Account**
2. Isi nama (contoh: `wms-dashboard`)
3. Download JSON key file

### 3. Share Spreadsheet ke Service Account
1. Buka Google Spreadsheet Anda
2. Klik **Share**
3. Paste email service account (dari JSON key, field `client_email`)
4. Berikan akses **Editor**

---

## 🚀 Deploy ke Vercel

### 1. Push ke GitHub
```bash
git init
git add .
git commit -m "WMS Dashboard initial"
git remote add origin https://github.com/YOUR_USERNAME/wms-dashboard.git
git push -u origin main
```

### 2. Connect ke Vercel
1. Buka [vercel.com](https://vercel.com) → Import Project
2. Pilih repository GitHub
3. Framework: **Next.js** (auto-detected)

### 3. Environment Variables di Vercel
Tambahkan di Vercel Dashboard → Settings → Environment Variables:

```
GOOGLE_SERVICE_ACCOUNT_KEY = (paste full JSON dari file key, 1 baris)
GOOGLE_SHEET_ID = (ID spreadsheet dari URL)
```

---

## 📱 PDA Receiving (Zebra Android)

### Setup di HP Zebra
1. Buka browser Chrome di Zebra Android
2. Buka URL aplikasi yang sudah di-deploy
3. Navigasi ke menu **PDA Receiving**
4. Arahkan scanner ke barcode produk

### Format Barcode yang Didukung
```
{Kode Material};{Batch};{UOM};{Qty};{UOM PCS};{Material No};{Nama Barang};{Gudang}
```

Contoh:
```
1201020711;D26158;CTN;12.00000;PCS;852600153;Hanasui Glow Expert Package 4pack x 12;WH
```

| Posisi | Data |
|--------|------|
| 1 | Kode Material SAP |
| 2 | Batch |
| 3 | UOM (CTN/PCS/BOX) |
| 4 | Qty default |
| 5 | UOM PCS |
| 7 | Nama barang |
| 8 | Kode gudang |

---

## 🏷️ Dual SKU Handling

Produk dengan 2 kemasan (PP Board reusable & Master Box):

| OCS Code (WMS) | SAP Code 1 (PP Board) | SAP Code 2 (Master Box) |
|----------------|----------------------|------------------------|
| FYNE-EXTRAIT-AMBER-WOOD | 1207050305 | 1227050305 |

Daftarkan di menu **Master Item** agar sistem bisa memetakan keduanya ke 1 OCS Code.

---

## 📤 Upload Data

### Upload Open PO
- Format: file .xlsx sesuai template yang digunakan (kolom sama dengan file contoh)
- Menu: **Open PO** → Upload PO (.xlsx)
- Data akan otomatis replace data lama di sheet `OpenPO`

### Upload Stock
- Format: .xlsx dari ekspor SAP/OCS dengan kolom: OCS Code, SAP Code, Item Name, Qty On Hand, UOM
- Menu: **Stock Monitor** → Upload Stock (.xlsx)

---

## 🛠️ Local Development

```bash
npm install
# Isi .env.local dengan GOOGLE_SERVICE_ACCOUNT_KEY dan GOOGLE_SHEET_ID
npm run dev
```

Buka http://localhost:3000
