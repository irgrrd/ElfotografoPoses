
import { GoogleGenAI, Type } from "@google/genai";
import { FacialTraits, IdentityValidation } from "./types";

/**
 * ESTRATEGIA DE ANÁLISIS PRO THINKING v1.4.5
 * Extrae el ADN facial con razonamiento profundo sobre la anatomía del sujeto.
 */
export const analyzeFaceImage = async (base64Image: string, useThinking: boolean = true): Promise<{ traits: FacialTraits, analysisText: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-pro-preview';
  
  const systemInstruction = `ERES EL FOTÓGRAFO - ANALISTA BIOMÉTRICO v1.4.5.
Tu misión es extraer el "ADN facial" de la imagen proporcionada.
Analiza con rigor forense: geometría ósea, micro-asimetrías, rasgos oculares y cutáneos.
Realiza un razonamiento técnico profundo sobre la estructura del sujeto antes de generar el JSON final. 
IMPORTANTE: El JSON debe ser la única salida.`;

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
  } catch (e) {
    console.error("Fallo en extracción de ADN:", e);
    throw new Error("El motor Pro no pudo estructurar el ADN facial. Verifique la nitidez del retrato.");
  }
};

/**
 * VALIDACIÓN BIOMÉTRICA NATIVA
 * Compara dos imágenes para verificar la preservación de identidad.
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
        { text: "Compara estas dos imágenes. Determina si el sujeto es la misma persona basándote en su estructura facial inmutable. Ignora cambios de ropa o fondo." },
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

  const text = response.text || "";
  return JSON.parse(text.trim());
};
