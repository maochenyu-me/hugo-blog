#!/usr/bin/env python
# 拉丁字体子集化：把 UI 字体（Cartograph/Wotfard/Sriracha）裁到「项目实际出现过的字符 + 常用拉丁区」。
# 用法：<venv-python> tools/subset-latin-fonts.py
# 原字体备份到 tools/fonts/full/，可反复重跑（改了文案/新增符号后执行一次）。
# 注意：只对无 CJK 的拉丁字体生效，中文字符一律走系统字体回退。
import glob
import os
import shutil

from fontTools.ttLib import TTFont
from fontTools.subset import Options, Subsetter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, "themes/kemiao/static/fonts")
FULL = os.path.join(ROOT, "tools/fonts/full")

TARGETS = ["128abe3c1110e433", "e61bf9ae512299f9", "9a19da937bd4d43c"]

SCAN_GLOBS = [
    "themes/kemiao/layouts/**/*.html",
    "themes/kemiao/assets/js/*.js",
    "themes/kemiao/data/*.yaml",
    "content/**/*.md",
    "data/*.yaml",
    "hugo.toml",
]

# 基础拉丁区 + 标点 + 常用符号（数字/单位/箭头/货币等动态内容兜底）
BASE = set(range(0x20, 0x7F)) | set(range(0xA0, 0x100)) | set(range(0x2000, 0x2070))


def scanned():
    chars = set()
    for pattern in SCAN_GLOBS:
        for path in glob.glob(os.path.join(ROOT, pattern), recursive=True):
            try:
                chars.update(open(path, encoding="utf-8").read())
            except OSError:
                continue
    return {ord(c) for c in chars if ord(c) > 0x7F}


def main():
    extra = scanned()
    cps = sorted(BASE | extra)
    print(f"目标码点 {len(cps)} 个（基础 {len(BASE)} + 项目文本补充 {len(extra)}）")
    os.makedirs(FULL, exist_ok=True)

    for name in TARGETS:
        target = os.path.join(FONTS, f"{name}.woff2")
        backup = os.path.join(FULL, f"{name}.woff2")
        if not os.path.exists(target) and not os.path.exists(backup):
            print(f"  {name}: 未找到，跳过")
            continue
        if not os.path.exists(backup):
            shutil.copy2(target, backup)
        font = TTFont(backup)
        has = sorted(font.getBestCmap())
        hit = [c for c in cps if c in set(has)]
        options = Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        subsetter = Subsetter(options=options)
        subsetter.populate(unicodes=hit)
        subsetter.subset(font)
        font.save(target)
        print(f"  {name}: {os.path.getsize(backup) // 1024}KB -> {os.path.getsize(target) // 1024}KB "
              f"（保留 {len(hit)}/{len(has)} 字形）")


if __name__ == "__main__":
    main()
