from __future__ import annotations
from typing import Any

import pandas as pd

def parse_upload(file, sheet_name: str | None = None) -> pd.DataFrame:
    """
    Read CSV/XLSX -> DataFrame.
    Keep everything as string first to avoid dtype surprises.
    """
    fname = (getattr(file, "filename", "") or "").lower()

    if fname.endswith(".csv"):
        return pd.read_csv(
            file.file,
            dtype=str,
            keep_default_na=False,
            encoding="utf-8-sig",
        )

    # Excel
    if sheet_name:
        return pd.read_excel(file.file, sheet_name=sheet_name, dtype=str)
    return pd.read_excel(file.file, dtype=str)


def norm_key(k: Any) -> str:
    s = str(k or "").strip().lower()
    return s.replace(" ", "").replace("-", "").replace("/", "")

def to_bool(v: Any) -> bool | None:
    if v is None: return None
    if isinstance(v, bool): return v
    s = str(v).strip().lower()
    if s in {"", "none", "null"}: return None
    if s in {"1","true","yes","y","active"}: return True
    if s in {"0","false","no","n","inactive"}: return False
    return None

def to_int(v: Any) -> int | None:
    if v is None: return None
    if isinstance(v, int): return v
    s = str(v).strip()
    if s == "": return None
    try: return int(float(s))
    except: return None

def apply_aliases(raw: dict[str, Any], aliases: dict[str, str]) -> dict[str, Any]:
    out = {}
    for k, v in raw.items():
        nk = norm_key(k)
        target = aliases.get(nk)
        if not target:
            target = str(k).strip().replace(" ", "_").replace("-", "_").lower()
        out[target] = v
    # trim strings to None
    for k, v in list(out.items()):
        if isinstance(v, str):
            vv = v.strip()
            out[k] = vv if vv != "" else None
    return out
