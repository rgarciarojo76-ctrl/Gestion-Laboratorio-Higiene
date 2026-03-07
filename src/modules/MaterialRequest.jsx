import { useState, useRef, useMemo, useEffect } from 'react'
import { useCart } from '../context/CartContext'
import { useToast } from '../components/ToastNotification'

/**
 * Módulo II: Solicitud de soportes de captación (F01655)
 *
 * Wizard de entrevista guiada para generar el formulario F01655
 * de solicitud de soportes de captación al laboratorio.
 */

const STEPS = [
  { id: 'client', label: 'Datos del Cliente' },
  { id: 'contact', label: 'Contacto' },
  { id: 'shipping', label: 'Tipo de Envío' },
  { id: 'material', label: 'Material' },
  { id: 'review', label: 'Revisión' },
]

// Catalog of common materials from F01655
const MATERIAL_CATALOG = [
  { cef: 'MT077', desc: 'Cassette 3 c. EDC reticulado (recuento Fibras en aire)', category: 'AMIANTO' },
  { cef: 'QE094', desc: 'Tiras adhesivas para captación de amianto en superficies', category: 'AMIANTO' },
  { cef: 'MT143', desc: 'Cassette 3 C. FILTRO GCPC 25MM (SEM)', category: 'AMIANTO' },
  { cef: 'MT117', desc: 'Cassette 2-3 c. EDC 37 mm', category: 'FRACCIÓN TOTAL' },
  { cef: 'MT062', desc: 'Cassette 2-3 c. FV imp. con NO2', category: 'FRACCIÓN TOTAL' },
  { cef: 'MT052', desc: 'Cassette 2-3 c. FQ', category: 'FRACCIÓN TOTAL' },
  { cef: 'MT063', desc: 'Cassette 2-3 c. FV imp. con Vera. y Octilft.', category: 'FRACCIÓN TOTAL' },
  { cef: 'MT058', desc: 'Cassette 2-3 c. FV sin impregnar', category: 'FRACCIÓN TOTAL' },
  { cef: 'MT040', desc: 'Sílica lavada 400/200mg', category: 'TUBOS / ADSORBENTES' },
  { cef: 'MT010', desc: 'Tubo carbón activo 100/50mg', category: 'TUBOS / ADSORBENTES' },
  { cef: 'MT053', desc: 'Anasorb 747', category: 'TUBOS / ADSORBENTES' },
  { cef: 'MT060', desc: 'Bolsa TEDLAR', category: 'OTROS SOPORTES' },
  { cef: 'MT083', desc: 'Impinger', category: 'OTROS SOPORTES' },
  { cef: 'MT111', desc: 'Monitor pasivo SKC7', category: 'MONITORES PASIVOS' },
  { cef: 'MT125', desc: 'Cassette PVC sin prepesar', category: 'FRACCIÓN INHALABLE' },
  { cef: 'MT050', desc: 'Filtro celulosa impregnado Na2CO3', category: 'FILTROS IMPREGNADOS' },
]

export default function MaterialRequest({ contaminants = [], memory, updateMemory }) {
  const [step, setStep] = useState(0)
  
  // Search State
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const searchInputRef = useRef(null)

  // Normalize utility for accent-insensitive search
  const normalizeText = (text) => {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  // Filter contaminants based on query
  const searchResults = useMemo(() => {
    if (!query.trim()) return []
    const terms = normalizeText(query).split(' ').filter(Boolean)
    
    return contaminants.filter(c => {
      const name = normalizeText(c.contaminante_display || c.contaminante || '')
      const cas = (c.cas || '').toLowerCase()
      const sinonimo = normalizeText(c.sinonimo || '')
      
      return terms.every(term => 
        name.includes(term) || cas.includes(term) || sinonimo.includes(term)
      )
    }).slice(0, 10) // Limit to 10 results
  }, [query, contaminants])

  const addMaterialByContaminant = (contaminant) => {
    // Attempt to match the contaminant's "ref_soporte" with our catalog
    const ref = contaminant.ref_soporte
    const desc = contaminant.soporte_captacion_display || contaminant.soporte_captacion || 'Soporte no especificado'
    const category = contaminant.medicion || 'A DETERMINAR'
    
    const catalogItem = MATERIAL_CATALOG.find(m => m.cef === ref)
    
    if (catalogItem) {
      addMaterial(catalogItem)
    } else {
      // Create a dynamic item if it's not in the hardcoded catalog
      const dynamicItem = {
        cef: ref || 'S/R',
        desc: desc,
        category: category
      }
      addMaterial(dynamicItem)
    }
    
    setQuery('')
    setIsFocused(false)
  }

  const [form, setForm] = useState({
    codigo: memory.codigo || '',
    nombre: memory.nombre || '',
    oficina_venta: memory.oficina_venta || '',
    persona_solicita: memory.persona_solicita || '',
    cliente_cargo: memory.cliente_cargo || '',
    remitente: memory.remitente || '',
    compania: memory.compania || '',
    email: memory.email || '',
    telefono: memory.telefono || '',
    contrato_odoo: '',
    numero_pedido: '',
    fecha_solicitud: new Date().toISOString().slice(0, 10),
    tipo_envio: 'oficina',
    cuenta_mrw: '',
    direccion_envio: '',
  })
  const [materials, setMaterials] = useState([])
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [cartInjected, setCartInjected] = useState(false)

  const { items: cartItems, clearCart } = useCart()
  const { showToast } = useToast()

  // Inject cart items into materials when entering the material step
  useEffect(() => {
    if (cartItems.length > 0 && !cartInjected) {
      const cartMaterials = cartItems.map(item => ({
        cef: item.code || 'S/R',
        desc: item.name || 'Soporte de carrito',
        category: 'PEDIDO PREVIO',
        qty: item.quantity || 1,
        fromCart: true,
        price: item.price || 0,
      }))

      setMaterials(prev => {
        // Merge, avoiding duplicates
        const merged = [...prev]
        cartMaterials.forEach(cm => {
          const idx = merged.findIndex(m => m.cef === cm.cef)
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], qty: merged[idx].qty + cm.qty, fromCart: true }
          } else {
            merged.push(cm)
          }
        })
        return merged
      })
      setCartInjected(true)
    }
  }, [cartItems, cartInjected])

  const updateField = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const addMaterial = (item) => {
    const existing = materials.find(m => m.cef === item.cef)
    if (existing) {
      setMaterials(materials.map(m =>
        m.cef === item.cef ? { ...m, qty: m.qty + 1 } : m
      ))
    } else {
      setMaterials([...materials, { ...item, qty: 1 }])
    }
  }

  const removeMaterial = (cef) => {
    setMaterials(materials.filter(m => m.cef !== cef))
  }

  const updateQty = (cef, qty) => {
    if (qty < 1) return removeMaterial(cef)
    setMaterials(materials.map(m =>
      m.cef === cef ? { ...m, qty: parseInt(qty) || 1 } : m
    ))
  }

  const saveToMemory = () => {
    ['codigo', 'nombre', 'oficina_venta', 'persona_solicita',
     'cliente_cargo', 'remitente', 'compania', 'email', 'telefono'].forEach(key => {
      if (form[key]) updateMemory(key, form[key])
    })
  }

  const handleNext = () => {
    saveToMemory()
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }

  const handleBack = () => setStep(s => Math.max(s - 1, 0))

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/generate-f01655', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...form, materials })
      })

      if (!response.ok) throw new Error('Error al generar el documento')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url

      const disposition = response.headers.get('content-disposition')
      let filename = 'Solicitud_soportes_captacion_F01655.docx'
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        const matches = filenameRegex.exec(disposition)
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '')
        }
      }

      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      
      setGenerated(true)
      clearCart()
      showToast('Pedido procesado: PDF generado correctamente', 'success')
    } catch (error) {
      console.error('Error generando F01655:', error)
      alert('Error de conexión con el servidor backend.')
    } finally {
      setGenerating(false)
    }
  }

  const renderStep = () => {
    switch (STEPS[step].id) {
      case 'client':
        return (
          <div className="card">
            <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>📋 Datos del Cliente</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Código Cliente (1)</label>
                <input className="form-input" value={form.codigo} onChange={e => updateField('codigo', e.target.value)} placeholder="Código Cliente" />
              </div>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input className="form-input" value={form.nombre} onChange={e => updateField('nombre', e.target.value)} placeholder="Nombre del cliente" />
              </div>
              <div className="form-group">
                <label className="form-label">Oficina de Venta</label>
                <input className="form-input" value={form.oficina_venta} onChange={e => updateField('oficina_venta', e.target.value)} placeholder="Donde entrega las muestras" />
              </div>
              <div className="form-group">
                <label className="form-label">Persona que solicita</label>
                <input className="form-input" value={form.persona_solicita} onChange={e => updateField('persona_solicita', e.target.value)} placeholder="Técnico solicitante" />
              </div>
              <div className="form-group">
                <label className="form-label">Cliente (Cargo)</label>
                <input className="form-input" value={form.cliente_cargo} onChange={e => updateField('cliente_cargo', e.target.value)} placeholder="Quien paga el servicio" />
              </div>
              <div className="form-group">
                <label className="form-label">Remitente</label>
                <input className="form-input" value={form.remitente} onChange={e => updateField('remitente', e.target.value)} placeholder="Donde enviamos resultados" />
              </div>
              <div className="form-group">
                <label className="form-label">Compañía</label>
                <input className="form-input" value={form.compania} onChange={e => updateField('compania', e.target.value)} placeholder="Nombre de la compañía" />
              </div>
            </div>
          </div>
        )

      case 'contact':
        return (
          <div className="card">
            <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>📞 Datos de Contacto</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Correo Electrónico</label>
                <input className="form-input" type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="email@empresa.com" />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input className="form-input" type="tel" value={form.telefono} onChange={e => updateField('telefono', e.target.value)} placeholder="+34 600 000 000" />
              </div>
              <div className="form-group">
                <label className="form-label">Contrato Odoo</label>
                <input className="form-input" value={form.contrato_odoo} onChange={e => updateField('contrato_odoo', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Número de Pedido</label>
                <input className="form-input" value={form.numero_pedido} onChange={e => updateField('numero_pedido', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Fecha de Solicitud</label>
                <input className="form-input" type="date" value={form.fecha_solicitud} onChange={e => updateField('fecha_solicitud', e.target.value)} />
              </div>
            </div>
          </div>
        )

      case 'shipping':
        return (
          <div className="card">
            <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>🚚 Tipo de Envío</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label className="checkbox-row" style={{ padding: 16, background: form.tipo_envio === 'oficina' ? 'rgba(59,130,246,0.08)' : 'var(--bg-input)', borderRadius: 10, border: `1px solid ${form.tipo_envio === 'oficina' ? 'var(--accent-primary)' : 'var(--border-color)'}` }}>
                <input type="radio" name="envio" checked={form.tipo_envio === 'oficina'} onChange={() => updateField('tipo_envio', 'oficina')} style={{ width: 18, height: 18, accentColor: 'var(--accent-primary)' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Envío a Oficina de Ventas</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Se envía a la oficina más próxima</div>
                </div>
              </label>
              <label className="checkbox-row" style={{ padding: 16, background: form.tipo_envio === 'mrw' ? 'rgba(59,130,246,0.08)' : 'var(--bg-input)', borderRadius: 10, border: `1px solid ${form.tipo_envio === 'mrw' ? 'var(--accent-primary)' : 'var(--border-color)'}` }}>
                <input type="radio" name="envio" checked={form.tipo_envio === 'mrw'} onChange={() => updateField('tipo_envio', 'mrw')} style={{ width: 18, height: 18, accentColor: 'var(--accent-primary)' }} />
                <div>
                  <div style={{ fontWeight: 600 }}>Envío a través de MRW</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Requiere nº de cuenta MRW propio</div>
                </div>
              </label>

              {form.tipo_envio === 'mrw' && (
                <div style={{ padding: 16, background: 'var(--bg-input)', borderRadius: 10, marginTop: 8 }}>
                  <div className="form-group">
                    <label className="form-label">Nº Cuenta MRW</label>
                    <input className="form-input" value={form.cuenta_mrw} onChange={e => updateField('cuenta_mrw', e.target.value)} placeholder="Número de cuenta MRW" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Dirección de Envío</label>
                    <textarea className="form-textarea" value={form.direccion_envio} onChange={e => updateField('direccion_envio', e.target.value)} placeholder="Dirección completa de envío" style={{ minHeight: 60 }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      case 'material':
        return (
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 16, fontSize: 18, fontWeight: 700 }}>📦 Selección de Material</h3>

              {/* Summary of selected materials */}
              {materials.length > 0 && (
                <div className="card" style={{ border: '2px solid var(--accent-primary)', background: 'linear-gradient(135deg, rgba(59,130,246,0.05) 0%, rgba(59,130,246,0.02) 100%)', marginBottom: 24 }}>
                  <h4 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    🛒 Material Seleccionado ({materials.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {materials.map(m => (
                      <div key={m.cef} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'white', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                        <code style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-accent)', minWidth: 60 }}>{m.cef}</code>
                        <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{m.desc}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => updateQty(m.cef, m.qty - 1)}>−</button>
                          <input
                            style={{ width: 40, textAlign: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '4px 0', color: 'var(--text-primary)', fontSize: 13 }}
                            value={m.qty}
                            readOnly
                          />
                          <button className="btn btn-sm btn-secondary" onClick={() => updateQty(m.cef, m.qty + 1)}>+</button>
                          <button className="btn btn-sm btn-danger" onClick={() => removeMaterial(m.cef)} style={{ marginLeft: 4 }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 24, position: 'relative' }}>
                <label className="form-label">Añadir Medio de Captación por Contaminante</label>
                <div className="search-input-container" style={{ margin: 0 }}>
                  <span className="search-icon">🔍</span>
                  <input
                    ref={searchInputRef}
                    className="search-input"
                    placeholder="Búsqueda Inteligente (ej: Formaldehído, 50-00-0)..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                    style={{ fontSize: 14 }}
                  />
                  {query && (
                    <button className="clear-btn" onClick={() => { setQuery(''); searchInputRef.current.focus() }}>✕</button>
                  )}
                </div>

                {isFocused && searchResults.length > 0 && (
                  <div className="autocomplete-dropdown" style={{ top: '100%', marginTop: 8 }}>
                    {searchResults.map((item, idx) => (
                      <div 
                        key={idx} 
                        className="autocomplete-item"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          addMaterialByContaminant(item)
                        }}
                      >
                        <div className="auto-main">
                          <span className="auto-name">{item.contaminante_display || item.contaminante}</span>
                          {item.cas && <span className="auto-cas">{item.cas}</span>}
                        </div>
                        <div className="auto-sub">
                          Req: {item.soporte_captacion_display || item.soporte_captacion || 'No especificado'} 
                          {item.ref_soporte ? ` (${item.ref_soporte})` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                  El sistema añadirá automáticamente el soporte de captación necesario para el contaminante seleccionado.
                </p>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border-light)', margin: '24px 0' }} />

              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                O añade material manualmente desde el catálogo común:
              </p>

              {/* Grouped by category */}
              {[...new Set(MATERIAL_CATALOG.map(m => m.category))].map(cat => (
                <div key={cat} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{cat}</div>
                  {MATERIAL_CATALOG.filter(m => m.category === cat).map(item => {
                    const inCart = materials.find(m => m.cef === item.cef)
                    return (
                      <div key={item.cef} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border-light)' }}>
                        <code style={{ fontSize: 12, color: 'var(--text-accent)', minWidth: 60 }}>{item.cef}</code>
                        <span style={{ flex: 1, fontSize: 13 }}>{item.desc}</span>
                        {inCart ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button className="btn btn-sm btn-secondary" onClick={() => updateQty(item.cef, inCart.qty - 1)}>−</button>
                            <input
                              style={{ width: 40, textAlign: 'center', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '4px 0', color: 'var(--text-primary)', fontSize: 13 }}
                              value={inCart.qty}
                              onChange={e => updateQty(item.cef, e.target.value)}
                            />
                            <button className="btn btn-sm btn-secondary" onClick={() => updateQty(item.cef, inCart.qty + 1)}>+</button>
                            <button className="btn btn-sm btn-danger" onClick={() => removeMaterial(item.cef)} style={{ marginLeft: 4 }}>✕</button>
                          </div>
                        ) : (
                          <button className="btn btn-sm btn-primary" onClick={() => addMaterial(item)}>+ Añadir</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>


          </div>
        )

      case 'review':
        return (
          <div className="card">
            <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>✅ Revisión de Solicitud</h3>

            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-item-label">Código</div>
                <div className="detail-item-value">{form.codigo || '—'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Nombre</div>
                <div className="detail-item-value">{form.nombre}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Persona Solicita</div>
                <div className="detail-item-value">{form.persona_solicita}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Compañía</div>
                <div className="detail-item-value">{form.compania}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Email</div>
                <div className="detail-item-value">{form.email}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Teléfono</div>
                <div className="detail-item-value">{form.telefono}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Tipo de Envío</div>
                <div className="detail-item-value">{form.tipo_envio === 'oficina' ? 'Oficina Técnica' : `MRW (${form.cuenta_mrw})`}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Fecha Solicitud</div>
                <div className="detail-item-value">{form.fecha_solicitud}</div>
              </div>
            </div>

            <h4 style={{ marginTop: 24, marginBottom: 12, fontSize: 15, fontWeight: 700 }}>Material ({materials.length} items)</h4>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Uds.</th>
                    <th>CEF</th>
                    <th>Descripción</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map(m => (
                    <tr key={m.cef}>
                      <td className="cell-numeric" style={{ fontWeight: 700 }}>{m.qty}</td>
                      <td className="cell-cas">{m.cef}</td>
                      <td>{m.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
              {!generated ? (
                <button
                  className="btn btn-lg btn-success"
                  onClick={handleGenerate}
                  disabled={generating || materials.length === 0}
                >
                  {generating ? (
                    <>
                      <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                      Generando PDF...
                    </>
                  ) : (
                    '📄 Generar F01655 (PDF)'
                  )}
                </button>
              ) : (
                <div className="alert alert-success">
                  <span className="alert-icon">✅</span>
                  <div>
                    <strong>F01655 generado correctamente.</strong>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      El documento PDF ha sido creado y está listo para descarga.
                      <br />
                      <em style={{ color: 'var(--text-muted)' }}>
                        (Nota: La generación backend con python-docx se conectará cuando el servidor Flask esté activo)
                      </em>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )

      default: return null
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Solicitud soportes de captación</h1>
        <p className="page-subtitle">
          Formulario F01655 — Solicitud de soportes de captación al laboratorio
        </p>
      </div>

      {/* Memory indicator */}
      {memory.persona_solicita && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          <span className="alert-icon">💾</span>
          <div style={{ fontSize: 13 }}>
            Datos recordados: <strong>{memory.persona_solicita}</strong>
            {memory.compania && ` — ${memory.compania}`}
            <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>
              (Los datos se rellenan automáticamente)
            </span>
          </div>
        </div>
      )}

      {/* Wizard steps */}
      <div className="wizard-steps">
        {STEPS.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              className={`wizard-step ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}
              onClick={() => setStep(i)}
              style={{ cursor: 'pointer' }}
            >
              <span className="wizard-step-number">
                {i < step ? '✓' : i + 1}
              </span>
              {s.label}
            </div>
            {i < STEPS.length - 1 && <div className="wizard-step-connector" />}
          </div>
        ))}
      </div>

      {/* Current step content */}
      {renderStep()}

      {/* Navigation buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button
          className="btn btn-secondary"
          onClick={handleBack}
          disabled={step === 0}
        >
          ← Anterior
        </button>
        {step < STEPS.length - 1 && (
          <button className="btn btn-primary" onClick={handleNext}>
            Siguiente →
          </button>
        )}
      </div>
    </div>
  )
}
