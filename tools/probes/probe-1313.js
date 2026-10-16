const PORT = 9300 + (process.pid % 500);
const { spawn } = require('child_process');
const CHROME = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=E:/CSharp/Temp/cdp-probe-${PORT}`,
  '--no-sandbox', '--disable-gpu', '--window-size=1440,900', 'about:blank'
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fs = require('fs');
async function getWs() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const page = (await res.json()).find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(300);
  }
  throw new Error('no page target');
}
async function main() {
  const ws = new WebSocket(await getWs());
  await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map(); const errors = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || JSON.stringify(m.params).slice(0, 150));
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise(res => {
    const mid = ++id; pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evalJs = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) return { EXC: (r.result.exceptionDetails.exception?.description || '').slice(0, 200) };
    return r.result.result.value;
  };
  const shot = async name => {
    const s = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(`E:/github_maochenyu_me/hugo-kemiao-theme/blog/.workbuddy/tmp/verify-1313-${name}.png`, Buffer.from(s.result.data, 'base64'));
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const BASE = 'http://127.0.0.1:1313';
  const results = {};

  // 首页
  await send('Page.navigate', { url: BASE + '/' });
  await sleep(3200);
  results.home = await evalJs(`(() => ({
    title: document.title, theme: document.documentElement.dataset.theme,
    navLinks: document.querySelectorAll('.nav-link').length,
    cards: document.querySelectorAll('.app-card').length,
    music: !!document.getElementById('nav-music'),
    musicReady: document.getElementById('nav-music')?.classList.contains('is-ready'),
    consoleBtn: !!document.querySelector('[data-control-console-trigger]'),
    heroName: document.querySelector('.name-glow')?.textContent,
  }))()`);
  await shot('home');

  // 搜索页 + 实搜
  await send('Page.navigate', { url: BASE + '/search/?q=hugo' });
  await sleep(2600);
  results.search = await evalJs(`(() => ({
    msg: document.querySelector('.algolia-ui__message')?.textContent,
    hits: document.querySelectorAll('.algolia-ui__result').length,
    inputVal: document.querySelector('.algolia-ui__search-input')?.value,
  }))()`);
  await shot('search');

  // safego
  const b64 = Buffer.from('https://github.com/Kemeow0815').toString('base64').replace(/=+$/, '');
  await send('Page.navigate', { url: BASE + '/safego/?u=' + b64 });
  await sleep(1600);
  results.safego = await evalJs(`(() => ({
    url: document.getElementById('safego-url')?.textContent,
    count: document.querySelector('[data-safego-count]')?.textContent,
  }))()`);
  await evalJs(`document.querySelector('[data-safego-cancel]')?.click(); true`);
  await shot('safego');

  // 文章页
  await send('Page.navigate', { url: BASE + '/posts/markdown-format/' });
  await sleep(2600);
  results.post = await evalJs(`(() => ({
    outdate: !!document.querySelector('[data-post-outdate-notice]'),
    safegoLinks: document.querySelectorAll('a[href^="/safego/"]').length,
    toc: !!document.querySelector('#TableOfContents, [data-toc-root]'),
    copyBtn: !!document.querySelector('.code-block-copy, [data-code-copy], .copy-btn'),
    comments: !!document.querySelector('#artalk-comments, #twikoo-comments'),
  }))()`);
  await shot('post');

  // 外链验证（safego 中转落地页可访问）
  const resp = await fetch(BASE + '/safego/');
  results.safegoPage = resp.status;

  console.log('RESULTS=' + JSON.stringify(results, null, 2));
  console.log('JS_ERRORS=' + errors.length);
  const realErrors = errors.filter(e => !/Failed to fetch/.test(e));
  realErrors.slice(0, 5).forEach(e => console.log('ERR: ' + e.slice(0, 180)));
  ws.close(); chrome.kill();
}
main().catch(e => { console.error('ERR=' + e.message); chrome.kill(); process.exit(1); });
