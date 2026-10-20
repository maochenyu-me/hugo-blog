#!/usr/bin/env python
# FontAwesome CSS 子集化：只保留项目实际用到的图标定义（配合 subset-fonts.py 的字体子集）。
# 用法：<venv-python> tools/subset-fa-css.py
# 输入：themes/kemiao/static/fontawesome/css/all.min.css（原始全量）
# 输出：themes/kemiao/static/fontawesome/css/all.subset.min.css（供 head.html 引用）
import re
import glob
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "themes/kemiao/assets/fontawesome/css/all.min.css")
OUT = os.path.join(ROOT, "themes/kemiao/assets/fontawesome/css/all.subset.min.css")

SCAN_GLOBS = [
    "themes/kemiao/layouts/**/*.html",
    "themes/kemiao/assets/js/*.js",
    "themes/kemiao/data/*.yaml",
    "content/**/*.md",
    "data/*.yaml",
    "hugo.toml",
]

# CSS 里 content:"<码点字符>" 注入的字形（音乐胶囊播放/暂停图标等），
# 不会被 fa-xxx 类名扫描捕获，必须按码点反查类名一起保留。
CSS_GLOBS = [
    "themes/kemiao/assets/css/*.css",
    "themes/kemiao/layouts/**/*.html",
]

ICON_DEF = re.compile(r'([^{}]+)\{--fa:"\\([0-9a-f]+)\s*"\}')
CSS_CONTENT = re.compile(r'content:"([^"]*)"')


def css_content_codepoints():
    """收集 CSS 中 content:"<字符>" 注入的私用区码点（FA 图标字形）。"""
    cps = set()
    for pattern in CSS_GLOBS:
        for path in glob.glob(os.path.join(ROOT, pattern), recursive=True):
            try:
                text = open(path, encoding="utf-8").read()
            except OSError:
                continue
            for m in CSS_CONTENT.finditer(text):
                for ch in m.group(1):
                    if 0xE000 <= ord(ch) <= 0xF8FF:
                        cps.add(ord(ch))
    return cps


def names_by_codepoint(css):
    """码点 -> FA 类名集合（用于反查 CSS content 里注入的字形）。"""
    table = {}
    for m in ICON_DEF.finditer(css):
        cp = int(m.group(2), 16)
        table.setdefault(cp, set()).update(re.findall(r"\.fa-([a-z0-9-]+)", m.group(1)))
    return table


def used_icons(all_names):
    used = set()
    for pattern in SCAN_GLOBS:
        for path in glob.glob(os.path.join(ROOT, pattern), recursive=True):
            try:
                text = open(path, encoding="utf-8").read()
            except OSError:
                continue
            for name in re.findall(r"\bfa-([a-z0-9-]+)\b", text):
                if name in all_names:
                    used.add(name)
    return used


def split_blocks(css):
    """按大括号深度切出顶层块（含 @font-face/@keyframes/@media）。"""
    blocks, depth, start = [], 0, 0
    for i, ch in enumerate(css):
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                blocks.append(css[start:i + 1])
                start = i + 1
    tail = css[start:].strip()
    if tail:
        blocks.append(tail)
    return blocks


def main():
    css = open(SRC, encoding="utf-8").read()
    names = set()
    for m in ICON_DEF.finditer(css):
        names.update(re.findall(r"\.fa-([a-z0-9-]+)", m.group(1)))
    nb_cp = names_by_codepoint(css)
    used = used_icons(names)
    # 把 CSS content:"<字符>" 里注入的码点反查成类名，一并保留（如播放/暂停图标）
    for cp in css_content_codepoints():
        used.update(nb_cp.get(cp, set()))
    print(f"CSS 内图标定义 {len(names)} 个，项目用到 {len(used)} 个")

    kept, dropped = [], 0
    for block in split_blocks(css):
        m = ICON_DEF.search(block)
        if not m:
            kept.append(block)          # 结构类 / @font-face / 尺寸动画等，全部保留
            continue
        # 图标定义块：选择器里提到的图标只要有一个在用就保留（组合选择器如 .fa-computer-mouse,.fa-mouse）
        hit = [n for n in re.findall(r"\.fa-([a-z0-9-]+)", m.group(1)) if n in used]
        if hit:
            kept.append(block)
        else:
            dropped += 1

    out = "".join(kept).strip()
    open(OUT, "w", encoding="utf-8", newline="\n").write(out)
    print(f"丢弃未用图标定义 {dropped} 块")
    print(f"{os.path.getsize(SRC) // 1024}KB -> {os.path.getsize(OUT) // 1024}KB")

    missing = sorted(used - set(n for n in re.findall(r"\.fa-([a-z0-9-]+)", out)))
    if missing:
        print("!! 输出里缺少这些图标的定义：" + ", ".join(missing))
        raise SystemExit(1)
    print("自检通过：用到的图标定义都在输出里")


if __name__ == "__main__":
    main()
