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
  const [statusMsg, setStatusMsg] = useState(null); // { type: 'success'|'error', text: '...' }

  const API_BASE = "";

  // ─── Authentication ───────────────────────────────────────────────
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes

  const handleLogin = async () => {
    // Check if locked out
    const lockoutUntil = localStorage.getItem("adminLockout");
    if (lockoutUntil && Date.now() < parseInt(lockoutUntil, 10)) {
      const remainingMinutes = Math.ceil((parseInt(lockoutUntil, 10) - Date.now()) / 60000);
      setAuthError(`Acceso bloqueado. Inténtelo de nuevo en ${remainingMinutes} minutos.`);
      return;
    } else if (lockoutUntil) {
      // Lockout expired
      localStorage.removeItem("adminLockout");
      localStorage.removeItem("adminAttempts");
    }

    setAuthError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) {
        // Reset attempts on success
        localStorage.removeItem("adminAttempts");
        localStorage.removeItem("adminLockout");
        
        setAuthenticated(true);
        fetchProducts("");
        fetchLog();
      } else {
        // Increment attempts on failure
        let attempts = parseInt(localStorage.getItem("adminAttempts") || "0", 10) + 1;
        if (attempts >= MAX_ATTEMPTS) {
          localStorage.setItem("adminLockout", (Date.now() + LOCKOUT_TIME).toString());
          setAuthError(`Demasiados intentos fallidos. Acceso bloqueado por 15 minutos.`);
          // Log the brute force attempt
          try {
             await fetch(`${API_BASE}/api/admin/log-bruteforce`, { method: "POST" });
          } catch(e) { console.error("Could not log brute force attempt", e); }
        } else {
          localStorage.setItem("adminAttempts", attempts.toString());
          setAuthError(data.error || `Contraseña incorrecta. Intentos restantes: ${MAX_ATTEMPTS - attempts}`);
        }
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
      if (data && Array.isArray(data.entries)) {
        setLogEntries([...data.entries].reverse());
      } else {
        setLogEntries([]);
      }
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
    setStatusMsg(null);
    // Optimistic UI update
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, visible_en_app: !p.visible_en_app } : p));
    try {
      const res = await fetch(`${API_BASE}/api/admin/products/${encodeURIComponent(id)}/visibility`, {
        method: "POST",
        headers: { "X-Admin-Password": password },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error HTTP ${res.status}`);
      }
      await fetchProducts();
      fetchLog();
      if (onDataChanged) onDataChanged();
      setStatusMsg({ type: "success", text: "✅ Visibilidad actualizada correctamente" });
    } catch (e) {
      console.error("Toggle error:", e);
      setStatusMsg({ type: "error", text: `❌ Error al cambiar visibilidad: ${e.message}` });
      // Revert optimistic
      setProducts((prev) => prev.map((p) => p.id === id ? { ...p, visible_en_app: !p.visible_en_app } : p));
    }
    setSaving(false);
    setTimeout(() => setStatusMsg(null), 5000);
  };

  const saveProduct = async (product) => {
    setSaving(true);
    setStatusMsg(null);
    try {
      const { id, ...fields } = product;
      const res = await fetch(`${API_BASE}/api/admin/products/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Password": password,
        },
        body: JSON.stringify(fields),
      });
      if (!res.ok) {
        let errMsg = `Error del servidor (HTTP ${res.status})`;
        try {
          const errData = await res.json();
          if (errData.error) errMsg = errData.error;
        } catch {
          // Ignore error if JSON parsing fails
        }
        throw new Error(errMsg);
      }
      await fetchProducts();
      fetchLog();
      setEditProduct(null);
      if (onDataChanged) onDataChanged();
      setStatusMsg({ type: "success", text: "✅ Producto guardado correctamente" });
    } catch (e) {
      console.error("Save error:", e);
      if (e.message && e.message.includes("Failed to fetch")) {
        setStatusMsg({ type: "error", text: "❌ Error de red: No se pudo conectar con el servidor." });
      } else {
        setStatusMsg({ type: "error", text: `❌ Error al guardar: ${e.message}` });
      }
    }
    setSaving(false);
    setTimeout(() => setStatusMsg(null), 6000);
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

      {/* Status Message Banner */}
      {statusMsg && (
        <div style={{
          padding: "10px 20px",
          borderRadius: "8px",
          marginBottom: "12px",
          fontWeight: 600,
          fontSize: "13px",
          background: statusMsg.type === "success" ? "#ecfdf5" : "#fef2f2",
          color: statusMsg.type === "success" ? "#065f46" : "#991b1b",
          border: `1px solid ${statusMsg.type === "success" ? "#a7f3d0" : "#fecaca"}`,
        }}>
          {statusMsg.text}
        </div>
      )}

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
    if ((key === "caudal_asignado" || key === "caudal_metodo_min" || key === "caudal_metodo_max" || key === "caudal") && value !== "") {
      if (!/^[0-9.,\- ]+$/.test(value)) return;
    }
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Field sections organized to match front-end views
  const sections = [
    {
      title: "🔎 Identificación del Contaminante",
      fields: [
        { key: "contaminante", label: "Nombre Interno", hint: "Sistema", wide: true },
        { key: "contaminante_display", label: "Nombre para Mostrar", hint: "Vista principal", wide: true },
        { key: "cas", label: "Nº CAS", hint: "Vista principal" },
        { key: "sinonimo", label: "Sinónimos", hint: "Vista principal", wide: true },
      ],
    },
    {
      title: "🔬 DESCRIPCIÓN TÉCNICA ANALÍTICA",
      fields: [
        { key: "descripcion_tecnica", label: "DESCRIPCIÓN TÉCNICA ANALÍTICA", hint: "Vista principal", wide: true },
        { key: "codigo_8d", label: "Código Urgente 8 días", hint: "Vista principal" },
        { key: "codigo_15d", label: "Código Estándar 15 días", hint: "Vista principal" },
        { key: "codigo_prueba", label: "Código Prueba General", hint: "Oculto en front" },
        { key: "tecnica_analitica", label: "Técnica Analítica (Acrónimo)", hint: "Vista secundaria" },
        { key: "metodo_analisis", label: "Método de Análisis Interno", hint: "Vista secundaria", wide: true },
        { key: "metodo_interno_basado_en", label: "Método Interno Basado En", hint: "Vista secundaria", wide: true },
        { key: "ref_tecnica", label: "Referencia Técnica", hint: "Vista secundaria" },
      ],
    },
    {
      title: "🧪 Soporte de Muestreo",
      fields: [
        { key: "soporte_captacion_display", label: "Soporte de Muestreo (Display)", hint: "Vista principal", wide: true },
        { key: "soporte_captacion", label: "Soporte de Captación (Código)", hint: "Sistema" },
        { key: "codigo_soporte", label: "Código Soporte Principal (Ref)", hint: "Vista principal" },
        { key: "codigo_soporte_alt", label: "Código Soporte Alternativo (Ref)", hint: "Vista principal", wide: true },
        { key: "ref_soporte", label: "Referencia Soporte", hint: "Vista principal" },
      ],
    },
    {
      title: "💨 CAUDAL MÉTODO",
      fields: [
        { key: "caudal_metodo_min", label: "Caudal Método Mínimo (L/min)", hint: "Vista principal" },
        { key: "caudal_metodo_max", label: "Caudal Método Máximo (L/min)", hint: "Vista principal" },
        { key: "caudal_asignado", label: "Caudal Asignado por Defecto (L/min)", hint: "Vista principal — UNE 482", wide: true },
        { key: "caudal", label: "Caudal Estático Inicial (L/min)", hint: "Sistema / Fallback" },
      ],
    },
    {
      title: "📦 Volumen y Tiempos de Muestreo",
      fields: [
        { key: "volumen_minimo", label: "Volumen Método", hint: "Vista principal" },
        { key: "v_minimo_muestreo_ed", label: "V Mín. Muestreo VLA-ED (L)", hint: "Vista secundaria" },
        { key: "v_minimo_muestreo_twa", label: "V Mín. Muestreo TWA (L)", hint: "Vista secundaria" },
        { key: "v_maximo_muestreo", label: "V Máx. Muestreo 8h (L)", hint: "Vista secundaria" },
        { key: "tiempo_minimo_asignado", label: "Tiempo Mín. Asignado (min)", hint: "Vista secundaria" },
        { key: "tiempo_minimo_muestreo_ed", label: "Tiempo Mín. Muestreo 10%VLA-ED (min)", hint: "Vista secundaria" },
        { key: "tiempo_minimo_muestreo_twa", label: "Tiempo Mín. Muestreo 10%TWA (min)", hint: "Vista secundaria" },
      ],
    },
    {
      title: "🎯 LÍMITES DE CUANTIFICACIÓN / DETECCIÓN",
      fields: [
        { key: "lq", label: "LÍMITE DE CUANTIFICACIÓN (µg)", hint: "Vista principal" },
        { key: "loq_concentracion", label: "LÍMITE DE CUANTIFICACIÓN (mg/m³)", hint: "Vista secundaria" },
        { key: "ld", label: "LÍMITE DE DETECCIÓN (µg)", hint: "Vista principal" },
      ],
    },
    {
      title: "⚖️ Valores Límite (VLA / Gestis)",
      fields: [
        { key: "vla_ed", label: "VLA-ED (mg/m³)", hint: "Vista principal" },
        { key: "vla_ec", label: "VLA-EC (mg/m³)", hint: "Vista principal" },
        { key: "notas_lep", label: "Notas LEP 2025", hint: "Vista secundaria", wide: true },
        { key: "gestis_pais", label: "Gestis País", hint: "Vista principal" },
        { key: "gestis_twa", label: "Gestis TWA", hint: "Vista principal" },
        { key: "gestis_stel", label: "Gestis STEL", hint: "Vista principal" },
      ],
    },
    {
      title: "☣️ Clasificación CMR / Normativa",
      fields: [
        { key: "is_cmr", label: "Es CMR", hint: "Vista secundaria", type: "boolean" },
        { key: "familia_cmr", label: "Familia CMR", hint: "Vista secundaria" },
        { key: "rd_665", label: "Aplica RD 665/1997", hint: "Vista secundaria", type: "boolean" },
        { key: "frases_h", label: "Frases H (LEP 2025)", hint: "Vista secundaria", wide: true },
      ],
    },
    {
      title: "📊 Screening / Perfil Analítico",
      fields: [
        { key: "screening_perfil", label: "Perfil Screening", hint: "Vista principal" },
        { key: "screening_desc", label: "Descripción Screening", hint: "Vista principal", wide: true },
        { key: "screening_condiciones_ed", label: "Condiciones Screening VLA-ED", hint: "Vista secundaria", wide: true },
        { key: "screening_condiciones_ec", label: "Condiciones Screening VLA-EC", hint: "Vista secundaria", wide: true },
        { key: "screening_comentarios", label: "Screening Comentarios", hint: "Vista secundaria", wide: true },
        { key: "screening_compuestos_formatted", label: "Screening Lista Compuestos", hint: "Vista principal", wide: true },
      ],
    },
    {
      title: "🏢 Laboratorio y Logística",
      fields: [
        { key: "laboratorio", label: "Laboratorio", hint: "Vista secundaria" },
        { key: "plazo_entrega", label: "Plazo Entrega Laboratorio", hint: "Vista secundaria" },
        { key: "transporte", label: "Condiciones de Transporte", hint: "Vista secundaria", type: "select", options: ["Ambiente", "Refrigerante", "Congelador"] },
        { key: "precio_analisis", label: "Precio Análisis (€)", hint: "Vista secundaria" },
        { key: "precio_soporte", label: "Precio Soporte (€)", hint: "Vista secundaria" },
      ],
    },
    {
      title: "📐 Parámetros Analíticos Avanzados",
      fields: [
        { key: "rango_trabajo", label: "Rango de Trabajo", hint: "Vista secundaria" },
        { key: "coeficiente_desorcion", label: "Coeficiente de Desorción", hint: "Vista secundaria" },
        { key: "cv_analitico", label: "CV Analítico", hint: "Vista secundaria" },
        { key: "cv_total", label: "CV Total", hint: "Vista secundaria" },
        { key: "evaluacion_apendice_1", label: "Evaluación Apéndice 1", hint: "Vista secundaria", type: "select", options: ["Sí", "No", "N/A"] },
        { key: "ie_limite_condiciones_ed", label: "IE Límite Condiciones VLA-ED", hint: "Vista secundaria" },
        { key: "ie_limite_condiciones_twa", label: "IE Límite Condiciones TWA", hint: "Vista secundaria" },
        { key: "ie_minimo_teorico_ed", label: "IE Mín. Teórico VLA-ED", hint: "Vista secundaria" },
        { key: "ie_minimo_teorico_twa", label: "IE Mín. Teórico TWA", hint: "Vista secundaria" },
      ],
    },
    {
      title: "⚙️ Sistema y Otros",
      fields: [
        { key: "visible_en_app", label: "Visible en App", hint: "Sistema", type: "boolean" },
        { key: "sin_metodo_disponible", label: "Sin Método Disponible", hint: "Sistema", type: "boolean" },
        { key: "tabla", label: "Tabla de Compatibilidad", hint: "Vista secundaria" },
        { key: "observaciones_concepto", label: "Observaciones / Comentarios", hint: "Vista secundaria", wide: true },
      ],
    },
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
          {sections.map((section) => (
            <div key={section.title} className="admin-modal-section">
              <h4 className="admin-modal-section-title">{section.title}</h4>
              <div className="admin-modal-section-fields">
                {section.fields.map(({ key, label, type, options, wide, hint }) => (
                  <div key={key} className={`admin-modal-field ${wide ? "wide" : ""}`}>
                    <label>
                      {label}
                      {hint && <span className="admin-field-hint">{hint}</span>}
                    </label>
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
                        <option value="true">Sí ✅</option>
                        <option value="false">No ❌</option>
                      </select>
                    ) : type === "select" ? (
                      <select
                        value={form[key] || ""}
                        onChange={(e) => update(key, e.target.value)}
                        className="admin-select"
                      >
                        <option value="">Seleccionar...</option>
                        {options.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={form[key] ?? ""}
                        onChange={(e) => update(key, e.target.value)}
                      />
                    )}
                  </div>
                ))}
              </div>
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
            {saving ? "⏳ Guardando..." : isNew ? "➕ Crear Producto" : "💾 Guardar Cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

