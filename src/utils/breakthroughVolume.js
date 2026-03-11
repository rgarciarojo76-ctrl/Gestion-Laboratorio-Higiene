/**
 * Módulo de Cálculo de Estrategia de Volumen de Ruptura (VR)
 *
 * Evalúa si el tiempo objetivo de muestreo (UNE 689) puede completarse
 * con un único soporte adsorbente o si requiere fraccionamiento para
 * evitar la elución / saturación por humedad.
 *
 * Normativa de referencia:
 *   - UNE-EN 689: Estrategia de muestreo representativo
 *   - UNE-EN 482: Sensibilidad mínima (0.1 × VLA-ED)
 */

/**
 * Parsea un string de volumen tipo "1-30 L\n(15 L)" y extrae el valor máximo.
 * @param {string|number|null} volStr
 * @returns {number|null}
 */
export function parseVolumenMaximo(volStr) {
  if (volStr == null) return null;
  const s = String(volStr).replace(/[Ll]/g, '').trim();
  // Try to extract range "X-Y"
  const rangeMatch = s.match(/([\d.,]+)\s*[-–—]\s*([\d.,]+)/);
  if (rangeMatch) {
    return parseFloat(rangeMatch[2].replace(',', '.'));
  }
  // Try plain number
  const numMatch = s.match(/([\d.,]+)/);
  if (numMatch) {
    return parseFloat(numMatch[1].replace(',', '.'));
  }
  return null;
}

/**
 * Calcula la estrategia de muestreo óptima para evitar el volumen de ruptura.
 *
 * @param {Object} params
 * @param {number}      params.tObjetivo       – Tiempo objetivo UNE 689 (min)
 * @param {number}      params.caudal          – Caudal de muestreo (L/min)
 * @param {number|null} params.vRuptura        – VR específico del MTA/FTA (L) si disponible
 * @param {number|null} params.vMaxMTA         – Volumen máximo del rango MTA (L)
 * @param {number|null} params.volMinUNE482    – Volumen mínimo UNE 482 para 0.1×VLA (L)
 *
 * @returns {Object} resultado
 * @returns {string}  resultado.estrategia     – 'UNICA' | 'FRACCIONAMIENTO' | 'SIN_DATOS'
 * @returns {string}  resultado.estado         – 'verde' | 'amarillo' | 'gris'
 * @returns {number}  resultado.nSoportes      – Número de soportes necesarios
 * @returns {number}  resultado.tPorSoporte    – Tiempo por soporte (min)
 * @returns {number}  resultado.vPorFraccion   – Volumen de aire por fracción (L)
 * @returns {number}  resultado.vSeguro        – Volumen seguro utilizado (L)
 * @returns {number}  resultado.vTotal         – Volumen total de muestreo (L)
 * @returns {number}  resultado.tMaxSoporte    – Tiempo máximo por soporte (min)
 * @returns {number}  resultado.pctSaturacion  – % del volumen total vs VR (0-100+)
 * @returns {boolean} resultado.cumpleUNE482   – Si cada fracción cumple vol mínimo UNE 482
 * @returns {string}  resultado.origenDato     – Transparencia del criterio aplicado
 * @returns {string}  resultado.instruccion    – Texto de instrucción para técnico junior
 */
export function calcularEstrategiaVR({
  tObjetivo,
  caudal,
  vRuptura = null,
  vMaxMTA = null,
  volMinUNE482 = null,
}) {
  // ── Guard: datos insuficientes ───────────────────────────────────────
  if (!caudal || caudal <= 0 || !tObjetivo || tObjetivo <= 0) {
    return {
      estrategia: 'SIN_DATOS',
      estado: 'gris',
      nSoportes: 0,
      tPorSoporte: 0,
      vPorFraccion: 0,
      vSeguro: 0,
      vTotal: 0,
      tMaxSoporte: 0,
      pctSaturacion: 0,
      cumpleUNE482: true,
      origenDato: 'Datos insuficientes',
      instruccion: 'No se dispone de datos suficientes para evaluar el riesgo de saturación del soporte.',
    };
  }

  // ── 1. Determinar V_seguro ───────────────────────────────────────────
  let vSeguro;
  let origenDato;

  if (vRuptura != null && vRuptura > 0) {
    // Dato VR específico disponible (del MTA/FTA a HR > 80%)
    vSeguro = vRuptura;
    origenDato = 'VR específico según MTA';
  } else if (vMaxMTA != null && vMaxMTA > 0) {
    // Fallback: 50% del volumen máximo del rango del método
    vSeguro = vMaxMTA * 0.5;
    origenDato = 'Reducción 50% (Dato VR no disponible en MTA)';
  } else {
    return {
      estrategia: 'SIN_DATOS',
      estado: 'gris',
      nSoportes: 0,
      tPorSoporte: 0,
      vPorFraccion: 0,
      vSeguro: 0,
      vTotal: caudal * tObjetivo,
      tMaxSoporte: 0,
      pctSaturacion: 0,
      cumpleUNE482: true,
      origenDato: 'Sin datos de volumen máximo del método',
      instruccion: 'No se dispone de datos de volumen máximo del método para evaluar la saturación.',
    };
  }

  // ── 2. Cálculo de soporte único ──────────────────────────────────────
  const tMaxSoporte = vSeguro / caudal; // min
  const vTotal = caudal * tObjetivo;    // L

  // ── 3. Decisión estratégica ──────────────────────────────────────────
  let estrategia, nSoportes, tPorSoporte, vPorFraccion;

  if (tMaxSoporte >= tObjetivo) {
    // ✅ Un solo soporte es suficiente
    estrategia = 'UNICA';
    nSoportes = 1;
    tPorSoporte = tObjetivo;
    vPorFraccion = vTotal;
  } else {
    // ⚠️ Se requiere fraccionamiento
    estrategia = 'FRACCIONAMIENTO';
    nSoportes = Math.ceil(tObjetivo / tMaxSoporte);
    // Ajuste de simetría: dividir equitativamente
    tPorSoporte = Math.round((tObjetivo / nSoportes) * 10) / 10;
    vPorFraccion = Math.round(caudal * tPorSoporte * 100) / 100;
  }

  // ── 4. Validación cruzada UNE 482 ────────────────────────────────────
  const cumpleUNE482 = volMinUNE482 == null || volMinUNE482 <= 0 || vPorFraccion >= volMinUNE482;

  // ── 5. Porcentaje de saturación ──────────────────────────────────────
  const pctSaturacion = vSeguro > 0 ? Math.round((vTotal / vSeguro) * 100) : 0;

  // ── 6. Instrucción para técnico junior ───────────────────────────────
  const formatTiempo = (min) => {
    if (min < 60) return `${Math.round(min)} min`;
    const hrs = Math.floor(min / 60);
    const mins = Math.round(min % 60);
    return mins > 0 ? `${hrs}h ${mins}min` : `${hrs}h`;
  };

  let instruccion;
  if (estrategia === 'UNICA') {
    instruccion = `Muestreo seguro con 1 soporte. Puede muestrear ${formatTiempo(tObjetivo)} de forma continua sin riesgo de saturación (volumen ${Math.round(vTotal * 10) / 10} L vs límite seguro ${Math.round(vSeguro * 10) / 10} L).`;
  } else {
    instruccion = `Para cumplir con la UNE 689 (${formatTiempo(tObjetivo)}) y evitar la saturación por humedad, utilice ${nSoportes} soportes. Muestree ${formatTiempo(tPorSoporte)} con cada uno (${Math.round(vPorFraccion * 10) / 10} L por soporte).`;
    if (!cumpleUNE482) {
      instruccion += ` ⚠️ ATENCIÓN: El volumen por fracción (${Math.round(vPorFraccion * 10) / 10} L) es inferior al mínimo UNE 482 (${Math.round(volMinUNE482 * 10) / 10} L). Considere aumentar el caudal.`;
    }
  }

  // ── 7. Estado semáforo ───────────────────────────────────────────────
  const estado = estrategia === 'UNICA' ? 'verde' : 'amarillo';

  return {
    estrategia,
    estado,
    nSoportes,
    tPorSoporte: Math.round(tPorSoporte * 10) / 10,
    vPorFraccion: Math.round(vPorFraccion * 100) / 100,
    vSeguro: Math.round(vSeguro * 100) / 100,
    vTotal: Math.round(vTotal * 100) / 100,
    tMaxSoporte: Math.round(tMaxSoporte * 10) / 10,
    pctSaturacion,
    cumpleUNE482,
    origenDato,
    instruccion,
  };
}
