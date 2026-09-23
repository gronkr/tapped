import { isAddress, verifySignIn } from "../lib/solana.mjs";
import { issue } from "../lib/session.mjs";
import { getSeason, store } from "../lib/data.mjs";
import { newPlayer } from "../lib/game.mjs";
import { json, fail } from "../lib/http.mjs";

export default async (req) => {
  if (req.method !== "POST") return fail(405, "POST only");
  let b;
  try { b = await req.json(); } catch { return fail(400, "Invalid request body."); }
  const { wallet, issued, signature, ref } = b;
  if (!isAddress(wallet)) return fail(400, "Invalid wallet.");
  const err = verifySignIn({ wallet, issued, signature });
  if (err) return fail(401, err);
  let token;
  try { token = issue(wallet); } catch (e) { return fail(500, e.message); }

  const season = await getSeason();
  if (season) {
    const key = `${season.id}/${wallet}`;
    const ps = store("players");
    if (!(await ps.get(key))) await ps.setJSON(key, newPlayer(wallet, season.id, isAddress(ref) ? ref : null));
  }
  return json({ token, wallet }, 200, { "cache-control": "no-store" });
};
export const config = { path: "/api/auth" };
