const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs/promises");

require("dotenv").config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;

app.use(cors());
app.use(express.json({ limit: "64kb" }));

const ROOT_DIR = path.resolve(__dirname, "..");

app.get("/", (_req, res) => {
  res.sendFile(path.join(ROOT_DIR, "index.html"));
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

function isValidEmail(email) {
  if (typeof email !== "string") return false;
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

async function storeLocalSignup({ email, userAgent, ip }) {
  const dataDir = path.join(ROOT_DIR, "data");
  await fs.mkdir(dataDir, { recursive: true });
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    email,
    userAgent,
    ip
  });
  await fs.appendFile(path.join(dataDir, "waitlist.jsonl"), line + "\n", "utf8");
}

async function getGraphToken() {
  const tenantId = process.env.MS_TENANT_ID;
  const clientId = process.env.MS_CLIENT_ID;
  const clientSecret = process.env.MS_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) return null;

  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(
    tenantId
  )}/oauth2/v2.0/token`;

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("client_id", clientId);
  body.set("client_secret", clientSecret);
  body.set("scope", "https://graph.microsoft.com/.default");

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Graph token failed (${resp.status}): ${text}`);
  }

  const json = await resp.json();
  if (!json?.access_token) throw new Error("Graph token missing access_token");
  return json.access_token;
}

async function appendRowToExcel({ accessToken, values }) {
  const driveId = process.env.EXCEL_DRIVE_ID;
  const itemId = process.env.EXCEL_ITEM_ID;
  const tableName = process.env.EXCEL_TABLE_NAME;

  if (!driveId || !itemId || !tableName) return false;

  const url = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(
    driveId
  )}/items/${encodeURIComponent(
    itemId
  )}/workbook/tables/${encodeURIComponent(tableName)}/rows/add`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ values: [values] })
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Excel append failed (${resp.status}): ${text}`);
  }

  return true;
}

app.post("/api/waitlist", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim();
    const source = String(req.body?.source || "landing").trim();

    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: "invalid_email" });
    }

    const userAgent = String(req.get("user-agent") || "");
    const ip = req.ip;

    const row = [new Date().toISOString(), email, source, ip, userAgent];

    try {
      const token = await getGraphToken();
      if (token) {
        const wroteToExcel = await appendRowToExcel({
          accessToken: token,
          values: row
        });
        if (wroteToExcel) return res.json({ ok: true, stored: "excel" });
      }
    } catch (e) {
      await storeLocalSignup({ email, userAgent, ip });
      return res.json({ ok: true, stored: "local", note: "excel_failed" });
    }

    await storeLocalSignup({ email, userAgent, ip });
    return res.json({ ok: true, stored: "local" });
  } catch (_e) {
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`OOTD landing listening on http://localhost:${PORT}`);
});

