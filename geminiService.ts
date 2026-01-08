
import { GoogleGenAI, Type } from "@google/genai";
import { FacialTraits, IdentityValidation } from "./types";

/**
 * ESTRATEGIA DE ANÁLISIS PRO THINKING v1.4.5
 * Extrae el ADN facial con razonamiento profundo.
 */
export const analyzeFaceImage = async (base64Image: string, useThinking: boolean = true): Promise<{ traits: FacialTraits, analysisText: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';
  
  const systemInstruction = `ERES EL FOTÓGRAFO - ANALISTA BIOMÉTRICO v1.4.5.
Tu misión es extraer el "ADN facial" de la imagen proporcionada.
Analiza: geometría ósea, micro-asimetrías, rasgos únicos y condiciones lumínicas de origen.
Realiza un razonamiento técnico profundo sobre la estructura del sujeto antes de generar el JSON final.`;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image.split(',')[1] || base64Image,
          },
        },
        { text: "Ejecuta un análisis forense de identidad y devuelve el ADN facial estructurado en JSON." },
      ],
    },
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      thinkingConfig: useThinking ? { thinkingBudget: 32768 } : undefined,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          shape: { type: Type.STRING },
          eyes: { type: Type.STRING },
          nose: { type: Type.STRING },
          mouth: { type: Type.STRING },
          skin: { type: Type.STRING },
          features: { type: Type.ARRAY, items: { type: Type.STRING } },
          analysisText: { type: Type.STRING, description: "Desglose técnico del razonamiento profundo" }
        },
        required: ["shape", "eyes", "nose", "mouth", "skin", "features", "analysisText"],
      },
    },
  });

  try {
    const json = JSON.parse(response.text.trim());
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
  } catch (e) {
    console.error("Fallo en extracción de ADN:", e);
    throw new Error("El motor Pro no pudo estructurar el ADN facial. Verifique la calidad de la imagen.");
  }
};

/**
 * VALIDACIÓN BIOMÉTRICA NATIVA
 */
export const validateIdentityPreservation = async (
  originalImage: string,
  generatedImage: string
): Promise<IdentityValidation> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { text: "Compara estas dos imágenes. Determina si el sujeto es la misma persona basándote en su estructura facial inmutable." },
        { inlineData: { mimeType: "image/jpeg", data: originalImage.split(',')[1] || originalImage } },
        { inlineData: { mimeType: "image/jpeg", data: generatedImage.split(',')[1] || generatedImage } }
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
};
