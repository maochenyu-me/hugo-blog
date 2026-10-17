---
title: "日常说说"
layout: shuoshuo
description: "落笔之间，皆是日常的星火与远方的回响。"
hero:
  title: "日常说说"
  desc: "落笔之间，皆是日常的星火与远方的回响。"
  gradient: false
  badges:
    - text: "随笔与生活"
    - text: "提笔摘星"
      href: "/archives/"

# 本地说说数据源开关（对应 hugo.toml 的 params.shuoshuo.source）：
#   source = 'tg' / 'api' → 保留下面的 cascade，本地说说 md 不构建单页、
#                           不进任何列表（包括标签/分类），/shuoshuo/<slug>/ 直接 404；
#   source = 'local'      → 删除整个 cascade 段，本地说说恢复渲染。
# 注意：section 自身要显式 build（否则会被自己的 cascade 带掉，说说列表页 404）。
build:
  list: always
  render: always
cascade:
  build:
    list: never
    render: never
---
