import { useState, useMemo, useEffect, useRef } from "react";

/**
 * Módulo I: Guía Técnica de Muestreo
 *
 * Mejoras V2:
 * - Búsqueda insensible a acentos/diacríticos (normalizeText)
 * - Atajos de teclado (/, Cmd+K)
 * - UI/UX mejorada (Glassmorphism, Quick Tags)
 */
export default function SamplingGuide({ contaminants, allContaminants, loading }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [editableCaudal, setEditableCaudal] = useState("");
  const searchInputRef = useRef(null);

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

    // Filter out duplicates and format as "Display Name (Code)"
    // We prefer contaminante_display if available, fallback to contaminante
    const uniqueMap = new Map();
    related.forEach((c) => {
      if (c.codigo_prueba) {
        const name = c.contaminante_display || c.contaminante;
        // Clean up the name if it has " - aire" etc to make the comma list cleaner, or keep as is.
        // We will keep as is but focus on the main part before " - " if we want it concise, let's keep full for accuracy
        const cleanName = name.split(" - ")[0];
        uniqueMap.set(c.codigo_prueba, `${cleanName} (${c.codigo_prueba})`);
      }
    });
    
    return Array.from(uniqueMap.values()).sort();
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
          Guía Técnica de Muestreo
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
                const isCommonEquipment =
                  /tubo|filtro|ciclón|monitor|bomba|impactador/i.test(
                    equipmentStr,
                  );
                const searchFocusRaw =
                  selected.soporte_captacion_display
                    ?.split("(")[0]
                    ?.split("->")[0]
                    ?.trim() || selected.contaminante;

                let searchFocus = searchFocusRaw;
                const lowerEquip = searchFocusRaw.toLowerCase();
                if (lowerEquip.includes("sílica") || lowerEquip.includes("silica")) searchFocus = "Tubo Sílica Gel";
                else if (lowerEquip.includes("carbón") || lowerEquip.includes("carbon")) searchFocus = "Tubo Carbón Activo";
                else if (lowerEquip.includes("ciclón") || lowerEquip.includes("ciclon")) searchFocus = "Ciclón";
                else if (lowerEquip.includes("filtro")) searchFocus = "Filtro";
                else if (lowerEquip.includes("pasivo") || lowerEquip.includes("monitor")) searchFocus = "Monitor Pasivo";
                else if (lowerEquip.includes("impactador")) searchFocus = "Impactador";
                else if (lowerEquip.includes("burbujeador")) searchFocus = "Burbujeador";
                else if (lowerEquip.includes("tubo")) searchFocus = "Tubo Absorbente";

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
                    {isCommonEquipment && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/link/apa/${encodeURIComponent(searchFocus)}`);
                            const data = await res.json();
                            if (data.url) window.open(data.url, '_blank');
                          } catch (e) {
                            console.error("Error fetching video link", e);
                          }
                        }}
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
                        title={`Ver tutorial para ${searchFocus}`}
                      >
                        <span style={{ fontSize: "16px" }}>▶️</span>
                        Vídeo
                      </button>
                    )}
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
                style={{ background: "#f0f9ff", borderColor: "#bae6fd", flex: "none" }}
              >
                <div className="detail-item-label" style={{ color: "#0369a1" }}>
                  Perfil Analítico / Screening
                </div>
                <div className="detail-item-value" style={{ fontWeight: 600, color: "#0284c7" }}>
                  {selected.screening_desc} (Código {selected.screening_perfil}),{" "}
                  {screeningCompounds.length > 1
                    ? "análisis simultáneo"
                    : "análisis no simultáneo"}
                </div>
                {selected.screening_compuestos_formatted && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#475569",
                      fontWeight: 400,
                      marginTop: 4,
                      lineHeight: 1.4,
                    }}
                  >
                    {selected.screening_compuestos_formatted}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2x2 Info Cards Grid */}
          <div className="info-cards-grid">
            {/* Card 1: Soporte */}
            <div className="info-card">
              <div className="info-card-icon icon-green">🧪</div>
              <div className="info-card-content">
                <span className="info-card-label">Soporte de Muestreo</span>
                <span
                  className="info-card-value"
                  title={
                    selected.soporte_captacion_display ||
                    selected.soporte_captacion
                  }
                >
                  {renderWithAnexoLink(
                    selected.soporte_captacion_display ||
                      selected.soporte_captacion ||
                      "—",
                  )}
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px" }}>
                  {selected.codigo_soporte && (
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Soporte Principal — Ref: <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{selected.codigo_soporte}</span>
                    </span>
                  )}
                  {selected.codigo_soporte_alt && (
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Soporte Alternativo — Ref: <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{selected.codigo_soporte_alt}</span>
                    </span>
                  )}
                  {!selected.codigo_soporte && selected.ref_soporte && (
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Ref: <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{selected.ref_soporte}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 2: Descripción Técnica + Códigos Lab */}
            <div className="info-card" style={{ flex: "1 1 100%" }}>
              <div className="info-card-icon icon-blue">🔬</div>
              <div className="info-card-content">
                <span className="info-card-label">Descripción Técnica</span>
                <span
                  className="info-card-value"
                  style={{ fontWeight: 600 }}
                  title={selected.descripcion_tecnica}
                >
                  {selected.descripcion_tecnica || "—"}
                </span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginTop: "6px" }}>
                  {selected.codigo_prueba && (
                    <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>
                      Código Gral: <strong>{selected.codigo_prueba}</strong>
                    </span>
                  )}
                  {selected.codigo_8d && (
                    <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>
                      Urgente (8 días): <strong>{selected.codigo_8d}</strong>
                    </span>
                  )}
                  {selected.codigo_15d && (
                    <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>
                      Estándar (15 días): <strong>{selected.codigo_15d}</strong>
                    </span>
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
                <span className="info-card-label" style={{ color: "#64748b" }}>Caudal, rango método</span>
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
                <span className="info-card-label">LOQ</span>
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
                <span className="info-card-label">LOD</span>
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
            const volMinED_UNE = calcVolMinUNE482(
              selected.lq || selected.loq,
              selected.vla_ed || selected.vla_ed_mg_m3,
              0.1
            );
            const volMinEC_UNE = calcVolMinUNE482(
              selected.lq || selected.loq,
              selected.vla_ec || selected.vla_ec_mg_m3,
              0.5
            );

            // Get max volume recommended by method to compare
            const maxVolMethod =
              parseNum(selected.v_maximo_muestreo) ||
              parseNum(selected.volumen_recomendado_l) ||
              parseNum(selected.volumen_minimo);

            const methodCaudal = parseFloat(editableCaudal.replace(',', '.')) || parseNum(selected.caudal) || parseNum(selected.caudal_l_min);

            const timeMinED_UNE = (volMinED_UNE !== null && methodCaudal) 
              ? parseFloat((volMinED_UNE / methodCaudal).toFixed(1)) 
              : null;
              
            const timeMinEC_UNE = (volMinEC_UNE !== null && methodCaudal) 
              ? parseFloat((volMinEC_UNE / methodCaudal).toFixed(1)) 
              : null;
              
            const formatTime = (minutes) => {
              if (minutes === null || isNaN(minutes)) return "N/A";
              if (minutes < 60) return `${minutes} min`;
              const hrs = Math.floor(minutes / 60);
              const mins = Math.round(minutes % 60);
              return mins > 0 ? `${hrs}h ${mins}min` : `${hrs}h`;
            };

            let showWarningED = false;
            let showWarningEC = false;
            if (maxVolMethod) {
              if (volMinED_UNE !== null && volMinED_UNE > maxVolMethod) showWarningED = true;
              if (volMinEC_UNE !== null && volMinEC_UNE > maxVolMethod) showWarningEC = true;
            }
            const showWarningTotal = showWarningED || showWarningEC;

            return (
              <div style={{ paddingBottom: "24px" }}>
                {/* Límites Comparativos Row */}
                <div className="section-title" style={{ padding: "8px 28px 8px", fontSize: "14px", fontWeight: "600", color: "#1e293b", marginTop: 16 }}>
                  Límites Comparativos (Nacional e Internacional)
                </div>

                <div className="info-cards-grid-4" style={{ padding: "0 28px" }}>
                  {/* VLA-ED */}
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

                  {/* VLA-EC */}
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

                  {/* Gestis TWA */}
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

                  {/* Gestis STEL */}
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

                {/* Control Operativo Row */}
                <div className="section-title" style={{ padding: "16px 28px 8px", fontSize: "14px", fontWeight: "600", color: "#1e293b", borderTop: "1px solid #e2e8f0" }}>
                  Control Operativo (UNE 482)
                </div>
                
                <div className="info-cards-grid-4" style={{ padding: "0 28px" }}>
                  {/* Caudal Asignado */}
                  <div className={`info-card ${isCaudalOutOfRangeGlobal ? "warning" : ""}`} style={{ display: "flex", flexDirection: "column" }}>
                    <div className="info-card-icon icon-teal">💨</div>
                    <div className="info-card-content" style={{ width: "100%" }}>
                      <span className="info-card-label" style={{ marginBottom: "6px" }}>Caudal Asignado (L/min)</span>
                      <input 
                        type="text" 
                        className="caudal-input-premium"
                        value={editableCaudal}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9.,]/g, '');
                          setEditableCaudal(val);
                        }}
                        placeholder="Ej: 1,5"
                        style={{ width: "100px", padding: "6px 12px" }}
                      />
                      {isCaudalOutOfRangeGlobal && (
                         <div style={{ marginTop: "8px", fontSize: "11px", color: "#ef4444", fontWeight: "500" }}>
                           ⚠️ Valor fuera de rango oficial
                         </div>
                      )}
                    </div>
                  </div>

                  {/* Tiempo Mín. VLA-ED (UNE 482) */}
                  <div className={`info-card ${(timeMinED_UNE > 480) ? "warning" : ""}`}>
                    <div className="info-card-icon icon-teal">⏳</div>
                    <div className="info-card-content">
                      <span className="info-card-label">Tiempo Mín. ED (UNE 482)</span>
                      <span className="info-card-value" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {formatTime(timeMinED_UNE)}
                        {showWarningED && (
                          <span className="warning-icon" title={`Atención: El tiempo requerido (${formatTime(timeMinED_UNE)} a ${methodCaudal} L/min) equivale a ${volMinED_UNE} L, superando el máximo recomendado por el método analítico (${maxVolMethod} L).`} style={{ fontSize: "15px" }}>
                            ⚠️
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Tiempo Mín. VLA-EC (UNE 482) */}
                  <div className={`info-card ${showWarningEC ? "warning" : ""}`}>
                    <div className="info-card-icon icon-teal">⏳</div>
                    <div className="info-card-content">
                      <span className="info-card-label">Tiempo Mín. EC (UNE 482)</span>
                      <span className="info-card-value" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {formatTime(timeMinEC_UNE)}
                        {showWarningEC && (
                          <span className="warning-icon" title={`Atención: El tiempo requerido (${formatTime(timeMinEC_UNE)} a ${methodCaudal} L/min) equivale a ${volMinEC_UNE} L, superando el máximo recomendado por el método analítico (${maxVolMethod} L).`} style={{ fontSize: "15px" }}>
                            ⚠️
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Banner de Advertencia Global */}
                {showWarningTotal && (
                  <div className="capa1-warning-banner" style={{ margin: "24px 28px 0" }}>
                    ⚠️ <b>Atención (Saturación Soporte):</b> El volumen requerido por la norma UNE-EN 482:2021 supera 
                    el volumen recomendado o máximo del método analítico ({maxVolMethod} L). 
                    Se requiere ajustar la estrategia de muestreo.
                  </div>
                )}
                
                {/* Banner de Advertencia Jornada Laboral */}
                {timeMinED_UNE > 480 && (
                  <div className="capa1-warning-banner banner-orange" style={{ margin: "24px 28px 0", backgroundColor: "#fff7ed", color: "#9a3412", borderLeft: "4px solid #ea580c" }}>
                    ⚠️ <b>Atención:</b> El muestreo excede la jornada laboral estándar (8 horas).
                  </div>
                )}
              </div>
            );
          })()}

          {/* Toggle Expanded View */}
          <div style={{ padding: "0 28px 24px" }}>
            <button
              className="btn-expand-info"
              onClick={() => {
                const panel = document.getElementById("expanded-info");
                if (panel.style.display === "none") {
                  panel.style.display = "block";
                } else {
                  panel.style.display = "none";
                }
              }}
            >
              <span>Ampliar información</span>
              <span style={{ fontSize: 16, transition: "transform 0.3s" }}>⬇️</span>
            </button>
          </div>

          {/* Expanded Information */}
          <div
            id="expanded-info"
            className="expanded-info-section"
            style={{ display: "none" }}
          >
            <div className="detail-grid" style={{ borderTop: "none", paddingTop: 8, marginTop: 8 }}>
              {/* === SCREENING / PERFIL ANALÍTICO === */}
              {selected.screening_perfil && (
                <div
                  className="detail-item full-width"
                  style={{ background: "#f0f9ff", borderColor: "#bae6fd" }}
                >
                  <div className="detail-item-label" style={{ color: "#0369a1" }}>
                    Perfil Analítico / Screening
                  </div>
                  <div
                    className="detail-item-value"
                    style={{ fontWeight: 600, color: "#0284c7" }}
                  >
                    Código {selected.screening_perfil} — {selected.screening_desc}
                  </div>
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
                  <div className="detail-item-label">Descripción Técnica</div>
                  <div className="detail-item-value">{selected.descripcion_tecnica}</div>
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
              {selected.codigo_prueba && (
                <div className="detail-item">
                  <div className="detail-item-label">Código Prueba</div>
                  <div className="detail-item-value mono">{selected.codigo_prueba}</div>
                </div>
              )}
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
                  <div className="detail-item-label">LOQ Concentración (mg/m³)</div>
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
                  Consulta las tablas del Anexo I en la Guía Técnica oficial
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
