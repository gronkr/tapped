import { walletFrom } from "../lib/session.mjs";
import { getSeason, seasonLive, getLevels, store } from "../lib/data.mjs";
import { newPlayer, applyTaps, settle, REF_SHARE } from "../lib/game.mjs";
import { playerView } from "../lib/view.mjs";
import { json, fail } from "../lib/http.mjs";

export default async (req) => {
  if (req.method !== "POST") return fail(405, "POST only");
  const wallet = walletFrom(req);
  if (!wallet) return fail(401, "Sign in again.");
  const season = await getSeason();
  if (!season) return fail(409, "No season is running yet.");
  let b = {};
  try { b = await req.json(); } catch {}
  const taps = Math.max(0, Math.min(5000, Number(b.taps) || 0));

  const key = `${season.id}/${wallet}`;
  const ps = store("players");
  const [saved, lvl] = await Promise.all([ps.get(key, { type: "json" }), getLevels(season.id, wallet)]);
  const p = saved || newPlayer(wallet, season.id, null);
  const now = Date.now();
  let accepted = 0;
  if (seasonLive(season, now)) accepted = applyTaps(p, lvl, taps, now);
  else settle(p, lvl, Math.min(now, season.endsAt));
  await ps.setJSON(key, p);
  if (p.ref) await store("refs").setJSON(`${season.id}/${p.ref}/${wallet}`, { points: Math.floor(p.points * REF_SHARE) }).catch(() => {});
  return json({ accepted, player: await playerView(season, p, lvl) }, 200, { "cache-control": "no-store" });
};
export const config = { path: "/api/sync" };
