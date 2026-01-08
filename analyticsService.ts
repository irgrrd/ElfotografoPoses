
export interface GenerationMetrics {
  sessionId: string;
  timestamp: string;
  strength: number;
  attempts: number;
  retriedDueToLowScore: boolean;
  finalMatchScore: number;
  allMatchScores: number[];
  facialFeatureScores: {
    faceShape: number;
    eyes: number;
    nose: number;
    mouth: number;
    overall: number;
  };
  validationLevel: 'excellent' | 'good' | 'warning' | 'failed';
  success: boolean;
  processingTimeMs: number;
  modelUsed: string;
  warnings: string[];
}

export interface SessionAnalytics {
  sessionId: string;
  startTime: string;
  generations: GenerationMetrics[];
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  averageMatchScore: number;
  averageAttempts: number;
  totalProcessingTime: number;
}

class AnalyticsService {
  private sessionId: string;
  private sessionStartTime: string;
  private metrics: GenerationMetrics[] = [];
  
  constructor() {
    this.sessionId = `SESSION_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.sessionStartTime = new Date().toISOString();
    this.loadMetricsFromStorage();
  }
  
  private loadMetricsFromStorage(): void {
    try {
      const stored = localStorage.getItem('fotografo_metrics');
      if (stored) {
        const data = JSON.parse(stored);
        this.metrics = data.metrics || [];
      }
    } catch (error) {
      console.error('Error cargando métricas:', error);
    }
  }
  
  private saveMetricsToStorage(): void {
    try {
      const data = {
        sessionId: this.sessionId,
        startTime: this.sessionStartTime,
        metrics: this.metrics
      };
      localStorage.setItem('fotografo_metrics', JSON.stringify(data));
    } catch (error) {
      console.error('Error guardando métricas:', error);
    }
  }
  
  logGeneration(
    revealResult: any,
    strength: number,
    processingTimeMs: number,
    modelUsed: string = 'gemini-3-pro-image'
  ): void {
    const validation = revealResult.renderItem?.metadata?.identityValidation;
    
    const metric: GenerationMetrics = {
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      strength,
      attempts: revealResult.attempts,
      retriedDueToLowScore: revealResult.retriedDueToLowScore,
      finalMatchScore: revealResult.finalScore,
      allMatchScores: revealResult.allScores,
      facialFeatureScores: validation?.facialFeatures || {
        faceShape: 0,
        eyes: 0,
        nose: 0,
        mouth: 0,
        overall: 0
      },
      validationLevel: this.getValidationLevel(revealResult.finalScore),
      success: revealResult.success,
      processingTimeMs,
      modelUsed,
      warnings: validation?.warnings || []
    };
    
    this.metrics.push(metric);
    this.saveMetricsToStorage();
  }
  
  private getValidationLevel(score: number): 'excellent' | 'good' | 'warning' | 'failed' {
    if (score >= 95) return 'excellent';
    if (score >= 85) return 'good';
    if (score >= 75) return 'warning';
    return 'failed';
  }
  
  getSessionStats(): SessionAnalytics {
    const totalGenerations = this.metrics.length;
    const successfulGenerations = this.metrics.filter(m => m.success).length;
    const failedGenerations = totalGenerations - successfulGenerations;
    
    const averageMatchScore = totalGenerations > 0
      ? this.metrics.reduce((sum, m) => sum + m.finalMatchScore, 0) / totalGenerations
      : 0;
    
    const averageAttempts = totalGenerations > 0
      ? this.metrics.reduce((sum, m) => sum + m.attempts, 0) / totalGenerations
      : 0;
    
    const totalProcessingTime = this.metrics.reduce((sum, m) => sum + m.processingTimeMs, 0);
    
    return {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime,
      generations: this.metrics,
      totalGenerations,
      successfulGenerations,
      failedGenerations,
      averageMatchScore,
      averageAttempts,
      totalProcessingTime
    };
  }

  getStrengthDistribution() {
    const low = this.metrics.filter(m => m.strength < 0.3);
    const medium = this.metrics.filter(m => m.strength >= 0.3 && m.strength < 0.7);
    const high = this.metrics.filter(m => m.strength >= 0.7);
    
    return {
      low: {
        count: low.length,
        avgScore: low.length > 0 ? low.reduce((s, m) => s + m.finalMatchScore, 0) / low.length : 0
      },
      medium: {
        count: medium.length,
        avgScore: medium.length > 0 ? medium.reduce((s, m) => s + m.finalMatchScore, 0) / medium.length : 0
      },
      high: {
        count: high.length,
        avgScore: high.length > 0 ? high.reduce((s, m) => s + m.finalMatchScore, 0) / high.length : 0
      }
    };
  }
  
  getCommonFailureReasons() {
    const warningCounts = new Map<string, number>();
    this.metrics
      .filter(m => !m.success)
      .forEach(m => {
        m.warnings.forEach(warning => {
          warningCounts.set(warning, (warningCounts.get(warning) || 0) + 1);
        });
      });
    
    return Array.from(warningCounts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }

  clearMetrics(): void {
    this.metrics = [];
    this.saveMetricsToStorage();
  }
}

export const analytics = new AnalyticsService();
