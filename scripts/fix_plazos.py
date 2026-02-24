import json
import os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = [
    os.path.join(BASE, "public", "contaminantes.json"),
    os.path.join(BASE, "data", "contaminantes.json"),
]

def fix_plazos():
    for path in TARGETS:
        if not os.path.exists(path):
            print(f"Skipping {path}")
            continue
            
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        fixed_to_15 = 0
        fixed_to_8 = 0
        
        for c in data:
            ref = c.get("conc_fact_prueba", "")
            cod_8d = c.get("codigo_8d", "")
            cod_15d = c.get("codigo_15d", "")
            current_plazo = c.get("plazo_entrega", "")
            
            # Case 1: Reference is the 15-day code but plazo is not 15
            if ref and ref == cod_15d:
                if "15" not in current_plazo:
                    c["plazo_entrega"] = "15 días laborables"
                    fixed_to_15 += 1
            
            # Case 2: Reference is the 8-day code but plazo is not 8
            elif ref and ref == cod_8d:
                if "8" not in current_plazo:
                    c["plazo_entrega"] = "8 días laborables"
                    fixed_to_8 += 1
                    
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        print(f"✅ {path}: Fixed {fixed_to_15} to 15 days, {fixed_to_8} to 8 days.")

if __name__ == "__main__":
    fix_plazos()
