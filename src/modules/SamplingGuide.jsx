import { useState, useMemo, useEffect, useRef } from "react";

/**
 * Módulo I: Guía técnica muestreo
 *
 * Mejoras V2:
 * - Búsqueda insensible a acentos/diacríticos (normalizeText)
 * - Atajos de teclado (/, Cmd+K)
 * - UI/UX mejorada (Glassmorphism, Quick Tags)
 * - Integración de Pricing "High-End" (Old Gold / Tabular Nums)
 */

// Hardcoded pricing for critical components (as examples/fallbacks)
const PRICING_MAP = {
  // Soportes (individual prices)
  'MAE10': 12.50,
  'MAE39': 15.80,
  'MT111': 22.40,
  'MT077': 18.20,
  // Profiles (Screening)
  '0205': 147.21,
  // Individual Tests
  'MA051': 55.20,
  'MA173': 82.80,
};

const formatPrice = (amount) => {
  if (!amount || isNaN(amount)) return null;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
};

export default function SamplingGuide({ contaminants, allContaminants, loading }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [editableCaudal, setEditableCaudal] = useState("");
  const searchInputRef = useRef(null);

  // Módulo Validación UNE 689 State
  const [exposicionTipo, setExposicionTipo] = useState("Constante");
  const [duracionTarea, setDuracionTarea] = useState(480);
  const [jornadaLaboral, setJornadaLaboral] = useState(8);

  const [isEstrategiaOpen, setIsEstrategiaOpen] = useState(true);
  const [isAmpliadaOpen, setIsAmpliadaOpen] = useState(true);

  // Modal state for Anexo I
  const [showAnexo, setShowAnexo] = useState(false);
  const [activeAnexoRef, setActiveAnexoRef] = useState("");

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Focus search on '/' or 'Cmd+K' / 'Ctrl+K'
      if (
        (e.key === "/" && document.activeElement !== searchInputRef.current) ||
        ((e.metaKey || e.ctrlKey) && e.key === "k")
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Close search on Escape
      if (e.key === "Escape") {
        if (query) {
          setQuery("");
          setSelectedId(null);
          searchInputRef.current?.blur();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [query]);

  // Helper: Normalize text to remove accents (e.g., "Ácido" -> "acido")
  const normalizeText = (text) => {
    if (!text) return "";
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  };

  // Helper: Parse number from string (supports commas and text like "< 0.1")
  const parseNum = (val) => {
    if (!val) return null;
    if (typeof val === "number") return val;
    // Replace comma with dot and extract numeric part
    const clean = val.toString().replace(/,/g, ".").replace(/[^\d.-]/g, "");
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? null : parsed;
  };

  // Helper: Calculate Volume Mínimo UNE 482
  // Formula: V = LOQ (µg) / (factor * VLA (mg/m³))
  const calcVolMinUNE482 = (loq, vla, factor) => {
    const loqValue = parseNum(loq);
    const vlaValue = parseNum(vla);
    if (loqValue === null || vlaValue === null || vlaValue === 0) return null;
    const v = loqValue / (factor * vlaValue);
    return Math.round(v * 100) / 100; // Round to 2 decimals
  };

  // Helper to detect "Anexo I" links or "Ver Tabla"
  const renderWithAnexoLink = (text) => {
    if (!text || typeof text !== "string") return text;

    // Regex to match "Anexo I", "anexo I", "Anexo" (if relevant), "Ver Tabla X", "Ver tabla X"
    const regex = /(Anexo\s+I|anexo\s+I|Anexo\s+\w+|Ver\s+[Tt]abla\s+\d+)/g;

    if (regex.test(text)) {
      const parts = text.split(regex);
      return (
        <span>
          {parts.map((part, i) => {
            if (regex.test(part)) {
              return (
                <span
                  key={i}
                  className="anexo-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveAnexoRef(text);
                    setShowAnexo(true);
                  }}
                  title="Ver información del Anexo I"
                >
                  {part} 🔗
                </span>
              );
            }
            return part;
          })}
        </span>
      );
    }
    return text;
  };

  // Smart Search: Multi-term + Accent Insensitive
  const results = useMemo(() => {
    if (!query || query.length < 2) return [];

    // Normalize query terms
    const terms = normalizeText(query).split(/\s+/).filter(Boolean);

    return contaminants.filter((c) => {
      // Create a normalized "haystack" string of searchable fields
      const haystack = normalizeText(
        [c.contaminante, c.sinonimo, c.cas, c.contaminante_display]
          .filter(Boolean)
          .join(" "),
      );

      // ALL terms must match somewhere in the haystack
      return terms.every((term) => haystack.includes(term));
    });
  }, [query, contaminants]);

  const selected =
    contaminants.find((c) => c.id === selectedId) ||
    contaminants.find((c) => c.contaminante === selectedId);

  // Synchronize editable flow rate when a new chemical is selected
  useEffect(() => {
    if (selected) {
      if (selected.caudal_asignado !== undefined && selected.caudal_asignado !== null) {
        setEditableCaudal(selected.caudal_asignado.toString().replace('.', ','));
      } else {
        const fallback = parseNum(selected.caudal) || parseNum(selected.caudal_l_min);
        setEditableCaudal(fallback !== null ? fallback.toString().replace('.', ',') : "");
      }
    } else {
      setEditableCaudal("");
    }
  }, [selected]);

  // Calculate validation state globally
  const methodCaudalGlobal = useMemo(() => {
    return parseFloat(editableCaudal.replace(',', '.')) || parseNum(selected?.caudal) || parseNum(selected?.caudal_l_min) || 0;
  }, [editableCaudal, selected]);

  const isCaudalOutOfRangeGlobal = useMemo(() => {
    if (!selected) return false;
    if (!isNaN(methodCaudalGlobal) && selected.caudal_metodo_min !== undefined && selected.caudal_metodo_max !== undefined) {
      if (methodCaudalGlobal < selected.caudal_metodo_min || methodCaudalGlobal > selected.caudal_metodo_max) {
         return true;
      }
    }
    return false;
  }, [methodCaudalGlobal, selected]);

  // Derive compounds for a screening profile
  const screeningCompounds = useMemo(() => {
    if (!selected || !selected.screening_perfil) return [];
    
    // Find all contaminants that share the same screening_perfil from the full list
    const listToSearch = allContaminants || contaminants;
    const related = listToSearch.filter(
      (c) => c.screening_perfil === selected.screening_perfil
    );

    // Filter out duplicates and format as "Display Name (CAS)"
    // We prefer contaminante_display if available, fallback to contaminante
    const uniqueMap = new Map();
    related.forEach((c) => {
      const key = c.cas || c.codigo_prueba || c.contaminante;
      if (key) {
        const name = c.contaminante_display || c.contaminante;
        const cleanName = name.split(" - ")[0];
        const casLabel = c.cas ? c.cas : "";
        uniqueMap.set(key, casLabel ? `${cleanName} (${casLabel})` : cleanName);
      }
    });
    
    const result = Array.from(uniqueMap.values()).sort();
    console.log("Screening Compounds for", selected.contaminante, ":", result);
    return result;
  }, [selected, contaminants, allContaminants]);

  // Quick Tags constant
  const QUICK_TAGS = [
    { label: "Aldehídos", term: "Aldehído" },
    { label: "Metales", term: "Metal" },
    { label: "Sílice", term: "Sílice" },
    { label: "Ácidos", term: "Ácido" },
    { label: "Amianto", term: "Amianto" },
    { label: "Disolventes", term: "Disolvente" },
  ];

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="sampling-guide-container">
      {/* Search Header */}
      <div className="hero-search-section">
        <h2 className="search-title">
          Guía técnica muestreo
          <span className="search-subtitle-inline">
            {" "}
            | Consulta de métodos de toma de muestra y análisis
          </span>
        </h2>

        <div className="search-box-wrapper">
          <div className={`search-input-container ${query ? "active" : ""}`}>
            <span className="search-icon">🔍</span>
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              placeholder="Buscar contaminante (ej. Formaldehído, 50-00-0)..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedId(null);
              }}
            />

            {/* Keyboard Shortcut Hint (Desktop only usually) */}
            {!query && (
              <div className="search-shortcut-hint">
                <span>/</span>
              </div>
            )}

            {query && (
              <button
                className="clear-button"
                onClick={() => {
                  setQuery("");
                  setSelectedId(null);
                  searchInputRef.current?.focus();
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {query && query.length >= 2 && !selectedId && (
            <div className="autocomplete-dropdown">
              {results.length > 0 ? (
                results.slice(0, 10).map((c, idx) => {
                  const displayName = c.contaminante_display || c.contaminante;
                  return (
                    <div
                      key={idx}
                      className="autocomplete-item"
                      onClick={() => {
                        setQuery(displayName);
                        setSelectedId(c.id || c.contaminante);
                      }}
                    >
                      <div className="item-name">
                        {displayName}
                        {c.cas && <span className="item-cas"> ({c.cas})</span>}
                      </div>
                      {c.sinonimo && (
                        <span className="item-synonym">{c.sinonimo}</span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="autocomplete-empty">
                  No se encontraron resultados
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Tags (only if no query) */}
        {!query && !selected && (
          <div className="quick-tags-container">
            <span className="quick-tags-label">Búsquedas frecuentes:</span>
            <div className="quick-tags">
              {QUICK_TAGS.map((tag, i) => (
                <button
                  key={i}
                  className="quick-tag"
                  onClick={() => {
                    setQuery(tag.term);
                    searchInputRef.current?.focus();
                  }}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="detail-panel">
          <div className="detail-header-top">
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <h3 className="detail-title">
                {renderWithAnexoLink(
                  selected.contaminante_display || selected.contaminante,
                )}
                {selected.cas && (
                  <span style={{ fontSize: "0.8em", color: "#64748b", fontWeight: 500, marginLeft: 8 }}>
                    (Nº CAS: {selected.cas})
                  </span>
                )}
              </h3>
              {selected.sinonimo && (
                <div style={{
                  fontSize: "13px",
                  color: "#64748b",
                  fontWeight: 400,
                  lineHeight: 1.4,
                  maxWidth: 700,
                }}>
                  {selected.sinonimo}
                </div>
              )}

              {/* Warning Badges */}
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {selected.sin_metodo_disponible && (
                  <span
                    className="badge badge-error"
                    style={{
                      fontSize: 13,
                      padding: "4px 8px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    ⚠️ Sin método de muestreo disponible en laboratorio (Buscar
                    alternativas)
                  </span>
                )}
                {selected.is_cmr && (
                  <span
                    className="badge badge-warn"
                    style={{
                      fontSize: 13,
                      padding: "4px 8px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    ☣️ Sustancia CMR (Aplica RD 665/1997)
                  </span>
                )}
              </div>
            </div>

            <div className="detail-header-actions">
              {(() => {
                const searchString =
                  (selected.tecnica_analitica || "") +
                  " " +
                  (selected.metodo_analisis || "");
                const mtaMatch = searchString.match(
                  /MTA\/MA-\d{3}\/[AR]\d{2}/i,
                );
                const mtaCode = mtaMatch ? mtaMatch[0] : null;

                const equipmentStr =
                  (selected.soporte_captacion_display || "") +
                  " " +
                  (selected.contenedor || "");
                const searchFocusRaw =
                  selected.soporte_captacion_display
                    ?.split("(")[0]
                    ?.split("->")[0]
                    ?.trim() || selected.contaminante;

                // --- APA Video Mapping (client-side) ---
                const APA_VIDEO_MAP = {
                  // Tubos absorbentes (sílica gel, carbón activo, aldehídos, NOx, etc.)
                  tubos:     "https://www.youtube.com/watch?v=ulD_fwpP2YU",
                  // Portafiltros de gravimetría (PGP) — fracción inhalable
                  pgp:       "https://www.youtube.com/watch?v=tIty4FQxq4w",
                  // IOM Sampler — fracción inhalable
                  iom:       "https://www.youtube.com/watch?v=cSPMWxenylI",
                  // Ciclón GK 2.69 — fracción respirable
                  ciclon:    "https://www.youtube.com/watch?v=RH2Nl4Yfhvg",
                  // Higgins & Dewell — fracción respirable
                  higgins:   "https://www.youtube.com/watch?v=ujwe9v92ulI",
                  // Captadores / Monitores Pasivos
                  pasivo:    "https://www.youtube.com/watch?v=m9fpzq6e0lk",
                  // HAP — Teflón + XAD-2
                  hap:       "https://www.youtube.com/watch?v=4VfS9voIaww",
                  // Fibras / Amianto
                  fibras:    "https://www.youtube.com/watch?v=zMCY-Kcn8Qg",
                  // Calibración de bombas (genérico)
                  bombas:    "https://www.youtube.com/watch?v=EKFBtCH5Enc",
                  // Calibración PGP
                  cal_pgp:   "https://www.youtube.com/watch?v=-0ZDyJYxLmI",
                  // Calibración IOM
                  cal_iom:   "https://www.youtube.com/watch?v=56gyf0korrg",
                };

                // Determine video URL from capture support description
                const getVideoUrl = (supportStr) => {
                  const s = (supportStr || "").toLowerCase();
                  if (/s[ií]lica|aldeh[ií]d|carb[oó]n|anasorb|xad|hopcalita|nox|ó?xido/i.test(s)) return APA_VIDEO_MAP.tubos;
                  if (/tubo/i.test(s)) return APA_VIDEO_MAP.tubos;
                  if (/pgp|porta.?filtro.?gravi/i.test(s)) return APA_VIDEO_MAP.pgp;
                  if (/iom/i.test(s)) return APA_VIDEO_MAP.iom;
                  if (/cicl[oó]n|gk.?2/i.test(s)) return APA_VIDEO_MAP.ciclon;
                  if (/higgins|dewell/i.test(s)) return APA_VIDEO_MAP.higgins;
                  if (/pasivo|monitor.*pasivo|captador.*pasivo|skc/i.test(s)) return APA_VIDEO_MAP.pasivo;
                  if (/hap|polic[ií]clico|teflon.*xad|xad.*teflon/i.test(s)) return APA_VIDEO_MAP.hap;
                  if (/fibra|amianto|edc.*reticulado/i.test(s)) return APA_VIDEO_MAP.fibras;
                  if (/cassette.*fv|filtro.*fibra.*vidrio|filtro.*cuarzo|filtro.*pvc|filtro.*celulosa|filtro.*mcef|cassette.*2|cassette.*3/i.test(s)) return APA_VIDEO_MAP.pgp;
                  if (/impinger|burbuj/i.test(s)) return APA_VIDEO_MAP.tubos;
                  if (/bolsa|tedlar/i.test(s)) return null; // No specific video
                  return null;
                };

                const videoUrl = getVideoUrl(equipmentStr) || "https://apa.es/higiene-industrial/videos-higiene-industrial/";
                const hasSpecificVideo = getVideoUrl(equipmentStr) !== null;

                return (
                  <>
                    {mtaCode && (
                      <a
                        href={`/api/link/mta/${encodeURIComponent(mtaCode)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-pro btn-pro-secondary"
                        style={{
                          fontSize: 13,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          textDecoration: "none",
                        }}
                        title={`Descargar ${mtaCode} exacto del INSST`}
                      >
                        <span style={{ fontSize: "16px" }}>📚</span>
                        Método Exacto
                      </a>
                    )}
                    <a
                      href={videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-pro btn-pro-secondary"
                      style={{
                        fontSize: 13,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        textDecoration: "none",
                        border: "1px solid #e2e8f0",
                        background: "white",
                        cursor: "pointer"
                      }}
                      title={hasSpecificVideo 
                        ? `Ver tutorial de muestreo para: ${searchFocusRaw}` 
                        : "Ver todos los vídeos de muestreo de APA"}
                    >
                      <span style={{ fontSize: "16px" }}>▶️</span>
                      Vídeo
                    </a>
                  </>
                );
              })()}

              <button
                className={`btn-pro btn-pro-primary ${isCaudalOutOfRangeGlobal ? 'disabled-btn' : ''}`}
                disabled={isCaudalOutOfRangeGlobal}
                title={isCaudalOutOfRangeGlobal ? "⚠️ Caudal asignado fuera de rango oficial" : "Descargar informe validado en PDF"}
                style={isCaudalOutOfRangeGlobal ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                onClick={async () => {
                  try {
                    // Extract values dynamically for the PDF Engine to stamp the custom ones instead of static ones
                    const methodCaudal = parseFloat(editableCaudal.replace(',', '.')) || parseNum(selected.caudal) || parseNum(selected.caudal_l_min);
                    const volMinED_UNE = calcVolMinUNE482(selected.lq || selected.loq, selected.vla_ed || selected.vla_ed_mg_m3, 0.1);
                    const volMinEC_UNE = calcVolMinUNE482(selected.lq || selected.loq, selected.vla_ec || selected.vla_ec_mg_m3, 0.5);
                    const timeMinED = (volMinED_UNE !== null && methodCaudal) ? parseFloat((volMinED_UNE / methodCaudal).toFixed(1)) : null;
                    const timeMinEC = (volMinEC_UNE !== null && methodCaudal) ? parseFloat((volMinEC_UNE / methodCaudal).toFixed(1)) : null;
                    
                    const formatTime = (minutes) => {
                      if (minutes === null || isNaN(minutes)) return null;
                      if (minutes < 60) return `${minutes} min`;
                      const hrs = Math.floor(minutes / 60);
                      const mins = Math.round(minutes % 60);
                      return mins > 0 ? `${hrs}h ${mins}min` : `${hrs}h`;
                    };

                    const payload = { 
                      ...selected,
                      caudal_asignado_final: methodCaudal,
                      tiempo_minimo_ed_final: formatTime(timeMinED),
                      tiempo_minimo_ec_final: formatTime(timeMinEC)
                    };

                    const response = await fetch(
                      "/api/generate-ficha",
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      },
                    );
                    if (!response.ok) throw new Error("API Error");
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.style.display = "none";
                    a.href = url;
                    const disposition = response.headers.get(
                      "content-disposition",
                    );
                    let filename =
                      `Ficha_${selected.contaminante_display || selected.contaminante}.pdf`.replace(
                        /[^a-zA-Z0-9.\-_]/g,
                        "_",
                      );
                    if (
                      disposition &&
                      disposition.indexOf("attachment") !== -1
                    ) {
                      const filenameRegex =
                        /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                      const matches = filenameRegex.exec(disposition);
                      if (matches != null && matches[1]) {
                        filename = matches[1].replace(/['"]/g, "");
                      }
                    }
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                  } catch (err) {
                    console.error("Error generating PDF:", err);
                    alert(
                      "Error al generar el PDF. Asegúrate de que API esté corriendo.",
                    );
                  }
                }}
              >
                📄 Descargar Ficha
              </button>
            </div>
          </div>

          {/* Promoted field: Perfil Analítico / Screening (First row) */}
          {selected.screening_perfil && (
            <div style={{ padding: "24px 28px 0", marginBottom: -4 }}>
              <div
                className="summary-stat-card"
                style={{ background: "#f0f9ff", borderColor: "#bae6fd", flex: "none", position: "relative" }}
              >
                {/* Badges container */}
                <div style={{ position: "absolute", top: "12px", right: "12px", display: "flex", gap: "6px", alignItems: "center" }}>
                  <span style={{ backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", color: "#0f172a", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px" }}>
                    {String(selected.screening_perfil).padStart(4, '0')}
                  </span>
                  {(selected.analisis_simultaneo !== undefined ? selected.analisis_simultaneo : screeningCompounds.length > 1) ? (
                    <span style={{ backgroundColor: "#22c55e", color: "white", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2px" }}>
                      análisis simultáneo
                    </span>
                  ) : (
                    <span style={{ backgroundColor: "#ef4444", color: "white", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2px" }}>
                      análisis no simultáneo
                    </span>
                  )}
                  {/* PVP Badge for Screening Profile */}
                  <div className="pvp-badge pvp-badge--gold">
                    💰 PVP: {formatPrice(PRICING_MAP[selected.screening_perfil] || 147.21)}
                  </div>
                </div>

                <div className="detail-item-label" style={{ color: "#0369a1" }}>
                  Perfil Analítico / Screening
                </div>
                <div className="detail-item-value" style={{ fontWeight: 600, color: "#0284c7", paddingRight: "180px" }}>
                  {selected.screening_desc}
                </div>
                {(selected.screening_compuestos_formatted || screeningCompounds.length > 0) && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#475569",
                      fontWeight: 400,
                      marginTop: 6,
                      lineHeight: 1.4,
                    }}
                  >
                    {selected.screening_compuestos_formatted || screeningCompounds.join(", ")}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2x2 Info Cards Grid */}
          <div className="info-cards-grid">
            {/* Card 1: Soporte */}
            <div className="info-card soporte-card">
              <div className="info-card-icon icon-green">🧪</div>
              <div className="info-card-content" style={{ flex: 1, minWidth: 0 }}>

                {/* Field Label */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span className="info-card-label">Soporte de Muestreo</span>
                  {/* Price Tag for primary support could go here if needed, but we put it in rows */}
                </div>

                {/* Soporte name — strip trailing code suffix (e.g. " → MAE10" or " -> MAE10") */}
                <p className="soporte-name">
                  {renderWithAnexoLink(
                    (selected.soporte_captacion_display || selected.soporte_captacion || "—")
                      .replace(/\s*(\u2192|->|→)\s*[A-Z]{1,4}\d+[A-Z0-9]*\s*$/i, "")
                      .trim()
                  )}
                </p>

                {/* Full-width support code rows */}
                {(selected.codigo_soporte || selected.codigo_soporte_alt || selected.ref_soporte) && (
                  <div className="soporte-rows">

                    {/* Principal row */}
                    {selected.codigo_soporte && (
                      <div className="soporte-row soporte-row--principal">
                        <span className="soporte-row-role">Principal</span>
                        <span className="soporte-row-code">{selected.codigo_soporte}</span>
                        <span className="soporte-row-price">
                          {formatPrice(PRICING_MAP[selected.codigo_soporte.split(/[\s()]+/)[0]] || 12.50)}
                        </span>
                      </div>
                    )}

                    {/* Alt rows — one per code from semicolon list */}
                    {selected.codigo_soporte_alt && (() => {
                      const parts = selected.codigo_soporte_alt
                        .split(/;\s*/)
                        .map(s => s.trim())
                        .filter(Boolean);
                      return parts.map((part, i) => {
                        const match = part.match(/^([A-Z]{1,4}\d+[A-Z0-9]*)([\s\S]*)$/);
                        const code = match ? match[1] : part;
                        const note = match ? match[2].trim().replace(/^\(|\)$/g, "").trim() : "";
                        return (
                          <div key={i} className="soporte-row soporte-row--alt">
                            <span className="soporte-row-role">Alternativo</span>
                            <span className="soporte-row-code">{code}</span>
                            {note && <span className="soporte-row-note">{note}</span>}
                            <span className="soporte-row-price">
                              {formatPrice(PRICING_MAP[code] || 15.80)}
                            </span>
                          </div>
                        );
                      });
                    })()}

                    {/* Ref fallback */}
                    {!selected.codigo_soporte && selected.ref_soporte && (
                      <div className="soporte-row soporte-row--ref">
                        <span className="soporte-row-role">Ref.</span>
                        <span className="soporte-row-code">{selected.ref_soporte}</span>
                        <span className="soporte-row-price">—</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Transport badge row (Repositioned to bottom right) */}
                <div className="transport-badge-container">
                  {(() => {
                    const raw = selected.transporte || "Temperatura ambiente";
                    const lower = raw.toLowerCase();
                    const isCold = /refriger|congelad|frío|frio|\d+\s*°\s*[cC]|<\s*0/.test(lower);
                    return (
                      <span className={`transport-badge ${isCold ? "transport-badge--cold" : "transport-badge--ambient"}`}>
                        {isCold ? "❄️" : "🌡️"} {raw}
                      </span>
                    );
                  })()}
                </div>
              </div>
            </div>



            {/* Card 2: DESCRIPCIÓN TÉCNICA ANALÍTICA + Códigos Lab */}
            <div className="info-card" style={{ flex: "1 1 100%" }}>
              <div className="info-card-icon icon-blue">🔬</div>
              <div className="info-card-content">
                <span className="info-card-label">DESCRIPCIÓN TÉCNICA ANALÍTICA</span>
                <span
                  className="info-card-value"
                  style={{ fontWeight: 600, whiteSpace: "pre-wrap" }}
                  title={selected.descripcion_tecnica}
                >
                  {selected.descripcion_tecnica || "—"}
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "12px" }}>
                  {/* General code hidden as per user request */}
                  {selected.codigo_8d && (
                    <div className="price-badge-item">
                      <span title="Plazo 8 días">🚀 Urgente:</span>
                      <span style={{ fontFamily: "monospace", letterSpacing: "0.5px" }}>{selected.codigo_8d}</span>
                      <span className="price-amount">{formatPrice(PRICING_MAP[selected.codigo_8d] || 82.80)}</span>
                    </div>
                  )}
                  {selected.codigo_15d && (
                    <div className="price-badge-item">
                      <span title="Plazo 15 días">📅 Estándar:</span>
                      <span style={{ fontFamily: "monospace", letterSpacing: "0.5px" }}>{selected.codigo_15d}</span>
                      <span className="price-amount">{formatPrice(PRICING_MAP[selected.codigo_15d] || 55.20)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 4-column Grid for Params */}
          <div className="info-cards-grid-4">
            {/* Caudal (Referencia) */}
            <div className="info-card" style={{ backgroundColor: "#f8fafc", border: "1px dashed #cbd5e1" }}>
              <div className="info-card-icon icon-teal" style={{ opacity: 0.6 }}>💨</div>
              <div className="info-card-content">
                <span className="info-card-label" style={{ color: "#64748b" }}>CAUDAL MÉTODO</span>
                <span className="info-card-value" style={{ color: "#334155" }}>
                  {selected.caudal_metodo_min && selected.caudal_metodo_max 
                    ? (selected.caudal_metodo_min === selected.caudal_metodo_max
                        ? `${selected.caudal_metodo_min.toString().replace('.', ',')} L/min`
                        : `${selected.caudal_metodo_min.toString().replace('.', ',')} - ${selected.caudal_metodo_max.toString().replace('.', ',')} L/min`)
                    : selected.caudal || selected.caudal_l_min
                      ? `${selected.caudal || selected.caudal_l_min} L/min`
                      : "—"}
                </span>
              </div>
            </div>

            {/* Volumen Mín. */}
            <div className="info-card">
              <div className="info-card-icon icon-teal">📦</div>
              <div className="info-card-content">
                <span className="info-card-label">Volumen Método</span>
                <span className="info-card-value">
                  {selected.volumen_minimo
                    ? (String(selected.volumen_minimo).toLowerCase().includes('l') 
                        ? selected.volumen_minimo 
                        : `${selected.volumen_minimo} L`)
                    : selected.volumen_recomendado_l
                      ? `${selected.volumen_recomendado_l} L`
                      : "—"}
                </span>
              </div>
            </div>

            {/* LOQ */}
            <div className="info-card">
              <div className="info-card-icon icon-yellow">🎯</div>
              <div className="info-card-content">
                <span className="info-card-label">LÍMITE DE CUANTIFICACIÓN</span>
                <span className="info-card-value">
                  {selected.lq
                    ? `${selected.lq} µg`
                    : selected.loq
                      ? `${selected.loq} µg`
                      : "—"}
                </span>
              </div>
            </div>

            {/* LOD */}
            <div className="info-card">
              <div className="info-card-icon icon-yellow">🔍</div>
              <div className="info-card-content">
                <span className="info-card-label">LÍMITE DE DETECCIÓN</span>
                <span className="info-card-value">
                  {selected.ld
                    ? `${selected.ld} µg`
                    : selected.lod
                      ? `${selected.lod} µg`
                      : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* --- CAPA 1: Cálculos UNE-EN 482 --- */}
          {(() => {
            // All calculations performed once for the entire detail section
            const methodCaudal = parseFloat(editableCaudal.replace(',', '.')) || parseNum(selected.caudal) || parseNum(selected.caudal_l_min);

            // --- MOTOR DE DECISIÓN UNIFICADO (UNE 482 & UNE 689) ---
            const lqForUnified = parseNum(selected.lq) || parseNum(selected.loq) || parseNum(selected.ld) || parseNum(selected.lod);
            const vlaEdValue = parseNum(selected.vla_ed) || parseNum(selected.vla_ed_mg_m3);
            const gestisTwaValue = parseNum(selected.gestis_twa);

            // 1. Cálculo t_482
            const t_482_vla = (lqForUnified && methodCaudal && vlaEdValue) ? (lqForUnified / (0.1 * vlaEdValue * methodCaudal)) : 0;
            const t_482_twa = (lqForUnified && methodCaudal && gestisTwaValue) ? (lqForUnified / (0.1 * gestisTwaValue * methodCaudal)) : 0;
            const t_482_max = Math.max(t_482_vla, t_482_twa);

            // 2. Cálculo t_689
            let t_689 = 0;
            const durTarea = Number(duracionTarea) || 0;
            if (exposicionTipo === "Constante") {
              t_689 = durTarea < 120 ? durTarea : 120;
            } else {
              t_689 = (Number(jornadaLaboral) || 8) * 0.8 * 60; // 80% de la jornada
            }

            // 3. Tiempo Mínimo Unificado
            const t_unified = Math.max(t_482_max, t_689);

            // 4. Índices usando t_unified
            let indiceVLA = null;
            if (lqForUnified && methodCaudal && vlaEdValue && t_unified > 0) {
               indiceVLA = (lqForUnified / (methodCaudal * t_unified)) / vlaEdValue;
            }
            let indiceTWA = null;
            if (lqForUnified && methodCaudal && gestisTwaValue && t_unified > 0) {
               indiceTWA = (lqForUnified / (methodCaudal * t_unified)) / gestisTwaValue;
            }

            const getValidationStatus = (indice) => {
              if (indice === null) return "unknown";
              if (indice <= 0.1) return "success";
              if (indice <= 0.5) return "warn";
              return "error";
            };
            const statusVLA = getValidationStatus(indiceVLA);
            const statusTWA = getValidationStatus(indiceTWA);

            // 5. Lógica de Sugerencia Inteligente
            let showSuggestion = false;
            let suggestedCaudal = 0;
            if (exposicionTipo === "Constante" && durTarea > 0 && durTarea < (t_482_max - 0.01)) {
              showSuggestion = true;
              const c_req_vla = (lqForUnified && vlaEdValue) ? (lqForUnified / (0.1 * vlaEdValue * durTarea)) : 0;
              const c_req_twa = (lqForUnified && gestisTwaValue) ? (lqForUnified / (0.1 * gestisTwaValue * durTarea)) : 0;
              suggestedCaudal = (Math.max(c_req_vla, c_req_twa)).toFixed(2);
            }
            // ----------------------------------------

            return (
              <>
                <div style={{ paddingBottom: "24px" }}>
                  {/* Campos de Límites (VLA-ED, VLA-EC, Gestis) */}
                  <div className="info-cards-grid-4" style={{ padding: "0 28px", marginTop: "16px", marginBottom: "16px" }}>
                    <div className="info-card">
                      <div className="info-card-icon icon-blue">⏱️</div>
                      <div className="info-card-content">
                        <span className="info-card-label">VLA-ED</span>
                        <span className="info-card-value">
                          {selected.vla_ed || selected.vla_ed_mg_m3
                            ? `${selected.vla_ed || selected.vla_ed_mg_m3} mg/m³`
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="info-card">
                      <div className="info-card-icon icon-blue">⚡</div>
                      <div className="info-card-content">
                        <span className="info-card-label">VLA-EC</span>
                        <span className="info-card-value">
                          {selected.vla_ec || selected.vla_ec_mg_m3
                            ? `${selected.vla_ec || selected.vla_ec_mg_m3} mg/m³`
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="info-card" style={{ position: "relative" }}>
                      <div className="info-card-icon icon-indigo">🌍</div>
                      <div className="info-card-content">
                        <span className="info-card-label">Gestis TWA</span>
                        <span className="info-card-value">
                          {selected.gestis_twa ? `${selected.gestis_twa} mg/m³` : "N/A"}
                        </span>
                        {selected.gestis_pais && selected.gestis_twa && (
                          <span style={{ position: "absolute", top: "12px", right: "12px", fontSize: "10px", fontWeight: "600", color: "#4f46e5", backgroundColor: "#e0e7ff", padding: "2px 6px", borderRadius: "4px" }}>
                            {selected.gestis_pais}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="info-card" style={{ position: "relative" }}>
                      <div className="info-card-icon icon-indigo">🌍</div>
                      <div className="info-card-content">
                        <span className="info-card-label">Gestis STEL</span>
                        <span className="info-card-value">
                          {selected.gestis_stel ? `${selected.gestis_stel} mg/m³` : "N/A"}
                        </span>
                        {selected.gestis_pais && selected.gestis_stel && (
                          <span style={{ position: "absolute", top: "12px", right: "12px", fontSize: "10px", fontWeight: "600", color: "#4f46e5", backgroundColor: "#e0e7ff", padding: "2px 6px", borderRadius: "4px" }}>
                            {selected.gestis_pais}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ padding: "0 28px 24px", display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
                  
                  {/* PESTAÑA 1: ESTRATEGIA DE MUESTREO */}
                  <div 
                    className="accordion-tab" 
                    onClick={() => setIsEstrategiaOpen(!isEstrategiaOpen)}
                  >
                    <span>Apoyo a estrategia de muestreo: Criterios UNE 482 y UNE 689</span>
                    <span 
                      className="accordion-icon"
                      style={{ transform: isEstrategiaOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    >
                      ⏬
                    </span>
                  </div>

                  {isEstrategiaOpen && (
                    <div className="accordion-content">
                      <div className="unified-engine-card">
                        
                        {/* Fila superior por Bloques */}
                        <div className="unified-inputs-row">
                          {/* Bloque A: Parámetros de la Tarea */}
                          <div className="unified-block block-a">
                            <div className="unified-block-title">Parámetros de la Tarea (Exposición)</div>
                            <div className="unified-block-inputs">
                              <div className="unified-input-group">
                                <label>Tipo Exposición</label>
                                <select 
                                  value={exposicionTipo} 
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setExposicionTipo(val);
                                    if (val === "Constante") {
                                      setDuracionTarea(480);
                                    }
                                  }}
                                  className="unified-select"
                                >
                                  <option value="Constante">Constante</option>
                                  <option value="Variable">Variable</option>
                                </select>
                              </div>
                              <div className={`unified-input-group ${exposicionTipo === "Variable" ? "disabled" : ""}`}>
                                <label>Duración (min)</label>
                                <input 
                                  type="number" 
                                  value={duracionTarea}
                                  onChange={(e) => setDuracionTarea(e.target.value)}
                                  disabled={exposicionTipo === "Variable"}
                                  className="unified-input-small"
                                  min="1"
                                />
                              </div>
                              <div className="unified-input-group">
                                <label>Jornada (h)</label>
                                <input 
                                  type="number" 
                                  value={jornadaLaboral}
                                  onChange={(e) => setJornadaLaboral(e.target.value)}
                                  className="unified-input-small"
                                  min="1"
                                  max="24"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Bloque B: Parámetro de Muestreo */}
                          <div className="unified-block block-b">
                            <div className="unified-block-title">Parámetro de Muestreo</div>
                            <div className="unified-block-inputs centered">
                              <div className="unified-input-group">
                                <label>Caudal Valorado (L/min)</label>
                                <div className={`unified-input-wrapper-large ${isCaudalOutOfRangeGlobal ? 'warning-border' : ''}`}>
                                  <span className="une-icon-subtle">💨</span>
                                  <input 
                                    type="text" 
                                    className="unified-input-large"
                                    value={editableCaudal}
                                    onChange={(e) => {
                                      const val = e.target.value.replace(/[^0-9.,]/g, '');
                                      setEditableCaudal(val);
                                    }}
                                    placeholder="Ej: 1,5"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Panel de Alertas y Sugerencias */}
                        <div className="unified-alerts-stack">
                          {/* 1. Alerta de Rango de Método (Lógica Restaurada) */}
                          {isCaudalOutOfRangeGlobal && (
                            <div className="range-warning-banner">
                              <div className="suggestion-icon">⚠️</div>
                              <div className="suggestion-text">
                                <strong>Advertencia:</strong> El caudal asignado ({methodCaudalGlobal} L/min) está fuera del rango oficial del método para este compuesto ({selected.caudal_metodo_min} - {selected.caudal_metodo_max} L/min).
                              </div>
                            </div>
                          )}

                          {/* 2. Panel de Sugerencia Inteligente (UNE 482 Sensitivity) */}
                          {showSuggestion && (
                            <div className="gold-suggestion-banner">
                              <div className="suggestion-icon">💡</div>
                              <div className="suggestion-text">
                                <strong>Optimización:</strong> La duración de la tarea ({duracionTarea} min) es insuficiente para el caudal actual ({methodCaudal} L/min).<br/>
                                Sugerencia: Incremente el Caudal Valorado a <span className="suggested-flow-btn" onClick={() => setEditableCaudal(suggestedCaudal.toString().replace('.', ','))}>{suggestedCaudal} L/min</span> para validar la sensibilidad en el tiempo disponible.
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Visualización de Resultados y Sensibilidad */}
                        <div className="unified-results-section">
                          <div className="unified-time-header">
                            Tiempo Mínimo de Medición Requerido: <strong>{Math.round(t_unified)} min</strong>
                          </div>
                          
                          <div className="unified-results-row">
                            <div className={`unified-result-card validation-${statusVLA}`}>
                              <div className="unified-result-label">Índice de exposición límite teórico para condiciones muestreo establecidas (VLA)</div>
                              <div className="unified-result-value">
                                {indiceVLA !== null ? indiceVLA.toFixed(3) : "N/A"}
                              </div>
                              <div className="unified-result-status">
                                {statusVLA === "success" && "🟢 Excelente (≤ 0.1)"}
                                {statusVLA === "warn" && "🟡 Aceptable (≤ 0.5)"}
                                {statusVLA === "error" && "🔴 Crítico (> 0.5)"}
                                {statusVLA === "unknown" && "Faltan datos (VLA o LQ)"}
                              </div>
                            </div>

                            <div className={`unified-result-card validation-${statusTWA}`}>
                              <div className="unified-result-label">Índice de exposición límite teórico para condiciones muestreo establecidas (TWA | Gestis)</div>
                              <div className="unified-result-value">
                                {indiceTWA !== null ? indiceTWA.toFixed(3) : "N/A"}
                              </div>
                              <div className="unified-result-status">
                                {statusTWA === "success" && "🟢 Excelente (≤ 0.1)"}
                                {statusTWA === "warn" && "🟡 Aceptable (≤ 0.5)"}
                                {statusTWA === "error" && "🔴 Crítico (> 0.5)"}
                                {statusTWA === "unknown" && "Faltan datos (TWA o LQ)"}
                              </div>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* PESTAÑA 2: AMPLIAR INFORMACIÓN */}
                  <div 
                    className="accordion-tab" 
                    onClick={() => setIsAmpliadaOpen(!isAmpliadaOpen)}
                  >
                    <span>Ampliar información</span>
                    <span 
                      className="accordion-icon"
                      style={{ transform: isAmpliadaOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    >
                      ⏬
                    </span>
                  </div>

                  {isAmpliadaOpen && (
                    <div className="accordion-content" style={{ marginTop: "-8px" }}>
                      <div className="detail-grid" style={{ borderTop: "none", paddingTop: 8 }}>
                        {/* REST OF DETAIL GRID STARTS HERE */}
                  {/* === SCREENING / PERFIL ANALÍTICO === */}
              {selected.screening_perfil && (
                <div
                  className="detail-item full-width"
                  style={{ background: "#f0f9ff", borderColor: "#bae6fd", position: "relative" }}
                >
                  {/* Badges container */}
                  <div style={{ position: "absolute", top: "12px", right: "12px", display: "flex", gap: "6px", alignItems: "center" }}>
                    <span style={{ backgroundColor: "#f1f5f9", border: "1px solid #cbd5e1", color: "#0f172a", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.5px" }}>
                      {String(selected.screening_perfil).padStart(4, '0')}
                    </span>
                    {(selected.analisis_simultaneo !== undefined ? selected.analisis_simultaneo : screeningCompounds.length > 1) ? (
                      <span style={{ backgroundColor: "#22c55e", color: "white", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2px" }}>
                        análisis simultáneo
                      </span>
                    ) : (
                      <span style={{ backgroundColor: "#ef4444", color: "white", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, letterSpacing: "0.2px" }}>
                        análisis no simultáneo
                      </span>
                    )}
                  </div>

                  <div className="detail-item-label" style={{ color: "#0369a1" }}>
                    Perfil Analítico / Screening
                  </div>
                  <div
                    className="detail-item-value"
                    style={{ fontWeight: 600, color: "#0284c7", paddingRight: "180px" }}
                  >
                    {selected.screening_desc}
                  </div>
                  {/* List of compounds fallback for expanded view */}
                  {(selected.screening_compuestos_formatted || screeningCompounds.length > 0) && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#475569",
                        fontWeight: 400,
                        marginTop: 6,
                        lineHeight: 1.5,
                        padding: "8px",
                        background: "rgba(255,255,255,0.5)",
                        borderRadius: "4px",
                        border: "1px dashed #bae6fd"
                      }}
                    >
                      <strong>Compuestos Incluidos:</strong><br/>
                      {selected.screening_compuestos_formatted || screeningCompounds.join(", ")}
                    </div>
                  )}
                </div>
              )}
              {selected.screening_condiciones_ed && (
                <div className="detail-item full-width" style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}>
                  <div className="detail-item-label" style={{ color: "#0369a1" }}>Condiciones Screening VLA-ED</div>
                  <div className="detail-item-value">{selected.screening_condiciones_ed}</div>
                </div>
              )}
              {selected.screening_condiciones_ec && (
                <div className="detail-item full-width" style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}>
                  <div className="detail-item-label" style={{ color: "#0369a1" }}>Condiciones Screening VLA-EC</div>
                  <div className="detail-item-value">{selected.screening_condiciones_ec}</div>
                </div>
              )}

              {/* === MÉTODO Y ANÁLISIS === */}
              <div className="detail-item">
                <div className="detail-item-label">Método de Análisis Interno</div>
                <div className="detail-item-value">
                  {renderWithAnexoLink(selected.metodo_analisis || "—")}
                </div>
              </div>
              {selected.metodo_interno_basado_en && (
                <div className="detail-item">
                  <div className="detail-item-label">Método Interno Basado En</div>
                  <div className="detail-item-value">{selected.metodo_interno_basado_en}</div>
                </div>
              )}
              {selected.descripcion_tecnica && (
                <div className="detail-item full-width">
                  <div className="detail-item-label">DESCRIPCIÓN TÉCNICA ANALÍTICA</div>
                  <div className="detail-item-value" style={{ whiteSpace: "pre-wrap" }}>{selected.descripcion_tecnica}</div>
                </div>
              )}
              {selected.tabla && (
                <div className="detail-item">
                  <div className="detail-item-label">Tabla de Compatibilidad</div>
                  <div className="detail-item-value">Tabla {selected.tabla}</div>
                </div>
              )}
              {selected.laboratorio && (
                <div className="detail-item">
                  <div className="detail-item-label">Laboratorio</div>
                  <div className="detail-item-value">{selected.laboratorio}</div>
                </div>
              )}

              {/* === CÓDIGOS Y REFERENCIAS === */}
              {selected.conc_fact_prueba && (
                <div className="detail-item">
                  <div className="detail-item-label">Conc. Fact. Prueba</div>
                  <div className="detail-item-value mono">{selected.conc_fact_prueba}</div>
                </div>
              )}
              {selected.codigo_perfil && (
                <div className="detail-item">
                  <div className="detail-item-label">Código Perfil Analítico</div>
                  <div className="detail-item-value mono">{selected.codigo_perfil}</div>
                </div>
              )}
              {selected.conc_fact_perfil && (
                <div className="detail-item">
                  <div className="detail-item-label">Conc. Fact. Perfil</div>
                  <div className="detail-item-value mono">{selected.conc_fact_perfil}</div>
                </div>
              )}
              {selected.codigo_soporte && (
                <div className="detail-item">
                  <div className="detail-item-label">Código Soporte</div>
                  <div className="detail-item-value mono">{selected.codigo_soporte}</div>
                </div>
              )}
              {selected.codigo_soporte_alt && (
                <div className="detail-item full-width">
                  <div className="detail-item-label">Soporte Alternativo</div>
                  <div className="detail-item-value">{selected.codigo_soporte_alt}</div>
                </div>
              )}

              {/* === PARÁMETROS DE CAUDAL DETALLADOS === */}
              {selected.caudal_metodo && (
                <div className="detail-item">
                  <div className="detail-item-label">Caudal Método (L/min)</div>
                  <div className="detail-item-value mono">{selected.caudal_metodo}</div>
                </div>
              )}
              {selected.caudal_muestreador && (
                <div className="detail-item">
                  <div className="detail-item-label">Caudal Muestreador (L/min)</div>
                  <div className="detail-item-value mono">{selected.caudal_muestreador}</div>
                </div>
              )}
              {selected.caudal_preferente && (
                <div className="detail-item">
                  <div className="detail-item-label">Caudal Preferente (L/min)</div>
                  <div className="detail-item-value mono">{selected.caudal_preferente}</div>
                </div>
              )}
              {selected.caudal_alternativo && (
                <div className="detail-item">
                  <div className="detail-item-label">Caudal Alternativo (L/min)</div>
                  <div className="detail-item-value mono">{selected.caudal_alternativo}</div>
                </div>
              )}
              {selected.rango_trabajo && (
                <div className="detail-item">
                  <div className="detail-item-label">Rango de Trabajo</div>
                  <div className="detail-item-value">{selected.rango_trabajo}</div>
                </div>
              )}

              {/* === TIEMPOS Y VOLÚMENES === */}
              {selected.tiempo_minimo_asignado && (
                <div className="detail-item">
                  <div className="detail-item-label">Tiempo Mín. Asignado (min)</div>
                  <div className="detail-item-value mono">{selected.tiempo_minimo_asignado}</div>
                </div>
              )}
              {selected.tiempo_minimo_muestreo_ed && (
                <div className="detail-item">
                  <div className="detail-item-label">Tiempo Mín. Muestreo 10%VLA-ED (min)</div>
                  <div className="detail-item-value mono">{selected.tiempo_minimo_muestreo_ed}</div>
                </div>
              )}
              {selected.tiempo_minimo_muestreo_twa && (
                <div className="detail-item">
                  <div className="detail-item-label">Tiempo Mín. Muestreo 10%TWA (min)</div>
                  <div className="detail-item-value mono">{selected.tiempo_minimo_muestreo_twa}</div>
                </div>
              )}
              {selected.v_minimo_muestreo_ed && (
                <div className="detail-item">
                  <div className="detail-item-label">V Mín. Muestreo VLA-ED (L)</div>
                  <div className="detail-item-value mono">{selected.v_minimo_muestreo_ed}</div>
                </div>
              )}
              {selected.v_minimo_muestreo_twa && (
                <div className="detail-item">
                  <div className="detail-item-label">V Mín. Muestreo TWA (L)</div>
                  <div className="detail-item-value mono">{selected.v_minimo_muestreo_twa}</div>
                </div>
              )}
              {selected.v_maximo_muestreo && (
                <div className="detail-item">
                  <div className="detail-item-label">V Máx. Muestreo 8h (L)</div>
                  <div className="detail-item-value mono">{selected.v_maximo_muestreo}</div>
                </div>
              )}
              {selected.loq_concentracion && (
                <div className="detail-item">
                  <div className="detail-item-label">LÍMITE DE CUANTIFICACIÓN (mg/m³)</div>
                  <div className="detail-item-value mono">{selected.loq_concentracion}</div>
                </div>
              )}

              {/* === IE MÍNIMOS TEÓRICOS === */}
              {selected.ie_minimo_teorico_ed && (
                <div className="detail-item">
                  <div className="detail-item-label">IE Mín. Teórico VLA-ED</div>
                  <div className="detail-item-value mono">{selected.ie_minimo_teorico_ed}</div>
                </div>
              )}
              {selected.ie_minimo_teorico_twa && (
                <div className="detail-item">
                  <div className="detail-item-label">IE Mín. Teórico TWA</div>
                  <div className="detail-item-value mono">{selected.ie_minimo_teorico_twa}</div>
                </div>
              )}
              {selected.ie_limite_condiciones_ed && (
                <div className="detail-item">
                  <div className="detail-item-label">IE Límite Condiciones VLA-ED</div>
                  <div className="detail-item-value mono">{selected.ie_limite_condiciones_ed}</div>
                </div>
              )}
              {selected.ie_limite_condiciones_twa && (
                <div className="detail-item">
                  <div className="detail-item-label">IE Límite Condiciones TWA</div>
                  <div className="detail-item-value mono">{selected.ie_limite_condiciones_twa}</div>
                </div>
              )}

              {/* === REGULATORIO Y LEP === */}
              {selected.frases_h && (
                <div className="detail-item full-width" style={{ background: "transparent", borderColor: "#e2e8f0" }}>
                  <div className="detail-item-label">Frases H (LEP 2025)</div>
                  <div className="detail-item-value mono">{selected.frases_h}</div>
                </div>
              )}
              {selected.notas_lep && (
                <div className="detail-item full-width" style={{ background: "transparent", borderColor: "#e2e8f0" }}>
                  <div className="detail-item-label">Notas LEP 2025</div>
                  <div className="detail-item-value">{selected.notas_lep}</div>
                </div>
              )}
              {selected.rd_665 && (
                <div className="detail-item full-width">
                  <div className="detail-item-label">Aplica RD 665/1997</div>
                  <div className="detail-item-value">{selected.rd_665}</div>
                </div>
              )}

              {/* === CMR / APÉNDICE 1 === */}
              {selected.is_cmr && (
                <div
                  className="detail-item full-width"
                  style={{ background: "#fff1f2", borderColor: "#fecdd3" }}
                >
                  <div className="detail-item-label" style={{ color: "#be123c" }}>
                    ⚠️ Sustancia CMR — Apéndice 1
                  </div>
                  <div className="detail-item-value" style={{ color: "#9f1239" }}>
                    {selected.familia_cmr && <div><strong>Familia:</strong> {selected.familia_cmr}</div>}
                    {selected.compatibilidades_cmr && <div><strong>Compatibilidades:</strong> {selected.compatibilidades_cmr}</div>}
                    {selected.evaluacion_apendice_1 && <div><strong>Evaluación:</strong> {selected.evaluacion_apendice_1}</div>}
                    {selected.concentracion_limite_cmr && <div><strong>Conc. Límite CMR:</strong> {selected.concentracion_limite_cmr}</div>}
                    {selected.cumple_003_vlaed && <div><strong>¿Cumple ≤0,03·VLA-ED?:</strong> {selected.cumple_003_vlaed}</div>}
                    {selected.cumple_v_max && <div><strong>¿Cumple V máx?:</strong> {selected.cumple_v_max}</div>}
                    {selected.contribucion_exterior && <div><strong>Contribución exterior:</strong> {selected.contribucion_exterior}</div>}
                  </div>
                </div>
              )}

              {/* === GESTIS (VALORES INTERNACIONALES) === */}
              {(selected.gestis_twa || selected.gestis_stel) && (
                <div className="detail-item full-width" style={{ background: "#fefce8", borderColor: "#fde68a" }}>
                  <div className="detail-item-label" style={{ color: "#92400e" }}>
                    🌍 Valores Gestis (Referencia Internacional)
                  </div>
                  <div className="detail-item-value mono">
                    TWA: {selected.gestis_twa || "—"} mg/m³ | STEL: {selected.gestis_stel || "—"} mg/m³
                    {selected.gestis_pais && <span> ({selected.gestis_pais})</span>}
                  </div>
                </div>
              )}

              {/* === LOGÍSTICA === */}
              {selected.plazo_entrega && (
                <div className="detail-item">
                  <div className="detail-item-label">Plazo Entrega Laboratorio</div>
                  <div className="detail-item-value">{selected.plazo_entrega}</div>
                </div>
              )}
              {selected.contenedor && (
                <div className="detail-item">
                  <div className="detail-item-label">Contenedor</div>
                  <div className="detail-item-value">{selected.contenedor}</div>
                </div>
              )}
              {selected.transporte && (
                <div className="detail-item">
                  <div className="detail-item-label">Condiciones de Transporte</div>
                  <div className="detail-item-value">{selected.transporte}</div>
                </div>
              )}
              {selected.precio_soporte && (
                <div className="detail-item">
                  <div className="detail-item-label">Precio Soporte (€)</div>
                  <div className="detail-item-value mono">{selected.precio_soporte}</div>
                </div>
              )}
              {selected.precio_analisis && (
                <div className="detail-item">
                  <div className="detail-item-label">Precio Análisis (€)</div>
                  <div className="detail-item-value mono">{selected.precio_analisis}</div>
                </div>
              )}

              {/* === UNE 689 / COMENTARIOS === */}
              {selected.comentarios_une_689 && (
                <div className="detail-item full-width">
                  <div className="detail-item-label">Comentarios UNE 689 (Muestreo 2h)</div>
                  <div className="detail-item-value">{selected.comentarios_une_689}</div>
                </div>
              )}
              {selected.comentarios_generales && (
                <div className="detail-item full-width">
                  <div className="detail-item-label">Comentarios Generales</div>
                  <div className="detail-item-value">{selected.comentarios_generales}</div>
                </div>
              )}

              {/* === OBSERVACIONES === */}
              {(selected.observaciones_concepto || selected.comentarios_prueba) && (
                <div className="detail-item full-width">
                  <div className="detail-item-label">Observaciones Adicionales</div>
                  <div className="detail-item-value" style={{ fontStyle: "italic" }}>
                    {selected.observaciones_concepto && <div>{selected.observaciones_concepto}</div>}
                    {selected.comentarios_prueba && <div>{selected.comentarios_prueba}</div>}
                  </div>
                </div>
              )}

              {/* === COMPUESTOS === */}
              {selected.compuestos && (
                <div className="detail-item full-width">
                  <div className="detail-item-label">Compuestos Asociados</div>
                  <div className="detail-item-value">{selected.compuestos}</div>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </>
           );
          })()}
        </div>
      )}

      {/* Empty state (when just starting) */}
      {!query && !selected && (
        <div className="empty-state" style={{ marginTop: 60 }}>
          <div className="empty-state-icon">⚗️</div>
          <div className="empty-state-text">
            Introduce un contaminante para consultar su ficha técnica
          </div>
          <div className="empty-state-sub">
            Puedes buscar por nombre, Nº CAS o sinónimo.
          </div>
        </div>
      )}

      {/* No results state */}
      {query && query.length >= 2 && results.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🔎</div>
          <div className="empty-state-text">
            No se encontraron resultados para "{query}"
          </div>
          <div className="empty-state-sub">
            Prueba a buscar sinónimos o el número CAS.
          </div>
        </div>
      )}

      {/* Anexo I Modal */}
      {showAnexo && (
        <div className="modal-overlay" onClick={() => setShowAnexo(false)}>
          <div
            className="modal-content large"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">Anexo I: Tablas de Screenings</h3>
              <button className="btn-close" onClick={() => setShowAnexo(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info">
                <span style={{ fontSize: 20 }}>ℹ️</span>
                <span>
                  Consulta las tablas del Anexo I en la Guía técnica muestreo oficial
                  para ver el listado completo de compuestos del screening.
                </span>
              </div>
              <p style={{ marginTop: 16 }}>
                Esta referencia indica que el compuesto forma parte de un
                barrido o screening analítico. Por favor, confirma en la
                documentación original qué compuestos específicos incluye este
                método.
              </p>
              {activeAnexoRef && (
                <div
                  style={{
                    marginTop: 24,
                    padding: 16,
                    background: "#F8FAFC",
                    borderRadius: 8,
                    border: "1px solid #E2E8F0",
                  }}
                >
                  <strong>Referencia encontrada:</strong>{" "}
                  <span style={{ fontFamily: "monospace" }}>
                    {activeAnexoRef}
                  </span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={() => setShowAnexo(false)}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
