# Prompt Maestro: Sistema Integral de Higiene Industrial y Gestión UNE-EN 482

## 1. Directiva de Integridad (CRÍTICO)

**PRESERVACIÓN DE LÓGICA:** No modifiques ninguna funcionalidad existente que ya esté operativa (vinculación de vídeos APA, enlaces INSST o formularios F01655/F00662). Tu misión es añadir las siguientes capas de administración y cálculo sin alterar el flujo de trabajo actual.

## 2. Panel de Administración y Seguridad

**Acceso:** Opción "Configuración Avanzada" protegida por contraseña: `DPTAspy2026`.
**Gestión de Datos (vía Python):**

- **Buscador de Edición:** Permite localizar cualquier producto por Nombre/CAS y editar sus campos.
- **Alta de Productos:** Botón "Nuevo Producto" para rellenar fichas manualmente desde cero.
- **Control de Visibilidad (Escenario A):** Solo los productos con el check "Visible en App" activado aparecerán para los técnicos. Por defecto, los nuevos están ocultos.
- **Persistencia y Trazabilidad:** Sobrescribe el archivo `/DATA/Base de conocimiento completa 2026` tras cada cambio.
- **Log de Actividad:** Registra cada acción en `/DATA/log_actividad.txt` con formato: `[FECHA] - USUARIO: Admin - ACCIÓN: [Alta/Edición/Visibilidad] - PRODUCTO: [Nombre/CAS]`.

## 3. Motor de Cálculo Inteligente (UNE-EN 482:2021)

Para cada contaminante visible, calcula en tiempo real el volumen mínimo legal utilizando el LOQ del laboratorio:

- **Conversión Automática:** Si los datos no son numéricos o están en ppm, conviértelos a $mg/m^3$. Si falta el Peso Molecular (PM) en el Excel, búscalo en tu base de conocimiento técnica.
- **Fórmulas UNE-EN 482:**
  - **Vol. Mín. VLA-ED (L):** $V = \frac{LOQ (\mu g)}{0,1 \times VLA\text{-}ED (mg/m^3)}$
  - **Vol. Mín. VLA-EC (L):** $V = \frac{LOQ (\mu g)}{0,5 \times VLA\text{-}EC (mg/m^3)}$
- **Gestión de Nulos:** Si falta un VLA, muestra "N/A" en el campo correspondiente.

## 4. Interfaz del Técnico (UI/UX)

Presenta la información técnica en dos capas:

- **Capa 1 (Vista Principal):** Muestra una fila destacada con 4 campos:
  `[VLA-ED] | [VLA-EC] | [Vol. Mín. VLA-ED (UNE 482)] | [Vol. Mín. VLA-EC (UNE 482)]`
  - **Lógica de Advertencia (⚠️):** Si el Volumen Mínimo UNE 482 es mayor que el "Volúmen recomendado" del método, muestra un icono ⚠️. Al pulsarlo, explica: _"Atención: El volumen requerido por UNE-EN 482 supera el recomendado por el método analítico."_
- **Capa 2 (Vista Expandida):** Botón "Ampliar información" para ver el resto de campos correlacionados.

## 5. Generación de Ficha Técnica (PDF)

Al pulsar "Descargar Ficha", genera un PDF maquetado profesionalmente que incluya:

- Logo, tablas estructuradas y parámetros de captación.
- **Nota Normativa Automática:** Si existió la advertencia (⚠️), añade en la sección de observaciones: _"Nota: Se requiere ajustar la estrategia de muestreo para cumplir con el rango de medida de la norma UNE-EN 482:2021 debido al límite de cuantificación actual."_
- **Multimedia:** Mantén los enlaces a métodos MTA y vídeos de captación de APA.
