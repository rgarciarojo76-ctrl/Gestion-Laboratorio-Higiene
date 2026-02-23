import json
import os
import re
import openpyxl

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
EXCEL_PATH = os.path.join(BASE_DIR, "data", "Base de conocimiento completa 2026.xlsx")
TARGETS = [
    os.path.join(BASE_DIR, "public", "contaminantes.json"),
    os.path.join(BASE_DIR, "data", "contaminantes.json")
]


def parse_caudal_range(val_str):
    """
    Parses a string like '0,03 - 1,5' or '0.5' into floats (min_val, max_val).
    If single value, min_val == max_val.
    Returns (None, None) if invalid.
    """
    if not val_str:
        return None, None
    val_str = str(val_str).strip().replace(',', '.')
    
    # Try range pattern first "A - B"
    m_range = re.match(r'^([\d\.]+)\s*-\s*([\d\.]+)$', val_str)
    if m_range:
        try:
            return float(m_range.group(1)), float(m_range.group(2))
        except ValueError:
            return None, None
            
    # Try single numeric value "A"
    try:
        val = float(val_str)
        return val, val
    except ValueError:
        return None, None


def build_excel_lookup():
    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    ws = wb["VLA-ED (y VLA-EC) pruebas ind."]
    
    lookup = {}
    
    # Iterate from row 2 to end handling header
    for row in ws.iter_rows(min_row=2):
        cas = str(row[4].value or "").strip() # Column 5 (E) is CAS
        if not cas or cas == "None":
            continue
            
        caudal_metodo = str(row[12].value or "").strip() # Column 13 (M): Caudal método(L/min)
        caudal_asignado = str(row[26].value or "").strip() # Column 27 (AA): Caudal asignado(L/min)
        
        # Parse ranges from the text
        c_min, c_max = parse_caudal_range(caudal_metodo)
        
        # Parse assigned value (single float)
        c_asig = None
        if caudal_asignado and caudal_asignado.lower() != "none":
            try:
                c_asig = float(caudal_asignado.replace(',', '.'))
            except ValueError:
                pass
                
        lookup[cas] = {
            "caudal_metodo_min": c_min,
            "caudal_metodo_max": c_max,
            "caudal_asignado": c_asig
        }
        
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
            
            if info["caudal_metodo_min"] is not None:
                c["caudal_metodo_min"] = info["caudal_metodo_min"]
            if info["caudal_metodo_max"] is not None:
                c["caudal_metodo_max"] = info["caudal_metodo_max"]
            if info["caudal_asignado"] is not None:
                c["caudal_asignado"] = info["caudal_asignado"]
                
                # Update the display "caudal" string if we have an assigned one to keep UI backward compat
                # as a fallback
                c["caudal"] = f"{info['caudal_asignado']} L/min"
                
            enriched += 1

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        print(f"✅ {path}: Enriched {enriched}/{len(data)} products")


if __name__ == "__main__":
    enrich()
