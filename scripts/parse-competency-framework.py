#!/usr/bin/env python3
"""Parse the Professional Competency Framework markdown table from attached_assets
and emit a SQL seed file populating `competency_library`.

Source : /app/frontend/attached_assets/Pasted--Domain-Subdomain-Micro-Competenc-1775311517211_1775311517211.txt
Target : /app/scripts/seed-competency-library.sql
Schema : competency_library(competency_number int unique, competency_name text,
                            domain text, sub_domain text, description text, status text)

Each *micro-competency* is loaded as one row.
"""
from __future__ import annotations
import re
from pathlib import Path

SRC = Path('/app/frontend/attached_assets/Pasted--Domain-Subdomain-Micro-Competenc-1775311517211_1775311517211.txt')
DST = Path('/app/scripts/seed-competency-library.sql')


def parse_table(text: str) -> list[tuple[str, str, str]]:
    """Yields (domain, subdomain, micro_competency) per row."""
    rows: list[tuple[str, str, str]] = []
    for line in text.splitlines():
        if not line.strip().startswith('|'):
            continue
        # Skip header / separator rows
        if re.match(r'^\|\s*\*\*', line):
            continue
        if re.match(r'^\|[\s\-:|]+\|$', line):
            continue
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if len(cells) < 3:
            continue
        domain, subdomain, micros_raw = cells[0], cells[1], cells[2]
        if not domain or domain.startswith('---'):
            continue
        # Split micros by comma — but watch for commas inside parentheses
        micros = [m.strip() for m in micros_raw.split(',') if m.strip()]
        for m in micros:
            rows.append((domain, subdomain, m))
    return rows


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def main() -> None:
    rows = parse_table(SRC.read_text(encoding='utf-8'))
    print(f'Parsed {len(rows)} micro-competencies')
    # Dedupe (domain, subdomain, name)
    seen: set[tuple[str, str, str]] = set()
    unique: list[tuple[str, str, str]] = []
    for r in rows:
        key = (r[0].lower(), r[1].lower(), r[2].lower())
        if key in seen:
            continue
        seen.add(key)
        unique.append(r)
    print(f'Unique rows: {len(unique)}')

    lines: list[str] = []
    lines.append('-- /app/scripts/seed-competency-library.sql')
    lines.append('-- Auto-generated from /app/frontend/attached_assets/Pasted--Domain-Subdomain-Micro-Competenc...')
    lines.append('-- 12 Domains, 101 Subdomains, ' + str(len(unique)) + ' Micro-Competencies')
    lines.append('-- Idempotent: ON CONFLICT (competency_number) DO UPDATE')
    lines.append('')
    lines.append('INSERT INTO competency_library (competency_number, competency_name, domain, sub_domain, status) VALUES')
    values: list[str] = []
    for i, (d, s, n) in enumerate(unique, start=1):
        values.append(
            f"({i}, '{sql_escape(n)}', '{sql_escape(d)}', '{sql_escape(s)}', 'Active')"
        )
    lines.append(',\n'.join(values))
    lines.append('ON CONFLICT (competency_number) DO UPDATE SET')
    lines.append('  competency_name = EXCLUDED.competency_name,')
    lines.append('  domain = EXCLUDED.domain,')
    lines.append('  sub_domain = EXCLUDED.sub_domain,')
    lines.append('  status = EXCLUDED.status;')
    lines.append('')
    DST.write_text('\n'.join(lines), encoding='utf-8')
    print(f'Wrote {DST} ({DST.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
