const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs/promises');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 8787);
const projectRoot = path.resolve(__dirname, '..');
const dataDir = path.join(projectRoot, 'data');
const waitlistFile = path.join(dataDir, 'waitlist.jsonl');

app.use(express.json());
app.use(express.static(projectRoot));

app.post('/api/waitlist', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const source = String(req.body?.source || 'unknown').trim();
  const userAgent = String(req.get('user-agent') || '');
  const ip = String(req.ip || req.socket?.remoteAddress || '');

  if (!email || !email.includes('@')) {
    return res.status(400).json({ ok: false, error: 'invalid_email' });
  }

  const entry = {
    ts: new Date().toISOString(),
    email,
    source,
    userAgent,
    ip,
  };

  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.appendFile(waitlistFile, `${JSON.stringify(entry)}\n`, 'utf8');
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error('Failed to persist signup:', error);
    return res.status(500).json({ ok: false, error: 'persist_failed' });
  }
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(projectRoot, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`OOTD server running on http://localhost:${PORT}`);
});
