#!/usr/bin/env python3
"""Generate /app/scripts/seed-concern-areas.sql from the seed-concerns.ts source.
Idempotent: drops & re-creates the table, then inserts 160 rows.
"""
from __future__ import annotations
import re
from pathlib import Path

SRC = Path('/app/frontend/server/src/scripts/seed-concerns.ts')
DST = Path('/app/scripts/seed-concern-areas.sql')


def parse() -> list[tuple[str, str, str, str, str]]:
    text = SRC.read_text()
    rows: list[tuple[str, str, str, str, str]] = []
    pattern = re.compile(
        r"\{\s*category:\s*'([^']*)',\s*concern_area:\s*'((?:[^'\\]|\\.)*)',\s*parent_worry:\s*'((?:[^'\\]|\\.)*)',\s*impact_on_child:\s*'((?:[^'\\]|\\.)*)',\s*assessment_type:\s*'([^']*)'\s*\}",
    )
    for m in pattern.finditer(text):
        cat, ca, pw, ic, at = m.groups()
        # Unescape \'  → '
        unescape = lambda s: s.replace("\\'", "'").replace('\\"', '"')
        rows.append((cat, unescape(ca), unescape(pw), unescape(ic), at))
    return rows


def sql_str(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def main() -> None:
    rows = parse()
    print(f'Parsed {len(rows)} concern areas')
    out: list[str] = []
    out.append('-- /app/scripts/seed-concern-areas.sql')
    out.append('-- Auto-generated from /app/frontend/server/src/scripts/seed-concerns.ts')
    out.append(f'-- {len(rows)} concern areas across all categories')
    out.append('-- Idempotent: safe to re-run')
    out.append('')
    out.append('''CREATE TABLE IF NOT EXISTS concern_areas (
  id              SERIAL PRIMARY KEY,
  category        TEXT NOT NULL,
  concern_area    TEXT NOT NULL,
  parent_worry    TEXT NOT NULL,
  impact_on_child TEXT NOT NULL,
  assessment_type TEXT,
  search_keywords TEXT,
  services        JSONB NOT NULL DEFAULT '[]'::jsonb,
  roles           JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (category, concern_area)
);
CREATE INDEX IF NOT EXISTS idx_concern_areas_category ON concern_areas(category);
CREATE INDEX IF NOT EXISTS idx_concern_areas_active ON concern_areas(is_active);
''')
    out.append('INSERT INTO concern_areas (category, concern_area, parent_worry, impact_on_child, assessment_type, search_keywords, sort_order) VALUES')
    values: list[str] = []
    for i, (cat, ca, pw, ic, at) in enumerate(rows, start=1):
        keywords = f'{cat} {ca} {pw} {ic}'.lower()
        values.append(
            f'  ({sql_str(cat)}, {sql_str(ca)}, {sql_str(pw)}, {sql_str(ic)}, {sql_str(at)}, {sql_str(keywords)}, {i})'
        )
    out.append(',\n'.join(values))
    out.append('ON CONFLICT (category, concern_area) DO UPDATE SET')
    out.append('  parent_worry = EXCLUDED.parent_worry,')
    out.append('  impact_on_child = EXCLUDED.impact_on_child,')
    out.append('  assessment_type = EXCLUDED.assessment_type,')
    out.append('  search_keywords = EXCLUDED.search_keywords,')
    out.append('  sort_order = EXCLUDED.sort_order,')
    out.append('  updated_at = now();')
    out.append('')
    DST.write_text('\n'.join(out))
    print(f'Wrote {DST} ({DST.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
