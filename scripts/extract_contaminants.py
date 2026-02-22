#!/usr/bin/env python3
"""
extract_contaminants.py — ETL: MTMHI2025v01.pdf → contaminantes.json

Extrae las tablas de contaminantes del PDF de Echevarne y genera un JSON
estructurado con las 15 columnas de referencia.

Columnas de la tabla del PDF (observadas):
  Nº CAS | Nombre del compuesto | Sinónimo | Técnica | Método |
  Título método | Caudal y V | Soporte | Desorción | % Inc | LQ (µg)

Columnas objetivo (del Excel de referencia):
  Contaminante | CAS | Soporte captación | Ref. Soporte | Técnica analítica |
  Ref. Técnica | Método análisis | Ref. Método | LOD | LOQ | Unidades LOQ/LOD |
  Caudal (l/min) | Vol. recomendado | VLA-ED (mg/m³) | VLA-EC (mg/m³)
"""

import json
import re
import os
import sys
import warnings

# Suppress pdfplumber pattern warnings
warnings.filterwarnings("ignore")

import pdfplumber

PDF_PATH = os.path.join(os.path.dirname(__file__), "..", "MTMHI2025v01.pdf")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "contaminantes.json")


def parse_caudal_volumen(text):
    """
    Parse caudal and volume from strings like:
    '1-2 L/min\n12-800 L\n(100 L)'  →  caudal='1-2', vol_recomendado='100'
    '0,5-1,5 L/min\n4-200 L\n(60 L)' →  caudal='0,5-1,5', vol_recomendado='60'
    """
    if not text:
        return "", ""

    text = text.strip()
    caudal = ""
    vol_recomendado = ""

    # Extract caudal (X-Y L/min or X L/min)
    m_caudal = re.search(r'([\d,\.\-]+(?:\s*-\s*[\d,\.]+)?)\s*L/min', text)
    if m_caudal:
        caudal = m_caudal.group(1).strip()

    # Extract recommended volume (in parentheses)
    m_vol = re.search(r'\((\d[\d,\.]*)\s*L\)', text)
    if m_vol:
        vol_recomendado = m_vol.group(1).strip()
    else:
        # Try range format: X-Y L
        m_vol2 = re.search(r'([\d,\.\-]+(?:\s*-\s*[\d,\.]+)?)\s*L(?!\s*/)', text)
        if m_vol2 and 'L/min' not in m_vol2.group(0):
            vol_recomendado = m_vol2.group(1).strip()

    return caudal, vol_recomendado


def extract_ref_echevarne(text):
    """
    Extract Echevarne reference codes like MT077, QE094, MT143, etc.
    from soporte/method fields.
    """
    if not text:
        return ""
    refs = re.findall(r'(MT\d+|QE\d+)', text)
    return ", ".join(refs) if refs else ""


def extract_echevarne_code(text):
    """Extract N-codes like N2380, N7004, N2471 from compound names."""
    if not text:
        return ""
    m = re.findall(r'\(N\d+\)', text)
    return ", ".join([x.strip("()") for x in m]) if m else ""


def clean_text(text):
    """Clean extracted text removing excessive whitespace and newlines."""
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()


def is_header_row(row):
    """Check if a row is a table header."""
    if not row:
        return False
    joined = " ".join([str(c) for c in row if c])
    return "Nº CAS" in joined or "Nombre del compuesto" in joined


def is_data_row(row):
    """Check if a row contains actual contaminant data (not header or empty)."""
    if not row:
        return False
    non_empty = [c for c in row if c and str(c).strip()]
    return len(non_empty) >= 2


def extract_all_contaminants(pdf_path):
    """Main extraction logic."""
    pdf = pdfplumber.open(pdf_path)
    contaminants = []
    current_cas = ""
    current_compound = ""

    print(f"Processing {len(pdf.pages)} pages...")

    # The contaminant tables start around page 6 and go to ~page 100
    for page_num in range(5, len(pdf.pages)):
        page = pdf.pages[page_num]
        tables = page.extract_tables()

        if not tables:
            continue

        for table in tables:
            if len(table) < 3 or not table[0]:
                continue

            # Skip if not a contaminant table (should have ~11 columns)
            if len(table[0]) < 10:
                continue

            # Process rows (skip header rows)
            for row in table:
                if not row or is_header_row(row):
                    continue

                if not is_data_row(row):
                    continue

                # Map columns based on observed PDF structure:
                # [0]=empty/category, [1]=Name, [2]=Synonym, [3]=Technique,
                # [4]=Method, [5]=Method Title, [6]=Caudal&Vol, [7]=Support,
                # [8]=Desorption, [9]=%Inc, [10]=LQ

                # Determine number of columns
                ncols = len(row)

                # Extract CAS number — sometimes in col[0], sometimes in a
                # separate row below the compound name
                cas_candidate = clean_text(row[0]) if ncols > 0 else ""
                compound_name = clean_text(row[1]) if ncols > 1 else ""
                synonym = clean_text(row[2]) if ncols > 2 else ""
                technique = clean_text(row[3]) if ncols > 3 else ""
                method = clean_text(row[4]) if ncols > 4 else ""
                method_title = clean_text(row[5]) if ncols > 5 else ""
                caudal_vol_raw = clean_text(row[6]) if ncols > 6 else ""
                support = clean_text(row[7]) if ncols > 7 else ""
                desorption = clean_text(row[8]) if ncols > 8 else ""
                pct_inc = clean_text(row[9]) if ncols > 9 else ""
                lq_raw = clean_text(row[10]) if ncols > 10 else ""

                # Check if this row has a CAS number (format: XXXXX-XX-X)
                cas_match = re.search(r'(\d{2,6}-\d{2}-\d)', cas_candidate + " " + compound_name)
                if cas_match:
                    current_cas = cas_match.group(1)

                # Check if row is just a CAS continuation (cas in col[0], rest empty)
                non_empty_cols = sum(1 for c in row[1:] if c and str(c).strip())
                if cas_match and non_empty_cols == 0:
                    # Just a CAS number row, attach to previous compound
                    if contaminants:
                        contaminants[-1]["cas"] = current_cas
                    continue

                # Skip category headers (like "AMIANTO", "FRACCIÓN TOTAL", etc.)
                if compound_name and not technique and not method and not support:
                    # Might be a category, or a compound name that spans multiple rows
                    if len(compound_name) < 30 and compound_name.isupper():
                        continue

                # If we have a compound name and at least some technical data
                if compound_name and (technique or method or support or lq_raw):
                    # Extract Internal References (MTxxx, QIxxx, PNTxxx)
                    ref_soporte = extract_ref_echevarne(support)
                    # Method ref can be in method column OR title
                    ref_method = extract_ref_echevarne(method)
                    if not ref_method:
                        ref_method = extract_ref_echevarne(method_title)
                    
                    # Technique ref often in name (Nxxxx)
                    ref_tecnica = extract_echevarne_code(compound_name)

                    # Extract Observations (Notes)
                    # Look for "Nota:" or text in parentheses that ISN'T a ref code
                    observaciones = []
                    
                    # Check for "Ver ... Anexo I" in method/title
                    if "Anexo I" in method_title or "Anexo I" in method:
                         observaciones.append(method_title if "Anexo I" in method_title else method)

                    # Check for explicit Notes in compound name or other fields if widely used
                    # For now, simplistic approach: text starting with "Nota" in name
                    if "Nota" in compound_name:
                        parts = compound_name.split("Nota")
                        if len(parts) > 1:
                            observaciones.append("Nota" + parts[1])
                            # Clean name
                            compound_name = parts[0].strip()

                    # Parse caudal and volume
                    caudal, vol_recomendado = parse_caudal_volumen(caudal_vol_raw)

                    # Parse LQ
                    lq = ""
                    if lq_raw:
                        lq_num = re.search(r'[\d,\.]+', lq_raw)
                        if lq_num:
                            lq = lq_num.group(0)

                    entry = {
                        "contaminante": compound_name,
                        "cas": current_cas if cas_match else "",
                        "sinonimo": synonym,
                        "soporte_captacion": support,
                        "ref_soporte": ref_soporte,
                        "tecnica_analitica": technique,
                        "ref_tecnica": ref_tecnica,
                        "metodo_analisis": f"{method} — {method_title}".strip(" —"),
                        "ref_metodo": ref_method,
                        "lod": "",  # LOD not always explicit in PDF
                        "loq": lq,
                        "unidades_loq_lod": "µg",
                        "caudal_l_min": caudal,
                        "volumen_recomendado_l": vol_recomendado,
                        "vla_ed_mg_m3": "",  # To be enriched from INSST LEP
                        "vla_ec_mg_m3": "",  # To be enriched from INSST LEP
                        "pct_incertidumbre": pct_inc,
                        "desorcion": desorption,
                        "observaciones": " | ".join(observaciones),
                        "pagina_pdf": page_num + 1,
                    }
                    contaminants.append(entry)

    pdf.close()
    return contaminants


def deduplicate_and_clean(contaminants):
    """Post-processing: deduplicate, clean, and enrich entries."""

    # Noise patterns — header fragments from the PDF table structure
    NOISE_NAMES = {
        "nº", "unidades", "obs", "cef", "descripción",
        "", "lq", "(µg)", "% inc",
    }

    # Phase 1: Forward-propagate CAS numbers
    # (In the PDF, CAS often appears in a row BELOW the compound)
    last_cas = ""
    for i, entry in enumerate(contaminants):
        if entry["cas"]:
            last_cas = entry["cas"]
        elif last_cas and not entry["cas"]:
            # Check if this entry is on the same page as the previous CAS
            if i > 0 and contaminants[i-1].get("pagina_pdf") == entry.get("pagina_pdf"):
                entry["cas"] = last_cas

    # Phase 2: Filter and deduplicate
    cleaned = []
    seen = set()

    for entry in contaminants:
        name = entry["contaminante"].strip()

        # Skip noise entries
        if name.lower() in NOISE_NAMES:
            continue
        if not name or name.startswith("("):
            continue

        # Skip entries that are clearly header fragments
        if name in ("CEF", "Descripción", "Obs"):
            continue

        # Must have at least SOME technical data to be useful
        has_data = (
            entry["loq"] or
            entry["caudal_l_min"] or
            entry["tecnica_analitica"] not in ("", "CEF") or
            entry["metodo_analisis"].strip(" —")
        )
        if not has_data:
            continue

        # Create a dedup key
        key = (
            name[:50],
            entry["cas"],
            entry["tecnica_analitica"],
        )

        if key in seen:
            continue
        seen.add(key)

        # Clean compound name (remove Echevarne codes from display name)
        display_name = re.sub(r'\s*\(N\d+\)\d*', '', name).strip()
        # Remove trailing digits/notes
        display_name = re.sub(r'\d+$', '', display_name).strip()
        entry["contaminante_display"] = display_name

        cleaned.append(entry)

    return cleaned


def main():
    pdf_path = os.path.abspath(PDF_PATH)
    output_path = os.path.abspath(OUTPUT_PATH)

    print(f"📄 Parsing PDF: {pdf_path}")

    if not os.path.exists(pdf_path):
        print(f"❌ Error: PDF not found at {pdf_path}")
        sys.exit(1)

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    contaminants = extract_all_contaminants(pdf_path)
    print(f"  → Raw entries extracted: {len(contaminants)}")

    contaminants = deduplicate_and_clean(contaminants)
    print(f"  → After deduplication: {len(contaminants)}")

    # Save to JSON
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(contaminants, f, ensure_ascii=False, indent=2)

    print(f"✅ Saved to: {output_path}")

    # Print a few samples
    print("\n📊 Sample entries:")
    for entry in contaminants[:5]:
        print(f"  • {entry['contaminante_display']} (CAS: {entry['cas']})")
        print(f"    Técnica: {entry['tecnica_analitica']} | Método: {entry['metodo_analisis']}")
        print(f"    Caudal: {entry['caudal_l_min']} L/min | Vol: {entry['volumen_recomendado_l']} L")
        print(f"    LOQ: {entry['loq']} µg | Soporte: {entry['soporte_captacion']}")
        print()


if __name__ == "__main__":
    main()
