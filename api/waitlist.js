const isValidEmail = (value) => {
  const email = String(value || "").trim().toLowerCase();
  return email.includes("@") && email.includes(".");
};

const upstashRequest = async (command, ...args) => {
  const baseUrl = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!baseUrl || !token) {
    throw new Error("missing_kv_env");
  }

  const response = await fetch(`${baseUrl}/${command}/${args.map(encodeURIComponent).join("/")}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`kv_http_${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`kv_error_${payload.error}`);
  }

  return payload.result;
};

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  const source = String(req.body?.source || "landing").trim();
  const userAgent = String(req.headers["user-agent"] || "");
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "");

  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: "invalid_email" });
  }

  const timestamp = new Date().toISOString();
  const entry = {
    ts: timestamp,
    email,
    source,
    userAgent,
    ip,
  };

  try {
    const emailKey = `waitlist:email:${email}`;
    const isNew = await upstashRequest("SETNX", emailKey, JSON.stringify(entry));

    if (isNew === 1) {
      await upstashRequest("RPUSH", "waitlist:entries", JSON.stringify(entry));
    }

    return res.status(201).json({
      ok: true,
      alreadyJoined: isNew === 0,
    });
  } catch (error) {
    console.error("Failed to persist signup in KV:", error);
    return res.status(500).json({ ok: false, error: "persist_failed" });
  }
};
