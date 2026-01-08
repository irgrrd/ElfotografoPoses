
import { GoogleGenAI, Type } from "@google/genai";
import { FacialTraits, IdentityValidation, EngineMode } from "./types";
import { executeWithFallback } from "./modelManager";
import { resizeImage } from "./imageUtils";

/**
 * BIOMETRIC ANALYSIS ENGINE v1.6.0
 */
export const analyzeFaceImage = async (
  base64Image: string, 
  useThinking: boolean = true,
  mode: EngineMode = 'live'
): Promise<{ traits: FacialTraits, analysisText: string, usedModel: string }> => {
  
  const optimizedImage = await resizeImage(base64Image, 1024);

  // We use Pro preview for all analysis as it's the most capable for biometric traits
  const stack = ["gemini-3-pro-preview", "gemini-3-flash-preview"];

  const execution = await executeWithFallback('ANALYSIS', async (modelName) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const systemInstruction = `ERES EL FOTÓGRAFO - ANALISTA BIOMÉTRICO v1.6.0.
Tu misión es extraer el "ADN facial" de la imagen proporcionada.
Analiza con rigor forense: geometría ósea, micro-asimetrías, rasgos oculares y cutáneos.
Realiza un razonamiento técnico profundo antes de generar el JSON final. 
IMPORTANTE: El JSON debe ser la única salida.`;

    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: optimizedImage.split(',')[1] || optimizedImage,
            },
          },
          { text: "Extraer ADN facial en formato JSON." },
        ],
      },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        thinkingConfig: (useThinking && modelName.includes('pro')) ? { thinkingBudget: 24576 } : undefined,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            shape: { type: Type.STRING },
            eyes: { type: Type.STRING },
            nose: { type: Type.STRING },
            mouth: { type: Type.STRING },
            skin: { type: Type.STRING },
            features: { type: Type.ARRAY, items: { type: Type.STRING } },
            analysisText: { type: Type.STRING, description: "Technical reasoning for the ADN" }
          },
          required: ["shape", "eyes", "nose", "mouth", "skin", "features", "analysisText"],
        },
      },
    });

    const text = response.text || "";
    const json = JSON.parse(text.trim());
    return {
      traits: {
        shape: json.shape,
        eyes: json.eyes,
        nose: json.nose,
        mouth: json.mouth,
        skin: json.skin,
        features: json.features
      },
      analysisText: json.analysisText
    };
  }, stack);

  return { ...execution.result, usedModel: execution.usedModel };
};

export const validateIdentityPreservation = async (
  originalImage: string,
  generatedImage: string
): Promise<IdentityValidation> => {
  const optOriginal = await resizeImage(originalImage, 512);
  const optGenerated = await resizeImage(generatedImage, 512);

  const execution = await executeWithFallback('ANALYSIS', async (modelName) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { text: "Determina si el sujeto es la misma persona basándote en su estructura facial." },
          { inlineData: { mimeType: "image/jpeg", data: optOriginal.split(',')[1] || optOriginal } },
          { inlineData: { mimeType: "image/jpeg", data: optGenerated.split(',')[1] || optGenerated } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            matchScore: { type: Type.NUMBER },
            isSamePerson: { type: Type.BOOLEAN },
            facialFeatures: {
              type: Type.OBJECT,
              properties: {
                faceShape: { type: Type.NUMBER },
                eyes: { type: Type.NUMBER },
                nose: { type: Type.NUMBER },
                mouth: { type: Type.NUMBER },
                overall: { type: Type.NUMBER }
              },
              required: ["faceShape", "eyes", "nose", "mouth", "overall"]
            },
            warnings: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["matchScore", "isSamePerson", "facialFeatures", "warnings"]
        }
      }
    });

    return JSON.parse(response.text.trim());
  });

  return execution.result;
};
