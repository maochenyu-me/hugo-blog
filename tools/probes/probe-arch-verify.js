const PORT = 9300 + (process.pid % 500);
const { spawn } = require('child_process');
const CHROME = 'C://Users//Administrator//.cache//puppeteer//chrome//win64-131.0.6778.204//chrome-win64//chrome.exe';
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=E:/CSharp/Temp/cdp-probe-${PORT}`, '--no-sandbox', '--disable-gpu', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getWs() {
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const p = (await r.json()).find(t => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch {}
    await sleep(300);
  }
}
async function main() {
  const ws = new WebSocket(await getWs());
  await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise(res => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
  const evalJs = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }); return r.result.result.value; };
  await send('Page.enable'); await send('Runtime.enable');
  const SNAP = `(() => { const t = document.querySelector('.post-title'); const tl = document.querySelector('.timeline'); if (!t) return null; const s = getComputedStyle(t); return { tl: !!tl, tlPad: tl ? getComputedStyle(tl).paddingLeft : null, h: Math.round(t.getBoundingClientRect().height), lh: s.lineHeight, fs: s.fontSize, fw: s.fontWeight }; })()`;
  await send('Page.navigate', { url: 'http://127.0.0.1:1313/archives/' });
  await sleep(3000);
  console.log('LOC=' + JSON.stringify(await evalJs(SNAP)));
  await send('Page.navigate', { url: 'https://blog.liushen.fun/archives/' });
  await sleep(3000);
  console.log('SRC=' + JSON.stringify(await evalJs(SNAP)));
  ws.close(); chrome.kill();
}
main().catch(e => { console.error('ERR=' + e.message); chrome.kill(); process.exit(1); });
