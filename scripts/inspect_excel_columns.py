import pandas as pd
import os

file_path = "data/Campos desarrollos App Gestión Laboratorio.xlsx"

# Using openpyxl explicitly just in case pandas default fails somehow
try:
    df = pd.read_excel(file_path, engine='openpyxl')
    print("Columns found:")
    for col in df.columns:
        print(f"- {col}")
    
    print("\nFirst 5 rows (head):")
    print(df.head().to_string())
except Exception as e:
    print(f"Error reading Excel file: {e}")
