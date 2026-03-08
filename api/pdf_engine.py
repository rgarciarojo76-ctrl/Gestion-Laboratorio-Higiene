import io
import os
from datetime import datetime

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer,
    Table, TableStyle, Image, NextPageTemplate, PageBreak, KeepTogether, Flowable
)
from reportlab.graphics.shapes import Drawing, Rect, String, Group
from reportlab.graphics import renderPDF

current_dir = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(current_dir)
ASSETS_DIR = os.path.join(current_dir, "assets")
FONTS_DIR = os.path.join(ASSETS_DIR, "fonts")

# Colors
COLOR_CORP_AZUL = colors.HexColor("#0284c7")       # Corporate Blue
COLOR_CORP_AZUL_LIGHT = colors.HexColor("#f0f9ff") # Light Blue BG
COLOR_CORP_AZUL_BORDER = colors.HexColor("#bae6fd")# Light Blue Border
COLOR_TEXT_DARK = colors.HexColor("#0f172a")       # Dark Text
COLOR_TEXT_MUTED = colors.HexColor("#64748b")      # Muted Text
COLOR_BORDER = colors.HexColor("#e2e8f0")          # Default Border
COLOR_SUCCESS = colors.HexColor("#22c55e")
COLOR_ERROR = colors.HexColor("#ef4444")
COLOR_WARN = colors.HexColor("#f59e0b")
COLOR_WHITE = colors.white

def register_fonts():
    # Register Inter fonts if available, otherwise fallback to Helvetica
    inter_reg = os.path.join(FONTS_DIR, "Inter-Regular.ttf")
    inter_bold = os.path.join(FONTS_DIR, "Inter-Bold.ttf")
    if os.path.exists(inter_reg) and os.path.exists(inter_bold):
        pdfmetrics.registerFont(TTFont('Inter', inter_reg))
        pdfmetrics.registerFont(TTFont('Inter-Bold', inter_bold))
        pdfmetrics.registerFontFamily('Inter', normal='Inter', bold='Inter-Bold')
        return 'Inter'
    return 'Helvetica'

class DataCard(Flowable):
    """A custom flowable to draw a beautiful rounded Data Card."""
    def __init__(self, title, content_flowables, width, height=min, min_height=100):
        Flowable.__init__(self)
        self.title = title
        self.content_flowables = content_flowables
        self.width = width
        self.min_height = min_height
        self._calculate_height()

    def _calculate_height(self):
        h = 30 # Title + padding top
        for f in self.content_flowables:
            _, fh = f.wrap(self.width - 20, 1000)
            h += fh + 5 # Add spacing
        h += 10 # Padding bottom
        self.height = max(h, self.min_height)

    def draw(self):
        # Draw background and border
        self.canv.saveState()
        self.canv.setStrokeColor(COLOR_BORDER)
        self.canv.setFillColor(colors.white)
        self.canv.setLineWidth(0.5)
        self.canv.roundRect(0, 0, self.width, self.height, radius=6, stroke=1, fill=1)
        
        # Draw Title Background
        self.canv.setFillColor(COLOR_CORP_AZUL_LIGHT)
        self.canv.setStrokeColor(COLOR_CORP_AZUL_BORDER)
        # We manually draw a rounded top box for the title
        self.canv.roundRect(0, self.height - 30, self.width, 30, radius=6, stroke=1, fill=1)
        # Fill bottom corners of the title rect to make it flat at the bottom
        self.canv.rect(0, self.height - 30, self.width, 10, stroke=0, fill=1)
        # Redraw left/right line for the flat part
        self.canv.line(0, self.height - 30, 0, self.height - 20)
        self.canv.line(self.width, self.height - 30, self.width, self.height - 20)
        # Line between title and body
        self.canv.line(0, self.height - 30, self.width, self.height - 30)

        # Draw Title Text
        self.canv.setFont('Inter-Bold' if 'Inter' in pdfmetrics.getRegisteredFontNames() else 'Helvetica-Bold', 10)
        self.canv.setFillColor(COLOR_CORP_AZUL)
        self.canv.drawString(10, self.height - 20, self.title)
        self.canv.restoreState()

        # Draw content flowables
        y = self.height - 40
        for f in self.content_flowables:
            aw, ah = f.wrap(self.width - 20, y)
            f.drawOn(self.canv, 10, y - ah)
            y -= (ah + 5)


def create_premium_ficha(data):
    font_family = register_fonts()
    buffer = io.BytesIO()

    # Layout frames
    margin = 20 * mm
    width, height = A4
    frame_width = width - 2 * margin
    
    # Page 1 Frame (Full width)
    # Give some space at the top for the logo
    frame_page1 = Frame(margin, margin, frame_width, height - 2*margin - 20*mm, id='F1')
    
    # Page 2+ Frames (2 Columns)
    col_width = (frame_width - 10*mm) / 2
    frame_col1 = Frame(margin, margin, col_width, height - 2*margin - 10*mm, id='Col1')
    frame_col2 = Frame(margin + col_width + 10*mm, margin, col_width, height - 2*margin - 10*mm, id='Col2')

    doc = BaseDocTemplate(buffer, pagesize=A4, rightMargin=margin, leftMargin=margin, topMargin=margin, bottomMargin=margin)
    
    def on_page_end(canvas, doc):
        canvas.saveState()
        # Logo on page 1 only
        if doc.page == 1:
            logo_path = os.path.join(PROJECT_DIR, "public", "logo_ialab.png")
            if os.path.exists(logo_path):
                # Scale logo to fit ~40mm height and position at top right
                # Original logo might need specific ratios, keeping it safe here
                canvas.drawImage(logo_path, width - margin - 50*mm, height - margin - 20*mm, width=50*mm, height=20*mm, preserveAspectRatio=True, anchor='ne')
            
            # Title on page 1
            canvas.setFont(f'{font_family}-Bold', 18)
            canvas.setFillColor(COLOR_CORP_AZUL)
            canvas.drawString(margin, height - margin - 10*mm, "FICHA TÉCNICA DE MUESTREO")
            canvas.setFont(f'{font_family}', 10)
            canvas.setFillColor(COLOR_TEXT_MUTED)
            canvas.drawString(margin, height - margin - 15*mm, "Dirección Técnica IA LAB")

        # Footer on all pages
        canvas.setFont(f'{font_family}', 8)
        canvas.setFillColor(COLOR_TEXT_MUTED)
        canvas.drawString(margin, margin - 10*mm, "Documento Técnico Confidencial - Propiedad de Dirección Técnica")
        page_str = f"Página {doc.page}"
        canvas.drawRightString(width - margin, margin - 10*mm, page_str)
        
        # Border line above footer
        canvas.setStrokeColor(COLOR_BORDER)
        canvas.line(margin, margin - 5*mm, width - margin, margin - 5*mm)
        canvas.restoreState()

    template_p1 = PageTemplate(id='FirstPage', frames=[frame_page1], onPage=on_page_end)
    template_p2 = PageTemplate(id='TwoColPage', frames=[frame_col1, frame_col2], onPage=on_page_end)
    doc.addPageTemplates([template_p1, template_p2])

    styles = getSampleStyleSheet()
    style_normal = ParagraphStyle('CorpNormal', fontName=font_family, fontSize=9, textColor=COLOR_TEXT_DARK, leading=12)
    style_label = ParagraphStyle('CorpLabel', fontName=f'{font_family}-Bold', fontSize=8, textColor=COLOR_TEXT_MUTED, leading=10, textTransform='uppercase')
    style_value_large = ParagraphStyle('CorpBigVal', fontName=f'{font_family}-Bold', fontSize=12, textColor=COLOR_CORP_AZUL, leading=14)
    style_block_title = ParagraphStyle('CorpBlockTitle', fontName=f'{font_family}-Bold', fontSize=11, textColor=COLOR_CORP_AZUL, spaceAfter=8, spaceBefore=12)
    style_h1 = ParagraphStyle('CorpH1', fontName=f'{font_family}-Bold', fontSize=24, textColor=COLOR_TEXT_DARK, leading=28)
    style_badge_text = ParagraphStyle('CorpBadge', fontName=font_family, fontSize=8, textColor=COLOR_WHITE)

    Story = []

    # ==========================
    # PAGE 1: EXECUTIVE DASHBOARD
    # ==========================
    contaminante = data.get("contaminante_display", data.get("contaminante", "Desconocido"))
    cas = data.get("cas", "—")
    
    # Hero Box (Agente)
    Story.append(Spacer(1, 15*mm))
    Story.append(Paragraph(contaminante, style_h1))
    Story.append(Spacer(1, 4))
    Story.append(Paragraph(f"<b>Nº CAS:</b> {cas}", ParagraphStyle('sub', fontName=font_family, fontSize=12, textColor=COLOR_TEXT_MUTED)))
    Story.append(Spacer(1, 15*mm))

    # Calculate Values
    vla_ed = str(data.get('vla_ed', data.get('vla_ed_mg_m3', '—')))
    vla_ec = str(data.get('vla_ec', data.get('vla_ec_mg_m3', '—')))
    time_ed = str(data.get("tiempo_minimo_ed_final") or "—")
    time_ec = str(data.get("tiempo_minimo_ec_final") or "—")
    caudal_val = data.get("caudal_asignado_final")
    caudal_str = f"{caudal_val} L/min" if caudal_val else str(data.get("caudal", data.get("caudal_l_min", "—")))
    soporte = str(data.get("soporte_captacion_display", data.get("soporte_captacion", "—")))
    
    # Card 1 Content (Límites)
    c1 = [
        Paragraph("VLA-ED (mg/m³)", style_label),
        Paragraph(vla_ed, style_value_large),
        Spacer(1, 10),
        Paragraph("VLA-EC (mg/m³)", style_label),
        Paragraph(vla_ec, style_value_large)
    ]
    # Card 2 Content (Tiempos)
    c2 = [
        Paragraph("Tiempo Mínimo ED", style_label),
        Paragraph(time_ed, style_value_large),
        Spacer(1, 10),
        Paragraph("Tiempo Mínimo EC", style_label),
        Paragraph(time_ec, style_value_large)
    ]
    # Card 3 Content (Logística)
    transporte = str(data.get("transporte", "—"))
    temp_text = "Refrigerada" if "refrig" in transporte.lower() else "Ambiente"
    
    icon_temp_path = os.path.join(ASSETS_DIR, "icons", "temp.png")
    icon_trans_path = os.path.join(ASSETS_DIR, "icons", "transport.png")
    
    def icon_row(icon_path, title, subtitle, is_large=False):
        img = Image(icon_path, width=20, height=20) if os.path.exists(icon_path) else ""
        text_block = [Paragraph(title, style_label), Paragraph(subtitle, style_value_large if is_large else style_normal)]
        t = Table([[img, text_block]], colWidths=[30, None])
        t.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('TOPPADDING', (0,0), (-1,-1), 0)
        ]))
        return t

    c3 = [
        icon_row(icon_temp_path, "Temperatura Recomendada", temp_text, is_large=True),
        Spacer(1, 10),
        icon_row(icon_trans_path, "Condiciones de Transporte", transporte, is_large=False)
    ]
    # Card 4 Content (Captación)
    c4 = [
        Paragraph("Soporte de Captación", style_label),
        Paragraph(soporte, ParagraphStyle('v1', parent=style_normal, fontName=f'{font_family}-Bold', textColor=COLOR_TEXT_DARK)),
        Spacer(1, 10),
        Paragraph("Caudal Asignado", style_label),
        Paragraph(caudal_str, style_value_large)
    ]

    card_width = (frame_width - 10*mm) / 2
    
    d1 = DataCard("Límites VLA", c1, width=card_width)
    d2 = DataCard("UNE 482 (Tiempos Mínimos)", c2, width=card_width)
    d3 = DataCard("Logística y Transporte", c3, width=card_width)
    d4 = DataCard("Estrategia de Captación", c4, width=card_width)

    # Put cards in a 2x2 grid via Table
    cards_table = Table([
        [d1, d2],
        [d3, d4]
    ], colWidths=[card_width, card_width])
    cards_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 10*mm),
        ('ALIGN', (1,0), (1,-1), 'RIGHT'), # Push right col to edge
    ]))
    Story.append(cards_table)

    # Switch to 2 columns for details
    Story.append(NextPageTemplate('TwoColPage'))
    Story.append(PageBreak())

    # ==========================
    # PAGE 2+: TECHNICAL BLOCKS
    # ==========================
    
    def create_block(title, fields_dict):
        """Creates a technical block with a title, a dividing line, and a list of label/values."""
        # Filter out empty fields
        filtered_fields = {k: v for k, v in fields_dict.items() if v and str(v).strip() and str(v).strip() != '—'}
        if not filtered_fields:
            return None # Skip empty blocks completely
            
        elements = []
        elements.append(Paragraph(title, style_block_title))
        
        # We use a table for the fine underline to match the width
        line_data = [[""]]
        line_t = Table(line_data, colWidths=[col_width])
        line_t.setStyle(TableStyle([
            ('LINEABOVE', (0, 0), (-1, -1), 1, COLOR_CORP_AZUL),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        elements.append(line_t)
        
        # Add the fields
        for lbl, val in filtered_fields.items():
            elements.append(Paragraph(lbl, style_label))
            elements.append(Paragraph(str(val), style_normal))
            elements.append(Spacer(1, 6))
            
        elements.append(Spacer(1, 10))
        return KeepTogether(elements)

    blocks = [
        create_block("1. Identificación y Sinónimos", {
            "Sinónimo": data.get("sinonimo"),
            "Frases H": data.get("frases_h"),
            "RD 665/1997 CMR": data.get("rd_665") if data.get("is_cmr") else None
        }),
        create_block("2. Metodología", {
            "Técnica Analítica": data.get("tecnica_analitica"),
            "Método de Análisis": data.get("metodo_analisis"),
            "Referencia Técnica": data.get("ref_tecnica")
        }),
        create_block("3. Captación y Soporte", {
            "Referencia Soporte": data.get("ref_soporte"),
            "Soportes Alternativos": data.get("codigo_soporte_alt"),
            "Desorción": data.get("desorcion")
        }),
        create_block("4. Caudales del Método", {
            "Rango de Caudal del Método": data.get("caudal_metodo"),
            "Caudal de Muestreador Recomendado": data.get("caudal_muestreador")
        }),
        create_block("5. Volúmenes de Muestreo", {
            "Volumen Mínimo Muestreo (L)": data.get("volumen_minimo"),
            "Volumen Máximo (L)": data.get("v_maximo_muestreo")
        }),
        create_block("6. Sensibilidad Técnica (LQ/LD)", {
            "Límite de Cuantificación (µg)": data.get("lq") or data.get("loq"),
            "Límite de Detección (µg)": data.get("ld") or data.get("lod"),
            "LOQ Concentración": data.get("loq_concentracion")
        }),
        create_block("7. Límites Suplementarios (Gestis)", {
            "Gestis TWA": f"{data.get('gestis_twa')} mg/m³",
            "Gestis STEL": f"{data.get('gestis_stel')} mg/m³",
            "País Origen (Gestis)": data.get("gestis_pais")
        }),
        create_block("8. Parámetros de Exposición", {
            "Notas LEP": data.get("notas_lep"),
            "Índice Expo Mínimo (ED)": data.get("ie_minimo_teorico_ed"),
            "Índice Expo Mínimo (TWA)": data.get("ie_minimo_teorico_twa")
        }),
        create_block("9. Logística", {
            "Plazo de Entrega": data.get("plazo_entrega"),
            "Transporte": data.get("transporte")
        }),
        create_block("10. Observaciones del Método", {
            "Observaciones del Concepto": data.get("observaciones_concepto"),
            "Comentarios Prueba": data.get("comentarios_prueba")
        }),
        create_block("11. Recomendaciones UNE-EN 689", {
            "Comentarios UNE 689": data.get("comentarios_une_689"),
            "Evaluación Apéndice 1": data.get("evaluacion_apendice_1")
        }),
        create_block("Información Adicional (Screening)", {
            "Perfil Screening": data.get("screening_desc") if data.get("screening_perfil") else None,
            "Comentarios Screening": data.get("screening_comentarios")
        })
    ]

    for b in blocks:
        if b is not None:
            Story.append(b)

    doc.build(Story)
    buffer.seek(0)
    
    # Safe filename creation
    safe_name = contaminante.replace("/", "_").replace(" ", "_")
    timestamp = datetime.now().strftime("%Y%m%d")
    filename = f"Ficha_Tecnica_{safe_name}_{timestamp}.pdf".replace("__", "_")
    
    return buffer, filename
