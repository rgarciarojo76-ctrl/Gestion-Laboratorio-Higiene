import { useState, useEffect, useCallback } from "react";

/**
 * AdminPanel — Configuración Avanzada
 *
 * Password-protected admin panel for managing product visibility,
 * editing product fields, creating new products, and viewing activity log.
 */
export default function AdminPanel({ onDataChanged }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");

  // Admin data
  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [logEntries, setLogEntries] = useState([]);
  const [activeTab, setActiveTab] = useState("products"); // products | log

  // Modal state
  const [editProduct, setEditProduct] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);

  // Loading state
  const [saving, setSaving] = useState(false);

  const API_BASE = "";

  // ─── Authentication ───────────────────────────────────────────────
  const handleLogin = async () => {
    setAuthError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) {
        setAuthenticated(true);
        fetchProducts("");
        fetchLog();
      } else {
        setAuthError(data.error || "Contraseña incorrecta");
      }
    } catch {
      setAuthError("Error de conexión con el servidor");
    }
  };

  // ─── Data Fetching ────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    try {
      const url = `${API_BASE}/api/admin/products`;
      const res = await fetch(url, { headers: { "X-Admin-Password": password } });
      const data = await res.json();
      if (Array.isArray(data)) setProducts(data);
    } catch (e) {
      console.error("Error fetching products:", e);
    }
  }, [password]);

  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/log`, {
        headers: { "X-Admin-Password": password },
      });
      const data = await res.json();
      if (data.entries) setLogEntries(data.entries.reverse());
    } catch (e) {
      console.error("Error fetching log:", e);
    }
  }, [password]);

  // Initial fetch on authenticated
  useEffect(() => {
    if (authenticated) {
      fetchProducts();
      fetchLog();
    }
  }, [authenticated, fetchProducts, fetchLog]);
  // ─── Actions ──────────────────────────────────────────────────────
  const toggleVisibility = async (id) => {
    setSaving(true);
    // Optimistic UI update
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, visible_en_app: !p.visible_en_app } : p));
    try {
      const res = await fetch(`${API_BASE}/api/admin/products/${id}/visibility`, {
        method: "PUT",
        headers: { "X-Admin-Password": password },
      });
      if (!res.ok) throw new Error("Fallo al contactar con el backend.");
      fetchLog();
      if (onDataChanged) onDataChanged();
    } catch (e) {
      console.error("Toggle error:", e);
      alert("Error: No se guardaron los cambios. La sesión podría haber caducado o GitHub tarda en responder.");
      // Revert optimistic
      setProducts((prev) => prev.map((p) => p.id === id ? { ...p, visible_en_app: !p.visible_en_app } : p));
    }
    setSaving(false);
  };

  const saveProduct = async (product) => {
    setSaving(true);
    try {
      const { id, ...fields } = product;
      const res = await fetch(`${API_BASE}/api/admin/products/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": password,
        },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error("Fallo al contactar con el backend.");
      await fetchProducts();
      fetchLog();
      setEditProduct(null);
      if (onDataChanged) onDataChanged();
    } catch (e) {
      console.error("Save error:", e);
      alert("Error: No se pudo conectar con el servidor backend.");
    }
    setSaving(false);
  };

  const createProduct = async (product) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": password,
        },
        body: JSON.stringify(product),
      });
      if (!res.ok) throw new Error("Fallo al contactar con el backend.");
      await fetchProducts();
      fetchLog();
      setShowNewModal(false);
      if (onDataChanged) onDataChanged();
    } catch (e) {
      console.error("Create error:", e);
      alert("Error: No se pudo conectar con el servidor backend.");
    }
    setSaving(false);
  };

  const publishToWeb = async () => {
    if (!window.confirm("¿Estás seguro de que quieres publicar los cambios actuales en la versión web (Vercel)? Esto tardará ~1 minuto.")) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/deploy`, {
        method: "POST",
        headers: { "X-Admin-Password": password },
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || "Cambios enviados a Vercel con éxito.");
        fetchLog();
      } else {
        alert("Error al publicar: " + (data.error || "Desconocido"));
      }
    } catch (e) {
      console.error("Deploy error:", e);
      alert("Error de conexión al intentar publicar.");
    }
    setSaving(false);
  };

  // ─── Login Screen ─────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <div className="admin-login-container">
        <div className="admin-login-card">
          <div className="admin-login-icon">🔒</div>
          <h2>Configuración Avanzada</h2>
          <p className="admin-login-subtitle">
            Acceso restringido. Introduzca la contraseña de administración.
          </p>
          <div className="admin-login-form">
            <div className="admin-password-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                className="admin-login-input"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                autoFocus
              />
              <button 
                type="button"
                className="admin-password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
            <button className="admin-login-btn" onClick={handleLogin}>
              Acceder
            </button>
          </div>
          {authError && <p className="admin-login-error">{authError}</p>}
        </div>
      </div>
    );
  }

  // ─── Admin Dashboard ──────────────────────────────────────────────
  return (
    <div className="admin-dashboard">
      {/* Admin Header */}
      <div className="admin-header">
        <div>
          <h2 className="admin-title">⚙️ Panel de Administración</h2>
          <p className="admin-subtitle">
            Gestión de inventario y control de visibilidad
          </p>
        </div>
        <button
          className="admin-logout-btn"
          onClick={() => {
            setAuthenticated(false);
            setPassword("");
          }}
        >
          🔓 Cerrar sesión
        </button>
      </div>

      {/* Sub-tabs */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === "products" ? "active" : ""}`}
          onClick={() => setActiveTab("products")}
        >
          📦 Productos
        </button>
        <button
          className={`admin-tab ${activeTab === "log" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("log");
            fetchLog();
          }}
        >
          📋 Registro de Actividad
        </button>
      </div>

      {/* Products Tab */}
      {activeTab === "products" && (
        <div className="admin-products-section">
          <div className="admin-toolbar">
            <div className="admin-search-box">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Buscar por nombre o CAS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="admin-filter-select"
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "14px", background: "white", color: "var(--text-primary)" }}
            >
              <option value="all">👁️ Todos los estados</option>
              <option value="visible">✅ Solo Visibles</option>
              <option value="hidden">❌ Solo Ocultos</option>
            </select>
            <div style={{ display: "flex", gap: "10px", marginLeft: "auto" }}>
              <button
                className="admin-btn-secondary"
                onClick={publishToWeb}
                disabled={saving}
                title="Sube los cambios locales a GitHub y actualiza la web de Vercel"
              >
                {saving ? "⏳ Procesando..." : "🌐 Publicar en Vercel"}
              </button>
              <button
                className="admin-btn-primary"
                onClick={() => setShowNewModal(true)}
              >
                ➕ Nuevo Producto
              </button>
            </div>
          </div>

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Visible</th>
                  <th>Contaminante</th>
                  <th style={{ width: 120 }}>Nº CAS</th>
                  <th style={{ width: 200 }}>Técnica</th>
                  <th style={{ width: 100 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products
                  .filter((p) => {
                    // Search purely locally
                    if (searchQuery) {
                      const qMatch = searchQuery.toLowerCase();
                      const nMatch = (p.contaminante_display || p.contaminante || "").toLowerCase().includes(qMatch);
                      const sMatch = (p.sinonimo || "").toLowerCase().includes(qMatch);
                      const cMatch = (p.cas || "").toLowerCase().includes(qMatch);
                      if (!nMatch && !sMatch && !cMatch) return false;
                    }
                    if (visibilityFilter === "all") return true;
                    if (visibilityFilter === "visible") return p.visible_en_app;
                    return !p.visible_en_app;
                  })
                  .slice(0, 100)
                  .map((p) => (
                  <tr
                    key={p.id}
                    className={p.visible_en_app ? "" : "admin-row-hidden"}
                  >
                    <td>
                      <button
                        className={`admin-toggle ${p.visible_en_app ? "on" : "off"}`}
                        onClick={() => toggleVisibility(p.id)}
                        disabled={saving}
                        title={
                          p.visible_en_app
                            ? "Visible — clic para ocultar"
                            : "Oculto — clic para mostrar"
                        }
                      >
                        {p.visible_en_app ? "✅" : "❌"}
                      </button>
                    </td>
                    <td className="admin-cell-name">
                      {p.contaminante_display || p.contaminante}
                    </td>
                    <td className="mono">{p.cas || "—"}</td>
                    <td>
                      <div>{p.descripcion_tecnica || "—"}</div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {p.codigo_prueba && <span>Gral: <strong>{p.codigo_prueba}</strong></span>}
                        {p.codigo_8d && <span style={{ color: "#92400e" }}>8d: <strong>{p.codigo_8d}</strong></span>}
                        {p.codigo_15d && <span style={{ color: "#065f46" }}>15d: <strong>{p.codigo_15d}</strong></span>}
                      </div>
                    </td>
                    <td>
                      <button
                        className="admin-btn-edit"
                        onClick={() => setEditProduct({ ...p })}
                      >
                        ✏️ Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {products.filter((p) => {
                    if (searchQuery) {
                      const qMatch = searchQuery.toLowerCase();
                      const nMatch = (p.contaminante_display || p.contaminante || "").toLowerCase().includes(qMatch);
                      const sMatch = (p.sinonimo || "").toLowerCase().includes(qMatch);
                      const cMatch = (p.cas || "").toLowerCase().includes(qMatch);
                      if (!nMatch && !sMatch && !cMatch) return false;
                    }
                    if (visibilityFilter === "all") return true;
                    if (visibilityFilter === "visible") return p.visible_en_app;
                    return !p.visible_en_app;
                  }).length > 100 && (
              <p className="admin-table-footer">
                La búsqueda ha encontrado demasiados resultados, mostrando los 100 primeros. Refina la búsqueda para ver más.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Log Tab */}
      {activeTab === "log" && (
        <div className="admin-log-section">
          {logEntries.length === 0 ? (
            <p className="admin-log-empty">
              No hay registros de actividad aún.
            </p>
          ) : (
            <div className="admin-log-list">
              {logEntries.map((entry, i) => (
                <div key={i} className="admin-log-entry">
                  {entry}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Edit Modal */}
      {editProduct && (
        <ProductModal
          product={editProduct}
          title="Editar Producto"
          onSave={saveProduct}
          onClose={() => setEditProduct(null)}
          saving={saving}
        />
      )}

      {/* New Product Modal */}
      {showNewModal && (
        <ProductModal
          product={{
            contaminante: "",
            contaminante_display: "",
            cas: "",
            sinonimo: "",
            descripcion_tecnica: "",
            soporte_captacion: "",
            caudal: "",
            volumen_minimo: "",
            lq: "",
            vla_ed: "",
            vla_ec: "",
          }}
          title="Nuevo Producto"
          onSave={createProduct}
          onClose={() => setShowNewModal(false)}
          saving={saving}
          isNew
        />
      )}
    </div>
  );
}

// ─── Product Modal Component ──────────────────────────────────────────────

function ProductModal({ product, title, onSave, onClose, saving, isNew }) {
  const [form, setForm] = useState({ ...product });

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const fields = [
    { key: "contaminante", label: "Nombre Interno (Contaminante)", wide: true },
    { key: "contaminante_display", label: "Nombre para Mostrar (Display)", wide: true },
    { key: "cas", label: "Nº CAS" },
    { key: "sinonimo", label: "Sinónimos", wide: true },
    { key: "descripcion_tecnica", label: "Descripción Técnica", wide: true },
    { key: "codigo_prueba", label: "Código Prueba (General)" },
    { key: "codigo_8d", label: "Código Urgente (8 días)" },
    { key: "codigo_15d", label: "Código Estándar (15 días)" },
    { key: "soporte_captacion", label: "Soporte de Captación (Código)" },
    { key: "soporte_captacion_display", label: "Soporte de Captación (Display)", wide: true },
    { key: "codigo_soporte", label: "Código Soporte Principal" },
    { key: "codigo_soporte_alt", label: "Código Soporte Alternativo", wide: true },
    { key: "ref_soporte", label: "Referencia Soporte" },
    { key: "caudal", label: "Caudal (L/min)" },
    { key: "volumen_minimo", label: "Volumen Mínimo (L)" },
    { key: "v_minimo_muestreo_ed", label: "V Mínimo Muestreo ED" },
    { key: "v_minimo_muestreo_twa", label: "V Mínimo Muestreo TWA" },
    { key: "v_maximo_muestreo", label: "V Máximo Muestreo" },
    { key: "tiempo_minimo_asignado", label: "Tiempo Mínimo Asignado" },
    { key: "tiempo_minimo_muestreo_ed", label: "Tiempo Mínimo Muestreo ED" },
    { key: "tiempo_minimo_muestreo_twa", label: "Tiempo Mínimo Muestreo TWA" },
    { key: "lq", label: "LQ / LOQ (µg)" },
    { key: "loq_concentracion", label: "LOQ Concentración" },
    { key: "vla_ed", label: "VLA-ED (mg/m³)" },
    { key: "vla_ec", label: "VLA-EC (mg/m³)" },
    { key: "notas_lep", label: "Notas LEP" },
    { key: "is_cmr", label: "Es CMR", type: "boolean" },
    { key: "familia_cmr", label: "Familia CMR" },
    { key: "rd_665", label: "RD 665", type: "boolean" },
    { key: "frases_h", label: "Frases H", wide: true },
    { key: "gestis_pais", label: "Gestis País" },
    { key: "gestis_twa", label: "Gestis TWA" },
    { key: "gestis_stel", label: "Gestis STEL" },
    { key: "tecnica_analitica", label: "Técnica Analítica (Acrónimo)" },
    { key: "metodo_analisis", label: "Método de Análisis", wide: true },
    { key: "metodo_interno_basado_en", label: "Método Interno Basado En", wide: true },
    { key: "ref_tecnica", label: "Referencia Técnica" },
    { key: "laboratorio", label: "Laboratorio" },
    { key: "plazo_entrega", label: "Plazo de Entrega" },
    { key: "transporte", label: "Transporte", type: "select", options: ["Ambiente", "Refrigerante", "Congelador"] },
    { key: "precio_analisis", label: "Precio Análisis" },
    { key: "precio_soporte", label: "Precio Soporte" },
    { key: "rango_trabajo", label: "Rango de Trabajo" },
    { key: "coeficiente_desorcion", label: "Coeficiente de Desorción" },
    { key: "cv_analitico", label: "CV Analítico" },
    { key: "cv_total", label: "CV Total" },
    { key: "observaciones_concepto", label: "Observaciones Concepto", wide: true },
    { key: "evaluacion_apendice_1", label: "Evaluación Apéndice 1", type: "select", options: ["Sí", "No", "N/A"] },
    { key: "ie_limite_condiciones_ed", label: "IE Límite Condiciones ED" },
    { key: "ie_limite_condiciones_twa", label: "IE Límite Condiciones TWA" },
    { key: "ie_minimo_teorico_ed", label: "IE Mínimo Teórico ED" },
    { key: "ie_minimo_teorico_twa", label: "IE Mínimo Teórico TWA" },
    { key: "screening_perfil", label: "Perfil Screening" },
    { key: "screening_desc", label: "Descripción Screening" },
    { key: "screening_condiciones_ed", label: "Screening Condiciones ED", wide: true },
    { key: "screening_condiciones_ec", label: "Screening Condiciones EC", wide: true },
    { key: "screening_comentarios", label: "Screening Comentarios", wide: true },
    { key: "sin_metodo_disponible", label: "Sin Método Disponible", type: "boolean" },
    { key: "tabla", label: "Grupo/Tabla" }
  ];

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-header">
          <h3>{title}</h3>
          <button className="admin-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="admin-modal-body">
          {fields.map(({ key, label, type, options, wide }) => (
            <div key={key} className={`admin-modal-field ${wide ? "wide" : ""}`}>
              <label>{label}</label>
              {type === "boolean" ? (
                <select 
                  value={form[key] === true ? "true" : form[key] === false ? "false" : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    update(key, val === "true" ? true : val === "false" ? false : "");
                  }}
                  className="admin-select"
                >
                  <option value="">Seleccionar...</option>
                  <option value="true">Sí (True)</option>
                  <option value="false">No (False)</option>
                </select>
              ) : type === "select" ? (
                <select
                  value={form[key] || ""}
                  onChange={(e) => update(key, e.target.value)}
                  className="admin-select"
                >
                  <option value="">Seleccionar...</option>
                  {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={form[key] || ""}
                  onChange={(e) => update(key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
        <div className="admin-modal-footer">
          <button className="admin-btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="admin-btn-primary"
            onClick={() => onSave(form)}
            disabled={saving}
          >
            {saving ? "Guardando..." : isNew ? "Crear Producto" : "Guardar Cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}
