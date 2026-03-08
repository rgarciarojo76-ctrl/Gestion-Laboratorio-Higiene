/**
 * Shared Utility Functions — Gestion Laboratorio Higiene
 *
 * Centralises duplicated helpers that were previously defined
 * independently inside SamplingGuide, MaterialRequest,
 * ChainOfCustody and OrderDrawer.
 */

// ── Text normalisation (accent-insensitive search) ───────────────────────────
export function normalizeText(text) {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// ── Numeric parser (handles commas, "< 0.1", whitespace) ─────────────────────
export function parseNum(val) {
  if (val == null) return NaN;
  const cleaned = String(val)
    .replace(/[<>≤≥~]/g, '')
    .replace(/,/g, '.')
    .trim();
  return parseFloat(cleaned);
}

// ── Price formatter (EUR via Intl) ───────────────────────────────────────────
const _priceFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

export function formatPrice(amount) {
  if (amount == null || isNaN(amount)) return null;
  return _priceFormatter.format(amount);
}

// ── Input sanitiser (strip HTML tags & control chars) ─────────────────────────
// Prevents any possible XSS if user-supplied text ever reaches a rendering
// context that doesn't auto-escape (PDF generation, server logs, etc.).
export function sanitizeInput(text) {
  if (!text) return '';
  return String(text)
    .replace(/[<>]/g, '')          // strip angle brackets
    .replace(/javascript:/gi, '')  // strip JS protocol
    .replace(/on\w+\s*=/gi, '')    // strip inline event handlers
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '') // strip control chars
    .trim();
}

// ── Debounce ─────────────────────────────────────────────────────────────────
export function debounce(fn, ms = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
