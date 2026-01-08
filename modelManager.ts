
import { GoogleGenAI } from "@google/genai";

/**
 * STRATEGY: Cascaded Model Selection v1.6.0
 */
export const MODEL_LADDERS = {
  IMAGE: [
    "gemini-3-pro-image-preview",   // Elite
    "gemini-2.5-flash-image",       // Reliable
  ],
  ANALYSIS: [
    "gemini-3-pro-preview",         // Deep reasoning
    "gemini-3-flash-preview",       // Fast
  ]
};

export interface ExecutionResult<T> {
  result: T;
  usedModel: string;
}

/**
 * Executes an operation with fallback logic.
 * If modelNames is provided, it specifically uses those.
 */
export async function executeWithFallback<T>(
  ladderType: 'IMAGE' | 'ANALYSIS',
  operation: (modelName: string) => Promise<T>,
  modelNames?: string[]
): Promise<ExecutionResult<T>> {
  
  const models = modelNames || MODEL_LADDERS[ladderType];
  let lastError: any = null;

  for (const modelName of models) {
    try {
      console.log(`[Sentinel] Attempting: ${modelName}`);
      const result = await operation(modelName);
      return { result, usedModel: modelName };
    } catch (error: any) {
      const msg = error?.message?.toLowerCase() || "";
      const isQuota = msg.includes("429") || msg.includes("quota");
      const isNotFound = msg.includes("404") || msg.includes("not found");
      const isPermission = msg.includes("403") || msg.includes("permission") || msg.includes("denied");

      if (isQuota || isNotFound || isPermission) {
        console.warn(`[Sentinel] ${modelName} failed (${msg}). Falling back...`);
        lastError = error;
        continue; 
      }
      throw error; 
    }
  }

  throw lastError || new Error("No available models in current stack.");
}
