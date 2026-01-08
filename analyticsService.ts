
import { RevealResult } from './types';

export interface GenerationMetrics {
  sessionId: string;
  timestamp: string;
  strength: number;
  attempts: number;
  retriedDueToLowScore: boolean;
  finalMatchScore: number;
  validationLevel: string;
  success: boolean;
  processingTimeMs: number;
}

class AnalyticsService {
  private sessionId = `SESSION_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  private metrics: GenerationMetrics[] = [];
  private readonly STORAGE_KEY = 'fotografo_metrics_v1.5';
  
  constructor() {
    this.loadFromStorage();
  }
  
  private loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.metrics = data.metrics || [];
      }
    } catch (e) {
      console.error('Error loading metrics', e);
    }
  }
  
  private saveToStorage() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
      sessionId: this.sessionId,
      startTime: new Date().toISOString(),
      metrics: this.metrics
    }));
  }
  
  logGeneration(result: RevealResult, strength: number, timeMs: number) {
    this.metrics.push({
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      strength,
      attempts: result.attempts,
      retriedDueToLowScore: result.retriedDueToLowScore,
      finalMatchScore: result.finalScore,
      validationLevel: result.finalScore >= 85 ? 'good' : 'warning',
      success: result.success,
      processingTimeMs: timeMs
    });
    this.saveToStorage();
  }
  
  getSessionStats() {
    const total = this.metrics.length;
    const successful = this.metrics.filter(m => m.success).length;
    const avgScore = total ? this.metrics.reduce((s, m) => s + m.finalMatchScore, 0) / total : 0;
    const avgAttempts = total ? this.metrics.reduce((s, m) => s + m.attempts, 0) / total : 0;
    
    return {
      totalGenerations: total,
      successfulGenerations: successful,
      averageMatchScore: avgScore,
      averageAttempts: avgAttempts
    };
  }
  
  getStrengthDistribution() {
    const filterByStrength = (min: number, max: number) => {
      const arr = this.metrics.filter(m => m.strength >= min && m.strength < max);
      return {
        count: arr.length,
        avgScore: arr.length ? arr.reduce((s, m) => s + m.finalMatchScore, 0) / arr.length : 0
      };
    };
    
    return {
      low: filterByStrength(0, 0.3),
      medium: filterByStrength(0.3, 0.7),
      high: filterByStrength(0.7, 1.1)
    };
  }

  exportMetrics() {
    return JSON.stringify({
      session: this.getSessionStats(),
      distribution: this.getStrengthDistribution(),
      raw: this.metrics
    }, null, 2);
  }

  clearMetrics() {
    this.metrics = [];
    this.saveToStorage();
  }
}

export const analytics = new AnalyticsService();
