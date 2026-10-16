// 三数据源回归：local / api / tg —— 逐一改配置、构建、浏览器验证
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const TOML = "hugo.toml";
const orig = readFileSync(TOML, "utf8");

function setSource(src) {
  // 注意：不能只匹配第一处 `source =`——hugo.toml 的 [module.mounts] 里也有 source。
  // 这里锚定 [params.shuoshuo] 段内的那一行。
  const re = /(\[params\.shuoshuo\][\s\S]*?\n)    source = '[^']*'/;
  if (!re.test(orig)) throw new Error("未找到 [params.shuoshuo].source");
  writeFileSync(TOML, orig.replace(re, `$1    source = '${src}'`), "utf8");
}
function restore() {
  writeFileSync(TOML, orig, "utf8");
}

const run = (cmd, args) =>
  spawnSync(cmd, args, { stdio: "pipe", encoding: "utf8", shell: process.platform === "win32" });

const NODE = process.execPath;

for (const src of ["local", "tg", "api"]) {
  setSource(src);
  console.log(`\n${"=".repeat(60)}\n== source = ${src}\n${"=".repeat(60)}`);
  const b = run("node", ["tools/build.mjs", "--no-pf"]);
  const pages = (b.stdout.match(/Pages\s*│\s*(\d+)/) || [])[1];
  const ok = /✓ 构建完成/.test(b.stdout);
  console.log(`  build: pages=${pages} ok=${ok}`);
  if (!ok) { console.log(b.stdout.slice(-800)); continue; }

  const html = readFileSync("public/shuoshuo/index.html", "utf8");
  const m = html.match(/data-source="([^"]+)"/);
  const cards = (html.match(/class="shuoshuo-card /g) || []).length;
  console.log(`  rendered: data-source=${m ? m[1] : "?"}  server-side cards=${cards}`);

  // 启动 server 做浏览器验证
  run("powershell", ["-NoProfile", "-Command", "Get-Process hugo -ErrorAction SilentlyContinue | Stop-Process -Force"]);
  const srv = spawnSync("powershell", ["-NoProfile", "-Command",
    "Start-Process hugo -ArgumentList 'server','-D','--port','1313','--bind','127.0.0.1' -WindowStyle Hidden; Start-Sleep -Seconds 8; 'started'"],
    { encoding: "utf8" });
  const v = spawnSync(NODE, ["tools/probes/verify-tg.mjs"], { encoding: "utf8" });
  const out = v.stdout || "";
  const grab = (k) => (out.match(new RegExp(`"${k}":\\s*"?([^",\\n]+)"?`)) || [])[1];
  console.log(`  browser: source=${grab("feedSource")} state=${grab("feedState")} cards=${grab("cards")} images=${grab("images")}`);
  const errs = out.match(/JS 异常：(.+)/);
  console.log(`  JS 异常: ${errs ? errs[1] : "?"}`);
  const tgCalls = out.match(/tg-api 请求 (\d+) 次/);
  if (tgCalls) console.log(`  tg-api 请求: ${tgCalls[1]}`);
}

restore();
run("powershell", ["-NoProfile", "-Command", "Get-Process hugo -ErrorAction SilentlyContinue | Stop-Process -Force"]);
console.log("\n配置已还原；server 已关闭。");
