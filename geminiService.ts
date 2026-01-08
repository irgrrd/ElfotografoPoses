
import { GoogleGenAI, Type } from "@google/genai";
import { FacialTraits, IdentityValidation } from "./types";

export const analyzeFaceImage = async (base64Image: string): Promise<FacialTraits> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';
  
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
        {
          text: `ROLE: EL FOTÓGRAFO Vision Architect. 
          Extrae el ADN facial y físico exacto para una reproducción por IA sin pérdida de detalles.
          Devuelve un objeto JSON estrictamente formateado. 
          La propiedad 'features' debe ser un array de strings que describan marcas, cicatrices, tatuajes, piercings, detalles del vello facial o geometría facial única.`,
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          shape: { type: Type.STRING, description: "Forma facial detallada (ej. ovalada, mandíbula estructurada)" },
          eyes: { type: Type.STRING, description: "Color de ojos, forma del párpado y detalles de pestañas" },
          nose: { type: Type.STRING, description: "Estructura del puente nasal y forma de la punta" },
          mouth: { type: Type.STRING, description: "Grosor de labios, arco de cupido y expresión predeterminada" },
          skin: { type: Type.STRING, description: "Tono de piel, subtono y textura aparente" },
          features: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "Array de rasgos distintivos" 
          },
        },
        required: ["shape", "eyes", "nose", "mouth", "skin", "features"],
      },
    },
  });

  try {
    const jsonStr = response.text.trim();
    const json = JSON.parse(jsonStr);
    return json as FacialTraits;
  } catch (e) {
    throw new Error("Error al extraer el ADN arquitectónico: " + response.text);
  }
};

/**
 * Valida que la imagen generada mantenga la identidad del sujeto original
 */
export const validateIdentityPreservation = async (
  originalImage: string,
  generatedImage: string
): Promise<IdentityValidation> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const model = 'gemini-3-flash-preview';

  const validationPrompt = `
TAREA: Análisis de Preservación de Identidad Facial

IMAGEN 1 (ORIGINAL): Sujeto de referencia
IMAGEN 2 (GENERADA): Resultado a validar

ANÁLISIS REQUERIDO:
Compara ambas imágenes y determina si representan a la MISMA persona.

Evalúa similitud (0-100) en:
1. Forma del rostro (estructura ósea)
2. Ojos (forma, tamaño, color, separación)
3. Nariz (forma, tamaño, ángulo)
4. Boca (forma de labios, tamaño)
5. Similitud general

IMPORTANTE: Devuelve un JSON estrictamente válido.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { text: validationPrompt },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: originalImage.replace(/^data:image\/\w+;base64,/, '')
            }
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: generatedImage.replace(/^data:image\/\w+;base64,/, '')
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isSamePerson: { type: Type.BOOLEAN },
            matchScore: { type: Type.NUMBER },
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
            warnings: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["isSamePerson", "matchScore", "facialFeatures", "warnings"]
        }
      }
    });

    const validation = JSON.parse(response.text.trim());
    
    return {
      matchScore: validation.matchScore,
      isValid: validation.isSamePerson && validation.matchScore >= 85,
      warnings: validation.warnings || [],
      facialFeatures: validation.facialFeatures
    };
    
  } catch (error) {
    console.error("Error en validación de identidad:", error);
    return {
      matchScore: 0,
      isValid: false,
      warnings: ["Error al validar identidad"],
      facialFeatures: {
        faceShape: 0,
        eyes: 0,
        nose: 0,
        mouth: 0,
        overall: 0
      }
    };
  }
};
