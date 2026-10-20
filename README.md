# kemiao · Hugo 博客主题

一个轻量、可自定义的 Hugo 博客主题，支持 PWA、双主题、多语言评论、说说三数据源等功能。

## 🚧 版本说明

**当前版本不是完整复刻原站项目**，保留了核心视觉与交互，但在配置、数据源、部分组件上做了自改与精简。你可以参考本主题自行改造使用，无需完全照搬。

---

## 说明

kemiao 是一个为 Hugo 打造的博客主题，借鉴了静态博客常见的玻璃拟态顶栏、终端风 Hero、swup 无刷新跳转等交互设计，适合喜欢极简设计又注重功能性的个人站点。

### 💻 快速开始

#### 1. 克隆与安装

```bash
# 在你的 Hugo 站点根目录
git clone <主题仓库地址> themes/kemiao
git submodule update --init --recursive
npm ci
```

#### 2. 应用主题

在 `hugo.toml` 中通过 `module.mounts` 挂载主题（本主题不使用 `theme =`）：

```toml
[module]
  [[module.mounts]]
    source = 'themes/kemiao/layouts'
    target = 'layouts'
  [[module.mounts]]
    source = 'themes/kemiao/assets'
    target = 'assets'
  [[module.mounts]]
    source = 'themes/kemiao/static'
    target = 'static'
  [[module.mounts]]
    source = 'themes/kemiao/archetypes'
    target = 'archetypes'
```

#### 3. 本地预览

```bash
hugo server -D
```

---

## 🎉 主题特色

- **视觉**：玻璃拟态顶栏、终端风 Hero、明暗双主题（light/dark/auto）、页面背景壁纸
- **交互**：swup 无刷新跳转、中控台偏好、搜索弹窗（⌘K）、统一灯箱、右键菜单、snackbar、返回顶部
- **内容**：文章、说说（三数据源）、归档、分类、标签、友链、留言、订阅、打赏等页面
- **功能**：AI 摘要卡、外链安全跳转、文章过期提醒、双评论后端、访问统计、PWA
- **性能**：单入口 JS、CSS 合并指纹化、图标/字体子集化、外部脚本后置加载

详细配置请见 `docs/` 下的各功能说明文档。

---

## 📁 目录结构（主题）

```
themes/kemiao/
├── archetypes/          # hugo new 模板
├── assets/
│   ├── css/             # 样式（footer/main/site，由 head.html 合并）
│   └── js/              # site.js 唯一入口，模块动态 import
├── data/                # 主题内置兜底数据（站点 data/ 优先）
├── layouts/
│   ├── _default/        # baseof / list / single / 各独立页
│   ├── partials/        # head / header / footer / 侧栏卡 / 控制台 / 弹窗
│   └── shuoshuo/        # 说说详情
└── static/
    ├── fontawesome/     # 子集化图标字体
    ├── fonts/           # 子集化 woff2
    ├── pwa/             # PWA 资产
    └── vendor/          # 第三方静态资源
```

站点侧（与主题配合，不属于主题仓库）：`hugo.toml`、`content/`、`data/`、`static/`、`tools/`

---

## ❓ 常见问题

### 如何开启/关闭 PWA？

在 `hugo.toml` 的 `[params.pwa]` 中设置 `enable = true/false`。资产由 `python tools/gen-pwa-assets.py` 生成。

### 如何切换评论后端？

在 `[params.comments]` 中设置 `provider = 'artalk' | 'twikoo' | 'ecoku'`，各后端地址在对应子节配置。

### 说说数据从哪里来？

`[params.shuoshuo].source` 可选 `local`（构建期 md）、`api`（memos echo 接口）、`tg`（Telegram 频道归档），三选一。

### 为什么 CSS 改了没生效？

本主题用 `resources.Concat` 把三份 CSS 合并成指纹化单包，旧哈希文件不会自动删。建议用 `node tools/build.mjs` 清空 `public/` 后重新构建。

---

### 📜 版权与声明

- 本主题借鉴了静态博客常见的视觉与交互设计，非原站完整复刻。
- 引用第三方库请遵循各自开源协议。
- 你可以参考本主题自行改造使用。