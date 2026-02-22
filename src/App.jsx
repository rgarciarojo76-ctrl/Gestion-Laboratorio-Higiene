import { useState, useEffect, useMemo, useCallback } from 'react'
import SamplingGuide from './modules/SamplingGuide'
import MaterialRequest from './modules/MaterialRequest'
import ChainOfCustody from './modules/ChainOfCustody'
import AdminPanel from './modules/AdminPanel'

function App() {
  const [activeModule, setActiveModule] = useState('guide')
  const [contaminants, setContaminants] = useState([])
  const [loading, setLoading] = useState(true)

  // Persistent memory for recurring data
  const [memory, setMemory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('hygiene-memory') || '{}')
    } catch {
      return {}
    }
  })

  // Save memory on change
  useEffect(() => {
    localStorage.setItem('hygiene-memory', JSON.stringify(memory))
  }, [memory])

  // Helper to update memory
  const updateMemory = (key, value) => {
    setMemory(prev => ({ ...prev, [key]: value }))
  }

  // Load contaminant data from Flask API (live state)
  const loadContaminants = useCallback(() => {
    fetch('http://localhost:5003/api/contaminants/all')
      .then(res => res.json())
      .then(data => {
        setContaminants(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error loading contaminants from API, falling back to static file:', err)
        // Fallback to static file if Flask is not running
        fetch('/contaminantes.json?_=' + Date.now())
          .then(res => res.json())
          .then(data => {
            setContaminants(data)
            setLoading(false)
          })
          .catch(err2 => {
            console.error('Error loading contaminants:', err2)
            setLoading(false)
          })
      })
  }, [])

  useEffect(() => {
    loadContaminants()
  }, [loadContaminants])

  // Filtered contaminants for technician modules (only visible ones)
  const visibleContaminants = useMemo(() => {
    return contaminants.filter(c => c.visible_en_app !== false)
  }, [contaminants])

  return (
    <div className="app-container">
      {/* 1. Top Header */}
      <header className="app-header">
        <div className="brand-section">
          <img src="/logo_ialab.png" alt="IA LAB Logo" className="brand-logo" />
          <div className="brand-divider"></div>
          <div className="brand-text-col">
            <span className="brand-org-name">DIRECCIÓN TÉCNICA IA LAB</span>
            <span className="brand-app-name">App Gestión Laboratorio Higiene Industrial</span>
          </div>
        </div>

        <div className="header-actions">
          <div className="status-disclaimer">
            <span className="disclaimer-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              AVISO
            </span>
            <span className="disclaimer-body">Uso Exclusivo - Dirección Técnica IA LAB</span>
          </div>
        </div>
      </header>

      {/* 2. Warning Banner */}
      <div className="warning-banner">
        <span>⚠️</span>
        <strong>AVISO:</strong> Apoyo técnico (no sustitutivo del criterio profesional). La información debe ser validada.
      </div>

      {/* 3. Navigation Tabs */}
      <nav className="nav-tabs">
        <div
          className={`nav-tab ${activeModule === 'guide' ? 'active' : ''}`}
          onClick={() => setActiveModule('guide')}
        >
          🔬 Guía Técnica
        </div>
        <div
          className={`nav-tab ${activeModule === 'material' ? 'active' : ''}`}
          onClick={() => setActiveModule('material')}
        >
          📦 Solicitud Material
        </div>
        <div
          className={`nav-tab ${activeModule === 'chain' ? 'active' : ''}`}
          onClick={() => setActiveModule('chain')}
        >
          📋 Cadena de Custodia
        </div>
        <div
          className={`nav-tab ${activeModule === 'admin' ? 'active' : ''}`}
          onClick={() => setActiveModule('admin')}
          style={{ marginLeft: 'auto' }}
        >
          ⚙️ Configuración Avanzada
        </div>
      </nav>

      {/* 4. Main Content Area */}
      <main className="main-content">
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            Cargando base de datos...
          </div>
        ) : (
          <>
            {activeModule === 'guide' && (
              <SamplingGuide contaminants={visibleContaminants} allContaminants={contaminants} loading={loading} />
            )}
            {activeModule === 'material' && (
              <MaterialRequest contaminants={visibleContaminants} memory={memory} updateMemory={updateMemory} />
            )}
            {activeModule === 'chain' && (
              <ChainOfCustody contaminants={visibleContaminants} memory={memory} updateMemory={updateMemory} />
            )}
            {activeModule === 'admin' && (
              <AdminPanel contaminants={contaminants} onDataChanged={loadContaminants} />
            )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
