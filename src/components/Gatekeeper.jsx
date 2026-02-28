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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    // Si ya estamos autenticados en esta sesión, permitimos el paso directamente
    if (sessionStorage.getItem("ia_lab_auth") === "true") {
      setIsAuthenticated(true);
      setIsVerifying(false);
      return;
    }

    const verifyAccess = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const t = urlParams.get("t");
        const h = urlParams.get("h");
        
        // Si no hay parámetros, verificar si es dev local
        if (!t || !h) {
          if (import.meta.env.DEV) {
            setIsAuthenticated(true);
            setIsVerifying(false);
            return;
          }
          window.location.href = "https://direccion-tecnica-ia-lab.vercel.app/";
          return;
        }

        const secret = import.meta.env.VITE_SHARED_SECRET;
        if (!secret) {
          console.error("Falta VITE_SHARED_SECRET en las variables de entorno");
          // Fallback allow en dev local si no hay secreto, pero en prod bloqueamos
          if (import.meta.env.DEV) {
            setIsAuthenticated(true);
            setIsVerifying(false);
            return;
          }
        }

        const expectedHash = await calculateHMAC(t, secret);

        if (expectedHash === h) {
          // Autenticación exitosa
          sessionStorage.setItem("ia_lab_auth", "true");
          setIsAuthenticated(true);
          
          // Opcional: limpiar la URL para que no quede el timestamp e hash
          window.history.replaceState({}, document.title, window.location.pathname);
        } else {
          // Fallo de autenticación
          window.location.href = "https://direccion-tecnica-ia-lab.vercel.app/";
        }
      } catch (error) {
        console.error("Error en validación HMAC:", error);
        window.location.href = "https://direccion-tecnica-ia-lab.vercel.app/";
      } finally {
        setIsVerifying(false);
      }
    };

    verifyAccess();
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
