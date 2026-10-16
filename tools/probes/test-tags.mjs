// 单元级验证：shuoshuo-tags.js 的边界行为
// 在真实浏览器里跑（因为 stripTagsFromHtml 依赖 DOM）
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
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
  const chrome = spawn(CHROME, ["--headless=new", "--remote-debugging-port=9380", "--no-first-run", "--disable-gpu",
    `--user-data-dir=${process.env.TEMP}/dsh-u-${Date.now()}`, "about:blank"], { stdio: "ignore" });
  let u;
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    try { const j = await (await fetch("http://127.0.0.1:9380/json/version")).json(); if (j.webSocketDebuggerUrl) { u = j.webSocketDebuggerUrl; break; } } catch {}
  }
  await new Promise((res, rej) => {
    ws = new WebSocket(u);
    ws.onopen = res; ws.onerror = rej;
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const { res, rej } = pend.get(m.id); pend.delete(m.id); m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); } };
  });
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const ss = (m, p = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method: m, params: p, sessionId })); });
  await ss("Page.enable"); await ss("Runtime.enable");
  await ss("Page.navigate", { url: "http://localhost:1313/shuoshuo/" });
  await sleep(4000);

  // 把模块源码直接喂进页面执行（用动态 import 的 data URL 形式不方便，改为内联实现对照）
  const modSrc = readFileSync("themes/kemiao/assets/js/shuoshuo-tags.js", "utf8")
    .replace(/^export /gm, "");
  const cases = `
    (() => {
    const { extractTags, stripTagsFromText, stripTagsFromHtml } = (() => {
      ${modSrc}
      return { extractTags, stripTagsFromText, stripTagsFromHtml };
    })();
    const R = [];
    const t = (name, got, want) => R.push({ name, got, want, pass: JSON.stringify(got) === JSON.stringify(want) });

    // 1) 纯标签正文 → 清空
    t("only-tag text", stripTagsFromText("#日常", ["日常"]), "");
    // 2) 标签在前 + 正文 → 前导空格吃掉
    t("leading tag", stripTagsFromText("#日常 七小时后早八，晚安-", ["日常"]), "七小时后早八，晚安-");
    // 3) 标签在中间
    t("mid tag", stripTagsFromText("今天 #日常 很累", ["日常"]), "今天 很累");
    // 4) 标签在末尾
    t("trailing tag", stripTagsFromText("晚安 #日常", ["日常"]), "晚安");
    // 5) 非 pill 的 # 保留（不在 tags 列表里）
    t("keep unknown tag", stripTagsFromText("#别的 正文", ["日常"]), "#别的 正文");
    // 6) URL 片段不算标签
    t("url fragment", extractTags("看 https://x.com/a#section 这个"), []);
    // 7) 大小写不敏感去重
    t("case dedupe", extractTags("#Daily #daily"), ["Daily"]);
    // 8) 上限 8 个
    t("max 8", extractTags("#a1 #a2 #a3 #a4 #a5 #a6 #a7 #a8 #a9").length, 8);
    // 9) HTML 文本节点剥离
    t("html strip", stripTagsFromHtml("<p>#日常 你好</p>", ["日常"]), "<p>你好</p>");
    // 10) HTML 里标签被包在 <a> 内
    t("html nested", stripTagsFromHtml('<p><a href="#">#日常</a> 你好</p>', ["日常"]), '<p><a href="#"></a> 你好</p>');
    // 11) 单字标签不算（2-32 位）
    t("single char not tag", extractTags("#a 正文"), []);
    // 12) 全角空格也吃掉
    t("ideographic space", stripTagsFromText("#日常\u3000你好", ["日常"]), "你好");
    return JSON.stringify(R);
    })()
  `;
  const r = await ss("Runtime.evaluate", { expression: cases, returnByValue: true });
  if (r.exceptionDetails) { console.log("EXC:", JSON.stringify(r.exceptionDetails)); process.exit(1); }
  const rows = JSON.parse(r.result.value);
  let fail = 0;
  for (const row of rows) {
    if (!row.pass) fail++;
    console.log(`  ${row.pass ? "✓" : "✗"} ${row.name.padEnd(20)} got=${JSON.stringify(row.got)} want=${JSON.stringify(row.want)}`);
  }
  console.log(`\n${rows.length - fail}/${rows.length} 通过`);
  chrome.kill();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e.message); process.exit(1); });
