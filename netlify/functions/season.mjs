import { getSeason, getAgg, aggregate } from "../lib/data.mjs";
import { poolView, seasonView, catalog } from "../lib/view.mjs";
import { json } from "../lib/http.mjs";

export default async () => {
  const s = await getSeason();
  let [agg, pool] = s ? await Promise.all([getAgg(s.id), poolView(s)]) : [{ total: 0, players: 0, top: [] }, { assets: [], totalUsd: 0 }];
  // Keep the leaderboard fresh: rebuild if it's more than 15s old (CDN caching limits this to ~4/min).
  if (s && Date.now() - (agg.at || 0) > 15e3) agg = await aggregate(s.id).catch(() => agg);
  return json({
    season: seasonView(s), pool, totalPoints: agg.total, players: agg.players, top: agg.top, aggAt: agg.at,
    upgrades: catalog(), tokenMint: process.env.TAPPED_MINT || null, serverTime: Date.now(),
  }, 200, { "netlify-cdn-cache-control": "public, durable, s-maxage=15, stale-while-revalidate=30" });
};
export const config = { path: "/api/season" };
