
import { GoogleGenAI } from "@google/genai";
import { validateIdentityPreservation } from "./geminiService";
import { RenderItem, DarkroomSettings, RevealResult, RetryConfig } from "./types";
import { analytics } from "./analyticsService";
import { validateWithAdaptiveThresholds } from "./validationThresholds";

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  minAcceptableScore: 85,
  retryDelay: 1000,
  improvementThreshold: 3
};

/**
 * MOTOR PLATINUM NATIVO - Gemini 3 Pro Image
 */
export const generateRealImageGemini = async (
  architectPrompt: string,
  initImageBase64: string,
  settings: DarkroomSettings
): Promise<{ image: string, renderItem: RenderItem }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemPrompt = `
SISTEMA: EL FOTÓGRAFO PLATINUM v1.5.0
TAREA: Revelado hiperrealista nativo.

REGLAS DE ORO:
- Debes preservar la identidad facial del sujeto de la imagen de referencia con un 100% de fidelidad.
- El estilo debe ser fotorrealista, evitando artefactos de IA.
- Sigue el blueprint: ${architectPrompt}
- Notas adicionales: ${settings.customPrompt}
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
        { text: systemPrompt },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: settings.aspectRatio as any,
        imageSize: settings.resolution as any
      }
    }
  });

  let generatedBase64 = "";
  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) {
      generatedBase64 = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }

  if (!generatedBase64) throw new Error("Fallo crítico: El motor nativo no devolvió un activo visual.");

  let validation = undefined;
  if (settings.validateOutput) {
    validation = await validateIdentityPreservation(initImageBase64, generatedBase64);
  }

  const renderItem: RenderItem = {
    id: `PLATINUM_${Date.now()}`,
    status: "final",
    provider: 'gemini',
    createdAt: new Date().toISOString(),
    finalPrompt: architectPrompt,
    outBase64: generatedBase64,
    metadata: {
      identityValidation: validation,
      strength: settings.strength,
      resolution: settings.resolution,
      aspectRatio: settings.aspectRatio
    }
  };

  return { image: generatedBase64, renderItem };
};

/**
 * EDICIÓN INTELIGENTE - Gemini 2.5 Flash Image
 */
export const editWithNanoBanana = async (
  imageBase64: string,
  editPrompt: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64.split(',')[1] || imageBase64 } },
        { text: `Modifica esta fotografía manteniendo el fotorrealismo: ${editPrompt}` },
      ],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("Fallo en edición Flash.");
};

export const revealImageWithRetry = async (
  architectPrompt: string,
  initImageBase64: string,
  settings: DarkroomSettings,
  onAttempt?: (attempt: number, score: number) => void
): Promise<RevealResult> => {
  const startTime = Date.now();
  let attempts = 0;
  let bestResult: { image: string, renderItem: RenderItem } | null = null;
  let bestScore = 0;
  const allScores: number[] = [];
  const maxLoops = settings.enableRetry ? DEFAULT_RETRY_CONFIG.maxRetries : 1;

  while (attempts < maxLoops) {
    attempts++;
    try {
      const { image, renderItem } = await generateRealImageGemini(architectPrompt, initImageBase64, settings);
      const currentScore = renderItem.metadata?.identityValidation?.matchScore || 0;
      allScores.push(currentScore);
      if (onAttempt) onAttempt(attempts, currentScore);

      if (currentScore > bestScore) {
        bestScore = currentScore;
        bestResult = { image, renderItem };
      }

      // Sentinel Adaptive Validation
      const validation = validateWithAdaptiveThresholds(currentScore, settings.strength);
      if (validation.isValid) break; 
      
      if (attempts < maxLoops) await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      if (attempts >= maxLoops) throw error;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!bestResult) throw new Error("Fallo en el pipeline de revelado.");

  const result: RevealResult = {
    success: bestScore >= 75,
    renderItem: bestResult.renderItem,
    attempts,
    allScores,
    finalScore: bestScore,
    retriedDueToLowScore: attempts > 1
  };
  
  analytics.logGeneration(result, settings.strength, Date.now() - startTime);
  return result;
};

export const generateRealImageFal = async (apiKey: string, prompt: string, initImageBase64: string, strength: number, guidance: number, steps: number): Promise<string> => {
  if (!apiKey) throw new Error("API Key Fal requerida");
  // Fix: Remove duplicate 'Content-Type' and ensure only correct headers are sent.
  const response = await fetch('https://fal.ai/models/fal-ai/flux/dev/image-to-image/api', {
    method: 'POST',
    headers: { 
      'Authorization': `Key ${apiKey}`, 
      'Content-Type': 'application/json' 
    },
    body: JSON.stringify({ prompt, image_url: initImageBase64, strength, guidance_scale: guidance, num_inference_steps: steps })
  });
  const data = await response.json();
  return data.image?.url || data.images?.[0]?.url || "";
};
