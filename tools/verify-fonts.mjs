// 判定 Sriracha / Wotfard 是否真的可用：
// document.fonts.check() 用中文测试串会对「纯拉丁字体」误报 false。
// 改用拉丁串测试 + 实际渲染宽度比对。
import { spawn } from "node:child_process";

const BASE = "http://127.0.0.1:1401";
const CHROME =
  process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";

let id = 0;
const pending = new Map();
let ws;
const send = (method, params = {}) =>
  new Promise((res, rej) => {
    const i = ++id;
    pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=9334",
      "--no-first-run",
      "--disable-gpu",
      `--user-data-dir=${process.env.TEMP}/dsh-font-${Date.now()}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  let wsUrl;
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    try {
      const j = await (await fetch("http://127.0.0.1:9334/json/version")).json();
      if (j.webSocketDebuggerUrl) { wsUrl = j.webSocketDebuggerUrl; break; }
    } catch {}
  }
  await new Promise((resolve, reject) => {
    ws = new WebSocket(wsUrl);
    ws.onopen = resolve;
    ws.onerror = reject;
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const { res, rej } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result);
      }
    };
  });

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const ssend = (method, params = {}) =>
    new Promise((res, rej) => {
      const i = ++id;
      pending.set(i, { res, rej });
      ws.send(JSON.stringify({ id: i, method, params, sessionId }));
    });

  await ssend("Page.enable");
  await ssend("Runtime.enable");
  await ssend("Page.navigate", { url: `${BASE}/` });
  await sleep(4000);

  const r = await ssend("Runtime.evaluate", {
    expression: `(async () => {
      await document.fonts.ready;
      const test = (fam, text) => {
        const s = '16px "' + fam + '"';
        return document.fonts.check(s, text);
      };
      // 已加载的 FontFace 列表
      const loaded = [];
      document.fonts.forEach(f => { if (f.status === 'loaded') loaded.push(f.family + ' [' + f.status + ']'); });
      return JSON.stringify({
        latin: {
          cartograph: test('Cartograph CF-1a234bdfe17fc7f2', 'ABC123'),
          cascadia:   test('Cascadia Code-92b4fb7167366a33', 'ABC123'),
          sriracha:   test('Sriracha-c79104b5446d9d3d', 'ABC123'),
          wotfard:    test('Wotfard-376b03e435c561c0', 'ABC123'),
        },
        cjk: { sriracha: test('Sriracha-c79104b5446d9d3d', '中文') },
        loadedFaces: loaded.filter(f => /Wotfard|Sriracha|Cartograph|Cascadia/i.test(f)),
      });
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  const d = JSON.parse(r.result.value);
  console.log("=== 拉丁字符测试（真实验证字体可用性）===");
  for (const [k, v] of Object.entries(d.latin)) {
    console.log(`  ${v ? "✓" : "✗"} ${k}`);
  }
  console.log(`\n=== 中文测试（预期 false：这两个字体不含 CJK）===\n  sriracha+cjk: ${d.cjk.sriracha}`);
  console.log(`\n=== 已 loaded 的 FontFace ===`);
  for (const f of d.loadedFaces) console.log(`  ✓ ${f}`);

  chrome.kill();
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
