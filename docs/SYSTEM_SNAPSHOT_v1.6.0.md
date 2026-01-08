# SYSTEM SNAPSHOT - EL FOTÓGRAFO (v1.6.0/v1.7.0)
Fecha: 2026-01-08
Estado: Auditoría de Integridad Realizada

## 1. Ontología del Software (Dominio y Contratos)

### Entidades Core
| Entidad | Definición en Negocio | Interfaz Técnica (types.ts) | Persistencia |
| :--- | :--- | :--- | :--- |
| **Sujeto** | Identidad analizada del usuario. | `FacialTraits` | `analysisLibrary` |
| **Negativo** | Imagen de origen (RAW). | `base64Image` (string) | `AnalysisItem.imageBase64` |
| **Rasgos/Firma** | ADN facial extraído. | `FacialTraits.features` | LocalStorage (Vault) |
| **Sensor** | Motor de renderizado. | `EngineMode` ('offline'/'live') | State (In-memory) |
| **Revelado** | Resultado de generación. | `RenderItem` | `renderLibrary` |
| **Archivo Maestro** | Galería guardada permanentemente. | `savedRenders` (RenderItem[]) | `fotografo_vault_v1.7` |
| **Bitácora** | Métricas de rendimiento. | `GenerationMetrics` | `fotografo_metrics_v1.5` |

## 2. Motores y Políticas (Sentinel Logic)

### Selección de Modelos (Sentinel)
El sistema utiliza un gestor de fallbacks en `modelManager.ts` llamado `executeWithFallback`.
- **Modo Pro (Full Frame):** Intenta `gemini-3-pro-image-preview`. Si falla (429/403/404), conmuta a `gemini-2.5-flash-image`.
- **Modo Standard (Native):** Va directo a `gemini-2.5-flash-image`.
- **Análisis Biométrico:** Siempre intenta `gemini-3-pro-preview` para razonamiento profundo (Thinking Budget: 24576).

### Errores Controlados
- **429 (Quota):** Dispara fallback inmediato al siguiente modelo.
- **403/401 (Keys):** Solicita recalibración de óptica (UI key selector).
- **Identity Score < 85%:** Activa bucle de reintento automático (hasta 3 veces en modo Pro).

## 3. Procesos (User Journeys)

1.  **Importar Negativo:** `App.tsx:handleFileUpload` -> `imageUtils.ts:resizeImage(1024)` -> `geminiService.ts:analyzeFaceImage`.
2.  **Exposición/Análisis:** `analyzeFaceImage` genera JSON biométrico -> Guardado en `analysisLibrary`.
3.  **SET / Composición:** Usuario elige `Pose` + `Style` + `Context` + `Gear` (Lente/Química).
4.  **LAB / Disparar Revelado:** `App.tsx:handleReveal` ensambla el prompt -> `imageGenService.ts:revealImageWithRetry`.
    - **Ensamblaje Prompt:** `Traits` + `Pose` + `Style` + `Context` + `Skin` + `Gear (Focal/Film)`.
5.  **Exportar Original:** `App.tsx:downloadHighRes` -> `fetch(base64)` -> `Blob` -> `file-saver`.
6.  **Vaciar Carrete:** Limpia `renderLibrary` (estado volátil). No borra el Archivo Maestro.

## 4. Persistencia (LocalStorage Schema)

- **Key:** `fotografo_vault_v1.7`
- **Schema:**
```typescript
{
  savedRenders: RenderItem[], // Objetos con outBase64 y metadata EXIF
  analysisLibrary: AnalysisItem[] // Historial de ADN facial
}
```

## 5. Inventario de Componentes Clave

| Componente | Responsabilidad | Riesgo de Refactor |
| :--- | :--- | :--- |
| **App.tsx** | Orquestador de Vistas y Estado Maestro. | **ALTO** (Lógica de negocio mezclada) |
| **GearRack.tsx** | Selector de Óptica/Química. | MEDIO |
| **imageGenService** | Comunicación con Google GenAI y Retries. | **CRÍTICO** (No tocar lógica de retry) |
| **geminiService** | Validación Biométrica y Análisis. | **CRÍTICO** (Parsing JSON sensible) |
| **modelManager** | Sentinel / Fallback System. | BAJO (Lógica aislada) |
