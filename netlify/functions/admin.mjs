import { getSeason, aggregate, standings, store } from "../lib/data.mjs";
import { isAddress, mintInfo } from "../lib/solana.mjs";
import { poolView, seasonView } from "../lib/view.mjs";
import { json, fail } from "../lib/http.mjs";

function checkSeason(s) {
  if (!/^[a-z0-9-]{1,32}$/.test(s?.id || "")) throw new Error("Season id: lowercase letters, numbers and dashes only (e.g. s1).");
  if (!s.name) throw new Error("Season needs a name.");
  const startsAt = Date.parse(s.startsAt), endsAt = Date.parse(s.endsAt);
  if (!startsAt || !endsAt || endsAt <= startsAt) throw new Error("Check the start and end dates.");
  if (!Array.isArray(s.pool) || !s.pool.length) throw new Error("Add at least one stock to the pool.");
  const pool = s.pool.map((a) => {
    if (!a.ticker || !isAddress(a.mint) || !(Number(a.amount) > 0)) throw new Error(`Pool row invalid: ${a.ticker || a.mint}`);
    return { ticker: String(a.ticker).slice(0, 12), mint: a.mint, amount: Number(a.amount) };
  });
  return { id: s.id, name: String(s.name).slice(0, 40), startsAt, endsAt, pool, minPoints: Math.max(0, Number(s.minPoints) || 0) };
}

export default async (req) => {
  const key = process.env.ADMIN_KEY;
  if (!key || req.headers.get("x-admin-key") !== key) return fail(401, "Wrong admin key.");
  const meta = store("meta");

  if (req.method === "GET") {
    const s = await getSeason();
    return json({ season: s ? { ...seasonView(s), pool: s.pool } : null, pool: await poolView(s), agg: s ? await aggregate(s.id) : null }, 200, { "cache-control": "no-store" });
  }

  const b = await req.json().catch(() => ({}));
  if (b.action === "set-season") {
    let s;
    try { s = checkSeason(b.season); } catch (e) { return fail(400, e.message); }
    await meta.setJSON("season", s);
    return json({ ok: true, season: s });
  }

  if (b.action === "payouts") {
    const s = await getSeason();
    if (!s) return fail(409, "No season.");
    if (Date.now() < s.endsAt) return fail(409, "The season hasn't ended yet.");
    const rows = (await standings(s.id)).filter((r) => r.points >= (s.minPoints || 0) && r.points > 0);
    const total = rows.reduce((a, r) => a + r.points, 0);
    const decs = {};
    for (const a of s.pool) decs[a.mint] = (await mintInfo(a.mint)).decimals;
    const byWallet = {}, csv = ["wallet,ticker,mint,amount,share_percent"];
    for (const r of rows) {
      const share = r.points / total;
      const items = [];
      for (const a of s.pool) {
        const f = 10 ** decs[a.mint];
        const amt = Math.floor(a.amount * share * f) / f;
        if (amt > 0) { items.push({ ticker: a.ticker, mint: a.mint, amount: amt }); csv.push(`${r.wallet},${a.ticker},${a.mint},${amt},${(share * 100).toFixed(6)}`); }
      }
      if (items.length) byWallet[r.wallet] = { share, points: r.points, items };
    }
    await meta.setJSON(`payouts-${s.id}`, { season: s.id, total, byWallet, at: Date.now() });
    return json({ ok: true, winners: Object.keys(byWallet).length, csv: csv.join("\n") });
  }
  return fail(400, "Unknown action.");
};
export const config = { path: "/api/admin" };
