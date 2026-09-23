import { walletFrom } from "../lib/session.mjs";
import { getSeason, getLevels, store } from "../lib/data.mjs";
import { newPlayer, settle } from "../lib/game.mjs";
import { playerView } from "../lib/view.mjs";
import { json, fail } from "../lib/http.mjs";

export default async (req) => {
  const wallet = walletFrom(req);
  if (!wallet) return fail(401, "Sign in again.");
  const season = await getSeason();
  if (!season) return json({ player: null }, 200, { "cache-control": "no-store" });
  const key = `${season.id}/${wallet}`;
  const ps = store("players");
  const p = (await ps.get(key, { type: "json" })) || newPlayer(wallet, season.id, null);
  const lvl = await getLevels(season.id, wallet);
  settle(p, lvl, Math.min(Date.now(), season.endsAt));
  return json({ player: await playerView(season, p, lvl) }, 200, { "cache-control": "no-store" });
};
export const config = { path: "/api/state" };
