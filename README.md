# kemiao · Hugo 博客主题

以 [blog.liushen.fun](https://blog.liushen.fun)（Astro）为参照 1:1 移植的 Hugo 主题，主题本体在 `themes/kemiao/`，Hugo v0.166.0+ extended。

## 快速开始

```bash
# 推荐：干净构建 + 搜索索引 + 自检（见下方"为什么必须干净构建"）
node tools/build.mjs

# 或手动
hugo -D --port 1313        # 本地预览（含草稿）
hugo -D && npx pagefind --site public   # 生产构建
```

产物在 `public/`，部署到任意静态托管即可。

> **为什么必须干净构建**：Hugo 的 fingerprint 会给 CSS 生成带内容哈希的文件名
> （`site.min.<hash>.css`）。改样式后新哈希生成，**旧哈希文件不会被删除**，`hugo --gc`
> 也不管它们。结果是 `public/css/` 里堆着多份 `site.min.*.css`，用 grep 全局扫描会
> **误判「修复没生效」**。`tools/build.mjs` 的做法是构建前整个删掉 `public/`，
> 并在构建后自检「无孤儿 CSS + 无断裂引用」。

## 写新内容

主题提供两套脚手架，字段带注释，按路径自动选择：

```bash
hugo new posts/my-post.md        # 文章（default.md）
hugo new shuoshuo/my-thought.md  # 说说（shuoshuo.md）
```

**文章字段**（`archetypes/default.md`）：

| 字段 | 说明 |
| --- | --- |
| `slug` | 永久链接末段 → `/posts/<slug>/`；默认由文件名 urlize |
| `title` | 标题 |
| `date` / `lastmod` | 必须带时区；`lastmod > date` 时显示「更新于」 |
| `draft` | `true` 仅 `-D` 可见 |
| `description` | SEO meta + og:description + AI 摘要回退 |
| `categories` / `tags` | 分类与标签徽章 + 归档页 |
| `aiSummary` | 可选，AI 摘要卡正文（打字机效果） |
| `cover` | 可选，封面图（站内路径或远程 URL） |

> ⚠️ **date 的两个坑**：① 不带时区会被当 UTC；② 晚于当前时间会被未来时间过滤
> **静默跳过**（不报错、页面不生成）。所以内容文件的日期一律写成 `...+08:00` 且不晚于此刻。

**说说字段**（`archetypes/shuoshuo.md`，与文章完全不同，勿混用）：
`title` / `date` / `draft`，可选 `images`、`video`、`website`、`github`、`location`、`pinned`、`tags`。

## 目录结构

```
hugo.toml           站点配置（主题经 [module.mounts] 手动挂载，注释齐全）
content/            页面与文章（独立页 hero 进 front matter）
data/               博客自有数据（导航/友链/赞赏等，改这份即可，优先于主题）
i18n/ static/ assets/ layouts/ archetypes/
                    项目级覆盖层（放同名文件即覆盖主题，不放则用主题默认）
themes/kemiao/
  layouts/          模板（_default/ 单页与列表、partials/、_markup/ 外链改写 hook）
  assets/
    css/            footer.css 主样式包 + main.css + site.css（移植期追加样式）
    js/             行为脚本（site.js 入口，动态 import 各模块）
  static/
    fonts/          Cascadia 等自托管字体
    fontawesome/    FontAwesome 7.2.0 自托管（css + webfonts）
    vendor/         artalk.js（仅评论页运行时加载）
  data/             导航 / 应用面板 / 说说跑马灯 / 友链 / 设备 / 赞赏（默认值）
  archetypes/       新文章脚手架
  theme.toml        主题元数据
tools/
  build.mjs           干净构建（删 public → hugo → pagefind → 孤儿 CSS 自检）
  gen-pwa-assets.py   PWA/favicon/OG 资产生成器（改用自己 logo 时跑这个）
  verify-browser.mjs  浏览器端字体与页面验证（有真实 404 时退出码非 0）
  verify-fonts.mjs    字体加载专项验证
  probes/             移植期使用的 CDP 探针脚本（风格 diff 等，备查）
```

## 项目级覆盖（不动主题源码）

Hugo 约定：站点根目录与主题同路径的文件**优先于主题**。改动一律放根目录，主题保持原样：

- `data/`：**博客自有数据，唯一数据源**。hugo.toml 用 `[module.mounts]` 手动挂载主题且**不含主题 `data/`**，因此改根目录这份即可，且不会有数组型 YAML 覆盖的 `overridden` 警告。注意：主题日后新增的 data 文件不会自动生效，需拷到根目录。
- `layouts/`：要改某个模板时，把 `themes/kemiao/layouts/...` 对应文件拷到根目录同路径再改（如 `layouts/partials/hero.html`）。
- `assets/`：同路径文件整体替换（如 `assets/css/site.css` 会顶掉主题整个 site.css，慎用；追加样式建议改主题内文件或新建独立 css 引入）。
- `static/`：同路径文件覆盖（字体、fontawesome、vendor 替换即生效）。
- `i18n/`、`archetypes/`：同名文件覆盖。

空目录带 `.gitkeep` 占位，首次覆盖时把主题里的对应文件拷过来改即可。

## 关键配置（hugo.toml）

| 功能 | 切换方式 |
| --- | --- |
| 页面背景 | `[params.background]` 明暗两套壁纸 + 底色 + 微调，见下方「页面背景」 |
| 评论 | `[params.comments] provider = 'artalk' \| 'twikoo'`，各后端地址在对应子节 |
| 搜索 | `[params.search] provider = 'pagefind' \| 'algolia'`，algolia 凭据已内置源站示例 |
| 图标 | `[params.icons] provider = 'local' \| 'cdn'`，local 读主题 `static/fontawesome/` |
| 音乐胶囊 | `[params.musicCapsule] enable`，APlayer + MetingJS（网易云歌单 id 等） |
| 安全跳转 | `[params.safego]` 倒计时与协议白名单；外链自动改写为 `/safego/?u=<base64>` |
| 说说 | `[params.shuoshuo] source = 'local' \| 'api' \| 'tg'`，见下方「说说数据源」 |
| 朋友圈 | `[params.fcircle]` JSON 源 |

### 页面背景

全站背景层（`.site-backdrop`：壁纸 + 底部渐隐遮罩，网格/噪点在其上层另管）由 `[params.background]` 驱动，明暗各一套：

```toml
[params.background]
  enable = true            # false = 不渲染壁纸图，只留底色（网格/噪点仍在）
  position = 'top center'  # 明暗共用，CSS background-position
  size = 'cover'           # 明暗共用，CSS background-size
  scale = 1.035            # 明暗共用，放大倍数（盖住 blur 后的边缘毛边）

  [params.background.light]
    image = '/imgs/default-light.webp'  # 站内路径或外链 URL 皆可
    color = '#f2f5ec'                   # 页面基础色 --background
    opacity = 0.34                      # 该层整体透明度
    blur = 6                            # 壁纸模糊半径（px）
    saturate = 1.16                     # 壁纸饱和度

  [params.background.dark]
    image = '/imgs/default-dark.webp'
    color = '#10131a'
    opacity = 0.38
    blur = 6
    saturate = 1.18
```

约定三条：

- **只填 `light.image`** → 深色自动复用同一张；两个 `image` 都留空 = 不显示壁纸。
- **`color` 改成别的值会牵动整站配色**：`--background` 是底色、卡片底色（`--surface`）、遮罩渐变的共同来源，全部由它派生，改完是成套的。
- **整段 `[params.background]` 删掉** = 回到主题内置默认（`themes/kemiao/assets/css/footer.css` 里那套硬编码规则仍在，作兜底），主题可独立分发。

实现：`themes/kemiao/layouts/partials/background-style.html` 读配置渲染成一张独立样式表（Hugo Pipes，指纹化），由 `head.html` 排在 `footer.css` / `site.css` 之后引入；选择器与 footer.css 同构（亮色 `.site-backdrop`、暗色 `html[data-theme=dark] .site-backdrop`），靠「后出现」覆盖。


## 说说数据源（三选一）

`[params.shuoshuo].source` 决定说说页与首页跑马灯的数据来源，**只有被选中的那个生效**：

| source | 数据来源 | 渲染时机 | 说明 |
| --- | --- | --- | --- |
| `local` | `content/shuoshuo/*.md` | 构建期 | Hugo 模板直接渲染，无网络依赖 |
| `api` | memos echo 接口 | 运行时 | `[params.shuoshuo].api` |
| `tg` | koharu-suite（Telegram 频道归档） | 运行时 | 游标分页，见下 |

### tg 模式配置

```toml
[params.shuoshuo]
  source = 'tg'

  [params.shuoshuo.tg]
    baseUrl   = 'https://tg-api.518339.xyz'          # koharu-suite 站点源
    channelId = 'aa764a3a-f037-45f4-8e04-fea3c5ac4209'  # 频道 UUID
    pageSize  = 12        # 每页条数（「加载更多」每次追加这么多）
    author    = ''        # 卡片作者名；留空回退 [params.shuoshuo].author
    avatar    = ''        # 卡片头像；留空回退 [params.shuoshuo].avatar
    detailLink = true     # 「查看详情」跳 Telegram 原帖；false 则隐藏该按钮
```

查频道 UUID：

```bash
curl https://tg-api.518339.xyz/api/v1/channels
# {"items":[{"id":"<uuid>","title":"塔罗岛","username":"..."}]}
```

**接口契约**（源码见 `koharu-suite/packages/koharu-astro/src/client.ts`）：

```
GET {baseUrl}/api/v1/messages/latest?channel=<uuid>&limit=<n>[&cursor=<nextCursor>]
→ { items: PublicMessage[], nextCursor: string|null }
```

- 分页：把上次响应的 `nextCursor` 作为 `cursor` 再请求；为 `null` 表示到底
- 图片：`media[].thumbnailUrl`（网格缩略图）/ `originalUrl`（灯箱大图），
  相对路径由 `baseUrl` 解析成绝对地址
- 「查看详情」跳 `sourceUrl`（`https://t.me/<channel>/<n>` 原帖）——tg-api 本身不提供 HTML 详情页

**部署后仍取最新数据**：tg 是**运行时客户端拉取**，与静态构建解耦，
所以 Hugo 构建产物可以一直用，说说会随 Telegram 频道更新。

> ⚠️ **CORS**：koharu-suite 按 `Origin` 白名单放行。本地调试须用
> **`http://localhost:1313`**（服务端白名单里的就是它），用 `http://127.0.0.1:1313`
> 会被拒（响应不带 `Access-Control-Allow-Origin`），表现为「加载失败」。

> 卡片 DOM 与 `local` 模式**逐类名对齐**，所以瀑布流 / 灯箱 / 卡片光斑 / 回复引用
> 全部复用既有样式与脚本，无需为 tg 单独写 CSS。

## 功能清单

- 全局：毛玻璃导航（药丸弹簧）、搜索弹窗（⌘K）、中控台偏好、自定义右键菜单、snackbar、亮暗主题、aurora 光效、音乐胶囊
- 独立页：搜索页（`/search/`，URL `?q=` 同步）、安全跳转（`/safego/`，Markdown 外链构建期自动改写）、说说、装备、留言板、友链、朋友圈、赞赏、订阅、归档、分类/标签
- 文章页：TOC spy、代码复制、AI 摘要、过期提醒（>365 天 snackbar）、分享、双评论后端

## 行为脚本

入口 `themes/kemiao/assets/js/site.js`，按 DOM 挂载点守卫动态 import：

- **全局**：药丸弹簧导航、滚动进度、抽屉、搜索弹窗（⌘K）、中控台、右键菜单、snackbar、主题模块、aurora 光效、音乐胶囊（APlayer/Meting 懒加载）
- **页面级**：说说瀑布流（三数据源：`shuoshuo-local.js` / `shuoshuo-page.js` / `shuoshuo-tg.js`）、友链状态、朋友圈、赞赏轮播、TOC spy、代码复制、AI 摘要打字、独立搜索页
- **评论**：`comment-artalk.js` / `comment-twikoo.js` 按挂载点二选一加载；Artalk 库走 `static/vendor/` 运行时动态 import，不进主 bundle

## 依赖说明

- 评论列表/中控台最近评论在本地 dev 会因 artalk 服务端 CORS 白名单报 `Failed to fetch`，部署到正式域名后消失
- 生产构建必须跑 `npx pagefind --site public` 生成搜索索引
- 音乐胶囊的 APlayer/Meting 资产从 jsd.liiiu.cn CDN 懒加载，`[params.musicCapsule] enable = false` 可整体关闭
- 悠哉文楷字体走 CDN 分片（`jsd.liiiu.cn`），中控台可开关

## PWA / 图标 / 社交分享图

主题自带占位资产（圆角暗底 + 主题色「克」字），已可直接使用；换成自己的 logo：

```bash
python tools/gen-pwa-assets.py --src your-logo.png --title "你的站名" --subtitle "一句话简介"
```

产出（写入 `themes/kemiao/static/`）：

| 文件 | 用途 |
| --- | --- |
| `favicon.ico` | 多尺寸 ICO（16/32/48 内嵌） |
| `apple-touch-icon.png` | 180×180，iOS 主屏（不透明底） |
| `pwa/favicon-{16,32,36,48,72,96,144,192,256,384,512}.png` | PWA 套件 |
| `pwa/favicon-mask.svg` | Safari pinned tab 单色剪影 |
| `og.webp` | 1200×630 社交分享图 |

配置（`hugo.toml`）：

```toml
[params.pwa]
  enable = true          # false 时只输出 /favicon.ico，其余 PWA 引用不渲染
  shortName = '清羽飞扬'
  themeColor = '#242424'
  backgroundColor = '#242424'
```

`manifest.json` 由 `themes/kemiao/layouts/manifest.json` 模板生成（读上面的参数），
经 `[outputFormats.MANIFEST]` 输出到站点根 `/manifest.json`。
换源图后重跑脚本即可，**不要手工改 `static/pwa/` 里的 PNG**。

## 验证脚本

```bash
# 浏览器实测：4 个自托管字体加载 + 页面截图 + 真实 404 扫描（有 404 时退出码 1）
hugo server -D --port 1401     # 另开终端
node tools/verify-browser.mjs
node tools/verify-fonts.mjs    # 字体专项（强制加载验证）
```

> **字体验证的坑**：`document.fonts.check()` 对「已声明但当前页面没用到」的字体返回
> `false`，那是浏览器**惰性加载**的正常行为，不代表字体缺失。可靠判据是
> `document.fonts.load('400 16px "家族名"', 'ABCabc123')` —— 能 load 出 FontFace 才算真可用。
> `verify-browser.mjs` 已按此实现；Wotfard / Sriracha 只在部分元素上使用，首页不下载属正常。

## 自托管字体路径

`themes/kemiao/static/fonts/*.woff2` 在 `assets/css/site.css` 的 `@font-face` 中以 `/fonts/` 引用。
（移植时源站 Astro 产物路径是 `/_astro/fonts/`，需改成本地 `/fonts/`，否则字体全部 404 回退系统字体。）


## 移植记录

移植过程、踩坑与逐阶段验证记录见 `.workbuddy/memory/`。
