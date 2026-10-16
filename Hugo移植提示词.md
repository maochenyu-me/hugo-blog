# 任务：将 blog.liushen.fun（Astro 自研主题）一比一移植为 Hugo 主题

## 0. 决策规则（最高优先级，动工前必读）
1. 本提示词的事实部分均已逐项核实。凡标注【待核实】的条目：实施到该项之前，必须先自行抓取源站对应页面/DOM/CSS 核对；核对后仍无法确认的，写入问题清单向我询问，**得到我的明确答复后才能实施**。
2. 任何设计或行为细节（图标、文案、颜色、间距、交互方式、断点表现、组件形态、数据字段）若在附件材料和源站中都找不到依据：**停下，写进问题清单问我，禁止用"常见做法 / 合理默认 / 自行发挥"填补空白**。
3. 每个阶段开工前若产生新疑问，同样先问后做。宁可多问，不要猜错返工。
4. 你随时可以抓取 https://blog.liushen.fun/ 的任意页面及其 /_astro/*.css 进行交叉核对；附件截图仅供整体观感参考，以实际 DOM/CSS 为准。

## 1. 目标
以 https://blog.liushen.fun/ 为唯一视觉与功能基准，用 **Hugo v0.166.0 extended**（版本锁定，构建环境必须使用该版本，README 写明安装方式）完整复刻该站。要求像素级 1:1 还原——布局、配色、字体、间距、动效、交互、页面清单全部对齐，不是"风格相似"。我先 1:1 复刻作为基线，魔改需求在基线验收后另行提出（见第 10 节）。

## 2. 附件材料（随提示词提供）
- `main.css` / `footer.css`：源站编译产物 CSS，是设计令牌、断点、组件样式的唯一权威来源
- 页面快照截图：首页亮暗双色、文章页（含代码块）、归档页、中控台、移动端首页
- `home.html` / `article.html`：源站首页与文章页原始 HTML（结构参考）
- 附件与线上不一致时，以线上为准，并在 README 登记差异

## 3. 源站技术事实（已逐项核实，直接采信）

### 3.1 框架与全局
- 源站：Astro v7.1.3 + Tailwind CSS v4 + Swup（无刷新跳转：`#swup` 容器 `data-swup-root`，`.transition-fade` 淡入过渡，`site-swup-overlay` 遮罩 + `site-swup-progress` 进度条）
- 主题三档 light / dark / auto：`html[data-theme=dark]` 驱动，localStorage 持久化，`<head>` 内联脚本渲染前设置防白闪；theme-color meta 默认 `#242424`
- 全局装饰层：`site-backdrop` / `site-grid` / `site-grain`（噪点纹理）/ 云山背景图
- 全局组件：滚动进度条 `site-scroll-progress`、自定义右键菜单 `site-context-menu-host`、消息条 `site-snackbar-box`、skip link（`#skip-to-content` → `#main-content`，bg-accent 圆角下挂样式）
- 鼠标跟随光晕 `.site-cursor-glow`（在 pointer:coarse 与 prefers-reduced-motion 设备上禁用）

### 3.2 设计令牌（变量名保留，两套主题由 data-theme 切换）
- 亮色 `:root`：`--background:#f2f5ec`  `--foreground:#353538`  `--accent:#1158d1`  `--border:#7cadff`  `--muted:#bbc789`
- 暗色 dark：`--background:#10131a`  `--foreground:#f6f7f8`  `--accent:#008fec`  `--border:#2264e3`  `--muted:#212f3f`
- 派生变量用 `color-mix()` 生成（`--border-subtle` / `--card-bg` / `--card-border` / `--glass-surface-bg` 等），含 `--blur-sm:8px` / `--blur-md:12px`
- `:root` 在 ≤640px 有变量级微调（设计令牌本身是响应式的）
- 全部以附件 main.css 为准，逐条搬运

### 3.3 字体
- 正文：悠哉体 Yozai（按 unicode-range 分片子集化）：`https://jsd.liiiu.cn/gh/willow-god/Sharding-fonts/Yozai-Medium/result.min.css`
- 手写体 Sriracha；代码字体 Cartograph（面包屑 `ol.breadcrumb-bar` 亦用 `font-cartograph`）；回退 `"PingFang SC","Microsoft YaHei"…`
- 主字体 preload，其余异步加载
- 中控台有"悠哉文楷"开关（yozaiFont）可切换字体

### 3.4 图标库（FontAwesome 7.2.0 Free）
- 引入：`https://jsd.liiiu.cn/npm/@fortawesome/fontawesome-free@7.2.0/css/all.min.css`（solid/regular/brands 全量）
- 使用场景：社交图标、移动端抽屉每个链接配图标、H2 前缀、分类 chip、中控台控制项、页脚联系方式等，全站统一
- 关键图标（已核实）：`fa-bars-progress`(中控台触发)、`fa-circle-half-stroke`/`fa-regular fa-sun`/`fa-moon`(主题三档)、`fa-expand`/`fa-compress`(全屏)、`fa-computer-mouse`(右键菜单)、`fa-brands fa-fonticons-fi`(悠哉文楷)、`fa-music`(音乐胶囊)、`fa-regular fa-comments`(最近评论)、`fa-calendar-days`(日期)、`fa-chevron-left`(cd .. 返回)、`fa-hashtag`/`fa-folder`(标签/分类)、`fa-brands fa-algolia`(搜索)

### 3.5 代码高亮（Shiki，注意：无行号）
- 容器：`<pre class="astro-code astro-code-themes min-light github-dark-default">`，双主题 = 亮 min-light / 暗 github-dark-default
- 4 个 CSS 变量：`--shiki-light:#24292eff` / `--shiki-dark:#e6edf3` / `--shiki-light-bg:#ffffff` / `--shiki-dark-bg:#0d1117`；`overflow-x:auto`；`tabindex="0"`；`data-language` 标记语言
- 每个代码块带 figcaption 标题栏（自定义标题，如"评论拦截"）+ 复制按钮；**无行号**
- Hugo 侧用 Chroma 复刻该观感（见第 7 节）

### 3.6 头部导航（玻璃拟态吸顶）
- 左区 header-floating-left：Logo（Liu}}Shen 括号风格字标，内联 SVG 复刻为 partial，不用字体图标）+ 搜索按钮 + 中控台按钮 + 消息徽章
- 右区 `nav#nav-menu`（`lg:flex`，<1024px 隐藏转移动抽屉）：6 个下拉分组，组名与条目已核实：
  - **导航**：个人主页(https://www.liushen.fun)、个人相册(https://xc.liushen.fun)
  - **整理**：时光卷轴(/archives/)、文章标签(/tags/)、文章分类(/categories/)、文章通览(/posts/)
  - **友人**：友链展示(/link/)、友链申请(/addlink/)、朋友动态(/fcircle/)
  - **留言**：留言白板(/comment/)
  - **分享**：提笔摘星(https://mm.liushen.fun)、代码片段(https://gist.liushen.fun)、日常说说(/shuoshuo/)、订阅本站(/subscribe/)
  - **关于**：站长资料(/about/)、我的设备(/devices/)、支持作者(/rewards/)
- 交互：`li.glide-pill` 悬停药丸——一个共享药丸元素，位置由 runtime 逐帧写入，在各条目间滑动；`ul.nav-dropdown` 下拉展开
- 滚动时出现 `#header-border` 渐变底边线（`from-transparent via-border/40 to-transparent`，opacity 过渡）；返回顶部按钮

### 3.7 首页
- Hero 终端风：`$ /hello-world` 徽章 + 头像 + h1 "LiuShen's Blog" + 描述"清羽飞扬的技术博客…" + "作者"标签 + 4 个社交图标（发邮件 / QQ / GitHub / RSS，均带 aria-label）
- 说说跑马灯：`glide-pill` 药丸列表（构建时为空、运行时填充内容），循环滚动
- 最新文章卡片流：日期（fa-calendar-days）/ 分类 chip（fa-folder）/ 标签（fa-hashtag）
- 右侧栏（桌面 `aside` 固定 `w-[300px]`，<1024px 隐藏并移到内容下方）：欢迎卡（welcome-copy / welcome-info，强调色 accent）、流量数据卡（文章数目 / 本站总字数 / 最后更新，数据来自不蒜子）、友访头像、网站信息

### 3.8 文章页
- 终端面包屑：`cd ..` 返回按钮（fa-chevron-left + 视觉隐藏文本"返回"，`.visually-hidden`）+ `ol.breadcrumb-bar`（font-cartograph，`~ / Posts / {slug}`）
- 头部：分类 chip → 居中标题 + 标签 → 发布/更新时间、阅读时长（"27 分钟"）、字数（"10,430 字"）
- AI 摘要卡：`.ai-summary-card`，摘要文本存于 `data-ai-summary` 属性，人设为"清羽AI"，终端风卡片；front matter 可开关
- 正文 `.app-prose`：H2 图标前缀、行内代码胶囊、GitHub 风格 alert 提示块（> [!NOTE]/[!TIP]/[!WARNING] 等，已核实 10 处）、figcaption 标题代码块
- 目录 TOC：桌面 sticky scrollspy 高亮联动；移动端形态以源站为准【待核实】
- 文末：上一篇 / 下一篇导航；桌面右栏"最近文章"
- 悬浮最近评论：`aside[data-floating-recent-comments]`，携带 `data-server` / `data-site` / `data-site-origin`，以及 `data-floating-next-post-title`（滚动到底显示下一篇提示）
- 评论容器：`.artalk-comments` + `data-server="https://atk.liushen.fun"` + `data-site="清羽飞扬"`（Hugo 版此项为 hugo.toml 配置）

### 3.9 搜索弹窗（id=search-modal，Ctrl+K 唤起）
- 结构：`search-modal-overlay` > backdrop + container；容器内含极光装饰 `modal-aurora`（3 个 orb 光球）、`modal-sparkles`（5 个 sparkle 粒子）、`modal-border-glow` 发光边框、`modal-cursor-glow` 弹窗内光标跟随
- 头部：`search-icon-ring` 图标环 + 标题 + kbd 快捷键提示（具体组合键以源站为准【待核实】）+ 关闭按钮
- 主体：`premium-search` > `algolia-ui`（form + 搜索输入 + "清理搜索"清空按钮 + 结果列表 + `algolia-ui__message` 消息条）
- 源站数据源为 Algolia；Hugo 版按第 7 节做 PageFind / Algolia 双后端，UI 观感保持一致

### 3.10 中控台面板
- 内容分区：最近评论列表、标签云（带计数，如 项目分享 22 / Hexo 20）、分类（筑站手札 33 / 项目分享 29 / 闲情杂记 20 / 笔耕问道 17）、应用列表（more-app-list 共 3 组 22 个外链：个人主页 / 个人博客 / 个人相册 / 音乐拾光 / Github / 代码片段 / 提笔摘星 / 访客统计 / 流量数据 / 清羽图床 / 不蒜计数 / 服务状态 / 静态资源 / 每日热榜 / 内容中转 / 临时邮箱 / 清羽盘搜 / 封面设计 / 迷你封面 / 万能图标 / 灵感白板 / 思维导图；分组名以源站为准【待核实】）
- 控制项 6 个（`button.control-console-action`，`aria-pressed` 切换态，title 即文案，均已核实）：
  1. 音乐胶囊（fa-music）
  2. 最近评论（fa-regular fa-comments）
  3. 亮暗模式（`data-theme-mode` auto/light/dark 三态：fa-circle-half-stroke / fa-regular fa-sun / fa-moon）
  4. 进入全屏（`data-fullscreen-state` enter/exit：fa-expand / fa-compress）
  5. 右键菜单（fa-computer-mouse）
  6. 悠哉文楷（yozaiFont，fa-brands fa-fonticons-fi）
- ≤1023px 与 pointer:coarse 各有专门面板形态（宽度 / 位置 / 触控目标）

### 3.11 页脚
- 顶部：footer-avatar 圆形头像 + "好奇心转化为代码的空间。"
- 联系方式：邮件（fa-envelope）、QQ（fa-brands fa-qq）、GitHub（fa-github）
- 链接行：发展历程(/info/)、隐私政策(/statement/)、个人主页(www.liushen.fun)
- 版权行：© 2021-2026 LiuShen（fa-regular fa-copyright）+ 陕ICP备2024028531号-2（beian.miit.gov.cn）+ 陕公网安备61011602000637号（beian.mps.gov.cn，带查询 code）
- 运行计时："本站已苟活：X 天 XX 时 XX 分 XX 秒"（footerRuntime 定时器逐秒刷新）
- 技术署名：EdgeOne / 八壹云 / 初七云 / ASTRO（astro-devosfera 仓库）；Hugo 版署名替换方式【向我确认】

### 3.12 第三方服务（全部做成 hugo.toml 可配置项，默认关闭）
- 评论：Artalk（增强 fork），前端配置 data-server / data-site；Hugo 版需同时支持 Twikoo（见第 7 节）
- 统计：Umami（`um.liushen.fun/script.js` + data-website-id + data-domains）与不蒜子（`bsz.liiiu.cn/js`，PV/UV/文章数目/总字数）
- 音乐：APlayer + MetingJS（api: `https://met.liiiu.cn/m`），音乐胶囊悬浮形态
- 源站外链与图床引用仅作参考，Hugo 版资源本地化或按配置项处理

### 3.13 SEO / PWA / 无障碍
- meta：description、keywords（清羽飞扬、博客、建站教程…）、theme-color、format-detection
- OG / Twitter 卡片：og:type/site_name/locale/title/description/url/image(og.webp)、twitter:card summary_large_image
- JSON-LD：schema.org WebSite（name/url/description/author Person）
- RSS：/atom.xml（title "LiuShen's Blog - 清羽飞扬"）；sitemap 路径与源站一致
- PWA：/manifest.json + favicon 套件（favicon.ico、16/32 png、apple-touch-icon、mask-icon color=#5bbad5）【待核实：是否存在 Service Worker，有则一并复刻】
- 无障碍：skip link、aria-label/aria-expanded/aria-haspopup、`.visually-hidden`、prefers-reduced-motion 全站 16 处降级规则

### 3.14 响应式（断点为自定义值，禁止用 Tailwind 默认断点"翻译"）
- 已实测断点——桌面增量：`width>=640 / 670 / 768 / 1024 / 1280 / 1536`；移动增量：`width<=300 / 400 / 420 / 480 / 620 / 640 / 720 / 768 / 900 / 1023 / 1100`
- 关键行为：桌面导航 lg(1024) 起显示，之下汉堡 + 抽屉（`aside.mobile-menu-panel` + 6 个 `details.mobile-nav-group`，`--i:0..5` 交错入场动画，每个链接配图标）；侧栏 <1024px 移到内容下方；右键菜单 ≤420px 用 compact 紧凑变体；中控台 ≤1023px 与 pointer:coarse 专门形态
- 交互分层：hover 效果包在 `@media (hover:hover)` 内（7 处）；`-webkit-tap-highlight-color` 与源站一致
- iOS：`env(safe-area-inset-*)`（4 处）、`100svh` 替代 100vh（2 处）、viewport meta（完整值【待核实】，含 viewport-fit=cover 则保留）
- 动效降级：prefers-reduced-motion 16 处必须还原；横向溢出保护 overflow-x auto/clip

## 4. 页面清单（全部已核验 HTTP 200，缺一不可）
首页 `/`；时光卷轴 `/archives/`；标签 `/tags/`；分类 `/categories/`；文章通览 `/posts/`；文章页 `/posts/{slug}/`（源站 slug 为 8 位 hash，Hugo 版 slug 策略【向我确认】）；友链展示 `/link/`；友链申请 `/addlink/`；朋友动态 `/fcircle/`；留言白板 `/comment/`；日常说说 `/shuoshuo/`；订阅本站 `/subscribe/`；站长资料 `/about/`；我的设备 `/devices/`；支持作者 `/rewards/`；发展历程 `/info/`；隐私政策 `/statement/`；404 页 `/404.html`；另含 `manifest.json` 与 `atom.xml`。
友链 / 朋友动态 / 说说 / 关于 / 设备 / 赞赏等页面的数据放 `data/` 或 md，版式照源站（数据结构与分组以各页实际渲染为准）。

## 5. 图标库要求（FontAwesome，硬性约束）
- 版本与写法：FontAwesome 7.2.0 Free，与源站同版本；类名写法与源站一致（fa-solid / fa-regular / fa-brands 按源站实际用法，不得混用替换）
- 图标清单先行：动手前从附件 HTML 与源站各页面扫出全部 fa-* 类名，生成 `data/icons.yaml`（图标名 → 使用位置 → 风格前缀），模板严格按清单使用
- 禁止顶替：同一语义位置必须用源站同款图标；个别 Pro 专属图标选最接近的 Free 替代并在 README 登记
- 站点 Logo 为内联 SVG，复刻为 partial，不用字体图标
- 引入方式做成配置 `icons.provider = "cdn" | "local"`：cdn 与源站同 CDN 链接；local 经 Hugo Pipes 自托管（生产推荐），woff2 `font-display:swap` 并 preload，防图标闪烁（FOUT）
- 验收标准：全站无一处图标缺字（渲染成方块/空框即不合格），图标尺寸与颜色随主题令牌联动

## 6. 多端适配要求（响应式，硬性约束）
- 断点体系一比一搬运（见 3.14 的实测清单），禁止改用 Tailwind 默认断点重新"翻译"；开工前产出 `docs/breakpoints.md`（断点 → 控制组件 → 行为变化），与 icons.yaml 一同作为核对物
- 移动端导航：≤1023px 汉堡 + 抽屉菜单，抽屉含全部 6 个分组与搜索/中控台入口，支持触摸关闭，动画与源站一致，不得自创
- 目录：桌面 sticky scrollspy，移动端按源站实际形态，不得自创悬浮按钮方案
- 悬浮组件：音乐胶囊 / 悬浮评论 / 进度条移动端为右侧竖向紧凑堆叠，间距层级照搬，不互相遮挡
- 中控台：≤1023px 与 pointer:coarse 专门形态，触控目标不小于 44px
- 右键菜单：≤420px compact 紧凑变体；移动端唤起方式按源站方案
- 交互分层：所有 hover 效果包在 `@media (hover:hover)` 内；触屏功能不依赖 hover；tap-highlight 与源站一致
- iOS 专项：固定元素叠加 `env(safe-area-inset-*)`；视口高度用 100svh/100dvh 替代 100vh；viewport meta 带 viewport-fit=cover
- 响应式令牌：`:root` ≤640px 的变量级微调一并搬运
- 动效降级：prefers-reduced-motion 16 处规则全量还原（跑马灯/淡入/浮动动画在"减弱动态效果"下停止或简化），`.visually-hidden` 等无障碍类照搬
- 横向溢出：任何断点下不得出现横向滚动条；代码块/表格/跑马灯用源站同款 overflow 方案（auto/clip）

## 7. Hugo 侧技术要求
- 结构：layouts/（baseof + partials + shortcodes）、assets/ 走 Hugo Pipes 编译 Tailwind 并 fingerprint、content/ 文章用 page bundle、data/ 存友链与站点信息、hugo.toml 完整注释
- 分类法用 Hugo 原生 taxonomy（源站分类 slug：website / daily-share / life-snippets / learning，Hugo 版沿用策略【向我确认】）；归档用 `.GroupByDate` 模板实现；RSS(atom.xml) 与 sitemap 路径与源站一致
- 搜索：双后端，`search.provider = "pagefind" | "algolia"` 切换，搜索 UI 做统一适配层，两后端观感一致
  - PageFind（默认）：hugo 构建后执行 `pagefind --site public` 建索引，纯静态零外部依赖，正文容器加 `data-pagefind-body`，中文分词按官方多语言方案配置
  - Algolia：构建期/CI 脚本抽取文章生成 records 并上传（search-only key），前端 algoliasearch 查询；README 说明索引同步流程（如 GitHub Action）
- 评论：双后端，`comments.provider = "artalk" | "twikoo"` 切换，各自独立 partial：
  - Artalk：官方 JS/CSS，配置 server 与 site 名（复刻 data-server / data-site 行为）
  - Twikoo：官方 JS/CSS，配置 envId
  - 悬浮"最近评论"轮播与中控台"最近评论"面板必须跟随当前 provider 取数（Artalk 最近评论 API / twikoo.getRecentComments），数据结构与渲染样式统一
- 代码高亮：优先 Hugo 内置 Chroma + 自定义 CSS 调成 Shiki 同款观感——双主题（亮 min-light / 暗 github-dark-default）+ 卡片容器 + figcaption 标题栏 + 复制按钮 + **无行号** + overflow-x:auto，CSS 变量名与 `--shiki-*` 对齐；对不齐再换客户端 Shiki 并在 README 说明取舍
- 主题三档（light/dark/auto）存 localStorage，`<head>` 内联脚本渲染前设 data-theme，严禁白闪
- SEO 一比一：canonical、OG/Twitter 卡片、keywords、lang=zh-CN、theme-color、JSON-LD、图片 loading="lazy" decoding="async"
- 性能不低于源站水平：字体子集化沿用源站 CDN、图标按第 5 节加载、音频 preload="none"、构建产物精简

## 8. 交付与验收
1. 完整可运行的 Hugo 项目（hugo server 即起，构建链含 PageFind 索引步骤）+ README（目录说明、配置项清单【含 comments.provider / search.provider / icons.provider 开关的配置示例】、内容迁移方法、Algolia 索引同步说明）
2. `data/icons.yaml` 图标清单及与源站一一对应说明；`docs/breakpoints.md` 断点对照表
3. 一篇示例文章覆盖全部版式（代码块/提示块/图片/目录/行内代码）
4. 双后端自检：分别以 artalk 与 twikoo、pagefind 与 algolia 各跑一遍，验证评论渲染与搜索结果一致
5. 验收矩阵：七档宽度（360/414/768/1024/1280/1440/1920）× 亮暗双色逐格截图；iPhone 14（刘海/底部横条模拟）与 iPad 专项；逐项检查：汉堡抽屉、目录形态、悬浮堆叠不重叠、中控台可触控、代码块横向滚动、全页无横向溢出、iOS 安全区、系统"减弱动态效果"开启后动画降级、触屏模式下所有功能可达；图标逐个核对无缺字
6. 所有【待核实】项与无法 1:1 之处在 README 列出销项记录与原因说明

## 9. 工作方式
- **开工前一次性输出四件套等我确认**：①页面 → Hugo 模板映射表；②docs/breakpoints.md；③data/icons.yaml 草案；④【待确认问题清单】——把我标注的【待核实】项与你自查出的疑问一次性列全，我逐条答复后才动工
- 分阶段提交，每阶段可构建可预览，验收通过再进入下一阶段：①骨架+令牌+头尾 → ②首页 → ③文章页 → ④列表/归档/标签 → ⑤搜索/中控台/全局件 → ⑥双评论+双搜索接入 → ⑦图标核对+多端+SEO/性能/自检
- 设计细节以附件 CSS 和源站实际渲染为准，不得自行发挥改动配色与布局

## 10. 后续魔改（基线完成后再执行，暂不做）
<!-- 在这里写你自己的改造需求，例如： -->
<!-- - 首页 Hero 换成打字机动效 -->
<!-- - 增加友链朋友圈聚合页 -->
<!-- - 配色从米绿换成 XX -->
