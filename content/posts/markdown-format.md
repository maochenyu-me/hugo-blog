---
slug: "markdown-format"
title: "Markdown 全版式速查：一篇看懂所有语法元素"
date: 2026-10-06T10:00:00+08:00
lastmod: 2026-10-06T10:00:00+08:00
draft: true
description: "从标题到脚注，一篇覆盖 Markdown 全部常用语法元素的速查文章，也是本主题渲染效果的完整样张。"
categories: ["效率工具"]
tags: ["Markdown", "写作", "速查"]
aiSummary: "本文系统梳理了 Markdown 的全部常用语法元素：标题层级、强调样式、列表与任务清单、引用与代码块、表格、图片、链接、脚注与分割线，并给出每个元素的典型用法示例，适合作为日常写作的案头速查手册。"
cover: "/imgs/posts/markdown-format.webp"
---

欢迎来到本站的第一篇**全版式示例文章**。这篇文章覆盖了 Markdown 的全部常用语法元素，既是写作速查，也是主题渲染效果的完整样张——如果你在浏览器里看到这一页的每个元素都样式正确，说明主题的排版引擎已经就位。

## 标题层级

Markdown 用 `#` 表示标题，一共六级。正文页会自动为二、三级标题生成目录（TOC），滚动时右侧目录高亮跟随。

### 三级标题：足够日常使用

四级标题往下的层级在长文中偶尔出现，样式逐级缩小：

#### 四级标题

##### 五级标题

###### 六级标题

## 段落与强调

普通段落直接书写，段落之间空一行。强调语法有四种：

- **粗体**：`**粗体**`，用于关键结论
- *斜体*：`*斜体*`，用于术语或外文书名
- ***粗斜体***：`***粗斜体***`，慎用，视觉太重
- ~~删除线~~：`~~删除线~~`，用于修订记录，保留"写错又改对"的痕迹

行内代码用反引号包裹，比如 `hugo server -D`，它会以等宽字体和浅底色呈现。

## 列表

### 无序列表

支持三种符号，渲染后样式一致：

- 静态站点生成器
  - Hugo（Go 模板，构建最快）
  - Astro（岛屿架构，组件化最爽）
  - Eleventy（极简主义者的选择）
- 动态站点：WordPress、Ghost——部署省心，但你要养着一台服务器

### 有序列表

1. 安装 Hugo（extended 版本，SCSS 支持必需）
2. 新建站点并挂载主题
3. 写文章，`hugo -D` 本地预览
4. 构建部署到 EdgeOne / Vercel / GitHub Pages

### 任务列表

- [x] 搭好站点骨架
- [x] 移植首页与文章页
- [x] 接入评论与搜索
- [ ] 评论区等待第一个留言的人

## 引用

单层引用长这样：

> 好的架构是让人读懂之后忍不住点头的方案，而不是让人惊叹之后无法维护的迷宫。

嵌套引用：

> 外层引用一段话。
>
> > 内层再引一层，样式的缩进边线会叠加。
> >
> > 回到外层。

引用里也可以放其他元素：

> **提示**：引用块常用于警告、备注和旁白，配合粗体开头效果最好。

## 代码块

三个反引号加语言名开启 fenced code block，主题用 Chroma 高亮：

Go 代码：

```go
package main

import "fmt"

func main() {
    for i := 1; i <= 3; i++ {
        fmt.Printf("第 %d 次构建\n", i)
    }
}
```

JavaScript 代码：

```javascript
// 药丸弹簧动画参数（与源站一致）
function springTo(prop, target, dt) {
  prop.velocity += (target - prop.value) * 7000 * dt;
  prop.velocity *= Math.exp(-96 * dt);
  prop.value += prop.velocity * dt;
  return Math.abs(target - prop.value) < 0.1;
}
```

带文件名的 TOML 配置：

```toml { title="hugo.toml" }
[params.comments]
  provider = 'artalk'    # artalk | twikoo

[params.search]
  provider = 'pagefind'  # pagefind | algolia
```

无语言代码块（纯文本）：

```text
$ hugo -D
Start building sites …
Total in 347 ms
```

## 表格

| 语法 | 用途 | 示例 |
| :--- | :---: | ---: |
| `\|---\|` | 左对齐 | 文档 |
| `:---:` | 居中 | 数据对比 |
| `---:` | 右对齐 | 数字表格 |

复杂一点的多列表格：

| 后端 | 部署成本 | 中文分词 | 适用场景 |
| --- | --- | --- | --- |
| Pagefind | 零（静态索引） | 支持（bigram） | 个人博客、文档站 |
| Algolia | 免费额度 + 超量付费 | 优秀（CJK） | 内容量大、需即时搜索 |
| Fuse.js | 零（全前端） | 较弱 | 几十篇文章的小站 |

## 图片

![示例配图：山水插画](https://picsum.photos/seed/markdown-format/960/540)

带链接的图片：

[![点击图片跳转](https://picsum.photos/seed/clickable/400/200)](https://gohugo.io)

## 链接

- 外部链接：[Hugo 官方文档](https://gohugo.io/documentation/)
- 自动链接：<https://gohugo.io>
- 相对链接跳转到[归档页](/archives/)
- 引用式链接：去 [Hugo 官网][hugo-home] 看最新版本
- 站外引用卡（带标题的链接自动渲染为卡片）：[Hugo - The world's fastest framework for building websites](https://gohugo.io "gohugo.io")

[hugo-home]: https://gohugo.io

## 其他元素

分割线（三个以上的 `-` 或 `*`）：

---

键盘按键：按 <kbd>Ctrl</kbd> + <kbd>K</kbd> 打开搜索弹窗，按 <kbd>Esc</kbd> 关闭。

变量标记：把 `--fa` 指向图标码位即可渲染图标，例如 <i class="fa-solid fa-house" aria-hidden="true"></i> 就是主页图标。

脚注语法[^1]，以及长脚注[^long]。

[^1]: 这是一个脚注。页脚会自动编号。
[^long]: 这是一个内容较长的脚注，可以放多行文字，用来补充正文中不方便展开的细节说明。

## 代码中的特殊内容

防止 Markdown 被意外解析，用反引号包裹：

- 不是列表的 `1. 纯文本`
- 不是强调的 `**两对星号**`
- 反引号本身：`` `code` ``

## 结语

这一篇覆盖了日常写作 99% 的语法需求。剩下的 1%——数学公式、Mermaid 图表——等用到了再补。写完这篇你会发现：Markdown 的语法一天就能学完，真正难的是把想说的东西组织成清晰的结构。

祝写作愉快。
