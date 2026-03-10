/* eslint-disable no-unused-vars */
import { useState, useEffect } from "react";

/**
 * Función auxiliar para calcular HMAC SHA-256 usando Web Crypto API.
 */
async function calculateHMAC(message, secret) {
  const enc = new TextEncoder();
  
  // 1. Import the secret key
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  // 2. Sign the message
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(message)
  );
  
  // 3. Convert ArrayBuffer to Hex String
  const hashArray = Array.from(new Uint8Array(signature));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

export default function Gatekeeper({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    // Bypass provisional para poder usar la app fuera del portal
  }, []);

  if (isVerifying) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div className="spinner" style={{ width: 40, height: 40, border: '3px solid #f3f3f3', borderTop: '3px solid #0099cc', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <div style={{ fontFamily: 'Inter, sans-serif', color: '#64748b' }}>Autenticando acceso seguro...</div>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return isAuthenticated ? children : null;
}
