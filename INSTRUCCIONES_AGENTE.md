# Instrucciones para el Agente Colaborador

Este documento establece el protocolo de desarrollo obligatorio para este proyecto.

## 1. Conexión al Repositorio

Este agente debe estar vinculado al repositorio: `https://github.com/rgarciarojo76-ctrl/Gestion-Laboratorio-Higiene`

## 2. Gestión de Ramas

Es obligatorio crear y usar exclusivamente la rama `dev-colaborador` para realizar cambios.

```bash
git checkout -b dev-colaborador
```

## 3. Configuración del Entorno

Instalar las dependencias necesarias:

- **Frontend (Node.js):** `npm install`
- **Backend (Python):** `pip install -r requirements.txt` (se recomienda usar un entorno virtual)

## 4. Despliegue Local

Para previsualizar los cambios localmente, utilizar el comando:

```bash
vercel dev
```

## 5. Sincronización de Avances

Cada avance debe subirse automáticamente mediante:

```bash
git push origin dev-colaborador
```

---

_Este protocolo asegura la integridad de la rama principal (main) y facilita la revisión de cambios por parte de la Dirección Técnica._
