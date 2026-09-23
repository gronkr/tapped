import { getSeason, getAgg } from "../lib/data.mjs";
import { poolView, seasonView, catalog } from "../lib/view.mjs";
import { json } from "../lib/http.mjs";

export default async () => {
  const s = await getSeason();
  const [agg, pool] = s ? await Promise.all([getAgg(s.id), poolView(s)]) : [{ total: 0, players: 0, top: [] }, { assets: [], totalUsd: 0 }];
  return json({
    season: seasonView(s), pool, totalPoints: agg.total, players: agg.players, top: agg.top, aggAt: agg.at,
    upgrades: catalog(), tokenMint: process.env.TAPPED_MINT || null, serverTime: Date.now(),
  }, 200, { "netlify-cdn-cache-control": "public, durable, s-maxage=30, stale-while-revalidate=120" });
};
export const config = { path: "/api/season" };
