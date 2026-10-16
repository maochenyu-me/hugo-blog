// 全页样式对比探针：SRC(源站) vs LOC(1313)，亮暗两轮
// 用法: node probe-style-diff.js [bright|dark|all]
const PORT = 9300 + (process.pid % 500);
const { spawn } = require('child_process');
const CHROME = 'C:\\Users\\Administrator\\.cache\\puppeteer\\chrome\\win64-131.0.6778.204\\chrome-win64\\chrome.exe';
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=E:/CSharp/Temp/cdp-probe-${PORT}`, '--no-sandbox', '--disable-gpu', '--window-size=1440,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const mode = process.argv[2] || 'all';

// 页面组：[标签, 源站路径, 本地路径]
const PAGES = [
  ['home', '/', '/'],
  ['post', '/posts/6a6de263/', '/posts/markdown-format/'],
  ['shuoshuo', '/shuoshuo/', '/shuoshuo/'],
  ['devices', '/devices/', '/devices/'],
  ['comment', '/comment/', '/comment/'],
  ['about', '/about/', '/about/'],
  ['archives', '/archives/', '/archives/'],
  ['link', '/link/', '/link/'],
  ['rewards', '/rewards/', '/rewards/'],
  ['subscribe', '/subscribe/', '/subscribe/'],
  ['fcircle', '/fcircle/', '/fcircle/'],
  ['statement', '/statement/', '/statement/'],
  ['info', '/info/', '/info/'],
  ['addlink', '/addlink/', '/addlink/'],
  ['search', '/search/', '/search/'],
];

// 通用组件选择器（两边同构）
const PICKS = ['#hero', '#bber-talk', '#recent-posts', '.post-title', '.ai-summary-card', '#TableOfContents',
  '.post-nav', '.atk-comment-welcome', '.atk-list', '#twikoo', '.shuoshuo-card', '.device-card',
  '.more-app-list-groups', '.link-card', '.archives-item', '.reward-item', '.breadcrumb', '.page-hero',
  '.about-page', '.friends-group', '.comment-container', '.post-header', '.toc-mobile', '.fcircle-card'];

const SNAP = `(() => {
  const norm = c => (c || '').replace(/data-astro-cid-[a-z0-9]+/g, '').replace(/\\s+/g, ' ').trim();
  const grab = el => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return el.tagName.toLowerCase() + '|' + norm(el.getAttribute('class') || '').slice(0, 90) +
      '|h' + Math.round(r.height) + '|pt' + s.paddingTop + '|pb' + s.paddingBottom +
      '|mt' + s.marginTop + '|mb' + s.marginBottom + '|fs' + s.fontSize + '|lh' + s.lineHeight.slice(0, 6) +
      '|bg' + s.backgroundColor.replace(/rgba?\\(|\\)|\\s/g, '').replace(/0\\.\\d+/g, m => Math.round(+m * 255)) +
      '|c' + s.color.replace(/rgba?\\(|\\)|\\s/g, '').replace(/0\\.\\d+/g, m => Math.round(+m * 255)) +
      '|br' + s.borderRadius.split(' ').map(v => Math.round(parseFloat(v))).join(',');
  };
  const main = document.querySelector('main');
  if (!main) return { err: 'no main' };
  const blocks = [...main.querySelectorAll(':scope > *')].slice(0, 8).map(grab);
  const ids = [...main.querySelectorAll('[id]')].map(e => e.id).sort();
  const picks = {};
  for (const sel of ${JSON.stringify(PICKS)}) {
    const el = document.querySelector(sel);
    if (el) picks[sel] = grab(el);
  }
  return { blocks, ids, picks, mainH: Math.round(main.getBoundingClientRect().height) };
})()`;

async function main() {
  const ws = new WebSocket(await getWs());
  await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise(res => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
  const evalJs = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result.exceptionDetails) return { err: (r.result.exceptionDetails.exception?.description || '').slice(0, 120) };
    return r.result.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  const themes = mode === 'bright' ? ['light'] : mode === 'dark' ? ['dark'] : ['light', 'dark'];
  for (const theme of themes) {
    console.log(`\n######## THEME=${theme} ########`);
    // 两边都先设主题键再导航
    const expiry = Date.now() + 86400000;
    for (const [label, base] of [['LOC', 'http://127.0.0.1:1313'], ['SRC', 'https://blog.liushen.fun']]) {
      await send('Page.navigate', { url: base + '/' });
      await sleep(2500);
      await evalJs(`try{localStorage.setItem('theme','{"value":"${theme}","expiry":${expiry}}')}catch(e){}; 'ok'`);
    }
    for (const [label, srcPath, locPath] of PAGES) {
      const snap = {};
      for (const [which, base, path] of [['SRC', 'https://blog.liushen.fun', srcPath], ['LOC', 'http://127.0.0.1:1313', locPath]]) {
        await send('Page.navigate', { url: base + path });
        await sleep(theme === 'dark' ? 3200 : 2600);
        snap[which] = await evalJs(SNAP);
      }
      const S = snap.SRC, L = snap.LOC;
      if (!S || !L || S.err || L.err) { console.log(`[${label}] SNAP_FAIL src=${JSON.stringify(S).slice(0, 60)} loc=${JSON.stringify(L).slice(0, 60)}`); continue; }
      const diffs = [];
      // ids 集合 diff
      const sIds = new Set(S.ids), lIds = new Set(L.ids);
      const onlyS = [...sIds].filter(i => !lIds.has(i)), onlyL = [...lIds].filter(i => !sIds.has(i));
      if (onlyS.length) diffs.push('IDS_MISSING_LOC=[' + onlyS.join(',') + ']');
      if (onlyL.length) diffs.push('IDS_ONLY_LOC=[' + onlyL.join(',') + ']');
      if (S.mainH !== L.mainH) diffs.push(`mainH ${S.mainH} vs ${L.mainH}`);
      // blocks 序列 diff
      const maxB = Math.max(S.blocks.length, L.blocks.length);
      for (let i = 0; i < maxB; i++) {
        const a = S.blocks[i], b = L.blocks[i];
        if (a === b) continue;
        if (!a) { diffs.push(`block${i} MISSING_SRC (loc=${b?.split('|').slice(0, 2).join('|')})`); continue; }
        if (!b) { diffs.push(`block${i} MISSING_LOC (src=${a.split('|').slice(0, 2).join('|')})`); continue; }
        const pa = a.split('|'), pb = b.split('|');
        const fieldDiff = pa.map((v, j) => v !== pb[j] ? `${pa[0]}#${j}:${v.slice(0, 40)}≠${(pb[j] || '').slice(0, 40)}` : null).filter(Boolean);
        diffs.push('block' + i + ' ' + fieldDiff.join(' ; '));
      }
      // picks diff
      const allKeys = [...new Set([...Object.keys(S.picks), ...Object.keys(L.picks)])];
      for (const k of allKeys) {
        const a = S.picks[k], b = L.picks[k];
        if (a === b) continue;
        if (!a) { diffs.push(`pick ${k} MISSING_SRC`); continue; }
        if (!b) { diffs.push(`pick ${k} MISSING_LOC`); continue; }
        const pa = a.split('|'), pb = b.split('|');
        const fieldDiff = pa.map((v, j) => v !== pb[j] ? `${j === 0 ? pa[0] : 'f' + j}:${v.slice(0, 44)}≠${(pb[j] || '').slice(0, 44)}` : null).filter(Boolean);
        if (fieldDiff.length) diffs.push(`pick ${k} → ` + fieldDiff.join(' ; '));
      }
      if (diffs.length) { console.log(`\n[${label}] ${diffs.length} 处差异:`); diffs.forEach(d => console.log('  · ' + d)); }
      else console.log(`[${label}] ✓ 一致`);
    }
  }
  ws.close(); chrome.kill();
  console.log('\nDONE');
}
async function getWs() {
  for (let i = 0; i < 30; i++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/list`); const p = (await r.json()).find(t => t.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch {}
    await sleep(300);
  }
  throw new Error('no ws');
}
main().catch(e => { console.error('ERR=' + e.message); chrome.kill(); process.exit(1); });
