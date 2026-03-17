## OOTD landing page

Static landing page (`index.html`) + a tiny API to store waitlist signups.

## Waitlist API (local + Excel)

This repo serves `index.html` and exposes a tiny API endpoint to store waitlist signups.

### Run

```bash
cd "/Users/oliviaespineiraflores/Desktop/IE/YEAR 2/semester 2/entrepreneurship/ootd"
npm i
cp .env.example .env
npm run dev
```

Then open `http://localhost:8787`.

### What gets stored

POST `/api/waitlist` with:

```json
{ "email": "you@example.com", "source": "landing" }
```

- If Microsoft Graph + Excel env vars are set, it appends a row to your Excel **Table** with columns:
  - `ts`, `email`, `source`, `ip`, `userAgent`
- Otherwise it appends to `data/waitlist.jsonl` locally.

### Excel setup (Microsoft Graph)

You need:

- **An Excel workbook** in OneDrive or SharePoint
- **A Table** created in that workbook (Excel: Insert → Table). Note its name (e.g. `Table1`).
- **An Entra ID app registration** with **application** permissions:
  - `Files.ReadWrite.All` (OneDrive) or `Sites.ReadWrite.All` (SharePoint)
  - Admin consent granted

Then fill `.env`:

- `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`
- `EXCEL_DRIVE_ID`, `EXCEL_ITEM_ID`, `EXCEL_TABLE_NAME`

To find `driveId` + `itemId`, use Graph Explorer:
- Query the drive, then locate the file item id.
