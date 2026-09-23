// Storage layout (Netlify Blobs):
//   meta/season                        current season config
//   meta/agg-<season>                  totals + leaderboard (rebuilt every 5 min)
//   players/<season>/<wallet>          progress (written only by sync/auth)
//   upgrades/<season>/<wallet>         levels (written only by upgrade)
//   burns/<season>/<wallet>/<upg>-<lvl>-<txSig>   one key per burn (source of truth)
//   refs/<season>/<referrer>/<invitee> invitee's points (written only by the invitee's sync)
import { getStore } from "@netlify/blobs";
import { ZERO_LVL, UPGRADES } from "./game.mjs";

export const store = (name) => getStore(name);

export async function getSeason() {
  return (await store("meta").get("season", { type: "json" }).catch(() => null)) || null;
}
export const seasonLive = (s, now = Date.now()) => !!s && now >= s.startsAt && now < s.endsAt;

export async function getLevels(seasonId, wallet) {
  return { ...ZERO_LVL, ...((await store("upgrades").get(`${seasonId}/${wallet}`, { type: "json" }).catch(() => null)) || {}) };
}

// Recompute levels from burn records (race-safe: each burn is its own key).
export async function rebuildLevels(seasonId, wallet) {
  const { blobs } = await store("burns").list({ prefix: `${seasonId}/${wallet}/` });
  const lvl = { ...ZERO_LVL };
  for (const { key } of blobs) {
    const m = /\/(tap|cap|regen|auto)-(\d+)-/.exec(key);
    if (m) lvl[m[1]] = Math.min(Math.max(lvl[m[1]], Number(m[2])), UPGRADES[m[1]].levels.length - 1);
  }
  await store("upgrades").setJSON(`${seasonId}/${wallet}`, lvl);
  return lvl;
}

export async function refPoints(seasonId, wallet) {
  const s = store("refs");
  const { blobs } = await s.list({ prefix: `${seasonId}/${wallet}/` });
  const vals = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" }).catch(() => null)));
  return { count: blobs.length, points: vals.reduce((a, v) => a + (v?.points || 0), 0) };
}

async function inBatches(items, n, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += n) out.push(...(await Promise.all(items.slice(i, i + n).map(fn))));
  return out;
}

// Full standings for a season: every player's total = own points + referral points.
export async function standings(seasonId) {
  const ps = store("players"), rs = store("refs");
  const { blobs: pk } = await ps.list({ prefix: `${seasonId}/` });
  const players = (await inBatches(pk, 40, (b) => ps.get(b.key, { type: "json" }).catch(() => null))).filter(Boolean);
  const { blobs: rk } = await rs.list({ prefix: `${seasonId}/` });
  const refVals = await inBatches(rk, 40, async (b) => [b.key.split("/")[1], (await rs.get(b.key, { type: "json" }).catch(() => null))?.points || 0]);
  const ref = {};
  for (const [w, v] of refVals) ref[w] = (ref[w] || 0) + v;
  const rows = players.map((p) => ({ wallet: p.wallet, points: Math.floor(p.points + (ref[p.wallet] || 0)) }));
  rows.sort((a, b) => b.points - a.points);
  return rows;
}

export async function aggregate(seasonId) {
  const rows = await standings(seasonId);
  const agg = { season: seasonId, total: rows.reduce((a, r) => a + r.points, 0), players: rows.length, top: rows.slice(0, 100), at: Date.now() };
  await store("meta").setJSON(`agg-${seasonId}`, agg);
  return agg;
}
export async function getAgg(seasonId) {
  return (await store("meta").get(`agg-${seasonId}`, { type: "json" }).catch(() => null)) || { total: 0, players: 0, top: [], at: 0 };
}
