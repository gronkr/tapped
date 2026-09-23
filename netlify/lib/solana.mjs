import bs58 from "bs58";
import nacl from "tweetnacl";
import { getStore } from "@netlify/blobs";

const RPC = () => process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export async function rpc(method, params) {
  const r = await fetch(RPC(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`RPC ${method}: ${j.error.message}`);
  return j.result;
}

export function isAddress(s) {
  try { return typeof s === "string" && bs58.decode(s).length === 32; } catch { return false; }
}
export function isTxSig(s) {
  try { return typeof s === "string" && bs58.decode(s).length === 64; } catch { return false; }
}

export function signInMessage(wallet, issued) {
  return `Tapped: sign in\nWallet: ${wallet}\nIssued: ${issued}`;
}
export function verifySignIn({ wallet, issued, signature }) {
  const t = Date.parse(issued);
  if (!Number.isFinite(t) || Math.abs(Date.now() - t) > 15 * 60e3) return "Signature expired. Sign again.";
  let sig;
  try { sig = Uint8Array.from(Buffer.from(String(signature), "base64")); } catch { return "Signature is malformed."; }
  if (sig.length !== 64) return "Signature is malformed.";
  const msg = new TextEncoder().encode(signInMessage(wallet, issued));
  if (!nacl.sign.detached.verify(msg, sig, bs58.decode(wallet))) return "Signature does not match this wallet.";
  return null;
}

// Mint facts (decimals + which token program owns it). Cached; never changes.
export async function mintInfo(mint) {
  const store = getStore("mints");
  const hit = await store.get(mint, { type: "json" }).catch(() => null);
  if (hit) return hit;
  const acc = await rpc("getAccountInfo", [mint, { encoding: "jsonParsed" }]);
  if (!acc?.value) throw new Error("Mint not found");
  const info = { decimals: acc.value.data.parsed.info.decimals, program: acc.value.owner };
  await store.setJSON(mint, info).catch(() => {});
  return info;
}

// Verify that `wallet` burned at least `minRaw` (BigInt) of `mint` in tx `txSig`.
export async function verifyBurn(txSig, wallet, mint, minRaw) {
  const tx = await rpc("getTransaction", [txSig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }]);
  if (!tx) return { pending: true };
  if (tx.meta?.err) return { error: "The burn transaction failed on-chain." };
  if (tx.blockTime && Date.now() / 1000 - tx.blockTime > 3 * 3600) return { error: "This burn is older than 3 hours." };
  const ixs = [
    ...tx.transaction.message.instructions,
    ...(tx.meta?.innerInstructions || []).flatMap((i) => i.instructions),
  ];
  let burned = 0n;
  for (const ix of ixs) {
    if (!["spl-token", "spl-token-2022"].includes(ix.program)) continue;
    const t = ix.parsed?.type, i = ix.parsed?.info;
    if (!i || (t !== "burn" && t !== "burnChecked")) continue;
    if (i.mint !== mint) continue;
    if ((i.authority || i.multisigAuthority) !== wallet) continue;
    burned += BigInt(i.tokenAmount?.amount ?? i.amount ?? 0);
  }
  if (burned < minRaw) return { error: "The burn was smaller than the upgrade price." };
  return { ok: true, burned };
}
