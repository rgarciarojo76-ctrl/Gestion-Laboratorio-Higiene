import pdfplumber
import os

PDF_PATH = "/Users/rubengarciarojo/.gemini/antigravity/workspaces/Gestion-Laboratorio-Higiene/MTMHI2025v01.pdf"

with pdfplumber.open(PDF_PATH) as pdf:
    print(f"Pages: {len(pdf.pages)}")
    for i in range(98, 108): # Inspect pages 98-108
        page = pdf.pages[i]
        text = page.extract_text()
        tables = page.extract_tables()
        
        print(f"--- Page {i+1} ---")
        # Check for specific keywords
        if "Anexo I" in text:
            print("FOUND 'Anexo I' in text!")
            # print(text[:500]) # Print context
        
        if "Nota" in text:
            print("FOUND 'Nota' in text!")

        if tables:
            for table in tables:
                if len(table) > 0:
                    for row in table:
                        row_str = str(row)
                        if "Anexo I" in row_str or "Nota" in row_str:
                             print(f"FOUND INTERESTING ROW on Page {i+1}: {row}")
        print("\n")
