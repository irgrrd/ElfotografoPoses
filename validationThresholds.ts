
export interface ValidationThresholds {
  excellent: number;
  good: number;
  warning: number;
  failed: number;
}

export interface AdaptiveThresholds extends ValidationThresholds {
  reason: string;
  adjustmentFactor: number;
}

export class ThresholdManager {
  private static readonly BASE_THRESHOLDS: ValidationThresholds = {
    excellent: 95,
    good: 85,
    warning: 75,
    failed: 75
  };
  
  static getAdaptiveThresholds(strength: number): AdaptiveThresholds {
    if (strength < 0.3) {
      return {
        excellent: 98,
        good: 95,
        warning: 90,
        failed: 90,
        reason: 'Strength bajo: se espera preservación casi perfecta',
        adjustmentFactor: 1.1
      };
    }
    
    if (strength >= 0.3 && strength < 0.7) {
      return {
        ...this.BASE_THRESHOLDS,
        reason: 'Strength medio: umbrales estándar',
        adjustmentFactor: 1.0
      };
    }
    
    return {
      excellent: 92,
      good: 82,
      warning: 72,
      failed: 72,
      reason: 'Strength alto: transformación dramática, umbrales ajustados',
      adjustmentFactor: 0.95
    };
  }
  
  static getValidationLevel(score: number, thresholds: ValidationThresholds): 'excellent' | 'good' | 'warning' | 'failed' {
    if (score >= thresholds.excellent) return 'excellent';
    if (score >= thresholds.good) return 'good';
    if (score >= thresholds.warning) return 'warning';
    return 'failed';
  }
}

export const validateWithAdaptiveThresholds = (
  matchScore: number,
  strength: number,
  imageQuality: number = 80
) => {
  const adaptive = ThresholdManager.getAdaptiveThresholds(strength);
  
  // Apply a small penalty for lower image quality if needed (simplified)
  const penalty = imageQuality < 60 ? 5 : 0;
  const thresholds = {
    excellent: adaptive.excellent - penalty,
    good: adaptive.good - penalty,
    warning: adaptive.warning - penalty,
    failed: adaptive.failed - penalty
  };

  const level = ThresholdManager.getValidationLevel(matchScore, thresholds);
  const isValid = level === 'excellent' || level === 'good';
  
  const messages = {
    excellent: '🏆 Identidad perfecta',
    good: '✅ Identidad preservada',
    warning: '⚠️ Variaciones detectadas',
    failed: '❌ Fallo de identidad'
  };

  return {
    isValid,
    level,
    thresholds: { ...thresholds, reason: adaptive.reason },
    message: `${messages[level]} (Score: ${matchScore}%)`
  };
};
