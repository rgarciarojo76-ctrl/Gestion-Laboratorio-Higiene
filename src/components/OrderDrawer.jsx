import { useCart } from '../context/CartContext'
import { formatPrice } from '../utils/helpers'

/**
 * OrderDrawer — Right-side sliding drawer showing the current cart contents.
 * 
 * Props:
 *   - isOpen: boolean
 *   - onClose: callback
 *   - onNavigateToMaterial: callback to switch to the MaterialRequest tab
 */
export default function OrderDrawer({ isOpen, onClose, onNavigateToMaterial }) {
  const { items, totalItems, totalUnits, removeItem, updateQuantity, clearCart } = useCart()

  // NOTE: formatPrice imported from '../utils/helpers'

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`drawer-overlay ${isOpen ? 'drawer-overlay--visible' : ''}`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <aside className={`order-drawer ${isOpen ? 'order-drawer--open' : ''}`}>
        {/* Header */}
        <div className="order-drawer-header">
          <div className="order-drawer-header-left">
            <h2 className="order-drawer-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              Mi Pedido
            </h2>
            {totalItems > 0 && (
              <span className="order-drawer-badge">{totalItems} {totalItems === 1 ? 'artículo' : 'artículos'}</span>
            )}
          </div>
          <button className="order-drawer-close" onClick={onClose} title="Cerrar">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="order-drawer-body">
          {items.length === 0 ? (
            <div className="order-drawer-empty">
              <div className="order-drawer-empty-icon">🛒</div>
              <p className="order-drawer-empty-title">Tu pedido está vacío</p>
              <p className="order-drawer-empty-sub">Añade soportes desde la Guía Técnica usando el icono 🛒</p>
            </div>
          ) : (
            <div className="order-drawer-list">
              {items.map(item => (
                <div key={item.id} className="order-drawer-item">
                  <div className="order-drawer-item-icon">
                    <span className="order-drawer-item-emoji">🧪</span>
                  </div>
                  <div className="order-drawer-item-info">
                    <div className="order-drawer-item-code">{item.code}</div>
                    <div className="order-drawer-item-name" title={item.name}>{item.name}</div>
                    {item.method && (
                      <div className="order-drawer-item-method">{item.method}</div>
                    )}
                    {item.price > 0 && (
                      <div className="order-drawer-item-price">{formatPrice(item.price)} /ud.</div>
                    )}
                  </div>
                  <div className="order-drawer-item-actions">
                    <div className="order-drawer-qty-controls">
                      <button
                        className="order-drawer-qty-btn"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        −
                      </button>
                      <input
                        className="order-drawer-qty-input"
                        type="number"
                        min="1"
                        max="999"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                      />
                      <button
                        className="order-drawer-qty-btn"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="order-drawer-delete-btn"
                      onClick={() => removeItem(item.id)}
                      title="Eliminar del pedido"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="order-drawer-footer">
            <div className="order-drawer-totals">
              <div className="order-drawer-total-row">
                <span>Total artículos</span>
                <strong>{totalItems}</strong>
              </div>
              <div className="order-drawer-total-row">
                <span>Total unidades</span>
                <strong>{totalUnits}</strong>
              </div>
            </div>
            <div className="order-drawer-footer-actions">
              <button
                className="order-drawer-clear-btn"
                onClick={() => { if (window.confirm('¿Vaciar todo el pedido?')) clearCart() }}
              >
                Vaciar pedido
              </button>
              <button
                className="order-drawer-submit-btn"
                onClick={() => {
                  onNavigateToMaterial()
                  onClose()
                }}
              >
                📦 Ir a Solicitud
              </button>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
