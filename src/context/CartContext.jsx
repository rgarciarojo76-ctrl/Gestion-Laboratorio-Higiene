import { createContext, useContext, useReducer, useEffect, useCallback } from 'react'

/**
 * Global Cart Context — Persistent Sampling Logistics Engine
 * 
 * Manages a global order cart that persists across tab changes,
 * contaminant searches, and page reloads via localStorage.
 * 
 * Item shape: { id, code, name, price, quantity, method }
 */

const STORAGE_KEY = 'hygiene-cart'

function loadCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM': {
      const existing = state.find(item => item.id === action.payload.id)
      if (existing) {
        return state.map(item =>
          item.id === action.payload.id
            ? { ...item, quantity: item.quantity + (action.payload.quantity || 1) }
            : item
        )
      }
      return [...state, { ...action.payload, quantity: action.payload.quantity || 1 }]
    }
    case 'REMOVE_ITEM':
      return state.filter(item => item.id !== action.payload)
    case 'UPDATE_QUANTITY':
      if (action.payload.quantity < 1) {
        return state.filter(item => item.id !== action.payload.id)
      }
      return state.map(item =>
        item.id === action.payload.id
          ? { ...item, quantity: action.payload.quantity }
          : item
      )
    case 'CLEAR_CART':
      return []
    case 'INJECT_ITEMS': {
      // Merge new items, incrementing qty for existing ones
      const merged = [...state]
      action.payload.forEach(newItem => {
        const idx = merged.findIndex(m => m.id === newItem.id)
        if (idx >= 0) {
          merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + (newItem.quantity || 1) }
        } else {
          merged.push({ ...newItem, quantity: newItem.quantity || 1 })
        }
      })
      return merged
    }
    default:
      return state
  }
}

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(cartReducer, null, loadCart)

  // Persist to localStorage on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const addItem = useCallback((item) => {
    dispatch({ type: 'ADD_ITEM', payload: item })
  }, [])

  const removeItem = useCallback((id) => {
    dispatch({ type: 'REMOVE_ITEM', payload: id })
  }, [])

  const updateQuantity = useCallback((id, quantity) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity: parseInt(quantity) || 0 } })
  }, [])

  const clearCart = useCallback(() => {
    dispatch({ type: 'CLEAR_CART' })
  }, [])

  const injectItems = useCallback((newItems) => {
    dispatch({ type: 'INJECT_ITEMS', payload: newItems })
  }, [])

  const totalItems = items.length
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <CartContext.Provider value={{
      items,
      totalItems,
      totalUnits,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      injectItems,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error('useCart must be used within a CartProvider')
  }
  return context
}

export default CartContext
