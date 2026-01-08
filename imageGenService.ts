
import { GoogleGenAI } from "@google/genai";
import { validateIdentityPreservation } from "./geminiService";
import { RenderItem, DarkroomSettings, RevealResult, RetryConfig, EngineMode } from "./types";
import { analytics } from "./analyticsService";
import { validateWithAdaptiveThresholds } from "./validationThresholds";
import { executeWithFallback } from "./modelManager";
import { resizeImage } from "./imageUtils";

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  minAcceptableScore: 85,
  retryDelay: 1000,
  improvementThreshold: 3
};

/**
 * PLATINUM ENGINE v1.6.0 - No Mocks
 */
export const generateRealImageGemini = async (
  architectPrompt: string,
  initImageBase64: string,
  settings: DarkroomSettings,
  mode: EngineMode = 'live'
): Promise<{ image: string, renderItem: RenderItem, usedModel: string }> => {
  
  // Choose model stack based on mode
  const stack = mode === 'live' 
    ? ["gemini-3-pro-image-preview", "gemini-2.5-flash-image"] // Pro tries both
    : ["gemini-2.5-flash-image"]; // Native/Live simple goes straight to flash

  const optimizedImageBase64 = await resizeImage(initImageBase64, 1024);

  const execution = await executeWithFallback('IMAGE', async (modelName) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemPrompt = `
SISTEMA: EL FOTÓGRAFO PLATINUM v1.6.0
TAREA: Revelado de sensor fotorrealista.
MODELO: ${modelName}

PRESERVAR SUJETO: Es crítico que el modelo sea idéntico al del negativo original.
ESQUEMA: ${architectPrompt}
ESTILO: Fotorrealismo de laboratorio, sin artefactos.
NOTAS DE CAMPO: ${settings.customPrompt}
`;

    const imageConfig: any = {
      aspectRatio: settings.aspectRatio,
    };

    // Only Pro models support specific imageSize
    if (!modelName.includes('flash')) {
      imageConfig.imageSize = settings.resolution;
    }

    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: optimizedImageBase64.split(',')[1] || optimizedImageBase64,
            },
          },
          { text: systemPrompt },
        ],
      },
      config: { imageConfig }
    });

    let generatedBase64 = "";
    const parts = response.candidates?.[0]?.content?.parts || [];
    for (const part of parts) {
      if (part.inlineData) {
        generatedBase64 = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!generatedBase64) throw new Error("No image data returned from Sensor.");

    let validation = undefined;
    if (settings.validateOutput) {
      validation = await validateIdentityPreservation(initImageBase64, generatedBase64);
    }

    const renderItem: RenderItem = {
      id: `REVELADO_${Date.now()}`,
      status: "final",
      provider: 'gemini',
      createdAt: new Date().toISOString(),
      finalPrompt: architectPrompt,
      outBase64: generatedBase64,
      metadata: {
        identityValidation: validation,
        strength: settings.strength,
        resolution: settings.resolution,
        aspectRatio: settings.aspectRatio,
        usedModel: modelName
      }
    };

    return { image: generatedBase64, renderItem };
  }, stack);

  return { ...execution.result, usedModel: execution.usedModel };
};

export const revealImageWithRetry = async (
  architectPrompt: string,
  initImageBase64: string,
  settings: DarkroomSettings,
  mode: EngineMode = 'live',
  onAttempt?: (attempt: number, score: number) => void
): Promise<RevealResult> => {
  const startTime = Date.now();
  let attempts = 0;
  let bestResult: { image: string, renderItem: RenderItem, usedModel: string } | null = null;
  let bestScore = 0;
  const allScores: number[] = [];
  const maxLoops = (settings.enableRetry && mode === 'live') ? DEFAULT_RETRY_CONFIG.maxRetries : 1;

  while (attempts < maxLoops) {
    attempts++;
    try {
      const { image, renderItem, usedModel } = await generateRealImageGemini(architectPrompt, initImageBase64, settings, mode);
      const currentScore = renderItem.metadata?.identityValidation?.matchScore || 0;
      allScores.push(currentScore);
      if (onAttempt) onAttempt(attempts, currentScore);

      if (currentScore > bestScore || attempts === 1) {
        bestScore = currentScore;
        bestResult = { image, renderItem, usedModel };
      }

      if (mode === 'offline') break; // Native/Free only one attempt for speed

      const validation = validateWithAdaptiveThresholds(currentScore, settings.strength);
      if (validation.isValid) break; 
      
      if (attempts < maxLoops) await new Promise(r => setTimeout(r, 1000));
    } catch (error) {
      if (attempts >= maxLoops) throw error;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  if (!bestResult) throw new Error("Revelado fallido.");

  const result: RevealResult = {
    success: bestScore >= 75 || mode === 'offline',
    renderItem: bestResult.renderItem,
    attempts,
    allScores,
    finalScore: bestScore,
    retriedDueToLowScore: attempts > 1
  };
  
  analytics.logGeneration(result, settings.strength, Date.now() - startTime);
  return result;
};

export const editWithNanoBanana = async (
  imageBase64: string,
  editPrompt: string
): Promise<string> => {
  const optimizedImage = await resizeImage(imageBase64, 1024);
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: optimizedImage.split(',')[1] || optimizedImage } },
        { text: `Modifica este negativo fotográfico: ${editPrompt}` },
      ],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  throw new Error("Edición fallida.");
};
