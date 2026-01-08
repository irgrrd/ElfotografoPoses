
export interface FacialTraits {
  shape: string;
  eyes: string;
  nose?: string;
  mouth?: string;
  skin?: string;
  features: string[];
}

export interface IdentityValidation {
  matchScore: number;
  isValid: boolean;
  warnings: string[];
  facialFeatures: {
    faceShape: number;
    eyes: number;
    nose: number;
    mouth: number;
    overall: number;
  };
}

export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9";
export type ImageSize = "1K" | "2K" | "4K";
export type QualityTier = 'free' | 'premium';
export type EngineMode = 'offline' | 'live';
export type FocalLength = '35mm' | '50mm' | '85mm';
export type FilmStock = 'Standard Digital' | 'Portra 400' | 'Ilford HP5' | 'CineStill 800T';

export interface GearSettings {
  focalLength: FocalLength;
  filmStock: FilmStock;
}

export interface DarkroomSettings {
  preset: string;
  strength: number;
  guidance: number;
  steps: number;
  customPrompt: string;
  resolution: ImageSize;
  aspectRatio: AspectRatio;
  identityProtection: 'maximum' | 'balanced' | 'creative';
  validateOutput: boolean;
  enableRetry?: boolean;
}

export interface Pose {
  id: string;
  name: string;
  prompt: string;
  optics: {
    lensMm: string;
    angle: string;
  };
  negative?: string;
}

export interface RenderItem {
  id: string;
  status: "draft" | "final";
  provider: "manual" | "gemini" | "fal-ai" | "mock";
  model?: string;
  seed?: string | number;
  createdAt: string;
  finalPrompt: string;
  outUrl?: string;
  outBase64?: string;
  thumbBase64?: string;
  promptId?: string;
  darkroomApplied?: boolean;
  metadata?: {
    identityValidation?: IdentityValidation;
    strength?: number;
    timestamp?: string;
    promptUsed?: string;
    resolution?: string;
    aspectRatio?: string;
    protectionMode?: string;
    attempts?: number;
    allScores?: number[];
    usedModel?: string;
    isMock?: boolean;
    gear?: GearSettings;
    engineMode?: EngineMode;
  };
}

export interface AnalysisItem {
  id: string;
  traits: FacialTraits;
  analysisText?: string;
  timestamp: string;
  imageBase64?: string;
}

export interface CurrentSession {
  facialTraits: FacialTraits | null;
  facialId: string | null;
  currentPose: Pose | null;
  currentStyle: 'natural' | 'studio' | 'noir' | 'neon';
  currentSkin: 'natural' | 'event' | 'raw';
  currentContext: string;
  previewImage?: string;
  darkroomSettings: DarkroomSettings;
  gearSettings: GearSettings;
  preferredProvider: 'gemini' | 'fal-ai';
  isThinkingMode: boolean;
}

export type AuditEventType =
  | 'LENS_SET'
  | 'FILM_SET'
  | 'REVEAL_START'
  | 'REVEAL_SUCCESS'
  | 'REVEAL_FAIL'
  | 'RENDER_SAVE'
  | 'SESSION_CLEAR'
  | 'HISTORY_CLEAR'
  | 'ANALYSIS_ADD';

export interface AuditEvent {
  id: string;
  ts: number;
  type: AuditEventType;
  label: string;
  payload?: Record<string, unknown>;
  sessionId?: string;
}

// Added InternalState to resolve import error in App.tsx
export interface InternalState {
  version: string;
  poseBank: Pose[];
  promptLibrary: any[];
  analysisLibrary: AnalysisItem[];
  renderLibrary: RenderItem[];
  savedRenders: RenderItem[];
  auditLog: AuditEvent[];
  currentSession: CurrentSession;
}

export enum ViewMode {
  ANALYSIS = 'ANALYSIS',
  ARCHITECT = 'ARCHITECT',
  DARKROOM = 'DARKROOM',
  ENGINE = 'ENGINE',
  LIBRARY = 'LIBRARY',
  RENDER_VAULT = 'RENDER_VAULT',
  AUDIT = 'AUDIT',
  GUIDE = 'GUIDE',
  ANALYTICS = 'ANALYTICS'
}

export interface RevealResult {
  success: boolean;
  renderItem: RenderItem;
  attempts: number;
  allScores: number[];
  finalScore: number;
  retriedDueToLowScore: boolean;
  error?: string;
}

export interface RetryConfig {
  maxRetries: number;
  minAcceptableScore: number;
  retryDelay: number;
  improvementThreshold: number;
}
