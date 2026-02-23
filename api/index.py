import json
import os
import io
import base64
import requests
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import urllib.parse
from docx import Document
from docx.shared import Pt

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.units import cm

app = Flask(__name__)
CORS(app)

# Load configuration from environment
# In Vercel, these must be set in the project settings
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "DPTAspy2026")
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
GITHUB_OWNER = "rgarciarojo76-ctrl"
GITHUB_REPO = "Gestion-Laboratorio-Higiene"

# Path to the data inside the Vercel deployment (read-only)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(BASE_DIR)
LOCAL_DATA_PATH = os.path.join(PROJECT_DIR, "public", "contaminantes.json")
F01655_PATH = os.path.join(PROJECT_DIR, "F01655.docx")
F00662_PATH = os.path.join(PROJECT_DIR, "F00662_converted.docx")


def check_admin_password():
    """Validate admin password from header."""
    pw = request.headers.get("X-Admin-Password", "")
    return pw.strip() == ADMIN_PASSWORD.strip()


# --- Link Resolver Logic ---

def resolve_mta_url(mta_code):
    query = f'site:insst.es "{mta_code}" filetype:pdf'
    encoded_query = urllib.parse.quote(query)
    return f"https://www.google.com/search?q={encoded_query}&btnI=I"

def resolve_apa_url(search_term):
    clean_term = search_term.split('(')[0].split('->')[0].strip()
    query = f'site:youtube.com "tutorial muestreo higiene industrial apa" "{clean_term}"'
    encoded_query = urllib.parse.quote(query)
    return f"https://www.google.com/search?q={encoded_query}&btnI=I"


# --- GitHub API Integration ---

def get_file_from_github(filepath):
    """Fetch the current file content and SHA from GitHub."""
    url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/contents/{filepath}"
    headers = {"Accept": "application/vnd.github.v3+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"token {GITHUB_TOKEN}"
    response = requests.get(url, headers=headers)
    if response.status_code == 200:
        data = response.json()
        content = base64.b64decode(data['content']).decode('utf-8')
        return content, data['sha']
    return None, None


def update_file_in_github(filepath, content, commit_message, sha):
    """Commit the updated file content back to GitHub."""
    url = f"https://api.github.com/repos/{GITHUB_OWNER}/{GITHUB_REPO}/contents/{filepath}"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
    }
    encoded_content = base64.b64encode(content.encode('utf-8')).decode('utf-8')
    payload = {
        "message": commit_message,
        "content": encoded_content,
        "sha": sha,
        "branch": "main"
    }
    response = requests.put(url, headers=headers, json=payload)
    return response.status_code in [200, 201]


def save_contaminants_to_github(contaminants_data, commit_message="Panel Admin: Actualizar base de datos"):
    """Saves the JSON to both data/ and public/ directories via GitHub API."""
    if not GITHUB_TOKEN:
        print("ERROR: GITHUB_TOKEN no configurado en Vercel.")
        return False
        
    json_str = json.dumps(contaminants_data, indent=2, ensure_ascii=False)
    success = True
    
    for path in ["data/contaminantes.json", "public/contaminantes.json"]:
        _, sha = get_file_from_github(path)
        if sha:
            if not update_file_in_github(path, json_str, commit_message, sha):
                print(f"Failed to update {path} in GitHub.")
                success = False
        else:
            print(f"Could not find existing file {path} to update.")
            success = False
            
    return success


def load_local_contaminants():
    """Load contaminants directly from Vercel's filesystem or via GitHub fallback."""
    try:
        with open(LOCAL_DATA_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading local json from disk: {e}. Falling back to GitHub API...")
        try:
            content, _ = get_file_from_github("public/contaminantes.json")
            if content:
                return json.loads(content)
        except Exception as gh_e:
            print(f"GitHub fallback failed: {gh_e}")
        return []


# --- Document Generation ---
    
def generate_docx(template_path, data, is_f01655=True):
    """Fill out a DOCX template and return it as a BytesIO buffer."""
    doc = Document(template_path)
    
    doc.add_paragraph("")
    doc.add_paragraph("═" * 60)
    p = doc.add_paragraph()
    p.add_run("DATOS CUMPLIMENTADOS AUTOMÁTICAMENTE (Via Web)").bold = True

    if is_f01655:
        fields = [
            ("Código", data.get("codigo", "")),
            ("Nombre", data.get("nombre", "")),
            ("Persona solicita", data.get("persona_solicita", "")),
            ("Cliente (Cargo)", data.get("cliente_cargo", "")),
            ("Remitente", data.get("remitente", "")),
            ("Compañía", data.get("compania", "")),
            ("Email", data.get("email", "")),
            ("Teléfono", data.get("telefono", "")),
            ("Ref. Presupuesto", data.get("ref_presupuesto", "")),
            ("Fecha Solicitud", data.get("fecha_solicitud", "")),
            ("Tipo de Envío", data.get("tipo_envio", "")),
        ]
        if data.get("tipo_envio") == "mrw":
            fields.append(("Cuenta MRW", data.get("cuenta_mrw", "")))
            fields.append(("Dirección Envío", data.get("direccion_envio", "")))
            
        for label, value in fields:
            p = doc.add_paragraph()
            run = p.add_run(f"{label}: ")
            run.bold = True
            run.font.size = Pt(10)
            p.add_run(str(value))

        materials = data.get("materials", [])
        if materials:
            doc.add_paragraph("")
            p = doc.add_paragraph()
            p.add_run("MATERIAL SOLICITADO").bold = True
            table = doc.add_table(rows=1, cols=3)
            table.style = "Table Grid"
            hdr_cells = table.rows[0].cells
            hdr_cells[0].text = "Uds."
            hdr_cells[1].text = "CEF"
            hdr_cells[2].text = "Descripción"
            for mat in materials:
                row_cells = table.add_row().cells
                row_cells[0].text = str(mat.get("qty", ""))
                row_cells[1].text = str(mat.get("cef", ""))
                row_cells[2].text = str(mat.get("desc", ""))
    
    # Save to memory buffer instead of disk
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer

            
# --- Endpoints ---

@app.route("/api/generate-ficha", methods=["POST"])
def api_generate_ficha():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    try:
        contaminante = data.get("contaminante_display", data.get("contaminante", "Desconocido"))
        safe_name = contaminante.replace("/", "_").replace(" ", "_")
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=2*cm, leftMargin=2*cm, topMargin=2*cm, bottomMargin=2*cm)
        Story = []
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'TitleStyle', parent=styles['Heading1'], fontSize=16,
            textColor=colors.HexColor("#0369a1"), spaceAfter=20, alignment=1
        )
        heading_style = ParagraphStyle(
            'HeadingStyle', parent=styles['Heading2'], fontSize=12,
            textColor=colors.HexColor("#0f172a"), spaceBefore=15, spaceAfter=10,
            borderPadding=5, backColor=colors.HexColor("#f1f5f9")
        )
        normal_style = styles['Normal']
        
        Story.append(Paragraph("FICHA TÉCNICA DE PROCEDIMIENTO DE MUESTREO - 2026", title_style))
        Story.append(Spacer(1, 10))
        
        def create_table(data_matrix):
            t = Table(data_matrix, colWidths=[5*cm, 11*cm])
            t.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#f8fafc")),
                ('TEXTCOLOR', (0,0), (-1,-1), colors.HexColor("#334155")),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
                ('FONTSIZE', (0,0), (-1,-1), 10),
                ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                ('TOPPADDING', (0,0), (-1,-1), 8),
                ('INNERGRID', (0,0), (-1,-1), 0.25, colors.HexColor("#cbd5e1")),
                ('BOX', (0,0), (-1,-1), 0.25, colors.HexColor("#cbd5e1")),
            ]))
            return t

        Story.append(Paragraph("1. Identificación del Agente Químico", heading_style))
        b1_data = [
            ["Contaminante", Paragraph(contaminante, normal_style)],
            ["Nº CAS", str(data.get("cas", "—"))],
            ["Sinónimos", Paragraph(str(data.get("sinonimo", "—")), normal_style)],
        ]
        Story.append(create_table(b1_data))
        Story.append(Spacer(1, 15))

        Story.append(Paragraph("2. Parámetros de Captación", heading_style))
        b2_data = [
            ["Soporte de Captación", Paragraph(str(data.get("soporte_captacion_display", data.get("soporte_captacion", "—"))), normal_style)],
            ["Ref. Soporte", str(data.get("ref_soporte", "—"))],
            ["Técnica Analítica", Paragraph(str(data.get("tecnica_analitica", "—")), normal_style)],
            ["Ref. Técnica", str(data.get("ref_tecnica", "—"))],
            ["Método de Análisis", Paragraph(str(data.get("metodo_analisis", "—")), normal_style)],
            ["Caudal (L/min)", str(data.get("caudal", data.get("caudal_l_min", "—")))],
            ["Volumen Recomendado (L)", str(data.get("volumen_minimo", data.get("volumen_recomendado_l", "—")))],
            ["Desorción", Paragraph(str(data.get("desorcion", "—")), normal_style)]
        ]
        Story.append(create_table(b2_data))
        Story.append(Spacer(1, 15))

        Story.append(Paragraph("3. Criterios Analíticos y Límites", heading_style))
        b3_data = [
            ["LOQ / LOD", f"{data.get('lq', data.get('loq', '—'))} µg / {data.get('ld', data.get('lod', '—'))} µg"],
            ["VLA-ED / VLA-EC", f"{str(data.get('vla_ed', data.get('vla_ed_mg_m3', '—')))} / {str(data.get('vla_ec', data.get('vla_ec_mg_m3', '—')))}"],
            ["Frases H", Paragraph(str(data.get("frases_h", "—")), normal_style)],
        ]
        Story.append(create_table(b3_data))
        Story.append(Spacer(1, 25))

        Story.append(Paragraph("Observaciones Técnicas y de Seguridad", heading_style))
        warnings_list = ["• Seguir las condiciones generales de transporte establecidas por el laboratorio."]
        for w in warnings_list:
            Story.append(Paragraph(w, normal_style))
            Story.append(Spacer(1, 5))

        doc.build(Story)
        buffer.seek(0)
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f"Ficha_{safe_name}_{timestamp}.pdf",
            mimetype="application/pdf"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/health")
def health_check():
    return jsonify({"status": "ok", "environment": "vercel_serverless"})

@app.route("/api/contaminants/all", methods=["GET"])
def get_all_contaminants():
    return jsonify(load_local_contaminants())

@app.route("/api/link/mta/<path:mta_code>", methods=["GET"])
def link_mta(mta_code):
    return jsonify({"url": resolve_mta_url(mta_code)})

@app.route("/api/link/apa/<path:term>", methods=["GET"])
def link_apa(term):
    return jsonify({"url": resolve_apa_url(term)})

@app.route("/api/generate-f01655", methods=["POST"])
def api_generate_f01655():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    try:
        buffer = generate_docx(F01655_PATH, data, is_f01655=True)
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f"F01655_Web_{datetime.now().strftime('%Y%m%d_%H%M%S')}.docx",
            mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# --- Admin Endpoints ---

@app.route("/api/admin/auth", methods=["POST"])
def admin_auth():
    pw = request.json.get("password", "") if request.is_json else ""
    if pw.strip() == ADMIN_PASSWORD.strip():
        return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "Contraseña incorrecta"}), 401


@app.route("/api/admin/products", methods=["GET"])
def admin_list_products():
    if not check_admin_password(): return jsonify({"error": "No autorizado"}), 401
    q = request.args.get("q", "").strip().lower()
    contaminants = load_local_contaminants()
    if q:
        contaminants = [
            c for c in contaminants
            if q in (c.get("contaminante_display") or c.get("contaminante") or "").lower()
            or q in (c.get("cas") or "").lower()
            or q in (c.get("sinonimo") or "").lower()
        ]
    return jsonify(contaminants)


@app.route("/api/admin/products/<path:product_id>/visibility", methods=["PUT"])
def admin_toggle_visibility(product_id):
    if not check_admin_password(): return jsonify({"error": "No autorizado"}), 401
    
    # 1. We must read the fresh data from GitHub because Vercel local is read-only and stale until next deploy
    content, sha = get_file_from_github("data/contaminantes.json")
    if not content:
        return jsonify({"error": "No se pudo leer GitHub"}), 500
        
    contaminants = json.loads(content)
    
    for c in contaminants:
        if str(c.get("id")) == str(product_id):
            new_val = not c.get("visible_en_app", False)
            c["visible_en_app"] = new_val
            
            # Save back to GitHub
            success = save_contaminants_to_github(contaminants, f"Panel Admin: {'Visible' if new_val else 'Oculto'} {c.get('contaminante')}")
            if success:
                return jsonify({"ok": True, "product": c})
            else:
                return jsonify({"error": "Error guardando en GitHub"}), 500
                
    return jsonify({"error": "Producto no encontrado"}), 404

# For vercel
if __name__ == '__main__':
    app.run(debug=True, port=8000)
