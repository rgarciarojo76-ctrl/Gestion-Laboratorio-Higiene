#!/usr/bin/env python3
"""
enrich_soportes.py
Enrich contaminantes.json with consolidated support codes from Excel.
Adds codigo_soporte, codigo_soporte_alt fields by matching CAS.
Takes the first valid value per CAS since supports are constant across analytical deadlines.
"""

import json
import os
import openpyxl

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCEL = os.path.join(BASE, "data", "Base de conocimiento completa 2026.xlsx")
TARGETS = [
    os.path.join(BASE, "public", "contaminantes.json"),
    os.path.join(BASE, "data", "contaminantes.json"),
]

def build_excel_lookup():
    """Build a lookup: CAS -> {codigo_soporte, codigo_soporte_alt}"""
    wb = openpyxl.load_workbook(EXCEL, read_only=True)
    ws = wb["Intranet Cargar PRUEBAS"]

    lookup = {}

    for row in ws.iter_rows(min_row=2, values_only=True):
        cas = str(row[0] or "").strip()
        if not cas or "-" not in cas:
            continue
            
        codigo_soporte = str(row[18] or "").strip()
        codigo_soporte_alt = str(row[19] or "").strip()

        if cas not in lookup:
            lookup[cas] = {"codigo_soporte": "", "codigo_soporte_alt": ""}
            
        entry = lookup[cas]
        
        if not entry["codigo_soporte"] and codigo_soporte and codigo_soporte.lower() != "none":
            entry["codigo_soporte"] = codigo_soporte
            
        if not entry["codigo_soporte_alt"] and codigo_soporte_alt and codigo_soporte_alt.lower() != "none":
            entry["codigo_soporte_alt"] = codigo_soporte_alt

    wb.close()
    return lookup

def enrich():
    lookup = build_excel_lookup()
    print(f"Excel lookup built: {len(lookup)} unique CAS numbers")

    for path in TARGETS:
        if not os.path.exists(path):
            print(f"Skipping {path} (not found)")
            continue

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        enriched = 0
        for c in data:
            cas = str(c.get("cas", "")).strip()
            if not cas or cas not in lookup:
                continue

            info = lookup[cas]
            
            # Using the exact fields requested by user: codigo_soporte and codigo_soporte_alt
            if info["codigo_soporte"]:
                c["codigo_soporte"] = info["codigo_soporte"]
                # Ref soporte is often mapped to the same code
                if not c.get("ref_soporte"):
                    c["ref_soporte"] = info["codigo_soporte"]
                    
            if info["codigo_soporte_alt"]:
                c["codigo_soporte_alt"] = info["codigo_soporte_alt"]
                
            enriched += 1

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"✅ {path}: Enriched {enriched}/{len(data)} products")

if __name__ == "__main__":
    enrich()
