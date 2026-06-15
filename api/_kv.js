// api/_kv.js
// Tiny helper for talking to Upstash Redis via its REST API, using the
// environment variable names Vercel created for this project's database
// integration (KV_REDIS_URL_KV_REST_API_URL / KV_REDIS_URL_KV_REST_API_TOKEN).

const KV_URL = process.env.KV_REDIS_URL_KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REDIS_URL_KV_REST_API_TOKEN;

function isConfigured() {
  return Boolean(KV_URL && KV_TOKEN);
}

// Try to JSON.parse a value; if the result is still a string that looks
// like JSON, parse again (handles values that were accidentally
// double-encoded). Returns the original string if it's not JSON at all.
function parseMaybeDouble(raw) {
  let value = raw;
  for (let i = 0; i < 2; i++) {
    if (typeof value !== 'string') break;
    try {
      value = JSON.parse(value);
    } catch (e) {
      break;
    }
  }
  return value;
}

async function kvGet(key) {
  if (!isConfigured()) {
    throw new Error('KV environment variables are not set.');
  }

  const res = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });

  if (!res.ok) {
    throw new Error(`KV get failed with status ${res.status}`);
  }

  const data = await res.json();
  if (data.result == null) return null;

  return parseMaybeDouble(data.result);
}

async function kvSet(key, value) {
  if (!isConfigured()) {
    throw new Error('KV environment variables are not set.');
  }

  const res = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(JSON.stringify(value)),
  });

  if (!res.ok) {
    throw new Error(`KV set failed with status ${res.status}`);
  }

  return true;
}

async function kvDel(key) {
  if (!isConfigured()) {
    throw new Error('KV environment variables are not set.');
  }

  const res = await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });

  if (!res.ok) {
    throw new Error(`KV del failed with status ${res.status}`);
  }

  return true;
}

module.exports = { kvGet, kvSet, kvDel, isConfigured };
