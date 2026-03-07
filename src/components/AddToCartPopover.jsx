import { useState, useRef, useEffect } from 'react'
import { useCart } from '../context/CartContext'
import { useToast } from './ToastNotification'

/**
 * AddToCartPopover — Floating popover for adding items to the global cart.
 * 
 * This component should be conditionally rendered (mount/unmount pattern)
 * so that state resets naturally each time it opens.
 * 
 * Props:
 *   - item: { id, code, name, price, method }
 *   - onClose: callback when popover closes
 */
export default function AddToCartPopover({ item, onClose }) {
  const [qty, setQty] = useState(1)
  const [showSuccess, setShowSuccess] = useState(false)
  const popoverRef = useRef(null)
  const { addItem } = useCart()
  const { showToast } = useToast()

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose()
      }
    }
    // Small delay to avoid the click that opened it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  const handleQtyChange = (val) => {
    const parsed = parseInt(val)
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 999) {
      setQty(parsed)
    }
  }

  const handleAdd = () => {
    addItem({ ...item, quantity: qty })
    setShowSuccess(true)
    showToast(`${qty}× ${item.code || item.name} añadido al pedido`, 'success')
    setTimeout(() => {
      onClose()
    }, 600)
  }

  return (
    <div className="cart-popover" ref={popoverRef}>
      <div className="cart-popover-arrow" />
      <div className="cart-popover-header">
        <span className="cart-popover-code">{item.code}</span>
        <span className="cart-popover-name">{item.name}</span>
      </div>
      <div className="cart-popover-body">
        <div className="cart-popover-qty-row">
          <span className="cart-popover-qty-label">Cantidad:</span>
          <div className="cart-popover-qty-controls">
            <button
              className="cart-popover-qty-btn"
              onClick={() => handleQtyChange(qty - 1)}
              disabled={qty <= 1}
            >
              −
            </button>
            <input
              className="cart-popover-qty-input"
              type="number"
              min="1"
              max="999"
              step="1"
              value={qty}
              onChange={(e) => handleQtyChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape') onClose()
              }}
            />
            <button
              className="cart-popover-qty-btn"
              onClick={() => handleQtyChange(qty + 1)}
              disabled={qty >= 999}
            >
              +
            </button>
          </div>
        </div>
        <button
          className={`cart-popover-add-btn ${showSuccess ? 'cart-popover-add-btn--success' : ''}`}
          onClick={handleAdd}
          disabled={showSuccess}
        >
          {showSuccess ? (
            <span className="cart-popover-success-anim">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Añadido
            </span>
          ) : (
            <>🛒 Añadir al pedido</>
          )}
        </button>
      </div>
    </div>
  )
}
