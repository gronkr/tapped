// Cosmetic bear fights. Points always come from the server; bears are just the fun part.
window.Bear = (() => {
  const TYPES = [
    { fur: "#A8683A", belly: "#E7B98A", ear: "#6E3F1C" },
    { fur: "#F4F1EA", belly: "#FFFFFF", ear: "#2B2B2B" },
    { fur: "#EAF6FF", belly: "#FFFFFF", ear: "#A9C9E0" },
    { fur: "#D8503F", belly: "#F7B1A2", ear: "#8E2A1F" },
    { fur: "#4A3E66", belly: "#9D8FC4", ear: "#2A2140" },
    { fur: "#F2B233", belly: "#FFE7A3", ear: "#B77912" },
  ];
  let level = Number(localStorage.getItem("tp_bear_lvl") || 1);
  let maxHp, hp, type;
  const $ = (id) => document.getElementById(id);

  function setup() {
    type = TYPES[(level - 1) % TYPES.length];
    maxHp = Math.round(20 * Math.pow(1.28, level - 1));
    hp = maxHp;
    const b = $("bear");
    b.style.setProperty("--fur", type.fur); b.style.setProperty("--belly", type.belly); b.style.setProperty("--ear", type.ear);
    $("foeName").textContent = `Dip the Bear, Lvl ${level}`;
    draw();
  }
  function draw() {
    $("foeHp").textContent = `${Math.max(0, Math.ceil(hp)).toLocaleString("en-US")} HP`;
    $("hpFill").style.width = `${Math.max(0, hp / maxHp) * 100}%`;
  }
  function coins(x, y, n) {
    const f = $("floats");
    for (let i = 0; i < n; i++) {
      const s = document.createElement("div");
      s.className = "spark";
      s.style.left = `${x}px`; s.style.top = `${y}px`;
      s.style.setProperty("--dx", `${(Math.random() - 0.5) * 260}px`);
      s.style.setProperty("--dy", `${-60 - Math.random() * 140}px`);
      f.appendChild(s); setTimeout(() => s.remove(), 700);
    }
  }
  function hit(power, x, y) {
    hp -= power;
    const arena = $("tapBtn");
    arena.classList.add("hit"); setTimeout(() => arena.classList.remove("hit"), 70);
    if (Math.random() < 0.25) coins(x, y, 1);
    if (hp <= 0) {
      const bear = $("bear");
      coins(x, y, 8);
      bear.classList.remove("enter"); bear.classList.add("pop");
      level++; localStorage.setItem("tp_bear_lvl", level);
      setTimeout(() => { bear.classList.remove("pop"); setup(); void bear.offsetWidth; bear.classList.add("enter"); }, 450);
      hp = 0;
    }
    draw();
  }
  document.addEventListener("DOMContentLoaded", setup);
  return { hit };
})();
