import { useState, useMemo } from 'react'

/**
 * Módulo III: Solicitud de Análisis — Envío muestras al laboratorio (F00662)
 *
 * Wizard de entrevista guiada con validación proactiva:
 * - Control de Volumen: V = Q × t
 * - Sensibilidad: LOQ vs 10% VLA-ED
 */

const STEPS = [
  { id: 'solicitor', label: 'Datos Solicitante' },
  { id: 'collection', label: 'Recogida / Toma' },
  { id: 'samples', label: 'Muestras' },
  { id: 'review', label: 'Revisión' },
]

// Normalize utility for accent-insensitive search
const normalizeText = (text) => {
  if (!text) return ''
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function emptySample() {
  return {
    id: Date.now(),
    descripcion: '',
    ref_soporte: '',
    punto_muestreo: '',
    caudal_inicial: '',
    caudal_final: '',
    tiempo_min: '',
    codigo_equipo: '',
    tipo_muestreo: 'personal',
    analisis_solicitado: '',
    observaciones: '',
  }
}

function parseNum(s) {
  if (!s) return NaN
  return parseFloat(s.replace(',', '.'))
}

export default function ChainOfCustody({ contaminants, memory, updateMemory }) {
  const [step, setStep] = useState(0)
  
  // Search State for Autocomplete
  const [activeSearchId, setActiveSearchId] = useState(null)
  
  const [form, setForm] = useState({
    codigo: memory.codigo || '',
    nombre: memory.nombre || '',
    cliente_cargo: memory.cliente_cargo || '',
    remitente: memory.remitente || '',
    oficina_venta: memory.oficina_venta || '',
    empresa: memory.empresa || memory.compania || '',
    compania: memory.compania || '',
    persona_solicita: memory.persona_solicita || '',
    email: memory.email || '',
    telefono: memory.telefono || '',
    contrato_odoo: '',
    numero_pedido: '',
    recogida_por: 'solicitante',
    fecha_toma: '',
    hora_toma: '',
    persona_toma: memory.persona_solicita || '',
    procedimiento: '',
    horas_tecnico: '',
    km_desplazamiento: '',
    observaciones_recogida: '',
  })
  const [samples, setSamples] = useState([emptySample()])
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)

  const updateField = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const updateSample = (id, key, value) => {
    setSamples(prev => prev.map(s => s.id === id ? { ...s, [key]: value } : s))
  }

  const addSample = () => setSamples(prev => [...prev, emptySample()])

  const removeSample = (id) => {
    if (samples.length <= 1) return
    setSamples(prev => prev.filter(s => s.id !== id))
  }

  const saveToMemory = () => {
    ['codigo', 'nombre', 'cliente_cargo', 'remitente', 'oficina_venta',
     'empresa', 'compania', 'persona_solicita', 'email', 'telefono'].forEach(key => {
      if (form[key]) updateMemory(key, form[key])
    })
  }

  const handleNext = () => {
    saveToMemory()
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }

  const handleBack = () => setStep(s => Math.max(s - 1, 0))

  // Validation calculations for each sample
  const validations = useMemo(() => {
    return samples.map(sample => {
      const q_ini = parseNum(sample.caudal_inicial)
      const q_fin = parseNum(sample.caudal_final)
      const t = parseNum(sample.tiempo_min)

      const q_avg = !isNaN(q_ini) && !isNaN(q_fin) ? (q_ini + q_fin) / 2 :
                    !isNaN(q_ini) ? q_ini : NaN
      const v_calculated = !isNaN(q_avg) && !isNaN(t) ? q_avg * t : NaN

      // Find matching contaminant for validation
      // Now it relies on the explicitly stored exact match selected from the dropdown
      const matchedContaminant = sample.matchedContaminant || null;

      const vol_rec = matchedContaminant?.volumen_recomendado_l
        ? parseNum(matchedContaminant.volumen_recomendado_l) : NaN

      // Volume validation
      let volumeStatus = 'neutral'
      let volumeMsg = ''
      if (!isNaN(v_calculated) && !isNaN(vol_rec)) {
        const ratio = v_calculated / vol_rec
        if (ratio >= 0.8 && ratio <= 1.5) {
          volumeStatus = 'pass'
          volumeMsg = `Volumen OK (${v_calculated.toFixed(1)} L ≈ ${vol_rec} L recomendado)`
        } else if (ratio < 0.8) {
          volumeStatus = 'warn'
          volumeMsg = `⚠️ Volumen insuficiente: ${v_calculated.toFixed(1)} L < ${vol_rec} L recomendado`
        } else {
          volumeStatus = 'warn'
          volumeMsg = `⚠️ Volumen excesivo: ${v_calculated.toFixed(1)} L > ${vol_rec} L recomendado`
        }
      } else if (!isNaN(v_calculated)) {
        volumeStatus = 'neutral'
        volumeMsg = `Volumen calculado: ${v_calculated.toFixed(1)} L`
      }

      // Sensitivity validation (LOQ / V > 10% VLA-ED)
      let sensitivityStatus = 'neutral'
      let sensitivityMsg = ''
      if (!isNaN(v_calculated) && matchedContaminant?.loq && matchedContaminant?.vla_ed_mg_m3) {
        const loq_ug = parseNum(matchedContaminant.loq)
        const vla_ed = parseNum(matchedContaminant.vla_ed_mg_m3)
        if (!isNaN(loq_ug) && !isNaN(vla_ed) && vla_ed > 0) {
          const loq_mg = loq_ug / 1000  // µg → mg
          const conc_loq = loq_mg / (v_calculated / 1000)  // mg / m³
          const ratio = conc_loq / vla_ed
          if (ratio <= 0.1) {
            sensitivityStatus = 'pass'
            sensitivityMsg = `Sensibilidad OK (Lím. Cuantif./V = ${conc_loq.toFixed(4)} mg/m³ ≤ 10% VLA-ED)`
          } else {
            sensitivityStatus = 'fail'
            sensitivityMsg = `❌ Sensibilidad insuficiente: Lím. Cuantif./V = ${conc_loq.toFixed(4)} mg/m³ > 10% de VLA-ED (${vla_ed} mg/m³)`
          }
        }
      }

      return {
        sampleId: sample.id,
        q_avg: isNaN(q_avg) ? null : q_avg,
        v_calculated: isNaN(v_calculated) ? null : v_calculated,
        vol_rec: isNaN(vol_rec) ? null : vol_rec,
        volumeStatus,
        volumeMsg,
        sensitivityStatus,
        sensitivityMsg,
        matchedContaminant,
      }
    })
  }, [samples, contaminants])

  const handleGenerate = async () => {
    // Check for critical validation failures
    const hasCritical = validations.some(v => v.volumeStatus === 'fail' || v.sensitivityStatus === 'fail')
    if (hasCritical) {
      if (!window.confirm('⚠️ Se han detectado alertas de validación críticas. ¿Desea continuar con la generación del documento?')) {
        return
      }
    }

    setGenerating(true)
    setTimeout(() => {
      setGenerating(false)
      setGenerated(true)
    }, 2000)
  }

  const renderStep = () => {
    switch (STEPS[step].id) {
      case 'solicitor':
        return (
          <div className="card">
            <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>👤 Datos del Solicitante</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Código (1)</label>
                <input className="form-input" value={form.codigo} onChange={e => updateField('codigo', e.target.value)} placeholder="Código Cliente" />
              </div>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input className="form-input" value={form.nombre} onChange={e => updateField('nombre', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Cliente (Cargo) — Pagador</label>
                <input className="form-input" value={form.cliente_cargo} onChange={e => updateField('cliente_cargo', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Remitente — Receptor resultados</label>
                <input className="form-input" value={form.remitente} onChange={e => updateField('remitente', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Oficina de Venta</label>
                <input className="form-input" value={form.oficina_venta} onChange={e => updateField('oficina_venta', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Empresa</label>
                <input className="form-input" value={form.empresa} onChange={e => updateField('empresa', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Compañía</label>
                <input className="form-input" value={form.compania} onChange={e => updateField('compania', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Persona que solicita</label>
                <input className="form-input" value={form.persona_solicita} onChange={e => updateField('persona_solicita', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="form-input" type="email" value={form.email} onChange={e => updateField('email', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Teléfono</label>
                <input className="form-input" type="tel" value={form.telefono} onChange={e => updateField('telefono', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Contrato Odoo</label>
                <input className="form-input" value={form.contrato_odoo} onChange={e => updateField('contrato_odoo', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Número de Pedido</label>
                <input className="form-input" value={form.numero_pedido} onChange={e => updateField('numero_pedido', e.target.value)} />
              </div>
            </div>
          </div>
        )

      case 'collection':
        return (
          <div className="card">
            <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>🧪 Datos de la Recogida / Toma de Muestra</h3>

            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <label className="checkbox-row" style={{ flex: 1, padding: 16, background: form.recogida_por === 'echevarne' ? 'rgba(59,130,246,0.08)' : 'var(--bg-input)', borderRadius: 10, border: `1px solid ${form.recogida_por === 'echevarne' ? 'var(--accent-primary)' : 'var(--border-color)'}` }}>
                <input type="radio" name="recogida" checked={form.recogida_por === 'echevarne'} onChange={() => updateField('recogida_por', 'echevarne')} style={{ width: 18, height: 18, accentColor: 'var(--accent-primary)' }} />
                <span style={{ fontWeight: 600 }}>Realizada por Laboratorio</span>
              </label>
              <label className="checkbox-row" style={{ flex: 1, padding: 16, background: form.recogida_por === 'solicitante' ? 'rgba(59,130,246,0.08)' : 'var(--bg-input)', borderRadius: 10, border: `1px solid ${form.recogida_por === 'solicitante' ? 'var(--accent-primary)' : 'var(--border-color)'}` }}>
                <input type="radio" name="recogida" checked={form.recogida_por === 'solicitante'} onChange={() => updateField('recogida_por', 'solicitante')} style={{ width: 18, height: 18, accentColor: 'var(--accent-primary)' }} />
                <span style={{ fontWeight: 600 }}>Realizada por el Solicitante</span>
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Fecha Toma de Muestra</label>
                <input className="form-input" type="date" value={form.fecha_toma} onChange={e => updateField('fecha_toma', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Hora</label>
                <input className="form-input" type="time" value={form.hora_toma} onChange={e => updateField('hora_toma', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Persona que toma la muestra</label>
                <input className="form-input" value={form.persona_toma} onChange={e => updateField('persona_toma', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Procedimiento de recogida</label>
                <input className="form-input" value={form.procedimiento} onChange={e => updateField('procedimiento', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Horas de Técnico</label>
                <input className="form-input" value={form.horas_tecnico} onChange={e => updateField('horas_tecnico', e.target.value)} placeholder="h" />
              </div>
              <div className="form-group">
                <label className="form-label">Desplazamiento (KM)</label>
                <input className="form-input" value={form.km_desplazamiento} onChange={e => updateField('km_desplazamiento', e.target.value)} placeholder="Km" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Observaciones</label>
              <textarea className="form-textarea" value={form.observaciones_recogida} onChange={e => updateField('observaciones_recogida', e.target.value)} style={{ minHeight: 60 }} />
            </div>
          </div>
        )

      case 'samples':
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700 }}>🧫 Datos de las Muestras</h3>
              <button className="btn btn-primary" onClick={addSample}>+ Añadir Muestra</button>
            </div>

            {samples.map((sample, idx) => {
              const val = validations[idx]
              return (
                <div key={sample.id} className="sample-card">
                  <div className="sample-card-header">
                    <div className="sample-card-title">Muestra {idx + 1}</div>
                    {samples.length > 1 && (
                      <button className="btn btn-sm btn-danger" onClick={() => removeSample(sample.id)}>Eliminar</button>
                    )}
                  </div>

                  <div className="sample-card-grid">
                    <div className="form-group">
                      <label className="form-label">Descripción de la muestra</label>
                      <input className="form-input" value={sample.descripcion} onChange={e => updateSample(sample.id, 'descripcion', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Referencia del soporte</label>
                      <input className="form-input" value={sample.ref_soporte} onChange={e => updateSample(sample.id, 'ref_soporte', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Punto / Lugar de muestreo</label>
                      <input className="form-input" value={sample.punto_muestreo} onChange={e => updateSample(sample.id, 'punto_muestreo', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Caudal Inicial (L/min)</label>
                      <input className="form-input" value={sample.caudal_inicial} onChange={e => updateSample(sample.id, 'caudal_inicial', e.target.value)} placeholder="ej: 2,0" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Caudal Final (L/min)</label>
                      <input className="form-input" value={sample.caudal_final} onChange={e => updateSample(sample.id, 'caudal_final', e.target.value)} placeholder="ej: 1,9" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tiempo de Muestreo (min)</label>
                      <input className="form-input" value={sample.tiempo_min} onChange={e => updateSample(sample.id, 'tiempo_min', e.target.value)} placeholder="ej: 120" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Código Equipo</label>
                      <input className="form-input" value={sample.codigo_equipo} onChange={e => updateSample(sample.id, 'codigo_equipo', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Tipo de Muestreo</label>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <label className="checkbox-row">
                          <input type="radio" name={`tipo_${sample.id}`} checked={sample.tipo_muestreo === 'personal'} onChange={() => updateSample(sample.id, 'tipo_muestreo', 'personal')} style={{ accentColor: 'var(--accent-primary)' }} />
                          Personal
                        </label>
                        <label className="checkbox-row">
                          <input type="radio" name={`tipo_${sample.id}`} checked={sample.tipo_muestreo === 'ambiental'} onChange={() => updateSample(sample.id, 'tipo_muestreo', 'ambiental')} style={{ accentColor: 'var(--accent-primary)' }} />
                          Ambiental
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: 12, position: 'relative' }}>
                    <label className="form-label">Análisis Solicitado / Agente Químico</label>
                    <div className="search-input-container" style={{ margin: 0 }}>
                      <span className="search-icon">🔍</span>
                      <input 
                        className="search-input" 
                        value={sample.analisis_solicitado} 
                        onChange={e => {
                          updateSample(sample.id, 'analisis_solicitado', e.target.value)
                          // Clear the attached contaminant if they start typing again
                          if (sample.matchedContaminant) updateSample(sample.id, 'matchedContaminant', null)
                        }} 
                        onFocus={() => setActiveSearchId(sample.id)}
                        onBlur={() => setTimeout(() => setActiveSearchId(null), 200)}
                        placeholder="Ej: Benceno, 71-43-2..." 
                        style={{ fontSize: 14 }}
                      />
                      {sample.analisis_solicitado && (
                        <button className="clear-btn" onClick={() => {
                           updateSample(sample.id, 'analisis_solicitado', '');
                           updateSample(sample.id, 'matchedContaminant', null);
                        }}>✕</button>
                      )}
                    </div>
                    
                    {/* Autocomplete Dropdown */}
                    {activeSearchId === sample.id && sample.analisis_solicitado && !sample.matchedContaminant && (
                      <div className="autocomplete-dropdown" style={{ top: '100%', marginTop: 8 }}>
                        {(() => {
                           const queryRaw = normalizeText(sample.analisis_solicitado || '')
                           if (!queryRaw.trim()) return null;
                           
                           const terms = queryRaw.split(' ').filter(Boolean)
                           const results = contaminants.filter(c => {
                             const name = normalizeText(c.contaminante_display || c.contaminante || '')
                             const cas = (c.cas || '').toLowerCase()
                             const sinonimo = normalizeText(c.sinonimo || '')
                             return terms.every(term => name.includes(term) || cas.includes(term) || sinonimo.includes(term))
                           }).slice(0, 10)
                           
                           return results.map((item, idx) => (
                             <div 
                               key={idx} 
                               className="autocomplete-item"
                               onMouseDown={(e) => {
                                 e.preventDefault();
                                 updateSample(sample.id, 'analisis_solicitado', item.contaminante_display || item.contaminante);
                                 updateSample(sample.id, 'matchedContaminant', item);
                                 setActiveSearchId(null);
                               }}
                             >
                               <div className="auto-main">
                                 <span className="auto-name">{item.contaminante_display || item.contaminante}</span>
                                 {item.cas && <span className="auto-cas">{item.cas}</span>}
                               </div>
                             </div>
                           ))
                        })()}
                      </div>
                    )}

                    {val?.matchedContaminant && (
                      <div style={{ fontSize: 12, color: 'var(--success)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>✓</span> Base de Conocimiento vinculada (CAS: {val.matchedContaminant.cas || 'N/A'})
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Observaciones</label>
                    <input className="form-input" value={sample.observaciones} onChange={e => updateSample(sample.id, 'observaciones', e.target.value)} />
                  </div>

                  {/* Validation Panel */}
                  {(val?.v_calculated || val?.volumeMsg || val?.sensitivityMsg || val?.matchedContaminant?.contenedor) && (
                    <div className="validation-panel">
                      <div className="validation-title">⚙️ Análisis Inteligente</div>
                      
                      {/* Sub-section: Logistics Info (From Knowledge Base Intranet) */}
                      {val.matchedContaminant && (val.matchedContaminant.contenedor || val.matchedContaminant.transporte) && (
                        <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border-light)' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span>📦 Info Logística</span>
                            {val.matchedContaminant.observaciones_concepto && (
                              <span className="badge badge-warn" style={{ padding: '2px 6px', fontSize: 10 }}>Alerta Logística</span>
                            )}
                          </div>
                          
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                            {val.matchedContaminant.contenedor && (
                              <div style={{ fontSize: 13 }}>
                                <span style={{ color: 'var(--text-muted)' }}>Soporte/Envase: </span>
                                <strong>{val.matchedContaminant.contenedor}</strong>
                              </div>
                            )}
                            {val.matchedContaminant.transporte && (
                              <div style={{ fontSize: 13 }}>
                                <span style={{ color: 'var(--text-muted)' }}>Transporte: </span>
                                <strong>{val.matchedContaminant.transporte}</strong>
                              </div>
                            )}
                            {val.matchedContaminant.plazo_entrega && (
                              <div style={{ fontSize: 13 }}>
                                <span style={{ color: 'var(--text-muted)' }}>Plazo máx. envío: </span>
                                <strong>{val.matchedContaminant.plazo_entrega}</strong>
                              </div>
                            )}
                          </div>
                          
                          {(val.matchedContaminant.observaciones_concepto || val.matchedContaminant.comentarios_prueba) && (
                            <div style={{ marginTop: 8, padding: 8, background: '#fffbeb', borderRadius: 6, fontSize: 12, color: '#92400e', borderLeft: '3px solid #f59e0b' }}>
                              <strong>⚠️ Obs. Laboratorio:</strong> {val.matchedContaminant.observaciones_concepto} {val.matchedContaminant.comentarios_prueba}
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>📐 Validación Técnica (Volumen y Sensibilidad)</div>

                      {val.q_avg && (
                        <div className="validation-row">
                          <span className="validation-label">Caudal medio (Q)</span>
                          <span className="validation-value">{val.q_avg.toFixed(2)} L/min</span>
                        </div>
                      )}
                      {val.v_calculated && (
                        <div className="validation-row">
                          <span className="validation-label">Volumen calculado (V = Q × t)</span>
                          <span className="validation-value">{val.v_calculated.toFixed(1)} L</span>
                        </div>
                      )}
                      {val.vol_rec && (
                        <div className="validation-row">
                          <span className="validation-label">Volumen recomendado (Guía)</span>
                          <span className="validation-value">{val.vol_rec} L</span>
                        </div>
                      )}

                      {val.volumeMsg && (
                        <div className={`alert ${val.volumeStatus === 'pass' ? 'alert-success' : val.volumeStatus === 'fail' ? 'alert-danger' : 'alert-warning'}`} style={{ marginTop: 8, marginBottom: 8 }}>
                          <span className="alert-icon">{val.volumeStatus === 'pass' ? '✅' : '⚠️'}</span>
                          <div style={{ fontSize: 13 }}>{val.volumeMsg}</div>
                        </div>
                      )}
                      {val.sensitivityMsg && (
                        <div className={`alert ${val.sensitivityStatus === 'pass' ? 'alert-success' : 'alert-danger'}`} style={{ marginBottom: 0 }}>
                          <span className="alert-icon">{val.sensitivityStatus === 'pass' ? '✅' : '❌'}</span>
                          <div style={{ fontSize: 13 }}>{val.sensitivityMsg}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )

      case 'review':
        return (
          <div className="card">
            <h3 style={{ marginBottom: 20, fontSize: 18, fontWeight: 700 }}>📦 Revisión — Envío muestras al laboratorio</h3>

            <div className="detail-grid">
              <div className="detail-item">
                <div className="detail-item-label">Código</div>
                <div className="detail-item-value">{form.codigo || '—'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Persona Solicita</div>
                <div className="detail-item-value">{form.persona_solicita}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Empresa</div>
                <div className="detail-item-value">{form.empresa}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Fecha Toma</div>
                <div className="detail-item-value">{form.fecha_toma || '—'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Persona Toma</div>
                <div className="detail-item-value">{form.persona_toma}</div>
              </div>
              <div className="detail-item">
                <div className="detail-item-label">Recogida por</div>
                <div className="detail-item-value">{form.recogida_por === 'echevarne' ? 'Laboratorio' : 'Solicitante'}</div>
              </div>
            </div>

            <h4 style={{ marginTop: 24, marginBottom: 12, fontSize: 15, fontWeight: 700 }}>Muestras ({samples.length})</h4>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Descripción</th>
                    <th>Punto</th>
                    <th>Q (L/min)</th>
                    <th>t (min)</th>
                    <th>V calc. (L)</th>
                    <th>Tipo</th>
                    <th>Análisis</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {samples.map((s, idx) => {
                    const val = validations[idx]
                    return (
                      <tr key={s.id}>
                        <td className="cell-numeric" style={{ fontWeight: 700 }}>{idx + 1}</td>
                        <td className="cell-name">{s.descripcion || '—'}</td>
                        <td>{s.punto_muestreo || '—'}</td>
                        <td className="cell-numeric">{val?.q_avg ? val.q_avg.toFixed(2) : '—'}</td>
                        <td className="cell-numeric">{s.tiempo_min || '—'}</td>
                        <td className="cell-numeric">{val?.v_calculated ? val.v_calculated.toFixed(1) : '—'}</td>
                        <td><span className="badge badge-method">{s.tipo_muestreo}</span></td>
                        <td>{s.analisis_solicitado || '—'}</td>
                        <td>
                          {val?.volumeStatus === 'pass' && val?.sensitivityStatus !== 'fail' && '✅'}
                          {val?.volumeStatus === 'warn' && '⚠️'}
                          {(val?.volumeStatus === 'fail' || val?.sensitivityStatus === 'fail') && '❌'}
                          {val?.volumeStatus === 'neutral' && '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Validation summary */}
            {validations.some(v => v.volumeStatus === 'warn' || v.sensitivityStatus === 'fail') && (
              <div className="alert alert-warning" style={{ marginTop: 16 }}>
                <span className="alert-icon">⚠️</span>
                <div style={{ fontSize: 13 }}>
                  <strong>Alertas de validación detectadas.</strong> Revise las muestras marcadas antes de generar el documento.
                </div>
              </div>
            )}

            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
              {!generated ? (
                <button
                  className="btn btn-lg btn-success"
                  onClick={handleGenerate}
                  disabled={generating || samples.every(s => !s.descripcion)}
                >
                  {generating ? (
                    <>
                      <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                      Generando PDF...
                    </>
                  ) : (
                    '📄 Generar F00662 (PDF)'
                  )}
                </button>
              ) : (
                <div className="alert alert-success">
                  <span className="alert-icon">✅</span>
                  <div>
                    <strong>F00662 generado correctamente.</strong>
                    <div style={{ fontSize: 13, marginTop: 4 }}>
                      El documento de envío de muestras ha sido creado y está listo para descarga.
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

      default:
        return null
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Envío muestras al laboratorio</h1>
        <p className="page-subtitle">
          Formulario F00662 — Solicitud de análisis con validación técnica proactiva
        </p>
      </div>

      {/* Memory indicator */}
      {memory.persona_solicita && (
        <div className="alert alert-info" style={{ marginBottom: 20 }}>
          <span className="alert-icon">💾</span>
          <div style={{ fontSize: 13 }}>
            Datos recordados: <strong>{memory.persona_solicita}</strong>
            {memory.compania && ` — ${memory.compania}`}
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

      {renderStep()}

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
        <button className="btn btn-secondary" onClick={handleBack} disabled={step === 0}>
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
