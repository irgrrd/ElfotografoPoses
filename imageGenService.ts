
import { GoogleGenAI } from "@google/genai";
import { validateIdentityPreservation } from "./geminiService";
import { RenderItem } from "./types";

/**
 * Genera instrucciones de fidelidad basadas en el valor de strength (0-100)
 */
const generateFidelityInstructions = (strength: number): string => {
  // Strength controla TRANSFORMACIÓN, NO identidad
  
  if (strength < 30) {
    return `MODO: RETOQUE SUTIL
    
TRANSFORMACIÓN:
- Mantén la pose original con ajustes mínimos (máximo 15% de cambio)
- Iluminación: ajustes sutiles, preserva la luz original
- Fondo: mantén o mejora levemente el entorno actual
- Estilo: naturalista, sin filtros dramáticos

IDENTIDAD FACIAL (OBLIGATORIO):
- Preserva al 100% todos los rasgos faciales
- Mantén estructura ósea exacta
- Conserva forma y color de ojos
- Mantén forma de nariz y boca
- Preserva tono de piel
- Conserva marcas faciales (lunares, pecas, cicatrices)`;
  }
  
  if (strength < 70) {
    return `MODO: TRANSFORMACIÓN BALANCEADA
    
TRANSFORMACIÓN:
- Pose: permite cambios moderados (30-50% de cambio)
- Iluminación: creatividad moderada, nuevos ángulos de luz
- Fondo: puedes cambiar completamente el entorno
- Estilo: aplica filtros artísticos moderados

IDENTIDAD FACIAL (OBLIGATORIO - PRIORIDAD MÁXIMA):
- La identidad facial es SAGRADA y debe preservarse al 100%
- Mantén EXACTAMENTE: estructura ósea, ojos, nariz, boca, orejas
- Preserva tono de piel y textura
- Conserva todas las marcas distintivas del rostro
- El sujeto debe ser CLARAMENTE reconocible como la misma persona`;
  }
  
  return `MODO: TRANSFORMACIÓN DRAMÁTICA
  
TRANSFORMACIÓN MÁXIMA PERMITIDA:
- Pose: cambio radical y dinámico (hasta 80% diferente)
- Iluminación: creatividad total, efectos dramáticos
- Fondo: escenario completamente nuevo y creativo
- Estilo: aplica filtros artísticos avanzados, efectos especiales
- Composición: ángulos cinematográficos, perspectivas únicas

⚠️ REGLA ABSOLUTA DE IDENTIDAD (NO NEGOCIABLE):
La identidad facial del sujeto es INMUTABLE bajo cualquier circunstancia.

ELEMENTOS QUE DEBES PRESERVAR AL 100%:
1. Estructura ósea del rostro (mandíbula, pómulos, frente)
2. Forma exacta y color de los ojos
3. Forma y tamaño de la nariz
4. Forma de la boca y labios
5. Forma de las orejas
6. Tono de piel base
7. Textura de la piel
8. Todas las marcas faciales distintivas (lunares, pecas, cicatrices, arrugas características)

IMPORTANTE: Aunque la pose, iluminación y entorno cambien radicalmente, 
cualquier persona que conozca al sujeto original debe poder identificarlo 
inmediatamente en la imagen generada. La identidad facial NO es negociable.`;
};

/**
 * MOTOR NATIVO EL FOTÓGRAFO v1.3.1
 * Flujo: Image + Text Part -> Multimodal Generation
 */
export const generateRealImageGemini = async (
  architectPrompt: string,
  initImageBase64: string,
  strengthValue: number // Expects 0-1
): Promise<{ image: string, renderItem: RenderItem }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const strengthPercent = strengthValue * 100;
  
  const fidelityInstructions = generateFidelityInstructions(strengthPercent);

  const revelationPrompt = `
SISTEMA: MOTOR DE REVELADO NATIVO "EL FOTÓGRAFO" v1.3.1 PLATINUM

⚠️ DIRECTIVA PRINCIPAL IRREVOCABLE:
La IDENTIDAD FACIAL del sujeto es SAGRADA. Bajo ninguna circunstancia 
modifiques los rasgos faciales que hacen reconocible al sujeto.

IMAGEN BASE (ADN):
La imagen proporcionada contiene al sujeto cuya identidad DEBES preservar 
al 100%. Analiza cuidadosamente sus rasgos faciales únicos.

BLUEPRINT DE TRANSFORMACIÓN:
${architectPrompt}

${fidelityInstructions}

INSTRUCCIONES DE EJECUCIÓN:
1. ANALIZA los rasgos faciales únicos del sujeto en la imagen base
2. APLICA la transformación de pose, iluminación y entorno según el blueprint
3. GENERA la imagen respetando el blueprint PERO manteniendo la identidad facial intacta
4. VERIFICA que el resultado sea reconocible como la misma persona

ESPECIFICACIONES TÉCNICAS:
- Resolución: 2048x2048 (2K)
- Calidad: Máxima definición fotorrealista
- Formato: Composición profesional según blueprint

RECORDATORIO FINAL:
Si en algún momento hay conflicto entre "creatividad/transformación" y 
"preservación de identidad", SIEMPRE prioriza la preservación de identidad.
`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: initImageBase64.split(',')[1] || initImageBase64,
          },
        },
        { text: revelationPrompt },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
        imageSize: "2K"
      }
    }
  });

  let generatedImage = "";
  const parts = response.candidates?.[0]?.content?.parts;
  if (parts) {
    for (const part of parts) {
      if (part.inlineData) {
        generatedImage = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }
  }

  if (!generatedImage) {
    throw new Error("El motor nativo no devolvió un activo visual.");
  }

  // Validar Identidad
  const validation = await validateIdentityPreservation(initImageBase64, generatedImage);

  const renderId = `PLATINUM_${Date.now()}`;
  const renderItem: RenderItem = {
    id: renderId,
    status: "final",
    provider: 'gemini',
    createdAt: new Date().toISOString(),
    finalPrompt: architectPrompt,
    outBase64: generatedImage,
    darkroomApplied: true,
    metadata: {
      identityValidation: validation,
      strength: strengthValue,
      timestamp: new Date().toISOString(),
      promptUsed: revelationPrompt
    }
  };

  return { image: generatedImage, renderItem };
};

export const generateRealImageFal = async (
  apiKey: string,
  prompt: string,
  initImageBase64: string,
  strength: number,
  guidance: number,
  steps: number
): Promise<string> => {
  if (!apiKey) throw new Error("Requiere API Key de Fal.ai");

  const response = await fetch('https://fal.ai/models/fal-ai/flux/dev/image-to-image/api', {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      image_url: initImageBase64,
      strength,
      guidance_scale: guidance,
      num_inference_steps: steps,
    })
  });

  if (!response.ok) throw new Error("Error en servicio externo Fal.ai");
  const data = await response.json();
  return data.image?.url || data.images?.[0]?.url || "";
};
