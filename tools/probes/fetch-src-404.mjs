// 抓取源站 404 页并分析其结构（对照移植版）
import { writeFileSync } from "node:fs";

const r = await fetch("https://blog.liushen.fun/404.html");
const h = await r.text();
writeFileSync(".workbuddy/tmp/src-404.html", h);
console.log("bytes:", h.length);

// 404 相关类名
const cls = [...h.matchAll(/class="([^"]*)"/g)]
  .map((x) => x[1])
  .filter((c) => /404|notfound|not-found|error|nf-/i.test(c));
console.log("\n404-ish classes:", JSON.stringify([...new Set(cls)], null, 1));

// 找出包含 "Page not found" 的最小片段
const idx = h.indexOf("Page not found");
if (idx > -1) {
  const start = Math.max(0, h.lastIndexOf("<", h.lastIndexOf("<", idx - 200)));
  console.log("\n--- context around 'Page not found' ---");
  console.log(h.slice(idx - 900, idx + 400));
}

// 标题
const t = h.match(/<title>([^<]*)<\/title>/);
console.log("\ntitle:", t ? t[1] : "(none)");
