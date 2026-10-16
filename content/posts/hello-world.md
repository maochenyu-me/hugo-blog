---
# ── 标识 ──────────────────────────────────────────────────────────────
# slug：决定文章永久链接 /posts/<slug>/（hugo.toml 的 [permalinks] posts = '/posts/:slug/'）
#       留空则回退到文件名；源站用 8 位 hash，本主题沿用同一风格
slug: "hello-world"
title: "Hello World：欢迎来到 kemiao"

# ── 时间 ──────────────────────────────────────────────────────────────
# date / lastmod 必须带时区（+08:00）。不带时区会被 Hugo 当 UTC 处理，
# 本地构建时可能被「未来时间过滤」静默跳过，页面直接不生成。
# 另外：date 若晚于当前时间，Hugo 默认也不构建（需 --buildFuture），
#       所以发布时间要写成「此刻或更早」。
date: 2026-10-15T10:00:00+08:00
lastmod: 2026-10-15T10:00:00+08:00

# draft: true 时仅 `hugo -D` 或 `hugo server -D` 可见
draft: false

# ── 摘要与 SEO ────────────────────────────────────────────────────────
# description：SEO meta description / og:description；也是 AI 摘要卡的回退文案
description: "kemiao 是一套移植自 blog.liushen.fun 的 Hugo 博客主题，本文介绍它的能力、目录结构与全部文章级 frontmatter 字段。"

# aiSummary：文章页顶部「AI 摘要」卡片正文（打字机效果逐字输出）
#            不填则回退到 description
aiSummary: "这是一篇 hello world。kemiao 主题以毛玻璃质感为视觉基调，内置双搜索后端、双评论后端、中控台偏好设置、自定义右键菜单、说说动态流与外链安全跳转等能力。本文同时是一份文章 frontmatter 字段速查表。"

# ── 分类与标签 ────────────────────────────────────────────────────────
# categories：渲染为文章页左上角分类徽章，并生成 /categories/<term>/
categories: ["筑站手札"]
# tags：渲染为标题下方的 #标签，并生成 /tags/<term>/
tags: ["Hugo", "主题", "kemiao"]

# ── 封面 ──────────────────────────────────────────────────────────────
# cover：文章正文顶部的封面图。支持两种写法：
#   1) 站内路径 —— 放 static/imgs/posts/ 下，写 /imgs/posts/xxx.webp
#      （模板会校验文件是否存在，找不到就整块跳过，不会出现破图）
#   2) 远程 URL —— 直接写 https://... 原样输出
cover: "/imgs/posts/hello-world.webp"
---

你好，世界。👋

这是 **kemiao** —— 一套移植自 [blog.liushen.fun](https://blog.liushen.fun/)（Astro 站点）的 Hugo 博客主题。
它保留原作那份「毛玻璃 + 终端感」的视觉气质，同时把整套能力重新落到了 Hugo v0.166.0 的模板体系上。

这篇文章既是一次自我介绍，也是一份**文章 frontmatter 字段速查表**——上面那段 YAML 里的每个字段都会在正文里解释一遍。

## 它长什么样

三句话概括视觉基调：

- **毛玻璃质感**：吸顶导航、卡片、搜索弹窗都带 `backdrop-filter` 模糊
- **终端气质**：等宽字体做数字与代码，首页 Hero 是一条 `~/hello-world$` 提示符
- **亮暗双主题**：`light` / `dark` / `auto` 三档，`localStorage` 持久化，head 内联脚本防白闪

导航栏那个药丸高亮是带弹簧动画的，鼠标移过去会跟着拉伸——细节来自原作的 `header.js`。

## 能力一览

| 能力 | 说明 |
| --- | --- |
| 双搜索后端 | `pagefind`（静态索引，默认）或 `algolia`，配置切换 |
| 双评论后端 | `artalk` 或 `twikoo`，按 `provider` 分支渲染 |
| 中控台 | 右下角偏好面板：主题、字体、全屏、音乐胶囊等开关 |
| 自定义右键菜单 | 分区菜单，评论框内提供「引用」与「填写友链」 |
| 说说动态流 | 本地 `content/shuoshuo/` 或远程 memos API 双数据源 |
| 外链安全跳转 | 站外链接自动改写为 `/safego/?u=<base64>` 中转页 |
| 音乐胶囊 | APlayer + MetingJS 懒加载 |
| 文章增强 | TOC 滚动高亮、代码复制、AI 摘要打字、过期提醒、分享 |

### 关于外链

正文里的站外链接会被构建期改写。比如这个 [Hugo 官方文档](https://gohugo.io/) 的链接，
点开后会先落到 `/safego/` 中转页，倒计时结束再跳转——这是 `layouts/_markup/render-link.html` 这个
markdown hook 干的事，不需要你在正文里手写任何特殊语法。

## frontmatter 字段说明

下面按用途分组，逐个解释文章级字段。

### 标识与时间

| 字段 | 类型 | 作用 |
| --- | --- | --- |
| `slug` | string | 永久链接的末段，决定 `/posts/<slug>/` |
| `title` | string | 文章标题，同时用于 `<title>` 与 og 标签 |
| `date` | datetime | 发布日期，**必须带时区** |
| `lastmod` | datetime | 更新日期；大于 `date` 时文章页会多显示一个「更新于」 |
| `draft` | bool | `true` 时只在 `-D` 模式下渲染 |

> ⚠️ `date` 不带时区是个安静的坑：Hugo 会按 UTC 解析，若本地时区是 UTC+8，
> 一个「现在」的时间会变成 8 小时后的未来，被未来时间过滤掉，页面**不报错但也不生成**。
> 所以本项目约定内容文件的日期一律写成 `2026-10-15T17:00:00+08:00`。

### 摘要与 SEO

| 字段 | 类型 | 作用 |
| --- | --- | --- |
| `description` | string | SEO meta description；AI 摘要卡的回退文案 |
| `aiSummary` | string | AI 摘要卡片正文，打字机效果逐字输出 |

`aiSummary` 不填时自动回退到 `description`；两者都没有时，AI 摘要卡整块不渲染。
卡片右下角那行品牌与模型名来自 `hugo.toml` 的 `[params.article.aiSummary]`，不是文章级字段。

### 分类、标签与封面

| 字段 | 类型 | 作用 |
| --- | --- | --- |
| `categories` | []string | 分类徽章 + 生成 `/categories/<term>/` |
| `tags` | []string | `#` 标签 + 生成 `/tags/<term>/` |
| `cover` | string | 正文顶部封面图，站内路径或远程 URL |

`cover` 传站内路径时，模板会先校验文件是否存在（`resources.Get` + `fileExists` 双查），
找不到就跳过整个封面块。这是刻意的——宁可少一张图，也不要给控制台留一个 404。

### 不适用于文章页的字段

主题里另有一批 frontmatter 字段，但它们属于**其他页面类型**，写进文章里不会生效：

- **说说专用**（`content/shuoshuo/`）：`images`、`video`、`website`、`github`、`location`、`pinned`
- **关于页专用**（`content/about.md`）：`name`、`greeting`、`motto`、`avatar`、`floatsLeft`、`floatsRight`
- **独立页 hero**（`content/link.md` 等）：`hero`（含 `title` / `desc` / `gradient`）

## 怎么用它

最省事的路径是跑自带的构建脚本：

```bash
# 干净构建 + 搜索索引 + 自检（推荐）
node tools/build.mjs

# 本地预览
hugo server -D --port 1313
```

之所以推荐 `tools/build.mjs` 而不是裸跑 `hugo`，是因为 Hugo 的 fingerprint 机制有个坑：
改样式后会生成新的 `site.min.<hash>.css`，**旧哈希文件不会被删除**，`hugo --gc` 也不清理。
残留多了以后，用 grep 全局搜样式会误判「改动没生效」。这个脚本会在构建前整个清掉 `public/`，
并在构建后自检「无孤儿 CSS」与「无断裂引用」。

### 目录结构

```
blog/
├── hugo.toml            站点配置（主题经 [module.mounts] 手动挂载）
├── content/             内容
│   ├── posts/           文章
│   └── shuoshuo/        说说
├── data/                博客自有数据（导航/友链/赞赏…）
├── layouts/ assets/     项目级覆盖层（放同名文件即覆盖主题）
├── tools/               构建与验证脚本
└── themes/kemiao/       主题本体
```

覆盖层是 Hugo 的约定：根目录与主题同路径的文件优先。想改主题里某个 partial，
把 `themes/kemiao/layouts/partials/xxx.html` 拷到根目录同路径再改就行，主题源码保持原样。

## 关于移植

这套主题是照着 [blog.liushen.fun](https://blog.liushen.fun/) 的线上 DOM 与编译产物逐块搬过来的。
做法上有一处值得一提：**样式没有重写 Tailwind 源码，而是直接引用原站编译后的 CSS 产物**
（`footer.css` 203KB 是主样式包），剥掉 Astro 的 `data-astro-cid` 作用域标记后经 Hugo Pipes 处理。
这比重写一遍更能保证像素级还原。

代价是剥标记时得留神两件事，都踩过：

1. **构建产物路径要改**。原站 CSS 里的 `@font-face` 指向 `/_astro/fonts/*.woff2`，
   而字体文件搬到了 `static/fonts/`。不改这四处，四个自托管字体会全部 404 静默回退系统字体。
2. **作用域会变全局**。原本 Astro scoped 的规则（如归档页的 `.post-title{line-height:1.4}`）
   剥掉 cid 后会污染全站同名类，需要补回限定前缀。

## 最后

如果你正在读这篇的线上版本，那它本身就说明了主题是能跑的——
TOC 在右侧跟着滚动高亮，代码块有复制按钮，顶部那张封面图是构建期校验过存在的。

有问题欢迎通过页脚的邮箱找我。

---

*本文由 kemiao 主题渲染。主题原作者 [LiuShen / Willow-God](https://github.com/willow-god)，Hugo 移植：[克喵](https://github.com/Kemeow0815)。*
