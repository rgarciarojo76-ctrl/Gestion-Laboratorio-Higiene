import pandas as pd
import json
import os
from openpyxl.styles import PatternFill

# Paths
# Use absolute paths to avoid cwd issues
BASE_DIR = "/Users/rubengarciarojo/.gemini/antigravity/workspaces/Gestion-Laboratorio-Higiene"
JSON_PATH = os.path.join(BASE_DIR, "src/data/contaminantes.json")
EXCEL_PATH = os.path.join(BASE_DIR, "data/Campos desarrollos App Gestión Laboratorio.xlsx")

def load_data():
    """Load JSON data"""
    try:
        with open(JSON_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
            print(f"Loaded {len(data)} entries from {JSON_PATH}")
            return data
    except Exception as e:
        print(f"Error loading JSON: {e}")
        return []

def populate_excel(data):
    """Populate Excel file with data"""
    try:
        # Load Excel using openpyxl engine
        df = pd.read_excel(EXCEL_PATH, engine='openpyxl')
        
        # Prepare lists for new columns
        sinonimos = []
        obs_list = []
        incertidumbre_list = []
        desorcion_list = []
        
        # We will reconstruct the DataFrame based on our JSON data
        # because the original Excel is likely empty or we want to overwrite it fully
        # based on the user request "Rellena los datos".
        
        # Map data to rows
        rows = []
        
        for entry in data:
            row = {
                "Contaminante a medir": entry.get("contaminante", ""),
                "Número CAS": entry.get("cas", ""),
                "Sinónimo": entry.get("sinonimo", ""),
                "Soporte captación": entry.get("soporte_captacion", ""),
                "Referencia Echevarne Soporte Captación": entry.get("ref_soporte", ""),
                "Precio Soporte": "", # Leave empty as requested
                "Técnica analítica": entry.get("tecnica_analitica", ""),
                "Referencia Echevarne Técnica Análitica": entry.get("ref_tecnica", ""),
                "Precio Técnica Análitica": "", # Leave empty
                "Método de analisis ": entry.get("metodo_analisis", ""),
                "Referencia Echevarne Método Análisis": entry.get("ref_metodo", ""),
                "LOD": entry.get("lod", ""),
                "LOQ": entry.get("loq", ""),
                "Unidades LOQ/LOD": entry.get("unidades_loq_lod", "µg"),
                "Caudal (litros/minuto)": entry.get("caudal_l_min", ""),
                "Volumen recomendado": entry.get("volumen_recomendado_l", ""),
                "VLA ED (mg/m3)": entry.get("vla_ed_mg_m3", ""),
                "VLA EC (mg/m3)": entry.get("vla_ec_mg_m3", ""),
                "Observaciones": entry.get("observaciones", ""),
                "% Incertidumbre": entry.get("pct_incertidumbre", ""),
                "Desorción": entry.get("desorcion", "")
            }
            rows.append(row)
            
        # Create new DataFrame
        new_df = pd.DataFrame(rows)
        
        # Save to Excel
        new_df.to_excel(EXCEL_PATH, index=False, engine='openpyxl')
        print(f"Successfully populated {len(rows)} rows to {EXCEL_PATH}")
        
    except Exception as e:
        print(f"Error populating Excel: {e}")

if __name__ == "__main__":
    data = load_data()
    if data:
        populate_excel(data)
