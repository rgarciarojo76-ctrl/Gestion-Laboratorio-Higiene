#!/usr/bin/env python3
"""Convert the Dossier Técnico markdown to a styled PDF using ReportLab (already installed)."""

import markdown
import re
import sys
import os

# Use pdfkit-free approach: convert MD → HTML, then open in browser for print
INPUT_MD = sys.argv[1] if len(sys.argv) > 1 else "dossier_tecnico_IT.md"
OUTPUT_HTML = sys.argv[2] if len(sys.argv) > 2 else "Dossier_Tecnico_IT.html"

with open(INPUT_MD, "r", encoding="utf-8") as f:
    md_text = f.read()

# Remove mermaid blocks
md_text = re.sub(
    r'```mermaid\n.*?```',
    '<div style="border:1px dashed #94a3b8;padding:12px;border-radius:6px;color:#64748b;font-style:italic;margin:12px 0;">📊 Diagrama Mermaid — consultar versión digital interactiva</div>',
    md_text, flags=re.DOTALL
)

# Convert GitHub alert syntax
md_text = re.sub(r'> \[!IMPORTANT\]\n', '> **⚠️ IMPORTANTE:** ', md_text)
md_text = re.sub(r'> \[!NOTE\]\n', '> **ℹ️ NOTA:** ', md_text)
md_text = re.sub(r'> \[!WARNING\]\n', '> **⚠️ ADVERTENCIA:** ', md_text)

html_body = markdown.markdown(
    md_text,
    extensions=['tables', 'fenced_code', 'toc'],
)

CSS = """
@page {
    size: A4;
    margin: 2.2cm 1.8cm 2.2cm 1.8cm;
}
@media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h2 { page-break-after: avoid; }
    h3 { page-break-after: avoid; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    pre { page-break-inside: avoid; }
}
* { box-sizing: border-box; }
body {
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 11px;
    line-height: 1.65;
    color: #1e293b;
    max-width: 100%;
    padding: 0;
    margin: 0;
}
h1 {
    font-size: 24px;
    color: #0f172a;
    border-bottom: 3px solid #0284c7;
    padding-bottom: 10px;
    margin-top: 0;
    margin-bottom: 16px;
}
h2 {
    font-size: 18px;
    color: #0369a1;
    border-bottom: 1.5px solid #e2e8f0;
    padding-bottom: 6px;
    margin-top: 32px;
}
h3 {
    font-size: 14px;
    color: #1e40af;
    margin-top: 22px;
}
h4 {
    font-size: 12px;
    color: #334155;
    margin-top: 16px;
}
table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 10px;
}
th {
    background-color: #0284c7;
    color: white;
    padding: 6px 8px;
    text-align: left;
    font-weight: 600;
    font-size: 10px;
}
td {
    padding: 5px 8px;
    border: 1px solid #e2e8f0;
    font-size: 10px;
}
tr:nth-child(even) td {
    background-color: #f8fafc;
}
code {
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 10px;
    font-family: 'SF Mono', 'Fira Code', Menlo, monospace;
    color: #0f172a;
}
pre {
    background: #1e293b;
    color: #e2e8f0;
    padding: 14px 18px;
    border-radius: 8px;
    font-size: 9.5px;
    line-height: 1.5;
    overflow-x: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
}
pre code {
    background: none;
    color: inherit;
    padding: 0;
}
blockquote {
    border-left: 3px solid #0284c7;
    margin: 14px 0;
    padding: 10px 18px;
    background: #f0f9ff;
    font-size: 10.5px;
    color: #0c4a6e;
    border-radius: 0 6px 6px 0;
}
hr {
    border: none;
    border-top: 2px solid #e2e8f0;
    margin: 28px 0;
}
ul, ol {
    margin: 8px 0;
    padding-left: 22px;
}
li { margin-bottom: 4px; }
p { margin: 8px 0; }
strong { color: #0f172a; }
.header-band {
    background: linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%);
    color: white;
    padding: 24px 28px;
    border-radius: 10px;
    margin-bottom: 24px;
    text-align: center;
}
.header-band h1 { color: white; border: none; margin: 0; font-size: 20px; }
.header-band p { color: #bae6fd; margin: 4px 0 0; font-size: 11px; }
.footer {
    text-align: center;
    font-size: 9px;
    color: #94a3b8;
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
}
"""

full_html = f"""<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <title>Dossier Técnico — Gestión Laboratorio Higiene Industrial</title>
    <style>{CSS}</style>
</head>
<body>
<div class="header-band">
    <h1>📋 Dossier Técnico de Transferencia de Proyecto</h1>
    <p>Gestión de Laboratorio de Higiene Industrial — CONFIDENCIAL</p>
    <p style="font-size:10px;margin-top:8px;">Dirección Técnica IA LAB · Servicio de Prevención · Febrero 2026</p>
</div>
{html_body}
<div class="footer">
    CONFIDENCIAL — Dirección Técnica IA LAB — Servicio de Prevención — Febrero 2026
</div>
</body>
</html>"""

with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
    f.write(full_html)

print(f"HTML generado: {OUTPUT_HTML}")
print("Abriendo en el navegador para imprimir como PDF (Cmd+P)...")
os.system(f'open "{OUTPUT_HTML}"')
