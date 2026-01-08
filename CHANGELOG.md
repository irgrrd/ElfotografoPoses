# CHANGELOG - EL FOTÓGRAFO (Studio Master)

## [v1.6.0] - 2026-01-08 (Versión Actual)

### 🚀 Nuevas Características
- **Ontología de Estudio:** Reemplazo de terminología de ingeniería (ADN/Render) por fotográfica (Negativo/Revelado) en toda la interfaz.
- **Modo Nativo Real:** "Sensor Standard" ahora utiliza Gemini Flash de forma nativa para revelados rápidos de alta fidelidad.
- **Sensor Full Frame:** "Sensor Pro" utiliza Gemini 3 Pro con lógica Sentinel de reintentos automáticos para blindar la identidad.
- **Bitácora de Exposición:** Nuevo panel de telemetría analítica que muestra el rendimiento del sensor y la calidad de los revelados.
- **Exportación "Master":** Sistema de descarga optimizado que genera archivos PNG de alta resolución con nombres técnicos.
- **Archivo Maestro (Vault):** Persistencia robusta en LocalStorage para negativos seleccionados y análisis previos.

### 🛡️ Integridad & Sentinel
- **Sentinel Fallback Manager:** Sistema de gestión de errores que conmuta automáticamente entre modelos ante fallos de cuota o servicio.
- **Validación Biométrica 1.6:** Umbrales adaptativos que ajustan la exigencia de identidad según el nivel de 'Strength' aplicado.
- **Hardware Aesthetic:** Interfaz rediseñada bajo la estética "Darkroom/Leica" con acentos de "Safe Light" (Rojo Técnico).

### 🛠️ Correcciones y Mejoras
- **Responsividad Crítica:** El selector de sensor se adapta de forma inteligente en móviles para evitar colisiones con el branding.
- **Optimización de Payload:** Redimensionamiento inteligente de imágenes antes de la transmisión para mejorar la latencia del laboratorio.
- **Fisicidad UX:** Implementación de controles de hardware (sliders y botones shutter) para una experiencia táctil profesional.