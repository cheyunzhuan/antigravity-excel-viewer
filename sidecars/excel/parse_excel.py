#!/usr/bin/env python3
"""Parse Excel (.xlsx/.xlsm) and delimited (.csv/.tsv) files to JSON."""

from __future__ import annotations

import argparse
import csv
from datetime import date, datetime, time
import json
from pathlib import Path
import sys


def format_cell(val) -> str:
    if val is None:
        return ""
    if isinstance(val, datetime):
        if val.hour == 0 and val.minute == 0 and val.second == 0:
            return val.strftime("%Y-%m-%d")
        return val.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(val, date):
        return val.strftime("%Y-%m-%d")
    if isinstance(val, time):
        return val.strftime("%H:%M:%S")
    if isinstance(val, float):
        if val.is_integer():
            return str(int(val))
        return f"{val:.6g}" if abs(val) >= 1e12 else str(round(val, 6)).rstrip("0").rstrip(".")
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    return str(val)


def parse_csv(path: Path, max_rows: int, max_cols: int) -> dict:
    delimiter = "\t" if path.suffix.lower() == ".tsv" else ","
    raw = path.read_bytes()
    text = None
    for enc in ("utf-8-sig", "utf-8", "gb18030", "latin-1"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        text = raw.decode("utf-8", errors="replace")

    rows: list[list[str]] = []
    total_rows = 0
    total_cols = 0
    truncated_rows = False
    truncated_cols = False

    reader = csv.reader(text.splitlines(), delimiter=delimiter)
    for idx, row in enumerate(reader):
        total_rows += 1
        if len(row) > total_cols:
            total_cols = len(row)
        if idx < max_rows:
            if len(row) > max_cols:
                truncated_cols = True
                rows.append([str(c) for c in row[:max_cols]])
            else:
                rows.append([str(c) for c in row])
        else:
            truncated_rows = True

    return {
        "fileName": path.name,
        "path": str(path),
        "sheets": [path.stem],
        "activeSheet": path.stem,
        "totalRows": total_rows,
        "totalCols": total_cols,
        "truncatedRows": truncated_rows,
        "truncatedCols": truncated_cols,
        "rows": rows,
    }


def parse_xlsx(path: Path, sheet_name: str | None, max_rows: int, max_cols: int) -> dict:
    import openpyxl  # noqa: PLC0415

    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    try:
        sheets = list(wb.sheetnames)
        if not sheets:
            return {
                "fileName": path.name,
                "path": str(path),
                "sheets": [],
                "activeSheet": "",
                "totalRows": 0,
                "totalCols": 0,
                "truncatedRows": False,
                "truncatedCols": False,
                "rows": [],
            }
        active = sheet_name if sheet_name in sheets else sheets[0]
        ws = wb[active]

        rows: list[list[str]] = []
        total_rows = 0
        total_cols = 0
        truncated_rows = False
        truncated_cols = False

        for idx, row in enumerate(ws.iter_rows(values_only=True)):
            total_rows += 1
            row_len = len(row)
            if row_len > total_cols:
                total_cols = row_len
            if idx < max_rows:
                if row_len > max_cols:
                    truncated_cols = True
                    sliced = row[:max_cols]
                else:
                    sliced = row
                rows.append([format_cell(c) for c in sliced])
            else:
                truncated_rows = True

        # Trim trailing completely empty rows for cleaner display
        while rows and all(cell == "" for cell in rows[-1]):
            rows.pop()

        return {
            "fileName": path.name,
            "path": str(path),
            "sheets": sheets,
            "activeSheet": active,
            "totalRows": total_rows,
            "totalCols": total_cols,
            "truncatedRows": truncated_rows,
            "truncatedCols": truncated_cols,
            "rows": rows,
        }
    finally:
        wb.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True)
    parser.add_argument("--sheet", default="")
    parser.add_argument("--max-rows", type=int, default=500)
    parser.add_argument("--max-cols", type=int, default=60)
    args = parser.parse_args()

    path = Path(args.file).expanduser()
    if not path.is_file():
        print(json.dumps({"error": "File not found"}))
        return 1

    ext = path.suffix.lower()
    if ext in (".csv", ".tsv"):
        data = parse_csv(path, args.max_rows, args.max_cols)
    elif ext in (".xlsx", ".xlsm", ".xltx", ".xltm"):
        data = parse_xlsx(path, args.sheet or None, args.max_rows, args.max_cols)
    else:
        print(json.dumps({"error": f"Unsupported format: {ext} (supported: .xlsx, .xlsm, .csv, .tsv)"}))
        return 1

    print(json.dumps(data, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
