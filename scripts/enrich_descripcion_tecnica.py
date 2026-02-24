#!/usr/bin/env python3
"""
enrich_descripcion_tecnica.py
Enrich contaminantes.json with consolidated lab codes from Excel.
Adds codigo_8d, codigo_15d fields by matching CAS + codigo_prueba.
"""

import json
import os
import openpyxl
from collections import defaultdict

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCEL = os.path.join(BASE, "data", "Base de conocimiento completa 2026.xlsx")
TARGETS = [
    os.path.join(BASE, "public", "contaminantes.json"),
    os.path.join(BASE, "data", "contaminantes.json"),
]

def build_excel_lookup():
    """Build a lookup: (CAS, codigo_prueba) -> {codigo_8d, codigo_15d, desc_tecnica}"""
    wb = openpyxl.load_workbook(EXCEL, read_only=True)
    ws = wb["Intranet Cargar PRUEBAS"]

    # key = (cas, cod_prueba)
    lookup = defaultdict(lambda: {"codigo_8d": "", "codigo_15d": "", "descripcion_tecnica": ""})

    for row in ws.iter_rows(min_row=2, values_only=True):
        cas = str(row[0] or "").strip()
        if not cas or "-" not in cas:
            continue
        cod_prueba = str(row[4] or "").strip()
        conc_fact = str(row[5] or "").strip()
        plazo = str(row[14] or "").lower()
        desc_tecnica = str(row[10] or "").strip()

        key = (cas, cod_prueba)
        entry = lookup[key]

        if desc_tecnica and not entry["descripcion_tecnica"]:
            entry["descripcion_tecnica"] = desc_tecnica

        if "8" in plazo:
            entry["codigo_8d"] = conc_fact
        elif "15" in plazo:
            entry["codigo_15d"] = conc_fact

    wb.close()
    return dict(lookup)


def enrich():
    lookup = build_excel_lookup()
    print(f"Excel lookup built: {len(lookup)} (CAS, cod_prueba) combinations")

    for path in TARGETS:
        if not os.path.exists(path):
            print(f"Skipping {path} (not found)")
            continue

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        enriched = 0
        for c in data:
            cas = str(c.get("cas", "")).strip()
            cod = str(c.get("codigo_prueba", "")).strip()
            if not cas:
                continue

            key = (cas, cod)
            if key in lookup:
                info = lookup[key]
                if info["codigo_8d"]:
                    c["codigo_8d"] = info["codigo_8d"]
                if info["codigo_15d"]:
                    c["codigo_15d"] = info["codigo_15d"]
                if info["descripcion_tecnica"] and not c.get("descripcion_tecnica"):
                    c["descripcion_tecnica"] = info["descripcion_tecnica"]
                    
                # Synchronize plazo_entrega with the primary reference code
                primary_code = c.get("conc_fact_prueba", "")
                if primary_code:
                    if primary_code == info["codigo_8d"]:
                        c["plazo_entrega"] = "8 días laborables"
                    elif primary_code == info["codigo_15d"]:
                        c["plazo_entrega"] = "15 días laborables"
                        
                enriched += 1

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"✅ {path}: Enriched {enriched}/{len(data)} products")


if __name__ == "__main__":
    enrich()
