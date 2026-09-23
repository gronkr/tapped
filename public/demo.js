// Demo mode (?demo=1): runs the full UI on sample data with no backend or wallet.
(() => {
  if (!new URLSearchParams(location.search).has("demo")) return;
  const now = Date.now();
  const UP = {
    tap: { name: "Tap power", unit: "points per tap", levels: [1, 2, 3, 5, 8, 12, 18, 25, 35, 50], cost: [0, 1000, 2500, 6000, 15000, 35000, 80000, 180000, 400000, 900000] },
    cap: { name: "Energy tank", unit: "max energy", levels: [500, 750, 1000, 1500, 2000, 3000, 4000, 5000], cost: [0, 800, 2000, 5000, 12000, 30000, 70000, 150000] },
    regen: { name: "Recharge", unit: "energy per second", levels: [1, 1.5, 2, 3, 4, 6], cost: [0, 1500, 4000, 10000, 25000, 60000] },
    auto: { name: "Auto-miner", unit: "points per hour, even offline", levels: [0, 300, 800, 2000, 5000, 12000, 30000], cost: [0, 3000, 8000, 20000, 50000, 120000, 300000] },
  };
  const ME = "DemoWa11et111111111111111111111111111111Demo";
  const S = { points: 0, energy: 500, at: now, lvl: { tap: 0, cap: 0, regen: 0, auto: 0 } };
  const stats = () => ({ tapPower: UP.tap.levels[S.lvl.tap], cap: UP.cap.levels[S.lvl.cap], regen: UP.regen.levels[S.lvl.regen], autoPerHour: UP.auto.levels[S.lvl.auto] });
  const others = [182400, 98000, 51002, 33300, 21000, 12500, 8000];
  const settle = () => { const s = stats(); S.energy = Math.min(s.cap, S.energy + (Date.now() - S.at) / 1000 * s.regen); S.at = Date.now(); };
  const player = () => {
    const total = S.points + 1850000;
    return { wallet: ME, points: S.points, refPoints: 0, refCount: 0, total: S.points, energy: Math.floor(S.energy), lvl: { ...S.lvl }, stats: stats(),
      share: S.points / total, rank: null, payout: null, serverTime: Date.now() };
  };
  const top = () => [...others.map((p, i) => ({ wallet: `Play${i}er1111111111111111111111111111111${i}xyz`, points: p })), { wallet: ME, points: S.points }].sort((a, b) => b.points - a.points);
  localStorage.setItem("tp_token", "demo"); localStorage.setItem("tp_wallet", ME);
  const reply = (d, status = 200) => Promise.resolve(new Response(JSON.stringify(d), { status, headers: { "content-type": "application/json" } }));
  const realFetch = window.fetch.bind(window);
  window.fetch = (url, opts = {}) => {
    const u = String(url);
    if (u.includes("/api/season")) return reply({ season: { id: "demo", name: "Demo season", startsAt: now - 864e5, endsAt: now + 3 * 864e5, minPoints: 0 },
      pool: { assets: [{ ticker: "NVDAx", amount: 5, priceUsd: 180, usd: 900 }, { ticker: "TSLAx", amount: 3, priceUsd: 250, usd: 750 }, { ticker: "AAPLx", amount: 2, priceUsd: 225, usd: 450 }], totalUsd: 2100 },
      totalPoints: 1850000 + S.points, players: 412, top: top(), aggAt: Date.now(), upgrades: UP, tokenMint: "demo", serverTime: Date.now() });
    if (u.includes("/api/state")) { settle(); return reply({ player: player() }); }
    if (u.includes("/api/sync")) {
      settle(); const taps = Math.min(JSON.parse(opts.body || "{}").taps || 0, Math.floor(S.energy));
      S.energy -= taps; S.points += taps * stats().tapPower; return reply({ accepted: taps, player: player() });
    }
    if (u.includes("/api/tokenacct")) return reply({ error: "Demo mode: upgrades are simulated. Tap Buy again to see it level up." }, 409);
    return realFetch(url, opts);
  };
  // In demo, buying an upgrade just levels it up (no burn).
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-up]");
    if (!b) return;
    e.stopImmediatePropagation(); e.preventDefault();
    settle(); S.lvl[b.dataset.up] = Number(b.dataset.lvl);
    window.fetch("/api/state").then((r) => r.json()).then((d) => window.__tpSetPlayer?.(d.player));
  }, true);
  window.__TP_DEMO = true;
  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.createElement("div");
    bar.textContent = "Demo mode: sample data, nothing is saved or paid.";
    bar.className = "demo-bar"; bar.style.cssText = "background:#2B1A0C;color:#FFE38A;text-align:center;font:800 13px Nunito,system-ui;padding:6px";
    document.body.prepend(bar);
  });
})();
