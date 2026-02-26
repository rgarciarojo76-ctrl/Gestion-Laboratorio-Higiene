#!/usr/bin/env python3
"""
enrich_transporte.py
───────────────────
Reads the 'Intranet V0 DTI' sheet from the knowledge base Excel file,
extracts the 'transporte' column, and enriches contaminantes.json
with a new 'transporte' field per product.

Match key: Excel 'CÓDIGO' → JSON 'id'
Default: if empty → "Temperatura ambiente"
"""

import json
import openpyxl
from pathlib import Path

EXCEL_PATH = Path("data/Base de conocimiento completa 2026.xlsx")
JSON_PATH  = Path("public/contaminantes.json")
SHEET_NAME = "Intranet V0 DTI"
DEFAULT_TRANSPORTE = "Temperatura ambiente"

print(f"Loading Excel: {EXCEL_PATH}…")
wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
ws = wb[SHEET_NAME]

rows = list(ws.iter_rows(values_only=True))
headers = rows[0]
print(f"Headers: {headers[:12]}")

# Build lookup: CÓDIGO → transporte
col_codigo    = headers.index("CÓDIGO")
col_transporte = headers.index("transporte")

excel_map = {}
for row in rows[1:]:
    codigo = row[col_codigo]
    transporte = row[col_transporte]
    if codigo:
        key = str(codigo).strip()
        val = str(transporte).strip() if transporte else DEFAULT_TRANSPORTE
        if not val or val == "None":
            val = DEFAULT_TRANSPORTE
        excel_map[key] = val

print(f"Found {len(excel_map)} entries in Excel.")

# Show unique transport values
unique_vals = sorted(set(excel_map.values()))
print("\nUnique transporte values:")
for v in unique_vals:
    print(f"  - {v!r}")

# Load JSON
with open(JSON_PATH, encoding="utf-8") as f:
    contaminants = json.load(f)

updated = 0
not_found = 0

for c in contaminants:
    product_id = str(c.get("id", "")).strip()
    if product_id in excel_map:
        c["transporte"] = excel_map[product_id]
        updated += 1
    else:
        # Use existing value or default
        if not c.get("transporte"):
            c["transporte"] = DEFAULT_TRANSPORTE
        not_found += 1

print(f"\nUpdated: {updated} products")
print(f"Not found in Excel (set to default): {not_found} products")

# Save both JSON copies
for path in [JSON_PATH, Path("data/contaminantes.json")]:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(contaminants, f, indent=2, ensure_ascii=False)
    print(f"Saved: {path}")

print("\nDone! ✅")
