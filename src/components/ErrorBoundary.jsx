import { Component } from 'react';

/**
 * ErrorBoundary — Catches rendering errors in child components
 * and displays a user-friendly fallback UI instead of a blank screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 24px',
          textAlign: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
          color: '#475569',
          gap: 16,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: '#fef2f2', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 32,
          }}>
            ⚠️
          </div>
          <h3 style={{ margin: 0, color: '#0f172a', fontSize: 18, fontWeight: 700 }}>
            Error inesperado
          </h3>
          <p style={{ margin: 0, maxWidth: 420, lineHeight: 1.5, fontSize: 14 }}>
            Se ha producido un error al cargar este módulo.
            Puedes intentar recargar la página.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8, padding: '10px 24px',
              background: 'linear-gradient(135deg, #0099cc, #0284c7)',
              color: '#fff', border: 'none', borderRadius: 8,
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,153,204,0.25)',
            }}
          >
            🔄 Recargar página
          </button>
          {import.meta.env.DEV && this.state.error && (
            <pre style={{
              marginTop: 16, padding: 12, background: '#f8fafc',
              border: '1px solid #e2e8f0', borderRadius: 6,
              fontSize: 11, textAlign: 'left', maxWidth: 600,
              overflow: 'auto', whiteSpace: 'pre-wrap',
            }}>
              {this.state.error.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
