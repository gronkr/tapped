import { createHmac, timingSafeEqual } from "node:crypto";

const secret = () => process.env.SESSION_SECRET || "";
const mac = (body) => createHmac("sha256", secret()).update(body).digest("base64url");

export function issue(wallet, days = 7) {
  if (!secret()) throw new Error("SESSION_SECRET is not set.");
  const body = `${wallet}.${Date.now() + days * 864e5}`;
  return `${body}.${mac(body)}`;
}

// Returns the wallet for a valid "Authorization: Bearer <token>", else null.
export function walletFrom(req) {
  if (!secret()) return null;
  const t = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [w, exp, m] = t.split(".");
  if (!w || !exp || !m) return null;
  const good = mac(`${w}.${exp}`);
  if (good.length !== m.length || !timingSafeEqual(Buffer.from(good), Buffer.from(m))) return null;
  if (Date.now() > Number(exp)) return null;
  return w;
}
