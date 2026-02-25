import os
import json
from docx import Document
from docx.document import Document as _Document
from docx.oxml.text.paragraph import CT_P
from docx.oxml.table import CT_Tbl
from docx.table import _Cell, Table
from docx.text.paragraph import Paragraph

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
DOCX_PATH = os.path.join(BASE_DIR, "MTMHI2025v01.docx")
JSON_PATH = os.path.join(BASE_DIR, "public", "contaminantes.json")

def iter_block_items(parent):
    if isinstance(parent, _Document):
        parent_elm = parent.element.body
    elif isinstance(parent, _Cell):
        parent_elm = parent._tc
    else:
        raise ValueError("something's not right")

    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield Table(child, parent)

def extract_simultaneous_status():
    doc = Document(DOCX_PATH)
    
    current_status = None
    table_status = {} # Map Table index -> status
    table_idx = 0
    
    for block in iter_block_items(doc):
        if isinstance(block, Paragraph):
            text = block.text.strip().lower()
            if "análisis simultáneo" in text:
                if "no simultáneo" in text or "ý" in text:
                    current_status = False
                elif "þ" in text or "✔" in text or "✓" in text:
                    current_status = True
        elif isinstance(block, Table):
            if current_status is not None:
                table_status[table_idx] = current_status
            table_idx += 1
            current_status = None # Reset for next
            
    # Now map table to CAS
    cas_to_status = {}
    
    for idx, table in enumerate(doc.tables):
        status = table_status.get(idx)
        if status is None:
            continue
            
        if not table.rows: continue
        
        # Find CAS column
        header_row = table.rows[0]
        cas_col_idx = -1
        for i, cell in enumerate(header_row.cells):
            if "cas" in cell.text.lower():
                cas_col_idx = i
                break
                
        if cas_col_idx == -1 and len(table.rows) > 1:
            header_row_2 = table.rows[1]
            for i, cell in enumerate(header_row_2.cells):
                if "cas" in cell.text.lower():
                    cas_col_idx = i
                    break
                    
        if cas_col_idx != -1:
            for row in table.rows[1:]:
                cas = row.cells[cas_col_idx].text.strip()
                import re
                if re.search(r'\d+-\d+-\d+', cas):
                    cas_num = re.search(r'\d+-\d+-\d+', cas).group(0)
                    cas_to_status[cas_num] = status
                    
    print(f"Extracted status for {len(cas_to_status)} CAS numbers from {table_idx} tables")
    return cas_to_status

def update_json(cas_to_status):
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    updated = 0
    for entry in data:
        cas = entry.get("cas", "")
        if cas in cas_to_status:
            entry["analisis_simultaneo"] = cas_to_status[cas]
            updated += 1
            
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print(f"Updated {updated} records in {JSON_PATH}")

if __name__ == "__main__":
    st = extract_simultaneous_status()
    update_json(st)
