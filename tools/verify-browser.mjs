// 浏览器端验证：字体真实加载 + 404 页截图 + 全站 404 资源扫描
// 用法：node tools/verify-browser.mjs
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const BASE = "http://127.0.0.1:1401";
const OUT = ".workbuddy/tmp";
const CHROME =
  process.env.CHROME_PATH ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";

let id = 0;
const pending = new Map();
let ws;

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const msgId = ++id;
    pending.set(msgId, { resolve, reject });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

function connect(url) {
  return new Promise((resolve, reject) => {
    ws = new WebSocket(url);
    ws.onopen = () => resolve();
    ws.onerror = (e) => reject(new Error("ws error"));
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const { resolve, reject } = pending.get(m.id);
        pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      }
    };
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 启动 headless Chrome
  const userDir = `${process.env.TEMP}/dsh-chrome-verify-${Date.now()}`;
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=9333",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      `--user-data-dir=${userDir}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );

  // 等 devtools 就绪
  let wsUrl;
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    try {
      const r = await fetch("http://127.0.0.1:9333/json/version");
      const j = await r.json();
      if (j.webSocketDebuggerUrl) {
        wsUrl = j.webSocketDebuggerUrl;
        break;
      }
    } catch {}
  }
  if (!wsUrl) {
    chrome.kill();
    throw new Error("Chrome DevTools 未就绪");
  }
  await connect(wsUrl);

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", {
    targetId,
    flatten: true,
  });

  // 带 sessionId 的 send
  const ssend = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
    });

  await ssend("Page.enable");
  await ssend("Runtime.enable");
  await ssend("Network.enable");

  // 收集失败请求（loadingFailed 事件只给 requestId，需用已记录的 URL 表反查）
  const failures = [];
  const reqUrls = new Map(); // requestId -> url
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === "Network.requestWillBeSent") {
      reqUrls.set(m.params.requestId, m.params.request?.url || "");
    }
    if (m.method === "Network.loadingFailed") {
      failures.push({
        url: reqUrls.get(m.params.requestId) || "",
        err: m.params.errorText,
        type: m.params.type,
      });
    }
    if (m.method === "Network.responseReceived") {
      const { response } = m.params;
      if (response.status >= 400) {
        failures.push({ url: response.url, status: response.status });
      }
    }
  });

  // ---- 1) 首页：字体真实加载 ----
  await ssend("Page.navigate", { url: `${BASE}/` });
  await sleep(4000);

  const fontCheck = await ssend("Runtime.evaluate", {
    expression: `(async () => {
      await document.fonts.ready;
      const want = [
        ['Cartograph CF-1a234bdfe17fc7f2', 'cartograph'],
        ['Cascadia Code-92b4fb7167366a33', 'cascadia'],
        ['Sriracha-c79104b5446d9d3d', 'sriracha'],
        ['Wotfard-376b03e435c561c0', 'wotfard'],
      ];
      const out = [];
      for (const [fam, label] of want) {
        // 关键：document.fonts.check() 对「已声明但页面没用到」的字体返回 false，
        // 那是浏览器惰性加载的正常行为，不代表字体缺失。
        // 可靠判定 = 用 document.fonts.load() 主动请求，能 load 出 FontFace 才算真可用。
        let loaded = false, err = null;
        try {
          const faces = await document.fonts.load('400 16px "' + fam + '"', 'ABCabc123');
          loaded = faces.length > 0 && faces.some(f => f.status === 'loaded');
        } catch (e) { err = e.message; }
        out.push({ label, family: fam, loaded, err });
      }
      const pre = document.querySelector('pre code, pre');
      const preFont = pre ? getComputedStyle(pre).fontFamily : null;
      return JSON.stringify({ fonts: out, preFont, total: document.fonts.size });
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });
  const fontData = JSON.parse(fontCheck.result.value);
  console.log("\n=== 字体加载实测（强制加载判定）===");
  let fontFail = 0;
  for (const f of fontData.fonts) {
    if (!f.loaded) fontFail++;
    console.log(`  ${f.loaded ? "✓" : "✗"} ${f.label.padEnd(10)} ${f.family}${f.err ? "  ERR: " + f.err : ""}`);
  }
  console.log(`  document.fonts.size = ${fontData.total}`);
  console.log(`  pre 字体: ${fontData.preFont}`);
  if (fontFail) console.log(`  ⚠ ${fontFail} 个字体加载失败`);

  // ---- 2) 404 页 ----
  await ssend("Page.navigate", { url: `${BASE}/404.html` });
  await sleep(2500);
  const shot404 = await ssend("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  writeFileSync(`${OUT}/verify-404.png`, Buffer.from(shot404.data, "base64"));
  console.log(`\n=== 404 页截图 ===\n  → ${OUT}/verify-404.png`);

  // ---- 3) 首页截图 ----
  await ssend("Page.navigate", { url: `${BASE}/` });
  await sleep(3000);
  const shotHome = await ssend("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/verify-home.png`, Buffer.from(shotHome.data, "base64"));

  // ---- 4) 文章页截图（验证代码块字体观感）----
  await ssend("Page.navigate", { url: `${BASE}/posts/markdown-format/` });
  await sleep(3000);
  const shotPost = await ssend("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/verify-post.png`, Buffer.from(shotPost.data, "base64"));

  // ---- 结果 ----
  // 已知良性噪声（本地 dev 环境预期出现，不算回归）：
  //  - artalk 服务端 CORS 白名单不含本地域 → loadingFailed
  //  - 外部统计/音乐 CDN 在本机代理下失败
  const BENIGN = [
    /atk\.|artalk|\.liushen\.fun/i,
    /met\.liiiu\.cn|jsd\.liiiu\.cn|bsz\.liiiu\.cn/i,
    /fc\.liushen\.fun|mm\.liushen\.fun/i,
  ];
  const hard = failures.filter((f) => {
    const bad = f.status >= 400 || (f.err && f.err !== "net::ERR_ABORTED");
    if (!bad) return false;
    const url = String(f.url || "");
    return !BENIGN.some((re) => re.test(url));
  });

  console.log(`\n=== 失败/4xx 请求（已滤除良性噪声）===`);
  if (hard.length === 0) {
    console.log("  ✓ 无真实失败请求");
  } else {
    for (const f of hard) console.log(`  ✗ ${f.url} ${f.err || f.status}`);
  }
  // 本地资源 404 单独强调
  const local404 = failures.filter(
    (f) => f.status === 404 && /127\.0\.0\.1|localhost/.test(String(f.url))
  );
  if (local404.length) {
    console.log(`\n  ⚠ 本地资源 404（${local404.length} 个，需修复）：`);
    local404.forEach((f) => console.log(`    - ${f.url}`));
  }

  chrome.kill();
  // 有真实失败或本地 404 时以非零退出，便于 CI/脚本判定
  process.exit(hard.length || local404.length ? 1 : 0);
}

main().catch((e) => {
  console.error("验证失败:", e.message);
  process.exit(1);
});
