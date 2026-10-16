#!/usr/bin/env node
/*
 * 友链工作流核心逻辑（零依赖）
 *
 * 只做三件事：
 *   ① 收录：议题被关闭 → 把表单字段转成 YAML 代码块贴到评论里，站长自己复制粘贴
 *   ② 下线：议题打开 + 有「失效」标签 → 把该友链移进「失效暂留」分组，并在条目上方写明原位置
 *   ③ 恢复：议题关闭 + 没有「失效」标签 + 该友链正在「失效暂留」里 → 迁回注释里记录的原位置
 *
 * 子命令：
 *   handle       GitHub Actions 入口：读议题 / 评论 JSON，自动决策并改文件
 *   fix-counts   校正各分组 desc / badge 计数与友链页的「N 位友人」
 *   fcircle      生成 static/fcircle.json（给「友链朋友圈」聚合器的二维数组）
 *   offline      本地调试：把某个 url 的友链移进「失效暂留」
 *   restore      本地调试：把某个 url 的友链从「失效暂留」迁回原位置
 *   yaml         本地调试：打印某个议题 JSON 对应的 YAML 片段
 *   show         本地调试：打印各分组的站点计数
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LINKS_REL = "data/links.yaml";
const LINKPAGE_REL = "content/link.md";
const GRAVEYARD_SHORT = "失效暂留";
const BAD_LABELS = ["失效", "失联", "不适配"]; // 「失效」为主，顺带兼容旧叫法
const LABEL_APPLY = "友链申请";
const ORIGIN_PREFIX = "# 原位置：";
const YAML_MARKER = "<!-- friend-link-yaml -->";

/* ────────────────────────── 通用工具 ────────────────────────── */

const readText = (file) => fs.readFileSync(file, "utf8");

function writeText(file, text) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, text, "utf8");
}

function splitEol(text) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  return { eol, lines: text.replace(/\r\n/g, "\n").split("\n") };
}

const joinEol = (lines, eol) => lines.join(eol);

/** 去掉 emoji / 空白 / 标点 / 大小写差异，用于中文简称的模糊匹配 */
function normKey(input) {
  return String(input ?? "")
    .normalize("NFKC")
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\u{FE0F}\u{200D}\u{20E3}]/gu, "")
    .replace(/[\s\p{P}\p{S}]/gu, "")
    .toLowerCase();
}

/** YAML 标量安全序列化：需要引号时用单引号并转义内部单引号 */
function yamlScalar(value) {
  const s = String(value ?? "")
    .replace(/\r?\n/g, " ")
    .trim();
  if (s === "") return "''";
  const looksNumeric = /^[-+]?(\d+\.?\d*|\.\d+)$/.test(s);
  const looksKeyword = /^(true|false|null|yes|no|on|off|~|\*|&)$/i.test(s);
  const needsQuote =
    looksNumeric ||
    looksKeyword ||
    /^[\s!&*?|>%@`"'#[\]{},-]/.test(s) ||
    /:\s/.test(s) ||
    /\s#/.test(s) ||
    /[:#]\s*$/.test(s) ||
    /\s$/.test(s);
  if (!needsQuote) return s;
  return "'" + s.replace(/'/g, "''") + "'";
}

function yamlUnquote(value) {
  const s = String(value ?? "").trim();
  if (s.length >= 2 && s.startsWith("'") && s.endsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) return s.slice(1, -1).replace(/\\"/g, '"');
  return s;
}

const normUrl = (url) =>
  String(url ?? "")
    .trim()
    .replace(/^<|>$/g, "")
    .replace(/\/+$/, "")
    .toLowerCase();

/* ────────────────────────── links.yaml 结构操作 ────────────────────────── */

function parseGroups(lines) {
  const groups = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^- title:\s*(.*)$/);
    if (!m) continue;
    groups.push({ title: yamlUnquote(m[1].trim()), start: i, end: lines.length, sitesLine: null });
  }
  const tombstoneAt = lines.findIndex((l) => /^tombstone:/.test(l));
  for (let g = 0; g < groups.length; g++) {
    groups[g].end = groups[g + 1] ? groups[g + 1].start : tombstoneAt === -1 ? lines.length : tombstoneAt;
    for (let i = groups[g].start; i < groups[g].end; i++) {
      if (/^\s{2}sites:\s*$/.test(lines[i])) {
        groups[g].sitesLine = i;
        break;
      }
    }
    groups[g].count = countSites(lines, groups[g]);
  }
  return groups;
}

function countSites(lines, group) {
  let n = 0;
  for (let i = group.start; i < group.end; i++) if (/^\s{2}- name:/.test(lines[i])) n++;
  return n;
}

const isGraveyard = (title) => normKey(title).includes(normKey(GRAVEYARD_SHORT));

/** 解析 data/links.yaml 文本为 { total, groups } */
export function inspectLinks(text) {
  const { lines } = splitEol(text);
  const groups = parseGroups(lines);
  return {
    total: groups.reduce((acc, g) => acc + g.count, 0),
    groups: groups.map((g) => ({ title: g.title, count: g.count })),
  };
}

/** 按中文简称定位分组；命中多个或零个都返回错误 */
function locateGroup(lines, shortName) {
  const groups = parseGroups(lines);
  const q = normKey(shortName);
  if (!q) return { error: "分组名为空" };
  const hits = groups.filter((g) => {
    const t = normKey(g.title);
    return t === q || t.includes(q);
  });
  if (hits.length === 1) return { group: hits[0] };
  if (hits.length === 0) return { error: `在 data/links.yaml 中找不到分组「${shortName}」` };
  return { error: `「${shortName}」同时匹配到多个分组：${hits.map((h) => h.title).join(" / ")}` };
}

/** 在分组内按 url 找条目，返回 [起始行, 结束行) 与字段 */
function findSite(lines, group, url) {
  const target = normUrl(url);
  const starts = [];
  for (let i = group.start; i < group.end; i++) if (/^\s{2}- name:/.test(lines[i])) starts.push(i);
  starts.push(group.end);
  for (let k = 0; k < starts.length - 1; k++) {
    const s = starts[k];
    let e = starts[k + 1];
    const fields = {};
    for (let j = s; j < e; j++) {
      const nm = lines[j].match(/^\s{2}- name:\s*(.*)$/);
      if (nm) fields.name = yamlUnquote(nm[1]);
      const um = lines[j].match(/^\s{4}url:\s*(.*)$/);
      if (um) fields.url = yamlUnquote(um[1]);
    }
    if (fields.url && normUrl(fields.url) === target) {
      while (e > s && lines[e - 1].trim() === "") e--;
      return { start: s, end: e, fields };
    }
  }
  return null;
}

/** 全文件按 url 查找，附带所属分组标题 */
function findSiteAnywhere(lines, url) {
  for (const group of parseGroups(lines)) {
    const found = findSite(lines, group, url);
    if (found) return { ...found, groupTitle: group.title };
  }
  return null;
}

/** 读取条目上方一行「# 原位置：...」注释 */
function readOriginComment(lines, found) {
  const idx = found.start - 1;
  if (idx < 0) return null;
  const m = lines[idx].match(/^\s*#\s*原位置：\s*(.+?)\s*$/);
  return m ? { index: idx, title: yamlUnquote(m[1]) } : null;
}

/** 分组末尾插入点：跳过尾部空行 */
function insertionIndex(lines, group) {
  let at = group.end;
  while (at > group.start && lines[at - 1].trim() === "") at--;
  return at;
}

const siteBlockLines = (site) => [
  `  - name: ${yamlScalar(site.name)}`,
  `    url: ${yamlScalar(site.url)}`,
  `    avatar: ${yamlScalar(site.avatar)}`,
  `    desc: ${yamlScalar(site.desc)}`,
  `    siteshot: ${yamlScalar(site.siteshot)}`,
  `    linkPage: ${yamlScalar(site.linkPage)}`,
];

/** 可直接粘贴进 data/links.yaml 的 YAML 片段 */
export const renderYamlSnippet = (site) => siteBlockLines(site).join("\n");

function appendBlock(lines, group, block) {
  const at = insertionIndex(lines, group);
  const payload = group.sitesLine === null && group.count === 0 ? ["  sites:", ...block] : block;
  lines.splice(at, 0, ...payload);
}

/* ────────────────────────── 计数同步 ────────────────────────── */

/** 同步每个分组的 desc / badge 计数 */
export function syncGroupCounts(text) {
  const { eol, lines } = splitEol(text);
  for (const g of parseGroups(lines)) {
    const count = countSites(lines, g);
    for (let i = g.start; i < g.end; i++) {
      if (/^\s{2}desc:\s*这里有\s*\d+\s*个正在发光的小站点。\s*$/.test(lines[i])) {
        lines[i] = lines[i].replace(/(这里有\s*)\d+(\s*个正在发光的小站点。)/, `$1${count}$2`);
      }
      if (/^\s{2}badge:\s*\d+\s*sites\s*$/.test(lines[i])) {
        lines[i] = lines[i].replace(/^(\s{2}badge:\s*)\d+(\s*sites)\s*$/, `$1${count}$2`);
      }
    }
  }
  return joinEol(lines, eol);
}

/** 同步 content/link.md 的 hero badge 数字 */
export function syncHeroBadges(text, { total, groups }) {
  return text
    .replace(/(text:\s*"?)\d+(\s*位友人"?)/, `$1${total}$2`)
    .replace(/(text:\s*"?)\d+(\s*个分组"?)/, `$1${groups}$2`);
}

/* ────────────────────────── fcircle.json 生成 ────────────────────────── */

// 只把「个人博客」类分组写进 fcircle.json。这个文件一般喂给「友链朋友圈」聚合器去爬 RSS：
//   - 「失效暂留」里的站点已经挂了，爬不到东西；
//   - 「博客组织 / 推荐网站 / 网站搭建 / 平时常用」是目录站、平台站和后台控制台
//     （GitHub、Gitee、阿里云控制台、百度站长…），根本不是博客，喂进去只会爬出垃圾。
// 想调整就改这个数组，或用 `fcircle --exclude "分组A,分组B"` 覆盖。
const FCIRCLE_EXCLUDE = ["失效暂留", "博客组织", "推荐网站", "网站搭建", "平时常用"];

/** 把 links.yaml 转成 friend.json 的二维数组：[[名称, 友链链接, 友链页, 头像], ...] */
export function buildFcircleRows(text, exclude = FCIRCLE_EXCLUDE) {
  const { lines } = splitEol(text);
  const skip = exclude.map((n) => normKey(n)).filter(Boolean);
  const rows = [];
  for (const group of parseGroups(lines)) {
    const groupKey = normKey(group.title);
    if (skip.some((s) => groupKey.includes(s))) continue;

    const starts = [];
    for (let i = group.start; i < group.end; i++) if (/^\s{2}- name:/.test(lines[i])) starts.push(i);
    starts.push(group.end);

    for (let k = 0; k < starts.length - 1; k++) {
      const fields = { name: "", url: "", avatar: "", linkPage: "" };
      for (let j = starts[k]; j < starts[k + 1]; j++) {
        const nm = lines[j].match(/^\s{2}- name:\s*(.*)$/);
        if (nm) {
          fields.name = yamlUnquote(nm[1]);
          continue;
        }
        const kv = lines[j].match(/^\s{4}(url|avatar|linkPage|siteshot):\s*(.*)$/);
        if (kv && kv[1] in fields) fields[kv[1]] = yamlUnquote(kv[2]);
      }
      if (!fields.url) continue; // 没有链接的条目对聚合器毫无意义
      // 与参考格式一致：缺友链页写 null；头像取 avatar，不是封面 siteshot
      rows.push([fields.name, fields.url, fields.linkPage || null, fields.avatar || null]);
    }
  }
  return rows;
}

/** 渲染成 JSON：每条一行，便于 git diff 查看增删 */
export function renderFcircle(rows) {
  if (rows.length === 0) return '{\n  "friends": []\n}\n';
  const body = rows.map((r) => `    ${JSON.stringify(r)}`).join(",\n");
  return `{\n  "friends": [\n${body}\n  ]\n}\n`;
}

/* ────────────────────────── Issue 表单解析 ────────────────────────── */

const FIELD_ALIASES = {
  站点名称: "name",
  名称: "name",
  站点名: "name",
  name: "name",
  站点地址: "url",
  站点链接: "url",
  地址: "url",
  网址: "url",
  链接: "url",
  url: "url",
  link: "url",
  头像地址: "avatar",
  头像: "avatar",
  头像链接: "avatar",
  avatar: "avatar",
  一句话描述: "desc",
  站点描述: "desc",
  描述: "desc",
  简介: "desc",
  站点简介: "desc",
  desc: "desc",
  descr: "desc",
  站点截图: "siteshot",
  截图: "siteshot",
  首页截图: "siteshot",
  siteshot: "siteshot",
  友链页链接: "linkPage",
  友链页: "linkPage",
  友链页面: "linkPage",
  友链页地址: "linkPage",
  linkpage: "linkPage",
};

const NO_RESPONSE = /^_?\s*(no response|无响应|未填写)\s*_?$/i;

/** 把表单里的 ### 小标题解析成字段名：先精确匹配，再退化为最长前缀匹配 */
function resolveFieldKey(heading) {
  const key = normKey(String(heading).replace(/\*+$/, ""));
  if (!key) return null;
  if (FIELD_ALIASES[key]) return FIELD_ALIASES[key];
  let best = null;
  for (const alias of Object.keys(FIELD_ALIASES)) {
    if (key.startsWith(alias) && (best === null || alias.length > best.length)) best = alias;
  }
  return best ? FIELD_ALIASES[best] : null;
}

const isBlankValue = (v) => String(v ?? "").trim() === "" || NO_RESPONSE.test(String(v ?? "").trim());

function stripMarkdown(value) {
  return String(value ?? "")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/^\s*[-*+]\s+/, "")
    .trim();
}

const cleanText = (v) =>
  stripMarkdown(String(v ?? "").replace(/\s*\n\s*/g, " ").replace(/^\s*[-*]\s*\[[ xX]\]\s*/, ""));

// URL 允许的字符：排除空白、中英文括号引号，以及全角标点 / CJK 字符
const URL_PATTERN =
  /https?:\/\/[^\s<>"'`\u2000-\u206F\u3000-\u303F\uFF00-\uFFEF\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]+/i;

function cleanUrl(value) {
  if (isBlankValue(value)) return "";
  let s = cleanText(value).replace(/^`+|`+$/g, "").trim();
  const m = s.match(URL_PATTERN);
  if (m) s = m[0];
  return s.replace(/[）)\]}>。，、；;"'`]+$/g, "").trim();
}

/** 解析 Issue 正文：优先按 ### 小标题分段，兜底扫 key: value 行 */
export function parseIssueBody(body) {
  const lines = String(body ?? "").replace(/\r\n/g, "\n").split("\n");
  const out = {};
  let current = null;
  let buffer = [];
  const flush = () => {
    if (!current) return;
    const value = buffer.join("\n").trim();
    if (out[current] === undefined && !isBlankValue(value)) out[current] = value;
  };
  for (const raw of lines) {
    const heading = raw.match(/^#{1,6}\s+(.*?)\s*$/);
    if (heading) {
      flush();
      current = resolveFieldKey(heading[1]);
      buffer = [];
      continue;
    }
    if (current) buffer.push(raw);
  }
  flush();

  if (Object.keys(out).length === 0) {
    for (const raw of lines) {
      const kv = raw.match(/^\s*([A-Za-z_]{2,12}|[\p{Script=Han}]{2,8})\s*[:：]\s*(\S.*?)\s*$/u);
      if (!kv) continue;
      const key = resolveFieldKey(kv[1]);
      if (key && out[key] === undefined && !isBlankValue(kv[2])) out[key] = kv[2].trim();
    }
  }
  return out;
}

export const buildSite = (fields) => ({
  name: cleanText(fields.name),
  url: cleanUrl(fields.url),
  avatar: cleanUrl(fields.avatar),
  desc: cleanText(fields.desc),
  siteshot: cleanUrl(fields.siteshot),
  linkPage: cleanUrl(fields.linkPage),
});

/* ────────────────────────── 文件级操作 ────────────────────────── */

function loadContext(opts) {
  const root = path.resolve(opts.root || ".");
  return {
    root,
    linksPath: path.resolve(root, opts.links || LINKS_REL),
    linkPagePath: path.resolve(root, opts.linkpage || LINKPAGE_REL),
  };
}

/** 写回 links.yaml，并顺带校正 content/link.md 的 hero badge */
function commitChanges(ctx, linksText) {
  const info = inspectLinks(linksText);
  const linksChanged = readText(ctx.linksPath) !== linksText;
  if (linksChanged) writeText(ctx.linksPath, linksText);

  let heroChanged = false;
  if (fs.existsSync(ctx.linkPagePath)) {
    const pageText = readText(ctx.linkPagePath);
    const synced = syncHeroBadges(pageText, { total: info.total, groups: info.groups.length });
    if (synced !== pageText) {
      writeText(ctx.linkPagePath, synced);
      heroChanged = true;
    }
  }
  return { info, linksChanged, heroChanged, changed: linksChanged || heroChanged };
}

/** 下线：把该友链移进「失效暂留」，并在条目上方写明原位置 */
function doOffline(ctx, url) {
  const { eol, lines } = splitEol(readText(ctx.linksPath));
  const located = locateGroup(lines, GRAVEYARD_SHORT);
  if (located.error) return { ok: false, message: located.error };

  const current = findSiteAnywhere(lines, url);
  if (!current) return { ok: false, message: `在 data/links.yaml 中找不到 url 为 ${url} 的友链条目` };
  if (isGraveyard(current.groupTitle)) {
    return { ok: true, changed: false, message: `「${current.fields.name || url}」已经在「${current.groupTitle}」里了。` };
  }

  const originTitle = current.groupTitle;
  const block = lines.slice(current.start, current.end);
  lines.splice(current.start, current.end - current.start);

  const refreshed = parseGroups(lines);
  const target = refreshed.filter((g) => isGraveyard(g.title));
  if (target.length !== 1) return { ok: false, message: `重新定位「${GRAVEYARD_SHORT}」分组失败` };
  appendBlock(lines, target[0], [`  ${ORIGIN_PREFIX}${originTitle}`, ...block]);

  const stat = commitChanges(ctx, syncGroupCounts(joinEol(lines, eol)));
  return {
    ok: true,
    changed: stat.changed,
    name: current.fields.name || url,
    from: originTitle,
    to: target[0].title,
    message: `已将「${current.fields.name || url}」从「${originTitle}」移入「${target[0].title}」。`,
  };
}

/** 恢复：把该友链从「失效暂留」迁回注释里记录的原位置 */
function doRestore(ctx, url) {
  const { eol, lines } = splitEol(readText(ctx.linksPath));
  const current = findSiteAnywhere(lines, url);
  if (!current) return { ok: false, message: `在 data/links.yaml 中找不到 url 为 ${url} 的友链条目` };
  if (!isGraveyard(current.groupTitle)) {
    return { ok: true, changed: false, message: `「${current.fields.name || url}」不在「${GRAVEYARD_SHORT}」里，无需恢复。` };
  }

  const origin = readOriginComment(lines, current);
  if (!origin) {
    return {
      ok: false,
      message: `「${current.fields.name || url}」上方没有「${ORIGIN_PREFIX}」注释，无法确定放回哪个分组，请手动处理`,
    };
  }

  const targetShort = origin.title;
  const name = current.fields.name || url;
  const fromTitle = current.groupTitle;
  const block = lines.slice(current.start, current.end);
  lines.splice(origin.index, current.end - origin.index); // 连注释一起摘掉

  const located = locateGroup(lines, targetShort);
  if (located.error) return { ok: false, message: located.error };
  if (isGraveyard(located.group.title)) return { ok: false, message: `记录的原位置本身就是「${located.group.title}」` };
  appendBlock(lines, located.group, block);

  const stat = commitChanges(ctx, syncGroupCounts(joinEol(lines, eol)));
  return {
    ok: true,
    changed: stat.changed,
    name,
    from: fromTitle,
    to: located.group.title,
    message: `已将「${name}」从「${fromTitle}」迁回「${located.group.title}」。`,
  };
}

/* ────────────────────────── handle：GitHub Actions 入口 ────────────────────────── */

function emitOutputs(pairs) {
  const target = process.env.GITHUB_OUTPUT;
  if (!target) return;
  const chunks = [];
  for (const [key, value] of Object.entries(pairs)) {
    const text = String(value);
    if (text.includes("\n")) {
      const token = `EOL_${Math.random().toString(36).slice(2, 10)}`;
      chunks.push(`${key}<<${token}\n${text}\n${token}`);
    } else {
      chunks.push(`${key}=${text}`);
    }
  }
  fs.appendFileSync(target, chunks.join("\n") + "\n", "utf8");
}

function parseJsonFile(file) {
  let data;
  try {
    data = JSON.parse(readText(file));
  } catch (error) {
    throw new Error(`无法解析 JSON 文件 ${file}：${error.message}`);
  }
  // gh api --paginate --slurp 会把多页结果包成「数组的数组」
  if (Array.isArray(data) && data.length > 0 && Array.isArray(data[0])) data = data.flat();
  return data;
}

const hasYamlMarker = (comments) =>
  (Array.isArray(comments) ? comments : []).some(
    (c) => c && typeof c.body === "string" && c.body.includes(YAML_MARKER),
  );

function renderYamlComment(site) {
  return [
    "下面是本议题解析出的友链数据，复制整段粘贴到 `data/links.yaml` 里**目标分组的 `sites:` 列表末尾**即可：",
    "",
    "```yaml",
    renderYamlSnippet(site),
    "```",
    "",
    "粘贴后直接提交推送即可 —— `Friend Link Fix Counts` 工作流会自动把各分组的" +
      "「N 个正在发光的小站点。」「N sites」和友链页的「N 位友人」对齐并重新部署。" +
      "想在本机先看效果也可以跑 `node tools/friend-link.mjs fix-counts`。",
    "",
    "> 若不打算收录这条友链，忽略本条评论即可。",
    "",
    YAML_MARKER,
  ].join("\n");
}

function cmdHandle(opts) {
  const ctx = loadContext(opts);
  const issue = parseJsonFile(opts.issue);
  const comments = parseJsonFile(opts.comments);
  const labels = (issue.labels || []).map((l) => (typeof l === "string" ? l : l.name));
  const state = String(issue.state || "").toLowerCase();
  const hasBadLabel = labels.some((l) => BAD_LABELS.includes(l));
  const site = buildSite(parseIssueBody(issue.body || ""));

  const result = {
    action: "noop",
    changed: false,
    comment: "",
    issue: issue.number ?? null,
    url: site.url,
    name: site.name,
    summary: "",
  };

  const finish = () => {
    const tidy = result.comment.trim();
    result.comment = tidy;
    if (opts.result) writeText(opts.result, JSON.stringify(result, null, 2));
    if (opts.commentfile) writeText(opts.commentfile, tidy ? `${tidy}\n` : "");
    emitOutputs({
      action: result.action,
      changed: String(result.changed),
      has_comment: String(tidy.length > 0),
      summary: result.summary,
    });
    process.stdout.write(
      `[friend-link] action=${result.action} changed=${result.changed} issue=#${result.issue}\n${result.summary}\n`,
    );
    if (tidy) process.stdout.write(`[friend-link] comment:\n${tidy}\n`);
  };

  const fail = (prefix, message) => {
    result.summary = message;
    result.comment = `> ⚠️ ${prefix}：${message}`;
    return finish();
  };

  let current = null;
  if (site.url) current = findSiteAnywhere(splitEol(readText(ctx.linksPath)).lines, site.url);
  const inGraveyard = current ? isGraveyard(current.groupTitle) : false;

  // ① 下线：议题打开 + 带「失效」标签
  if (state === "open" && hasBadLabel) {
    if (!current) {
      result.summary = "该议题对应的友链不在 data/links.yaml 中，跳过下线。";
      return finish();
    }
    if (inGraveyard) {
      result.summary = "该友链已经在「失效暂留」里了，无需重复下线。";
      return finish();
    }
    const outcome = doOffline(ctx, site.url);
    if (!outcome.ok) return fail("下线失败", outcome.message);
    result.action = "offline";
    result.changed = outcome.changed;
    result.summary = outcome.message;
    result.comment = [
      `> ⚠️ 已把「${outcome.name}」从「${outcome.from}」移入「${outcome.to}」。`,
      ">",
      "> 站点恢复后，摘掉 `失效` 标签并关闭本议题，我会把它放回原来的位置。",
    ].join("\n");
    return finish();
  }

  // ② 恢复：议题已关闭 + 没有「失效」标签 + 该友链正在「失效暂留」里
  if (state === "closed" && !hasBadLabel && inGraveyard) {
    const outcome = doRestore(ctx, site.url);
    if (!outcome.ok) return fail("恢复失败", outcome.message);
    result.action = "restore";
    result.changed = outcome.changed;
    result.summary = outcome.message;
    if (outcome.changed) {
      result.comment = `> ✅ 已把「${outcome.name}」从「${outcome.from}」迁回原位置「${outcome.to}」。`;
    }
    return finish();
  }

  // ③ 收录：议题已关闭 + 没有「失效」标签 + 还没输出过 YAML
  if (state === "closed" && !hasBadLabel && !inGraveyard && !hasYamlMarker(comments)) {
    if (!site.url || !site.name) {
      result.summary = "议题已关闭，但正文里解析不到站点名称 / 站点地址，跳过。";
      return finish();
    }
    result.action = "emit-yaml";
    result.summary = "已把友链数据贴成 YAML 代码块，等待站长复制粘贴。";
    result.comment = renderYamlComment(site);
    return finish();
  }

  result.summary =
    state === "closed" ? "议题已关闭，当前状态无需改动友链数据。" : "议题未关闭或未带「失效」标签，无需改动友链数据。";
  return finish();
}

/* ────────────────────────── CLI ────────────────────────── */

function parseArgv(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) opts[key] = true;
      else {
        opts[key] = next;
        i++;
      }
    } else opts._.push(token);
  }
  return opts;
}

function printCounts(ctx) {
  const info = inspectLinks(readText(ctx.linksPath));
  for (const g of info.groups) process.stdout.write(`${String(g.count).padStart(4)}  ${g.title}\n`);
  process.stdout.write(`合计 ${info.total} 个站点 / ${info.groups.length} 个分组\n`);
  return info;
}

function cmdFcircle(opts, ctx) {
  const outPath = path.resolve(ctx.root, opts.out || "static/fcircle.json");
  const exclude =
    typeof opts.exclude === "string" && opts.exclude.trim()
      ? opts.exclude.split(",").map((s) => s.trim()).filter(Boolean)
      : FCIRCLE_EXCLUDE;
  const rows = buildFcircleRows(readText(ctx.linksPath), exclude);
  const json = renderFcircle(rows);
  const before = fs.existsSync(outPath) ? readText(outPath) : null;
  const changed = before !== json;
  if (changed) writeText(outPath, json);
  process.stdout.write(
    `fcircle.json：${rows.length} 条友链，${changed ? "内容有变化，已写入" : "内容无变化，未改动"} → ${path.relative(ctx.root, outPath) || outPath}\n`,
  );
  process.stdout.write(`已排除的分组：${exclude.join(" / ")}\n`);
  return rows;
}

function main() {
  const opts = parseArgv(process.argv.slice(2));
  const command = opts._[0] || "show";
  const ctx = loadContext(opts);

  if (command === "handle") {
    if (!opts.issue || !opts.comments) throw new Error("handle 需要 --issue 与 --comments");
    cmdHandle(opts);
    return;
  }
  if (command === "show") {
    printCounts(ctx);
    return;
  }
  if (command === "fix-counts") {
    const stat = commitChanges(ctx, syncGroupCounts(readText(ctx.linksPath)));
    printCounts(ctx);
    process.stdout.write(stat.changed ? "已写回文件。\n" : "计数本来就是对的，文件无变化。\n");
    return;
  }
  if (command === "fcircle") {
    cmdFcircle(opts, ctx);
    return;
  }
  if (command === "yaml") {
    if (!opts.issue) throw new Error("yaml 需要 --issue <议题 JSON 路径>");
    const site = buildSite(parseIssueBody(parseJsonFile(opts.issue).body || ""));
    process.stdout.write(renderYamlSnippet(site) + "\n");
    return;
  }
  if (command === "offline") {
    const outcome = doOffline(ctx, opts.url);
    process.stdout.write(`${outcome.ok ? "OK" : "FAIL"} changed=${Boolean(outcome.changed)} ${outcome.message}\n`);
    process.exitCode = outcome.ok ? 0 : 1;
    return;
  }
  if (command === "restore") {
    const outcome = doRestore(ctx, opts.url);
    process.stdout.write(`${outcome.ok ? "OK" : "FAIL"} changed=${Boolean(outcome.changed)} ${outcome.message}\n`);
    process.exitCode = outcome.ok ? 0 : 1;
    return;
  }
  throw new Error(`未知子命令：${command}`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`[friend-link] error: ${error.message}\n`);
    process.exitCode = 1;
  }
}
