const PORT = 9300 + (process.pid % 500);
const { spawn } = require('child_process');
const CHROME = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=E:/CSharp/Temp/cdp-probe-${PORT}`,
  '--no-sandbox', '--disable-gpu', '--window-size=1440,900', 'about:blank'
], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
  let id = 0; const pending = new Map(); const events = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    if (m.method === 'Runtime.exceptionThrown') events.push(JSON.stringify(m.params.exceptionDetails.exception?.description || m.params));
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  };
  const send = (method, params = {}) => new Promise(res => {
    const mid = ++id; pending.set(mid, res);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  const evalJs = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) return { EXC: r.result.exceptionDetails.exception?.description };
    return r.result.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  const BASE = 'http://127.0.0.1:1397';

  // 1) /search/ 页
  await send('Page.navigate', { url: BASE + '/search/' });
  await sleep(2200);
  console.log('SEARCH_PAGE=' + JSON.stringify(await evalJs(`(() => {
    const c = document.getElementById('algolia-search');
    const input = c?.querySelector('.algolia-ui__search-input');
    return {
      hasContainer: !!c,
      provider: c?.dataset.searchProvider,
      bound: c?.dataset.bound === 'true',
      heroTitle: document.querySelector('.page-hero h1')?.textContent,
      breadcrumb: document.querySelector('.breadcrumb-current')?.textContent,
    };
  })()`)));
  // 输入关键词实测 pagefind
  await evalJs(`(() => {
    const input = document.querySelector('#algolia-search .algolia-ui__search-input');
    input.value = 'markdown';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(2500);
  console.log('SEARCH_QUERY=' + JSON.stringify(await evalJs(`(() => ({
    msg: document.querySelector('#algolia-search .algolia-ui__message')?.textContent,
    hits: document.querySelectorAll('#algolia-search .algolia-ui__result').length,
    urlQ: location.search,
  }))()`)));

  // 2) /safego/
  const b64 = Buffer.from('https://github.com/Kemeow0815').toString('base64').replace(/=+$/, '');
  await send('Page.navigate', { url: BASE + '/safego/?u=' + b64 });
  await sleep(1800);
  console.log('SAFEGO=' + JSON.stringify(await evalJs(`(() => ({
    url: document.getElementById('safego-url')?.textContent,
    count: document.querySelector('[data-safego-count]')?.textContent,
    progress: document.querySelector('[data-safego-progress]')?.style.width,
    kicker: document.querySelector('.safego-kicker')?.textContent,
  }))()`)));
  // 取消按钮不真跳走，点取消（window.close 在 headless 无害）
  await evalJs(`document.querySelector('[data-safego-cancel]')?.click(); true`);
  await sleep(300);

  // 3) 首页 nav-music
  await send('Page.navigate', { url: BASE + '/' });
  await sleep(3000);
  console.log('MUSIC=' + JSON.stringify(await evalJs(`(() => ({
    present: !!document.getElementById('nav-music'),
    ready: document.getElementById('nav-music')?.classList.contains('is-ready'),
    meting: !!document.querySelector('#nav-music meting-js'),
    hasAplayer: !!document.querySelector('#nav-music .aplayer'),
    cssLoaded: !!document.querySelector('link[href*="APlayer.min.css"]'),
  }))()`)));

  // 4) 文章页 outdate + console 错误收集
  await send('Page.navigate', { url: BASE + '/posts/markdown-format/' });
  await sleep(2500);
  console.log('OUTDATE=' + JSON.stringify(await evalJs(`(() => ({
    present: !!document.querySelector('[data-post-outdate-notice]'),
    date: document.querySelector('[data-post-outdate-notice]')?.dataset.publishedAt,
  }))()`)));
  console.log('JS_ERRORS=' + events.length);
  events.slice(0, 3).forEach(e => console.log('ERR: ' + e.slice(0, 200)));
  ws.close(); chrome.kill();
}
main().catch(e => { console.error('ERR=' + e.message); chrome.kill(); process.exit(1); });
