import { createHash } from "node:crypto";
import { getStore } from "@netlify/blobs";
// Market data: GeckoTerminal (keyless) or CoinGecko onchain (when CG_API_KEY is set).
export function upstream() {
  const key = process.env.CG_API_KEY;
  if (!key) return { base: "https://api.geckoterminal.com/api/v2", headers: { accept: "application/json;version=20230302" } };
  const pro = process.env.CG_KEY_TYPE === "pro";
  return {
    base: pro ? "https://pro-api.coingecko.com/api/v3/onchain" : "https://api.coingecko.com/api/v3/onchain",
    headers: { accept: "application/json", [pro ? "x-cg-pro-api-key" : "x-cg-demo-api-key"]: key },
  };
}

export async function gtGet(path, params = {}) {
  const { base, headers } = upstream();
  const u = new URL(`${base}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return fetch(u, { headers });
}

// Upstream call with a durable fallback: every good response is saved to Blobs,
// and when the provider rate-limits (429) or errors we serve the last good copy.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function cachedGet(path, params = {}) {
  const keyText = path + "?" + Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join("&");
  const key = createHash("sha256").update(keyText).digest("hex");
  const store = getStore("gtcache");
  let r;
  for (let i = 0; i < 2; i++) {
    try { r = await gtGet(path, params); } catch { r = null; }
    if (r && r.status !== 429) break;
    if (i === 0) await sleep(900);
  }
  if (r && r.ok) {
    const body = await r.text();
    try { await store.set(key, body, { metadata: { at: Date.now() } }); } catch {}
    return { status: 200, body, stale: false };
  }
  if (r && r.status === 404) return { status: 404, body: await r.text(), stale: false };
  const old = await store.getWithMetadata(key).catch(() => null);
  if (old) return { status: 200, body: old.data, stale: true, age: Date.now() - (old.metadata?.at || 0) };
  return { status: r ? r.status : 502, body: JSON.stringify({ error: "upstream unavailable" }), stale: false };
}

// USD prices for a list of mints (<= 30), using the cached market-data call.
export async function pricesOf(mints) {
  if (!mints.length) return {};
  const r = await cachedGet(`simple/networks/solana/token_price/${mints.join(",")}`);
  if (r.status !== 200) return {};
  try {
    const p = JSON.parse(r.body)?.data?.attributes?.token_prices || {};
    return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Number(v) || 0]));
  } catch { return {}; }
}
