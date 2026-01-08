
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
  
  static adjustForImageQuality(
    baseThresholds: ValidationThresholds,
    imageQualityScore: number // 0-100
  ): ValidationThresholds {
    if (imageQualityScore >= 80) return baseThresholds;
    
    const penalty = imageQualityScore >= 60 ? 3 : 8;
    return {
      excellent: baseThresholds.excellent - penalty,
      good: baseThresholds.good - penalty,
      warning: baseThresholds.warning - penalty,
      failed: baseThresholds.failed - penalty
    };
  }
}

export const validateWithAdaptiveThresholds = (
  matchScore: number,
  strength: number,
  imageQuality: number = 80
) => {
  const adaptive = ThresholdManager.getAdaptiveThresholds(strength);
  const thresholds = ThresholdManager.adjustForImageQuality(adaptive, imageQuality);
  
  let level: 'excellent' | 'good' | 'warning' | 'failed' = 'failed';
  if (matchScore >= thresholds.excellent) level = 'excellent';
  else if (matchScore >= thresholds.good) level = 'good';
  else if (matchScore >= thresholds.warning) level = 'warning';
  
  const isValid = level === 'excellent' || level === 'good';
  
  return {
    isValid,
    level,
    thresholds: { ...thresholds, reason: adaptive.reason, adjustmentFactor: adaptive.adjustmentFactor },
    message: `Validación ${level.toUpperCase()} (Score: ${matchScore}%, Requerido: ${thresholds.good}%)`
  };
};
