// 阶段⑦验收：图标渲染核对 + 七档宽度×亮暗矩阵 + reduced-motion
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeFileSync } from "node:fs";

const PORT = 9300 + (process.pid % 500);
const userDir = mkdtempSync(join(tmpdir(), "cdp-"));
const proc = spawn("C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe", [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`,
  "--no-sandbox", "--disable-gpu", "--window-size=1440,900", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let wsUrl;
for (let i = 0; i < 20; i++) { try { const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); wsUrl = l.find(t => t.type === "page")?.webSocketDebuggerUrl; if (wsUrl) break; } catch {} await sleep(300); }
const ws = new WebSocket(wsUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pend = new Map();
ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalIn = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
async function shot(file, clip) {
  const params = { format: "png" };
  if (clip) params.clip = { ...clip, scale: 1 };
  const r = await send("Page.captureScreenshot", params);
  writeFileSync(file, Buffer.from(r.result.data, "base64"));
}
await send("Page.enable");

const BASE = process.argv[2] || "http://127.0.0.1:1397";
const WIDTHS = [1440, 1280, 1024, 768, 640, 480, 375];
const PAGES = [
  { name: "home", url: "/" },
  { name: "post", url: "/posts/" }, // 文章列表（单篇另有）
];

// ---------- 1. 图标渲染核对（关键页面，收集未渲染的 fa 图标） ----------
console.log("===== 图标核对 =====");
const ICON_PAGES = ["/", "/archives/", "/comment/", "/devices/", "/shuoshuo/", "/link/", "/rewards/", "/posts/"];
for (const p of ICON_PAGES) {
  await send("Page.navigate", { url: BASE + p });
  await sleep(2200);
  const r = await evalIn(`(() => {
    const bad = [];
    const els = document.querySelectorAll("i[class*='fa-']");
    els.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const fam = getComputedStyle(el).fontFamily || "";
      const isFa = /Font Awesome/i.test(fam) || el.className.includes("fa-brands") || el.className.includes("fa-solid");
      const text = getComputedStyle(el).getPropertyValue("--fa") || "";
      if (!rect.width && rect.width !== 0) bad.push("no-rect");
      if (!isFa) bad.push((el.className + "").slice(0, 30) + "|fam:" + fam.slice(0, 24));
      else if (rect.width === 0 && !el.closest("[hidden]")) bad.push((el.className + "").slice(0, 30) + "|w0");
    });
    return JSON.stringify({ total: els.length, bad: [...new Set(bad)].slice(0, 6) });
  })()`);
  console.log(p.padEnd(12), r);
}
// 字体加载状态
console.log("fonts:", await evalIn(`document.fonts.status`));

// ---------- 2. 七档宽度 × 亮暗 ----------
console.log("===== 宽度×主题矩阵（横向溢出检查） =====");
for (const w of WIDTHS) {
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: 900, deviceScaleFactor: 1, mobile: w <= 640 });
  const row = [];
  for (const theme of ["light", "dark"]) {
    await send("Page.navigate", { url: BASE + "/" });
    await sleep(1600);
    await evalIn(`(() => { const d = document.documentElement; d.setAttribute("data-theme", "${theme}"); return 1; })()`);
    await sleep(600);
    const r = await evalIn(`JSON.stringify({
      ox: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      bodyOx: document.body.scrollWidth - document.body.clientWidth
    })`);
    const { ox, bodyOx } = JSON.parse(r);
    const flag = ox > 1 || bodyOx > 1 ? " ⚠ OVERFLOW " + ox + "/" + bodyOx : " ok";
    row.push(theme + ":" + flag);
  }
  console.log(String(w).padStart(4), row.join("  "));
}

// 代表性截图：375 dark 移动端 + 768 light 平板
await send("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: BASE + "/" });
await sleep(2000);
await evalIn(`document.documentElement.setAttribute("data-theme", "dark"); 1`);
await sleep(900);
await shot("stage7-mobile-375-dark.png", { x: 0, y: 0, width: 375, height: 812 });
await send("Emulation.setDeviceMetricsOverride", { width: 768, height: 1000, deviceScaleFactor: 1, mobile: false });
await send("Page.navigate", { url: BASE + "/" });
await sleep(2000);
await evalIn(`document.documentElement.setAttribute("data-theme", "light"); 1`);
await sleep(900);
await shot("stage7-tablet-768-light.png", { x: 0, y: 0, width: 768, height: 1000 });

// ---------- 3. reduced-motion ----------
console.log("===== reduced-motion =====");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await send("Page.navigate", { url: BASE + "/" });
await sleep(2500);
console.log(await evalIn(`JSON.stringify({
  mediaMatch: matchMedia("(prefers-reduced-motion: reduce)").matches,
  errs: (window.__errs || []).length
})`));
// 有无 JS 错误
await send("Page.navigate", { url: BASE + "/shuoshuo/" });
await sleep(3000);
console.log("shuoshuo under reduced-motion:", await evalIn(`JSON.stringify({
  cards: document.querySelectorAll(".shuoshuo-card").length,
  reveal: document.querySelector(".shuoshuo-feed-list")?.dataset?.reveal
})`));

console.log("done");
proc.kill();
process.exit(0);
