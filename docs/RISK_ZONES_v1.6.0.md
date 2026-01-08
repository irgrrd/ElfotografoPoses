# RISK ZONES - EL FOTÓGRAFO v1.6.0
## "Zonas Prohibidas" durante el Refactor UI

### 1. Parsing de Base64 y MIME Types
- **Ubicación:** `App.tsx`, `geminiService.ts`, `imageGenService.ts`.
- **Riesgo:** El sistema utiliza `.split(',')[1]` para enviar datos a la API. Alterar la forma en que se manejan estos strings romperá la comunicación con Gemini.
- **Instrucción:** Mantener la lógica de limpieza de cabeceras intacta.

### 2. Esquema de Persistencia (Vault)
- **Ubicación:** `App.tsx` (useEffect de guardado y carga).
- **Riesgo:** Cambiar nombres de propiedades en `InternalState` o `RenderItem` invalidará los datos guardados en el LocalStorage de los usuarios.
- **Instrucción:** Cualquier cambio en tipos debe ir acompañado de una migración de datos.

### 3. Lógica de Retries y Sentinel
- **Ubicación:** `imageGenService.ts:revealImageWithRetry`.
- **Riesgo:** Es el corazón de la app. Alterar el bucle `while` o el `executeWithFallback` puede causar pérdida de identidad o errores 429 infinitos.
- **Instrucción:** No modificar la lógica de control de flujo.

### 4. Redimensionamiento (Canvas)
- **Ubicación:** `imageUtils.ts:resizeImage`.
- **Riesgo:** Enviar imágenes > 2MB a la API causa errores de Payload. Esta utilidad garantiza que las imágenes se mantengan en límites seguros.
- **Instrucción:** No cambiar el `maxWidth` por defecto a menos que se valide el impacto en tokens.

### 5. Ensamblaje de Prompts
- **Ubicación:** `App.tsx:handleReveal`.
- **Riesgo:** El orden de los modificadores afecta la interpretación de la IA.
- **Instrucción:** Si se cambia la UI, asegurar que las variables inyectadas en el prompt final se mantengan en el mismo orden lógico.
