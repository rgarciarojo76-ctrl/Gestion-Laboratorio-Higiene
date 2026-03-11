#!/usr/bin/env python3
"""
Enriquece contaminantes.json con campos de Volumen de Ruptura (VR).

Lógica:
  1. Parsea el campo `volumen_minimo` (ej: "1-30 L\n(15 L)") y extrae el valor máximo del rango.
  2. Si existe `v_maximo_muestreo` con dato → usa ese valor como VR directo.
  3. Si no, aplica el criterio de seguridad: V_seguro = Vmáx_rango × 0.5
  4. Registra el origen del dato para transparencia en el frontend.

Campos nuevos añadidos:
  - v_ruptura          (float | null)  – Volumen seguro de ruptura estimado (L)
  - v_ruptura_origen   (str)           – Origen: "VR específico" | "Estimado (50% Vmáx MTA)"
  - v_max_rango_mta    (float | null)  – Valor máximo del rango del método (L)

Uso:
  python3 scripts/enrich_vr.py
"""

import json
import re
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
SRC_JSON = os.path.join(PROJECT_ROOT, "src", "data", "contaminantes.json")


def parse_volumen_maximo(vol_str):
    """Extrae el valor máximo de un string de volumen.
    
    Ejemplos:
      "1-30 L\n(15 L)" → 30.0
      "10 L"           → 10.0
      "0,5-5 L"        → 5.0
      "50"             → 50.0
      ""               → None
    """
    if not vol_str:
        return None
    s = str(vol_str).replace("L", "").replace("l", "").strip()
    
    # Try range "X-Y"
    range_match = re.search(r'([\d.,]+)\s*[-–—]\s*([\d.,]+)', s)
    if range_match:
        return float(range_match.group(2).replace(",", "."))
    
    # Try plain number (first occurrence)
    num_match = re.search(r'([\d.,]+)', s)
    if num_match:
        return float(num_match.group(1).replace(",", "."))
    
    return None


def main():
    print(f"📂 Leyendo {SRC_JSON}...")
    with open(SRC_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    print(f"   Total contaminantes: {len(data)}")
    
    enriched = 0
    with_vr_specific = 0
    with_vr_estimated = 0
    without_data = 0
    
    for item in data:
        v_max_muestreo_raw = item.get("v_maximo_muestreo", "")
        volumen_minimo_raw = item.get("volumen_minimo", "")
        
        # 1. Try specific VR from v_maximo_muestreo field
        v_max_muestreo = parse_volumen_maximo(v_max_muestreo_raw)
        
        # 2. Parse maximum from volumen_minimo range
        v_max_rango = parse_volumen_maximo(volumen_minimo_raw)
        
        item["v_max_rango_mta"] = v_max_rango
        
        if v_max_muestreo and v_max_muestreo > 0:
            # VR específico disponible
            item["v_ruptura"] = v_max_muestreo
            item["v_ruptura_origen"] = "VR específico según MTA"
            with_vr_specific += 1
            enriched += 1
        elif v_max_rango and v_max_rango > 0:
            # Fallback: 50% del máximo del rango
            item["v_ruptura"] = round(v_max_rango * 0.5, 2)
            item["v_ruptura_origen"] = "Estimado (50% Vmáx MTA)"
            with_vr_estimated += 1
            enriched += 1
        else:
            item["v_ruptura"] = None
            item["v_ruptura_origen"] = ""
            without_data += 1
    
    # Write back
    with open(SRC_JSON, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Enriquecimiento completado:")
    print(f"   🟢 Con VR específico:  {with_vr_specific}")
    print(f"   🟡 Con VR estimado:    {with_vr_estimated}")
    print(f"   ⚪ Sin datos:          {without_data}")
    print(f"   Total enriquecidos:    {enriched}/{len(data)}")
    print(f"\n📁 Archivo actualizado: {SRC_JSON}")


if __name__ == "__main__":
    main()
