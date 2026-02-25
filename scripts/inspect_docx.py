import os
from docx import Document

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DOCX_PATH = os.path.join(BASE_DIR, "MTMHI2025v01.docx")

def inspect_docx():
    print(f"Loading {DOCX_PATH}...")
    doc = Document(DOCX_PATH)
    
    for i, table in enumerate(doc.tables[:3]):
        print(f"\n--- Table {i} ---")
        for row in table.rows[:2]:
            print("Row:", [c.text.strip() for c in row.cells])

if __name__ == "__main__":
    inspect_docx()
