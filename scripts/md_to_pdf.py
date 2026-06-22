#!/usr/bin/env python3
"""Convert reports/phase1_workflow.md into a styled PDF (pure-Python, no native deps)."""
import re
import markdown
from xhtml2pdf import pisa

SRC = "reports/phase1_workflow.md"
OUT = "reports/phase1_workflow.pdf"

GLYPHS = {
    "\U0001F7E1": "[AMBER]",   # 🟡
    "\U0001F7E2": "[GREEN]",   # 🟢
    "\U0001F534": "[RED]",     # 🔴
    "\u2705": "[OK]",          # ✅
    "\u2699": "[ENGINE]",      # ⚙
    "\u26A0": "[WARN]",        # ⚠
    "\uFE0F": "",              # variation selector
    "\u25B6": ">",             # ▶
    "\u2502": "|",             # │
    "\u2514": "`",             # └
    "\u251C": "|",             # ├
    "\u2500": "-",             # ─
}

with open(SRC, encoding="utf-8") as f:
    text = f.read()

for k, v in GLYPHS.items():
    text = text.replace(k, v)

html_body = markdown.markdown(
    text,
    extensions=["tables", "fenced_code", "toc", "sane_lists", "nl2br"],
)

CSS = """
@page { size: A4; margin: 1.6cm 1.5cm; @frame footer { -pdf-frame-content: footerContent; bottom: 0.7cm; margin-left: 1.5cm; margin-right: 1.5cm; height: 1cm; } }
body { font-family: Helvetica, sans-serif; font-size: 9.5px; line-height: 1.45; color: #1f2733; }
h1 { font-size: 22px; color: #0f2a43; border-bottom: 2px solid #1f6f8b; padding-bottom: 4px; margin-top: 18px; }
h2 { font-size: 16px; color: #14506b; margin-top: 16px; border-bottom: 1px solid #cdd8e0; padding-bottom: 2px; }
h3 { font-size: 13px; color: #1f6f8b; margin-top: 12px; }
h4 { font-size: 11px; color: #2c3e50; margin-top: 10px; }
p { margin: 4px 0; }
a { color: #1f6f8b; text-decoration: none; }
code { font-family: Courier, monospace; font-size: 8.5px; background: #eef2f5; color: #b03a2e; padding: 0 2px; }
pre { font-family: Courier, monospace; font-size: 8px; background: #f4f6f8; border: 1px solid #dde4ea; padding: 6px; color: #1f2733; }
pre code { background: transparent; color: #1f2733; padding: 0; }
table { width: 100%; border-collapse: collapse; margin: 8px 0; }
th { background: #1f6f8b; color: #ffffff; font-size: 8.5px; padding: 4px 5px; text-align: left; border: 1px solid #1f6f8b; }
td { font-size: 8.5px; padding: 4px 5px; border: 1px solid #cdd8e0; vertical-align: top; }
tr:nth-child(even) td { background: #f4f7f9; }
blockquote { background: #fdf6e3; border-left: 3px solid #d9a441; margin: 6px 0; padding: 5px 9px; color: #4a3f1f; }
hr { border: none; border-top: 1px solid #cdd8e0; margin: 12px 0; }
ul, ol { margin: 4px 0 4px 14px; }
li { margin: 2px 0; }
strong { color: #0f2a43; }
"""

html = f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>{CSS}</style></head>
<body>{html_body}
<div id="footerContent" style="font-size:7.5px;color:#7a8794;text-align:center;">
MetryxOne Platform Manual &mdash; Phase 1 to 6.15 &nbsp;|&nbsp; page <pdf:pagenumber> of <pdf:pagecount>
</div>
</body></html>"""

with open(OUT, "w+b") as out:
    result = pisa.CreatePDF(html, dest=out, encoding="utf-8")

if result.err:
    raise SystemExit(f"PDF generation failed with {result.err} error(s)")
print(f"Wrote {OUT}")
