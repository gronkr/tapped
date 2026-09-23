import { pricesOf } from "./gt.mjs";
import { UPGRADES, stats } from "./game.mjs";
import { getAgg, refPoints, store } from "./data.mjs";

export async function poolView(season) {
  if (!season) return { assets: [], totalUsd: 0 };
  const prices = await pricesOf(season.pool.map((a) => a.mint)).catch(() => ({}));
  const assets = season.pool.map((a) => ({ ...a, priceUsd: prices[a.mint] || 0, usd: (prices[a.mint] || 0) * a.amount }));
  return { assets, totalUsd: assets.reduce((s, a) => s + a.usd, 0) };
}

export function seasonView(s) {
  return s ? { id: s.id, name: s.name, startsAt: s.startsAt, endsAt: s.endsAt, minPoints: s.minPoints || 0 } : null;
}

export const catalog = () => Object.fromEntries(Object.entries(UPGRADES).map(([k, u]) => [k, { name: u.name, unit: u.unit, levels: u.levels, cost: u.cost }]));

export async function playerView(season, p, lvl) {
  const [agg, refs, payouts] = await Promise.all([
    getAgg(season.id),
    refPoints(season.id, p.wallet),
    store("meta").get(`payouts-${season.id}`, { type: "json" }).catch(() => null),
  ]);
  const mine = Math.floor(p.points + refs.points);
  const inAgg = agg.top.find((r) => r.wallet === p.wallet)?.points || 0;
  const total = Math.max(mine, agg.total - inAgg + mine);
  const rank = agg.top.findIndex((r) => r.wallet === p.wallet);
  return {
    wallet: p.wallet, points: Math.floor(p.points), refPoints: refs.points, refCount: refs.count, total: mine,
    energy: Math.floor(p.energy), lvl, stats: stats(lvl),
    share: total > 0 ? mine / total : 0, rank: rank >= 0 ? rank + 1 : null,
    payout: payouts?.byWallet?.[p.wallet] || null,
    serverTime: Date.now(),
  };
}
