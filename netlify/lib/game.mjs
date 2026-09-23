// ---------- Game balance: edit these numbers to tune the economy ----------
// `levels` = the stat at each level; `cost` = whole $TAPPED burned to reach that level.
export const UPGRADES = {
  tap:   { name: "Tap power",   unit: "points per tap",     levels: [1, 2, 3, 5, 8, 12, 18, 25, 35, 50],
           cost: [0, 8000, 20000, 48000, 120000, 280000, 640000, 1440000, 3200000, 7200000] },
  cap:   { name: "Energy tank", unit: "max energy",         levels: [500, 750, 1000, 1500, 2000, 3000, 4000, 5000],
           cost: [0, 6400, 16000, 40000, 96000, 240000, 560000, 1200000] },
  regen: { name: "Recharge",    unit: "energy per second",  levels: [1, 1.5, 2, 3, 4, 6],
           cost: [0, 12000, 32000, 80000, 200000, 480000] },
  auto:  { name: "Auto-miner",  unit: "points per hour, even offline", levels: [0, 300, 800, 2000, 5000, 12000, 30000],
           cost: [0, 24000, 64000, 160000, 400000, 960000, 2400000] },
};
export const AUTO_CAP_HOURS = 8;   // offline auto-mining stops accruing after this long
export const REF_SHARE = 0.1;      // referrers earn 10% of their invites' points
export const MAX_TAPS_PER_SEC = 15; // humanly possible ceiling, enforced server-side
// ---------------------------------------------------------------------------

export const ZERO_LVL = { tap: 0, cap: 0, regen: 0, auto: 0 };

export function stats(lvl) {
  return {
    tapPower: UPGRADES.tap.levels[lvl.tap],
    cap: UPGRADES.cap.levels[lvl.cap],
    regen: UPGRADES.regen.levels[lvl.regen],
    autoPerHour: UPGRADES.auto.levels[lvl.auto],
  };
}

export function newPlayer(wallet, seasonId, ref, now = Date.now()) {
  return {
    wallet, season: seasonId, points: 0, taps: 0,
    energy: UPGRADES.cap.levels[0], energyAt: now, autoAt: now, lastSync: now,
    ref: ref && ref !== wallet ? ref : null, createdAt: now,
  };
}

// Bring energy and auto-mining up to `now`. Returns auto points gained.
export function settle(p, lvl, now = Date.now()) {
  const s = stats(lvl);
  p.energy = Math.min(s.cap, p.energy + ((now - p.energyAt) / 1000) * s.regen);
  p.energyAt = now;
  const hours = Math.min(AUTO_CAP_HOURS, Math.max(0, (now - p.autoAt) / 3600e3));
  const auto = Math.floor(hours * s.autoPerHour);
  p.points += auto;
  p.autoAt = now;
  return auto;
}

// Apply a batch of taps. Returns taps actually accepted.
export function applyTaps(p, lvl, taps, now = Date.now()) {
  settle(p, lvl, now);
  const elapsed = Math.max(0, (now - p.lastSync) / 1000);
  const byRate = Math.ceil(elapsed * MAX_TAPS_PER_SEC) + 30;
  const n = Math.max(0, Math.min(Math.floor(taps) || 0, Math.floor(p.energy), byRate));
  p.energy -= n;
  p.points += n * stats(lvl).tapPower;
  p.taps += n;
  p.lastSync = now;
  return n;
}
