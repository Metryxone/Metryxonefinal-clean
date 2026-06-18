from __future__ import annotations

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
