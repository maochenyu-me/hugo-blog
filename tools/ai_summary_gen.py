#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
博客文章 AI 摘要生成脚本
功能：为 blog/content/posts/ 下的非 draft 文章生成 AI 摘要 frontm
依赖：requests, pyyaml, python-dotenv
环境变量：.env 中的 SILICONFLOW_API_KEY（硅基流动 API Key）
模型：Qwen/Qwen3-8B

用法：
    python tools/ai_summary_gen.py
交互模式：
1. 跳过已生成摘要的文章：只处理非 draft 且没有 aiSummary 的文章
2. 选择一篇文章重新生成：列出所有非 draft 文章，让用户选一篇重新生成
3. 全部重新生成：对所有非 draft 文章重新生成摘要
"""

import os
import re
import sys
import glob
import json
import requests
from dotenv import load_dotenv

# 路径配置（脚本在 tools/，posts 在 blog/content/posts/）
BASE_DIR = os.path.dirname(os.path.abspath(__file__))      # blog/tools/
BLOG_DIR = os.path.dirname(BASE_DIR)                       # blog/
POSTS_DIR = os.path.join(BLOG_DIR, 'content', 'posts')     # blog/content/posts/

# .env 优先从脚本同级目录查找（tools/.env），再查找博客根目录（blog/.env）
TOOLS_ENV = os.path.join(BASE_DIR, '.env')
BLOG_ENV = os.path.join(BLOG_DIR, '.env')
ENV_FILE = TOOLS_ENV if os.path.exists(TOOLS_ENV) else BLOG_ENV

API_URL = "https://api.siliconflow.cn/v1/chat/completions"
MODEL = "Qwen/Qwen3-8B"


def load_env():
    """加载环境变量"""
    if not os.path.exists(ENV_FILE):
        print(f"错误：未找到 {ENV_FILE}，请先复制 .env.example 为 .env 并填入 SILICONFLOW_API_KEY")
        sys.exit(1)
    load_dotenv(ENV_FILE)
    api_key = os.getenv("SILICONFLOW_API_KEY")
    if not api_key or api_key == "your_siliconflow_api_key_here":
        print(f"错误：SILICONFLOW_API_KEY 未配置，请编辑 .env 文件填入真实 Key")
        sys.exit(1)
    return api_key


def parse_frontmatter(content):
    """
    解析 frontmatter。
    返回 (frontm_dict, frontm_raw, body_str)
    frontm_dict: 解析后的键值字典（支持 simple key: value / key: "value" / key: 'value'）
    frontm_raw:  ---  之间的原始文本
    body_str:   ---  之后的正文文本
    """
    if not content.startswith('---\n'):
        return {}, '', content
    match = re.match(r'^---\n(.*?)\n---\n(.*)$', content, re.DOTALL)
    if not match:
        return {}, '', content
    frontm_raw = match.group(1)
    body = match.group(2)
    frontm = {}
    for line in frontm_raw.split('\n'):
        line = line.strip()
        if not line or ':' not in line:
            continue
        key, _, val = line.partition(':')
        key = key.strip()
        val = val.strip()
        if val.startswith('"') and val.endswith('"'):
            val = val[1:-1]
        elif val.startswith("'") and val.endswith("'"):
            val = val[1:-1]
        frontm[key] = val
    return frontm, frontm_raw, body


def is_draft(frontm):
    """判断是否为草稿"""
    return str(frontm.get('draft', '')).lower() == 'true'


def has_summary(frontm):
    """判断是否已生成摘要"""
    return bool(frontm.get('aiSummary', '').strip())


def generate_summary(api_key, title, description, body):
    """调用硅基流动 API 生成摘要"""
    prompt = (
        "请为以下博客文章生成一段中文 AI 摘要，要求：\n"
        "1. 语言简洁，概括文章核心要点\n"
        "2. 适合作为文章页顶部的 AI 摘要卡片正文\n"
        "3. 直接输出摘要内容，不要加任何前缀、说明或引号\n\n"
        f"文章标题：{title}\n"
        f"文章描述（可选）：{description or '(无描述)'}\n\n"
        f"文章正文全文：\n{body}\n\n"
        "输出仅为摘要正文，无其他废话。"
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 512
    }

    resp = requests.post(API_URL, headers=headers, json=payload, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    return data["choices"][0]["message"]["content"].strip()


def write_summary(filepath, summary, frontm_raw, body):
    """将 aiSummary 写回 frontm。如果已有字段则覆盖，没有则在末尾追加。"""
    if not summary.strip():
        print(f"警告：生成的摘要为空，未写入 {filepath}")
        return

    # 已存在 aiSummary：直接替换值
    if re.search(r'^aiSummary\s*:', frontm_raw, re.MULTILINE):
        new_frontm_raw = re.sub(
            r'^aiSummary\s*:\s*.*$',
            f'aiSummary: "{summary}"',
            frontm_raw,
            flags=re.MULTILINE
        )
    else:
        # 不存在：在 --- 闭合前追加一行
        insert_pos = frontm_raw.rfind('---')
        if insert_pos >= 0:
            new_frontm_raw = (
                frontm_raw[:insert_pos] +
                f'\naiSummary: "{summary}"' +
                frontm_raw[insert_pos:]
            )
        else:
            new_frontm_raw = frontm_raw + f'\naiSummary: "{summary}"'

    new_content = f"---\n{new_frontm_raw}\n---\n{body}"
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)


def list_posts():
    """列出所有 posts 文章及其 frontm 状态"""
    posts = []
    for filepath in sorted(glob.glob(os.path.join(POSTS_DIR, '*.md'))):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        frontm, frontm_raw, body = parse_frontmatter(content)
        posts.append({
            'path': filepath,
            'name': os.path.basename(filepath),
            'title': frontm.get('title', '(无标题)'),
            'draft': is_draft(frontm),
            'has_summary': has_summary(frontm),
            'summary': frontm.get('aiSummary', '')
        })
    return posts


def main():
    api_key = load_env()
    posts = list_posts()

    non_draft = [p for p in posts if not p['draft']]
    no_summary_posts = [p for p in non_draft if not p['has_summary']]

    print(f"博客文章总数：{len(posts)} 篇")
    print(f"非草稿文章：{len(non_draft)} 篇")
    print(f"未生成摘要的非草稿文章：{len(no_summary_posts)} 篇\n")

    print("请选择操作：")
    print("1. 跳过已生成摘要的文章（只处理未生成摘要的非 draft 文章）")
    print("2. 选择一篇文章重新生成 AI 摘要")
    print("3. 全部重新生成 AI 摘要（所有非 draft 文章）")

    choice = input("\n请输入选项 (1/2/3): ").strip()

    if choice == '1':
        if not no_summary_posts:
            print("所有非草稿文章都已生成摘要。")
            return

        print("以下文章未生成摘要（将逐个询问是否生成）：")
        for i, p in enumerate(no_summary_posts, 1):
            print(f"  {i}. 《{p['title']}》 ({p['name']})")

        idx = 0
        while idx < len(no_summary_posts):
            p = no_summary_posts[idx]
            ans = input(f"\n为《{p['title']}》生成摘要？(y/n/q): ").strip().lower()
            if ans == 'q':
                print("已退出。")
                return
            if ans == 'y':
                try:
                    with open(p['path'], encoding='utf-8') as f:
                        content = f.read()
                    frontm, frontm_raw, body = parse_frontmatter(content)
                    summary = generate_summary(api_key, p['title'], p.get('description', ''), body)
                    write_summary(p['path'], summary, frontm_raw, body)
                    print(f"  ✓ 已生成：{summary[:80]}...")
                except Exception as e:
                    print(f"  ✗ 生成失败：{e}")
            idx += 1
            if idx >= len(no_summary_posts):
                break

    elif choice == '2':
        if not non_draft:
            print("没有非草稿文章。")
            return
        print("\n非草稿文章列表：")
        for i, p in enumerate(non_draft, 1):
            mark = " [已有摘要]" if p['has_summary'] else ""
            print(f"  {i}. 《{p['title']}》 ({p['name']}){mark}")

        idx_input = input("\n请输入文章序号: ").strip()
        try:
            idx = int(idx_input) - 1
            if idx < 0 or idx >= len(non_draft):
                print("序号无效。")
                return
        except ValueError:
            print("请输入有效的数字。")
            return

        p = non_draft[idx]
        try:
            with open(p['path'], encoding='utf-8') as f:
                content = f.read()
            frontm, frontm_raw, body = parse_frontmatter(content)
            if p['has_summary']:
                overwrite = input(f"《{p['title']}》已有摘要，是否覆盖？(y/n): ").strip().lower()
                if overwrite != 'y':
                    print("已跳过。")
                    return
            summary = generate_summary(api_key, p['title'], p.get('description', ''), body)
            write_summary(p['path'], summary, frontm_raw, body)
            print(f"✓ 已为《{p['title']}》生成摘要：{summary[:80]}...")
        except Exception as e:
            print(f"生成失败：{e}")

    elif choice == '3':
        if not non_draft:
            print("没有非草稿文章。")
            return
        confirm = input(f"确定要对全部 {len(non_draft)} 篇非草稿文章重新生成摘要吗？(y/n): ").strip().lower()
        if confirm != 'y':
            print("已取消。")
            return
        for p in non_draft:
            try:
                with open(p['path'], encoding='utf-8') as f:
                    content = f.read()
                frontm, frontm_raw, body = parse_frontmatter(content)
                summary = generate_summary(api_key, p['title'], p.get('description', ''), body)
                write_summary(p['path'], summary, frontm_raw, body)
                print(f"✓ {p['title']}: {summary[:80]}...")
            except Exception as e:
                print(f"✗ {p['title']}: {e}")

    else:
        print("无效选项，请输入 1/2/3。")


if __name__ == '__main__':
    main()