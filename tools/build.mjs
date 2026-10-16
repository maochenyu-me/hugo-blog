#!/usr/bin/env node
/**
 * 干净构建脚本 —— 解决 hugo --gc 不清理旧 fingerprint 变体的问题。
 *
 * 背景：
 *   Hugo 的 fingerprint 会给 assets/css/site.css 生成带内容哈希的文件名
 *   （site.min.<hash>.css）。改 CSS 后新哈希生成，但**旧哈希文件不会被删除**，
 *   `hugo --gc` 也不管它们。结果是 public/css/ 里堆着多份 site.min.*.css，
 *   用 grep 全局扫描会误判「修复没生效」。
 *
 * 做法：
 *   构建前把 public/ 整个删掉再重建 —— 这是唯一可靠的方式。
 *   （只删 public/，不碰 resources/ 缓存，构建依然很快。）
 *
 * 用法：
 *   node tools/build.mjs          # 删 public → hugo -D → pagefind
 *   node tools/build.mjs --no-pf  # 跳过 pagefind
 *   node tools/build.mjs --prod   # 不带 -D（不含草稿）
 */
import { rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = resolve(ROOT, "public");

const args = process.argv.slice(2);
const skipPagefind = args.includes("--no-pf");
const prod = args.includes("--prod");

const run = (cmd, cmdArgs, label) => {
  console.log(`\n▶ ${label}`);
  const r = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    console.error(`\n✗ ${label} 失败 (exit ${r.status})`);
    process.exit(r.status ?? 1);
  }
};

// 1) 清掉整个 public —— 根治旧 fingerprint 残留
if (existsSync(PUBLIC)) {
  process.stdout.write("▶ 清理 public/ … ");
  rmSync(PUBLIC, { recursive: true, force: true });
  console.log("done");
} else {
  console.log("▶ public/ 不存在，跳过清理");
}

// 2) Hugo 构建
const hugoArgs = ["--gc", "--logLevel", "warn"];
if (!prod) hugoArgs.unshift("-D"); // 项目约定：本地构建含草稿
run("hugo", hugoArgs, `hugo ${hugoArgs.join(" ")}`);

// 3) pagefind 搜索索引
if (skipPagefind) {
  console.log("\n▶ 跳过 pagefind（--no-pf）");
} else {
  // 优先用本地依赖（npm ci 安装的 node_modules/.bin/pagefind），
  // 缺失时回退到 npx 现下载，保证本地首次运行也能跑通。
  const localBin = resolve(
    ROOT,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "pagefind.cmd" : "pagefind",
  );
  const useLocal = existsSync(localBin);
  const pf = useLocal
    ? spawnSync(localBin, ["--site", "public"], {
        cwd: ROOT,
        stdio: "inherit",
        shell: process.platform === "win32",
      })
    : spawnSync("npx", ["--yes", "pagefind", "--site", "public"], {
        cwd: ROOT,
        stdio: "inherit",
        shell: process.platform === "win32",
      });
  if (pf.status !== 0) {
    console.warn("\n⚠ pagefind 失败（搜索索引缺失，不影响其余页面）");
  }
}

// 4) 自检：public/css 下每个 site.min.*.css 必须被某个 HTML 引用
//
// 说明：本脚本已在上一步清空 public/，所以正常情况下不可能有孤儿。
// 这个自检的价值在于「兜底」—— 若构建过程中有别的进程/旧 resources 缓存
// 把带旧哈希的 CSS 又塞回 public/，或是未来 Hugo 行为变化导致残留，这里会报错。
// 属于廉价保险，不是主要防线（主要防线是前面的 rm -rf public）。
import { readdirSync, readFileSync } from "node:fs";
const cssDir = resolve(PUBLIC, "css");
if (existsSync(cssDir)) {
  const cssFiles = readdirSync(cssDir).filter((f) => /site\.min\..*\.css$/.test(f));
  const referenced = new Set();
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".html")) {
        const html = readFileSync(p, "utf8");
        for (const m of html.matchAll(/site\.min\.([a-f0-9]+)\.css/g)) referenced.add(m[1]);
      }
    }
  };
  walk(PUBLIC);
  const orphans = cssFiles.filter((f) => {
    const h = f.match(/site\.min\.([a-f0-9]+)\.css/)?.[1];
    return h && !referenced.has(h);
  });
  console.log(`\n▶ 自检 public/css：${cssFiles.length} 个 site.min 文件，被引用 ${referenced.size} 个`);
  if (orphans.length) {
    console.error(`  ✗ 发现 ${orphans.length} 个孤儿 CSS（不应存在）：`);
    orphans.forEach((f) => console.error(`    - ${f}`));
    process.exit(1);
  }
  console.log("  ✓ 无孤儿 CSS 残留");
  // 反向检查：被引用的 CSS 必须真实存在（防断裂引用）
  const missing = [...referenced].filter(
    (h) => !existsSync(resolve(cssDir, `site.min.${h}.css`))
  );
  if (missing.length) {
    console.error(`  ✗ 有 ${missing.length} 个被 HTML 引用的 CSS 不存在（断裂引用）：`);
    missing.forEach((h) => console.error(`    - site.min.${h}.css`));
    process.exit(1);
  }
  console.log("  ✓ 所有被引用的 CSS 均存在");
}

console.log("\n✓ 构建完成\n");
