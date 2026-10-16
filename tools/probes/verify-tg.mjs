// tg 数据源端到端验证：真实渲染 / 分页 / 灯箱 / 响应式
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const BASE = "http://localhost:1313";
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUT = ".workbuddy/tmp";

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

(async () => {
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=9350",
      "--no-first-run",
      "--disable-gpu",
      "--window-size=1440,1000",
      `--user-data-dir=${process.env.TEMP}/dsh-tg-${Date.now()}`,
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  let wsUrl;
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    try {
      const j = await (await fetch("http://127.0.0.1:9350/json/version")).json();
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
  await ss("Network.enable");

  const reqs = [];
  const errs = [];
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data);
    if (m.method === "Network.responseReceived") {
      const r = m.params.response;
      reqs.push({ url: r.url, status: r.status });
    }
    if (m.method === "Runtime.exceptionThrown") {
      errs.push(m.params.exceptionDetails?.exception?.description || m.params.exceptionDetails?.text || "?");
    }
  });

  const evalJson = async (expr, awaitPromise = false) => {
    const r = await ss("Runtime.evaluate", { expression: expr, awaitPromise, returnByValue: true });
    return r.result.value;
  };

  // ── 说说列表页 ──
  await ss("Page.navigate", { url: `${BASE}/shuoshuo/` });
  await sleep(6000);

  const state = JSON.parse(await evalJson(`JSON.stringify({
    feedSource: document.getElementById("shuoshuo-feed")?.dataset.source,
    feedState: document.getElementById("shuoshuo-feed")?.dataset.state,
    cards: document.querySelectorAll(".shuoshuo-card").length,
    listItems: document.querySelectorAll(".shuoshuo-feed-list > .shuoshuo-feed-item").length,
    tags: document.querySelectorAll(".shuoshuo-pill").length,
    images: document.querySelectorAll(".shuoshuo-media-image").length,
    loadedImages: [...document.querySelectorAll(".shuoshuo-media-image")].filter(i=>i.complete&&i.naturalWidth>0).length,
    brokenImages: [...document.images].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src).slice(0,5),
    moreBtn: !!document.querySelector(".shuoshuo-more-button"),
    moreHidden: document.querySelector(".shuoshuo-more-button")?.hidden,
    moreState: document.querySelector(".shuoshuo-more-button")?.dataset.state,
    moreStatus: document.querySelector(".shuoshuo-more-status")?.textContent,
    detailLinks: [...document.querySelectorAll(".shuoshuo-detail-button")].map(a=>a.href).slice(0,3),
    replyBtns: document.querySelectorAll(".shuoshuo-reply-button").length,
    masonryHeight: document.querySelector(".shuoshuo-feed-list")?.style.height,
    reveal: document.querySelector(".shuoshuo-feed-list")?.dataset.reveal,
    skeletonGone: !document.querySelector(".shuoshuo-skeleton-card"),
    firstText: document.querySelector(".shuoshuo-text")?.textContent?.trim().slice(0,40),
    firstDate: document.querySelector(".shuoshuo-date")?.textContent,
    firstAuthor: document.querySelector(".shuoshuo-author")?.textContent,
    firstAvatarOk: (()=>{const i=document.querySelector(".shuoshuo-avatar");return i?i.complete&&i.naturalWidth>0:null})()
  })`));
  console.log("=== 说说页（tg）初始状态 ===");
  console.log(JSON.stringify(state, null, 2));

  // ── 分页：点「加载更多」 ──
  const before = state.cards;
  await evalJson(`document.querySelector(".shuoshuo-more-button")?.click(); "clicked"`);
  await sleep(4500);
  const after = JSON.parse(await evalJson(`JSON.stringify({
    cards: document.querySelectorAll(".shuoshuo-card").length,
    moreHidden: document.querySelector(".shuoshuo-more-button")?.hidden,
    moreState: document.querySelector(".shuoshuo-more-button")?.dataset.state,
    moreStatus: document.querySelector(".shuoshuo-more-status")?.textContent,
    masonryHeight: document.querySelector(".shuoshuo-feed-list")?.style.height,
    broken: [...document.images].filter(i=>i.complete&&i.naturalWidth===0).length
  })`));
  console.log(`\n=== 分页 ===\n  before=${before}  after=${after.cards}`);
  console.log(JSON.stringify(after, null, 2));

  // ── 灯箱 ──
  const lb = await evalJson(`(() => {
    const link = document.querySelector("[data-shuoshuo-fancybox='true']");
    if (!link) return JSON.stringify({ skipped: "no image" });
    link.click();
    const ov = document.querySelector(".shuoshuo-lightbox");
    return JSON.stringify({ opened: !!ov && !ov.hidden, hasImg: !!ov?.querySelector("img")?.src, cls: ov?.className });
  })()`);
  console.log(`\n=== 灯箱 ===\n${lb}`);

  // ── 截图（桌面） ──
  await sleep(500);
  const shot = await ss("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/tg-shuoshuo-desktop.png`, Buffer.from(shot.data, "base64"));

  // ── 移动端响应式 ──
  await ss("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await ss("Page.navigate", { url: `${BASE}/shuoshuo/` });
  await sleep(5000);
  const mob = JSON.parse(await evalJson(`JSON.stringify({
    cards: document.querySelectorAll(".shuoshuo-card").length,
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    scrollW: document.documentElement.scrollWidth,
    innerW: window.innerWidth,
    masonryHeight: document.querySelector(".shuoshuo-feed-list")?.style.height
  })`));
  console.log(`\n=== 移动端 390px ===\n${JSON.stringify(mob, null, 2)}`);
  const shotM = await ss("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(`${OUT}/tg-shuoshuo-mobile.png`, Buffer.from(shotM.data, "base64"));
  await ss("Emulation.clearDeviceMetricsOverride");

  // ── 首页跑马灯 ──
  await ss("Page.navigate", { url: `${BASE}/` });
  await sleep(6000);
  const home = JSON.parse(await evalJson(`JSON.stringify({
    tickerItems: document.querySelectorAll("#bber-talk .talk-list .item").length,
    activeItems: document.querySelectorAll("#bber-talk .talk-list .item.is-active").length,
    firstText: document.querySelector("#bber-talk .talk-list .item .talk-text")?.textContent?.slice(0,40),
    icons: document.querySelectorAll("#bber-talk .talk-resource-icons i").length,
    stillPlaceholder: document.querySelector("#bber-talk .talk-list .item .talk-text")?.textContent?.includes("正在加载")
  })`));
  console.log(`\n=== 首页跑马灯 ===\n${JSON.stringify(home, null, 2)}`);

  // ── 汇总 ──
  const tgCalls = reqs.filter((r) => r.url.includes("tg-api.518339.xyz"));
  const bad = reqs.filter((r) => r.status >= 400 && !/artalk|atk\.|liiiu|liushen/.test(r.url));
  console.log(`\n=== 网络 ===`);
  console.log(`  tg-api 请求 ${tgCalls.length} 次，状态：${[...new Set(tgCalls.map(r=>r.status))].join(",")}`);
  console.log(`  本地 4xx：${bad.length ? bad.map(b=>b.status+" "+b.url).join("\n    ") : "无"}`);
  console.log(`  JS 异常：${errs.length ? errs.join("\n    ") : "无"}`);

  chrome.kill();
  process.exit(0);
})().catch((e) => { console.error("验证失败:", e.message); process.exit(1); });
