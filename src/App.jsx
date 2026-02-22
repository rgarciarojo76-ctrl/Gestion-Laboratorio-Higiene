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
    return contaminants.filter(c => c.visible_en_app === true)
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
           <span className="status-pill">Estado: Piloto interno</span>
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
