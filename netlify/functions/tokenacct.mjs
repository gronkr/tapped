// The wallet's $TAPPED token account + program, so the browser can build a burn.
import { rpc, isAddress, mintInfo } from "../lib/solana.mjs";
import { json, fail } from "../lib/http.mjs";

export default async (req) => {
  const wallet = new URL(req.url).searchParams.get("wallet");
  const mint = process.env.TAPPED_MINT;
  if (!mint) return fail(409, "$TAPPED isn't live yet.");
  if (!isAddress(wallet)) return fail(400, "Invalid wallet.");
  try {
    const [{ decimals, program }, accs, bh] = await Promise.all([
      mintInfo(mint),
      rpc("getTokenAccountsByOwner", [wallet, { mint }, { encoding: "jsonParsed" }]),
      rpc("getLatestBlockhash", [{ commitment: "finalized" }]),
    ]);
    const best = accs.value
      .map((a) => ({ account: a.pubkey, raw: a.account.data.parsed.info.tokenAmount.amount }))
      .sort((x, y) => (BigInt(y.raw) > BigInt(x.raw) ? 1 : -1))[0];
    return json({ mint, decimals, program, account: best?.account || null, balanceRaw: best?.raw || "0", blockhash: bh.value.blockhash },
      200, { "cache-control": "no-store" });
  } catch {
    return fail(502, "Could not reach Solana. Try again.");
  }
};
export const config = { path: "/api/tokenacct" };
