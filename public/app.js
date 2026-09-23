// Always run on https (wallets won't reliably connect on http).
if (location.protocol === "http:" && !/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) location.replace("https://" + location.host + location.pathname + location.search);
const FRAMED = (() => { try { return window.self !== window.top; } catch { return true; } })();
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Math.floor(n).toLocaleString("en-US");
const usd = (n) => (n >= 1000 ? "$" + (n / 1000).toFixed(1) + "K" : "$" + n.toFixed(2));
const short = (w) => `${w.slice(0, 4)}…${w.slice(-4)}`;
const OL = 'stroke="#2B1A0C" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"';
const ICONS = {
  tap: `<svg viewBox="0 0 80 80"><rect x="34" y="30" width="12" height="44" rx="5" fill="#B7793A" ${OL} transform="rotate(35 40 52)"/><rect x="14" y="10" width="46" height="28" rx="8" fill="#9AA6B2" ${OL} transform="rotate(35 37 24)"/><rect x="18" y="14" width="10" height="20" rx="3" fill="#C9D2DA" transform="rotate(35 37 24)"/></svg>`,
  cap: `<svg viewBox="0 0 80 80"><rect x="16" y="16" width="48" height="58" rx="10" fill="#3FC06A" ${OL}/><rect x="30" y="6" width="20" height="12" rx="4" fill="#9AA6B2" ${OL}/><rect x="24" y="44" width="32" height="22" rx="5" fill="#9BF0A8"/><path d="M42 26 L32 42 H44 L36 58" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  regen: `<svg viewBox="0 0 80 80"><path d="M46 4 L14 44 H36 L28 76 L66 30 H42 Z" fill="#FFD23F" ${OL}/><path d="M44 12 L24 40" stroke="#FFF2A8" stroke-width="5" stroke-linecap="round"/></svg>`,
  auto: `<svg viewBox="0 0 80 80"><line x1="40" y1="6" x2="40" y2="18" ${OL}/><circle cx="40" cy="7" r="5" fill="#F0554A" ${OL}/><rect x="12" y="18" width="56" height="44" rx="12" fill="#9AA6B2" ${OL}/><rect x="20" y="28" width="40" height="22" rx="8" fill="#1E3A52" ${OL}/><circle cx="31" cy="39" r="5" fill="#7CF0FF"/><circle cx="49" cy="39" r="5" fill="#7CF0FF"/><rect x="24" y="62" width="32" height="12" rx="4" fill="#7E8A96" ${OL}/></svg>`,
};

// ---------- state ----------
const G = {
  token: localStorage.getItem("tp_token"), wallet: localStorage.getItem("tp_wallet"), provider: null,
  season: null, pool: { assets: [], totalUsd: 0 }, upgrades: {}, tokenMint: null, top: [], totalPoints: 0,
  me: null,          // last server view of the player
  base: null,        // { energy, at } for local energy regen
  pending: 0,        // taps not yet sent
  inflight: 0,       // taps in the request currently being sent
  syncing: false,
};
if (window.__TP_DEMO) { localStorage.removeItem("tp_token"); localStorage.removeItem("tp_wallet"); }
const ref = new URLSearchParams(location.search).get("ref");
if (ref && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(ref)) localStorage.setItem("tp_ref", ref);

const note = (msg, cls = "") => { const n = $("note"); n.className = "note " + cls; n.textContent = msg; };
let toastTimer;
function toast(msg, isErr = false) {
  let t = $("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "alert"); document.body.appendChild(t); }
  t.textContent = msg; t.className = "toast" + (isErr ? " err" : ""); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), isErr ? 7000 : 3500);
}

// ---------- api ----------
async function api(path, opts = {}) {
  const headers = { "content-type": "application/json", ...(G.token ? { authorization: `Bearer ${G.token}` } : {}) };
  const r = await fetch(path, { ...opts, headers });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && G.token) signOut("Session expired. Connect again.");
  return { status: r.status, ok: r.ok, data: d };
}

// ---------- season / public ----------
async function loadSeason() {
  const { ok, data } = await api("/api/season");
  if (!ok) return;
  G.season = data.season; G.pool = data.pool; G.upgrades = data.upgrades; G.tokenMint = data.tokenMint;
  G.top = data.top || []; G.totalPoints = data.totalPoints || 0;
  G.clockSkew = data.serverTime - Date.now();
  renderSeason(); renderPool(); renderBoard(data.aggAt); renderUpgrades();
}

function timeLeft(ms) {
  if (ms <= 0) return "ended";
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}
function renderSeason() {
  const s = G.season, now = Date.now() + (G.clockSkew || 0);
  if (!s) { $("seasonBox").innerHTML = `Season 1 is coming<small>Connect now to be ready</small>`; return; }
  const pre = now < s.startsAt, over = now >= s.endsAt;
  $("seasonBox").innerHTML = `${esc(s.name)} · ${usd(G.pool.totalUsd)} pool<small>${
    pre ? `Starts in ${timeLeft(s.startsAt - now)}` : over ? "Season ended" : `Ends in ${timeLeft(s.endsAt - now)}`}</small>`;
}
setInterval(renderSeason, 30e3);
setInterval(() => { if (!document.hidden) loadSeason(); }, 15e3);

function renderPool() {
  const a = G.pool.assets;
  $("pool").innerHTML = a.length
    ? a.map((x) => `<div class="row"><div class="icon"><svg viewBox="0 0 80 80"><rect x="8" y="14" width="64" height="52" rx="12" fill="#fff" ${OL}/><path d="M18 52 L32 38 L42 46 L60 26" fill="none" stroke="#3FC06A" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
        <div class="info"><div class="name">${esc(x.ticker)}</div><div class="desc">${x.amount} tokens${x.priceUsd ? ` · ${usd(x.priceUsd)} each` : ""}</div></div>
        <div class="name num">${x.usd ? usd(x.usd) : "–"}</div></div>`).join("")
      + `<div class="pool-total"><span>Total pool</span><span class="num">${usd(G.pool.totalUsd)}</span></div>`
    : `<div class="parch pad"><p>The pool is announced when the season starts.</p></div>`;
}

function renderBoard(at) {
  const me = G.wallet;
  $("board").innerHTML = G.top.length
    ? G.top.map((r, i) => `<li class="${r.wallet === me ? "me" : ""}"><span class="rk">#${i + 1}</span><span>${r.wallet === me ? "You" : short(r.wallet)}</span><span class="pts num"><span class="coin"></span>${fmt(r.points)}</span></li>`).join("")
    : `<li>No players yet. Be first.</li>`;
  $("boardAt").textContent = at ? `Updates every 15 seconds. Last update ${new Date(at).toLocaleTimeString()}.` : "";
}

// ---------- player ----------
function setPlayer(p) {
  G.me = p;
  G.base = { energy: p.energy, at: Date.now() };
  render();
  renderUpgrades();
  renderInvite();
}

function liveEnergy() {
  if (!G.me) return 0;
  const s = G.me.stats;
  const regen = ((Date.now() - G.base.at) / 1000) * s.regen;
  return Math.max(0, Math.min(s.cap, G.base.energy + regen) - G.pending - G.inflight);
}

function render() {
  const p = G.me;
  const live = G.season && Date.now() + (G.clockSkew || 0) >= G.season.startsAt && Date.now() + (G.clockSkew || 0) < G.season.endsAt;
  $("tapBtn").setAttribute("aria-disabled", !p || !live || liveEnergy() < 1 ? "true" : "false");
  if (!p) {
    $("points").textContent = "0"; $("share").textContent = "–"; $("shareUsd").textContent = "";
    $("energyTxt").textContent = "–"; $("energyBar").style.width = "0";
    $("rateTxt").textContent = "Connect your wallet to start smashing Dip the Bear"; return;
  }
  const extra = (G.pending + G.inflight) * p.stats.tapPower;
  const mine = p.total + extra;
  const serverTotal = p.share > 0 ? p.total / p.share : Math.max(G.totalPoints || 0, p.total);
  const total = Math.max(mine, serverTotal + extra);
  const share = total > 0 ? mine / total : 0;
  $("points").textContent = fmt(mine);
  $("share").textContent = share ? (share * 100).toFixed(share < 0.01 ? 4 : 2) + "%" : "–";
  $("shareUsd").textContent = share && G.pool.totalUsd ? `≈ ${usd(share * G.pool.totalUsd)} of stock` : "";
  const e = liveEnergy();
  $("energyTxt").textContent = `${fmt(e)} / ${fmt(p.stats.cap)}`;
  $("energyBar").style.width = `${(e / p.stats.cap) * 100}%`;
  $("rateTxt").textContent = `${p.stats.tapPower} damage per tap · ${p.stats.regen} energy/sec${p.stats.autoPerHour ? ` · ${fmt(p.stats.autoPerHour)} auto points/hr` : ""}`;
  if (p.payout) showPayout(p.payout);
}
setInterval(render, 500);

function showPayout(po) {
  if ($("payoutBox")) return;
  const d = document.createElement("div");
  d.id = "payoutBox"; d.className = "payout";
  d.innerHTML = `<b>You earned ${po.items.map((i) => `${i.amount} ${esc(i.ticker)}`).join(" + ")}</b><div class="muted small">That's ${(po.share * 100).toFixed(4)}% of the pool. Payouts are sent to this wallet after the season closes.</div>`;
  $("note").after(d);
}

// ---------- wallet ----------
function provider() { const p = window.phantom?.solana || window.solana; return p?.isPhantom ? p : null; }
async function waitForProvider(ms = 1500) {
  for (let t = 0; t < ms; t += 100) { const p = provider(); if (p) return p; await new Promise((r) => setTimeout(r, 100)); }
  return null;
}
let connecting = false;
function diag() {
  const p = provider();
  return [
    `host ${location.host}`, location.protocol.replace(":", ""), FRAMED ? "framed" : "top",
    window.phantom?.solana ? "phantom" : window.solana ? "solana-only" : "no-wallet",
    p && window.solana && window.solana !== window.phantom?.solana ? "multi-wallet" : "",
  ].filter(Boolean).join(" · ");
}

async function connect() {
  if (connecting) return;
  if (FRAMED) {
    // Wallets can't connect from inside a frame. Open the real page instead.
    toast("Opening Tapped in the full window…");
    const u = new URL(location.href); u.searchParams.set("connect", "1");
    try { window.top.location.href = u.href; } catch { window.open(u.href, "_blank", "noopener"); }
    return;
  }
  if ($("connectModal")) $("connectModal").hidden = true;
  const p = await waitForProvider();
  if (!p) {
    if (/Android|iPhone|iPad/i.test(navigator.userAgent)) {
      toast("Opening this page in the Phantom app…");
      location.href = `https://phantom.app/ul/browse/${encodeURIComponent(location.href)}?ref=${encodeURIComponent(location.origin)}`;
    } else {
      toast("Phantom isn't installed in this browser. Install it, then refresh this page.", true);
      window.open("https://phantom.app/download", "_blank", "noopener");
    }
    return;
  }
  connecting = true;
  $("connectBtn").disabled = true;
  try {
    toast("Approve the connection in Phantom…");
    const timeout = (ms, what) => new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error(what), { code: "timeout" })), ms));
    const r = await Promise.race([p.connect(), timeout(15000, "connect")]);
    G.provider = p;
    const wallet = r.publicKey.toString();
    if (G.token && G.wallet === wallet) { toast("Connected."); return refresh(); }
    toast("Sign the message in Phantom to log in. It's free and sends nothing.");
    const issued = new Date().toISOString();
    const msg = `Tapped: sign in\nWallet: ${wallet}\nIssued: ${issued}`;
    const { signature } = await Promise.race([p.signMessage(new TextEncoder().encode(msg), "utf8"), timeout(60000, "sign")]);
    const { ok, data } = await api("/api/auth", { method: "POST", body: JSON.stringify({
      wallet, issued, signature: btoa(String.fromCharCode(...signature)), ref: localStorage.getItem("tp_ref") }) });
    if (!ok) throw new Error(data.error || "Login failed. Try again.");
    G.token = data.token; G.wallet = wallet;
    localStorage.setItem("tp_token", G.token); localStorage.setItem("tp_wallet", wallet);
    toast("You're in. Start smashing Dip!");
    await refresh();
  } catch (e) {
    const code = e?.code;
    toast(code === 4001 ? "Cancelled in Phantom."
      : code === -32002 ? "Phantom already has a request open. Click the Phantom icon in your browser toolbar to finish or close it, then try again."
      : code === "timeout" ? `Phantom didn't respond. Click the Phantom icon in your toolbar and approve any waiting request, then try again. [${diag()}]`
      : e?.message || "Couldn't connect. Try again.", true);
  } finally {
    connecting = false;
    $("connectBtn").disabled = false;
  }
}

function signOut(msg) {
  G.token = null; G.wallet = null; G.me = null;
  localStorage.removeItem("tp_token"); localStorage.removeItem("tp_wallet");
  updateConnectBtn(); render(); if (msg) note(msg, "err");
}

function updateConnectBtn() {
  const b = $("connectBtn");
  b.textContent = G.wallet ? short(G.wallet) : "Connect";
  b.classList.toggle("primary", !G.wallet);
}
$("connectBtn").addEventListener("click", () => (window.__TP_DEMO ? note("Demo mode: wallet connect is off.") : G.wallet ? (confirm("Disconnect this wallet?") && signOut()) : connect()));

async function refresh() {
  updateConnectBtn();
  if (!G.token) return;
  const { ok, data } = await api("/api/state");
  if (ok && data.player) setPlayer(data.player);
  renderBoard();
}

// ---------- connect prompt ----------
function askToConnect() {
  if (!$("connectModal")) return connect();
  $("connectModal").hidden = false;
  const b = $("connectBtn"); b.classList.remove("pulse"); void b.offsetWidth; b.classList.add("pulse");
}
$("cmConnect")?.addEventListener("click", connect);
$("cmClose")?.addEventListener("click", () => ($("connectModal").hidden = true));
$("connectModal")?.addEventListener("click", (e) => { if (e.target.id === "connectModal") $("connectModal").hidden = true; });

// ---------- tapping ----------
const tapBtn = $("tapBtn");
function spawn(x, y, amount) {
  window.Bear?.hit(amount, x, y);
  const f = document.createElement("div");
  f.className = "float" + (Math.random() < 0.08 ? " crit" : ""); f.textContent = `+${amount}`;
  f.style.left = `${x}px`; f.style.top = `${y}px`;
  $("floats").appendChild(f); setTimeout(() => f.remove(), 800);
}
tapBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (!G.token && !window.__TP_DEMO) { askToConnect(); return; }
  if (!G.me) return;
  const now = Date.now() + (G.clockSkew || 0);
  if (!G.season || now < G.season.startsAt) { note("The season hasn't started yet."); return; }
  if (now >= G.season.endsAt) { note("This season has ended."); return; }
  if (liveEnergy() < 1) { note("Out of energy. It recharges on its own, or upgrade your tank."); return; }
  G.pending++;
  const rect = tapBtn.getBoundingClientRect();
  spawn(e.clientX - rect.left, e.clientY - rect.top - 20, G.me.stats.tapPower);
  if (navigator.vibrate) navigator.vibrate(8);
  render();
});
tapBtn.addEventListener("contextmenu", (e) => e.preventDefault());
tapBtn.addEventListener("keydown", (e) => {
  if (e.key !== " " && e.key !== "Enter") return;
  e.preventDefault();
  const r = tapBtn.getBoundingClientRect();
  tapBtn.dispatchEvent(new PointerEvent("pointerdown", { clientX: r.left + r.width / 2, clientY: r.top + r.height * 0.4 }));
});

async function sync(force = false) {
  if (!G.token || G.syncing || (!G.pending && !force)) return;
  G.syncing = true;
  G.inflight = G.pending; G.pending = 0;
  try {
    const { ok, data } = await api("/api/sync", { method: "POST", body: JSON.stringify({ taps: G.inflight }) });
    G.inflight = 0;
    if (ok) setPlayer(data.player);
    else if (data.error) note(data.error, "err");
  } catch {
    G.pending += G.inflight; G.inflight = 0; // retry next round
  } finally { G.syncing = false; }
}
setInterval(() => sync(false), 3000);
setInterval(() => sync(true), 20000);
document.addEventListener("visibilitychange", () => { if (document.hidden) sync(false); else { loadSeason(); refresh(); } });

// ---------- upgrades ----------
function renderUpgrades() {
  const lvl = G.me?.lvl || { tap: 0, cap: 0, regen: 0, auto: 0 };
  const entries = Object.entries(G.upgrades || {});
  if (!entries.length) { $("upgrades").innerHTML = ""; return; }
  $("upgrades").innerHTML = entries.map(([k, u]) => {
    const cur = lvl[k], next = cur + 1, maxed = next >= u.levels.length;
    const btn = maxed ? `<button class="bluebtn off" disabled>MAXED</button>`
      : !G.tokenMint ? `<button class="bluebtn off" disabled>SOON<span class="cost">🔒</span></button>`
      : `<button class="bluebtn" data-up="${k}" data-lvl="${next}">UPGRADE<span class="cost"><span class="coin"></span>${fmt(u.cost[next])}</span></button>`;
    return `<div class="row">${btn}<div class="info"><div class="name">${esc(u.name)}</div>
      <div class="desc">${u.levels[cur]} ${esc(u.unit)}${maxed ? "" : ` → <b>${u.levels[next]}</b>`}</div><span class="lvl">Level ${cur}</span></div>
      <div class="icon">${ICONS[k]}</div></div>`;
  }).join("") + `<p class="fine" style="color:#FCE3B5">Upgrade prices are in $TAPPED (the coin icon), and the tokens are burned. Upgrades reset every season.</p>`;
}

$("upgrades").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-up]");
  if (!b) return;
  if (!G.token) return askToConnect();
  const upgrade = b.dataset.up, level = Number(b.dataset.lvl), u = G.upgrades[upgrade];
  if (!confirm(`Burn ${fmt(u.cost[level])} $TAPPED for ${u.name} level ${level}? Burned tokens are gone for good.`)) return;
  b.disabled = true;
  try {
    if (!G.provider) { G.provider = provider(); await G.provider.connect(); }
    note("Preparing the burn…");
    const acct = await fetch(`/api/tokenacct?wallet=${G.wallet}`).then((r) => r.json());
    if (acct.error) throw new Error(acct.error);
    const raw = BigInt(u.cost[level]) * 10n ** BigInt(acct.decimals);
    if (!acct.account || BigInt(acct.balanceRaw) < raw) throw new Error(`You need ${fmt(u.cost[level])} $TAPPED in this wallet.`);
    const { Transaction, TransactionInstruction, PublicKey } = solanaWeb3;
    const data = new Uint8Array(10); const dv = new DataView(data.buffer);
    data[0] = 15; dv.setBigUint64(1, raw, true); data[9] = acct.decimals; // BurnChecked
    const owner = new PublicKey(G.wallet);
    const ix = new TransactionInstruction({ programId: new PublicKey(acct.program), data: Buffer.from(data), keys: [
      { pubkey: new PublicKey(acct.account), isSigner: false, isWritable: true },
      { pubkey: new PublicKey(acct.mint), isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ] });
    const tx = new Transaction({ feePayer: owner, recentBlockhash: acct.blockhash }).add(ix);
    note("Approve the burn in Phantom…");
    const { signature } = await G.provider.signAndSendTransaction(tx);
    note("Burn sent. Confirming…");
    for (let i = 0; i < 20; i++) {
      const r = await api("/api/upgrade", { method: "POST", body: JSON.stringify({ upgrade, level, txSig: signature }) });
      if (r.ok) { setPlayer(r.data.player); note(`${u.name} is now level ${level}.`, "ok"); return; }
      if (r.status !== 202) throw new Error(r.data.error || "Upgrade failed.");
      await new Promise((x) => setTimeout(x, 3000));
    }
    throw new Error("Still confirming. Refresh in a minute. Your burn is safe and will be applied.");
  } catch (err) {
    note(err?.code === 4001 ? "Cancelled in Phantom." : err.message, "err");
    b.disabled = false;
  }
});

// ---------- invite ----------
function renderInvite() {
  if (!G.wallet) return;
  const link = `https://tapped.fun/?ref=${G.wallet}`;
  $("refLink").value = link;
  $("shareRef").href = "https://x.com/intent/tweet?text=" + encodeURIComponent(`I'm smashing Dip the Bear to earn real stocks on @TappedApp 🐻📈\n\n${link}`);
  if (G.me) $("refStats").textContent = `${G.me.refCount} invited · ${fmt(G.me.refPoints)} points earned from invites`;
}
$("copyRef").addEventListener("click", async () => {
  if (!G.wallet) return askToConnect();
  await navigator.clipboard.writeText($("refLink").value); $("copyRef").textContent = "Copied";
});

window.__tpSetPlayer = setPlayer;

// ---------- tabs ----------
document.querySelectorAll(".tabs button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".tabs button").forEach((x) => x.setAttribute("aria-selected", x === b));
  document.querySelectorAll(".panel").forEach((p) => (p.hidden = p.dataset.panel !== b.dataset.tab));
}));

// ---------- boot ----------
(async () => {
  updateConnectBtn();
  await loadSeason();
  await refresh();
  const p = provider();
  if (p && G.wallet) { try { await p.connect({ onlyIfTrusted: true }); G.provider = p; } catch {} }
  // Arrived here from a framed page's Connect click: carry on connecting.
  const q = new URLSearchParams(location.search);
  if (q.get("connect") === "1" && !FRAMED) {
    q.delete("connect");
    history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : ""));
    if (!G.token) connect();
  }
})();
