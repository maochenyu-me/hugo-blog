import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 9300 + (process.pid % 500);
const CHROME = "C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe";
const userDir = mkdtempSync(join(tmpdir(), "cdp-"));
const proc = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDir}`,
  "--no-sandbox", "--disable-gpu", "--window-size=1440,900", "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getWs() {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error("no ws");
}
const ws = new WebSocket(await getWs());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let idSeq = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
};
function send(method, params = {}) {
  return new Promise((resolve) => {
    const id = ++idSeq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalIn(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) console.log("EVAL-ERR:", JSON.stringify(r.result.exceptionDetails.exception?.description || "").slice(0, 300));
  return r.result?.result?.value;
}
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  const { writeFileSync } = await import("node:fs");
  writeFileSync(`final-${name}.png`, Buffer.from(r.result.data, "base64"));
}
await send("Page.enable");

const BASE = "http://127.0.0.1:1397";

// light theme for comparison with user screenshots
await send("Page.navigate", { url: BASE + "/" });
await sleep(3000);
await evalIn(`localStorage.setItem('site-settings', JSON.stringify({...JSON.parse(localStorage.getItem('site-settings')||'{}'), 'theme-mode': 'light'})); location.reload(); 1`);
await sleep(4500);

// more-app panel: hover + focus-within
await evalIn(`(() => {
  const btn = document.querySelector('.more-app-btn');
  btn.focus();
  btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  return 1;
})()`);
await sleep(700);
await shot("more-app");

await send("Page.navigate", { url: BASE + "/shuoshuo/" });
await sleep(7000);
await shot("shuoshuo-light");

await send("Page.navigate", { url: BASE + "/comment/" });
await sleep(4000);
await shot("guestbook-light");

proc.kill();
process.exit(0);
