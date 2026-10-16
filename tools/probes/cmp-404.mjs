// 404 页逐项几何/样式对比：源站 vs 本地
// 用同一选择器在两边取 rect + 关键 computed style，逐字段 diff。
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const SRC = "https://blog.liushen.fun/404.html";
const LOC = "http://127.0.0.1:1401/404.html";
const CHROME =
  process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";

let id = 0;
const pend = new Map();
let ws;
const send = (m, p = {}) =>
  new Promise((res, rej) => {
    const i = ++id;
    pend.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method: m, params: p }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 目标选择器 + 要抓的属性
const SELECTORS = [
  ["main#main-content", "main"],
  ["main#main-content > div", "wrapper"],
  ["main#main-content h1", "h1-404"],
  ["main#main-content span[aria-hidden]", "kaomoji"],
  ["main#main-content p", "p-notfound"],
  ["main#main-content a", "a-back"],
  ["body", "body"],
];
const PROPS = [
  "display", "flexDirection", "alignItems", "justifyContent",
  "width", "height", "marginTop", "marginBottom", "padding",
  "fontSize", "fontWeight", "lineHeight", "color", "textAlign",
  "textDecorationLine", "textDecorationStyle", "textUnderlineOffset",
];

async function probe(url, label) {
  await send("Page.navigate", { url });
  await sleep(url.startsWith("https") ? 6000 : 3000);
  const r = await send("Runtime.evaluate", {
    expression: `(() => {
      const sels = ${JSON.stringify(SELECTORS)};
      const props = ${JSON.stringify(PROPS)};
      const out = {};
      for (const [sel, name] of sels) {
        const el = document.querySelector(sel);
        if (!el) { out[name] = null; continue; }
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const o = {
          _rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
          _text: (el.textContent || "").trim().slice(0, 60),
        };
        for (const p of props) o[p] = cs[p];
        out[name] = o;
      }
      return JSON.stringify(out);
    })()`,
    returnByValue: true,
  });
  return JSON.parse(r.result.value);
}

(async () => {
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=9336",
      "--no-first-run",
      "--disable-gpu",
      "--window-size=1440,900",
      `--user-data-dir=${process.env.TEMP}/dsh-404-${Date.now()}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  let wsUrl;
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    try {
      const j = await (await fetch("http://127.0.0.1:9336/json/version")).json();
      if (j.webSocketDebuggerUrl) { wsUrl = j.webSocketDebuggerUrl; break; }
    } catch {}
  }
  await new Promise((res, rej) => {
    ws = new WebSocket(wsUrl);
    ws.onopen = res;
    ws.onerror = rej;
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pend.has(m.id)) {
        const { res, rej } = pend.get(m.id);
        pend.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      }
    };
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const ss = (m, p = {}) =>
    new Promise((res, rej) => {
      const i = ++id;
      pend.set(i, { res, rej });
      ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId }));
    });
  await ss("Page.enable");
  await ss("Runtime.enable");

  // 覆盖 send 供 probe 用
  const oldSend = send;
  globalThis.__ss = ss;

  const src = await (async () => {
    await ss("Page.navigate", { url: SRC });
    await sleep(6000);
    const r = await ss("Runtime.evaluate", {
      expression: `(() => {
        const sels = ${JSON.stringify(SELECTORS)};
        const props = ${JSON.stringify(PROPS)};
        const out = {};
        for (const [sel, name] of sels) {
          const el = document.querySelector(sel);
          if (!el) { out[name] = null; continue; }
          const cs = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const o = { _rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)], _text: (el.textContent||"").trim().slice(0,60) };
          for (const p of props) o[p] = cs[p];
          out[name] = o;
        }
        return JSON.stringify(out);
      })()`,
      returnByValue: true,
    });
    return JSON.parse(r.result.value);
  })();

  const loc = await (async () => {
    await ss("Page.navigate", { url: LOC });
    await sleep(3000);
    const r = await ss("Runtime.evaluate", {
      expression: `(() => {
        const sels = ${JSON.stringify(SELECTORS)};
        const props = ${JSON.stringify(PROPS)};
        const out = {};
        for (const [sel, name] of sels) {
          const el = document.querySelector(sel);
          if (!el) { out[name] = null; continue; }
          const cs = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const o = { _rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)], _text: (el.textContent||"").trim().slice(0,60) };
          for (const p of props) o[p] = cs[p];
          out[name] = o;
        }
        return JSON.stringify(out);
      })()`,
      returnByValue: true,
    });
    return JSON.parse(r.result.value);
  })();

  console.log("=== 404 页逐项对比（SRC vs LOC）===\n");
  let diffs = 0;
  for (const [, name] of SELECTORS) {
    const s = src[name], l = loc[name];
    if (!s && !l) { console.log(`[${name}] 两边都无此元素`); continue; }
    if (!s) { console.log(`[${name}] ✗ 源站有，本地没有`); diffs++; continue; }
    if (!l) { console.log(`[${name}] ✗ 源站无，本地有`); diffs++; continue; }
    const lines = [];
    for (const k of Object.keys(s)) {
      const a = JSON.stringify(s[k]), b = JSON.stringify(l[k]);
      if (a !== b) { lines.push(`      ${k}: SRC=${a} LOC=${b}`); diffs++; }
    }
    if (lines.length) { console.log(`[${name}] 差异:`); lines.forEach(x => console.log(x)); }
    else console.log(`[${name}] ✓ 完全一致（rect=${JSON.stringify(s._rect)}）`);
  }
  console.log(`\n>>> 总差异字段数: ${diffs}`);

  // 截图
  await ss("Page.navigate", { url: LOC });
  await sleep(2500);
  const shot = await ss("Page.captureScreenshot", { format: "png" });
  writeFileSync(".workbuddy/tmp/cmp-404-local.png", Buffer.from(shot.data, "base64"));
  await ss("Page.navigate", { url: SRC });
  await sleep(5000);
  const shot2 = await ss("Page.captureScreenshot", { format: "png" });
  writeFileSync(".workbuddy/tmp/cmp-404-src.png", Buffer.from(shot2.data, "base64"));
  console.log("\n截图: .workbuddy/tmp/cmp-404-{local,src}.png");

  chrome.kill();
  process.exit(0);
})().catch((e) => { console.error("失败:", e.message); process.exit(1); });
