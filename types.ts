
export interface FacialTraits {
  shape: string;
  eyes: string;
  nose: string;
  mouth: string;
  skin: string;
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
  provider: "manual" | "gemini" | "fal-ai";
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
  };
}

export interface PromptItem {
  id: string;
  title: string;
  finalPrompt: string;
  negativePrompt?: string;
  blocks: string[];
  createdAt: string;
  reference?: {
    previewImageBase64?: string;
    renderId?: string;
    outUrl?: string;
    thumbBase64?: string;
  };
  meta?: {
    provider: string;
    model?: string;
    seed?: number | string;
  };
}

export interface AnalysisItem {
  id: string; // ADN_XXXX
  traits: FacialTraits;
  analysisText?: string;
  timestamp: string;
  imageBase64?: string;
}

export interface AuditLog {
  type: 'ANALYZE_DONE' | 'LIB_POSE_CREATE' | 'REVEAL_DONE' | 'SAVE_PROMPT' | 'EXPORT_ZIP' | 'ANALYZE_START' | 'ANALYZE_ERROR' | 'COPY_PROMPT' | 'FINALIZE_RENDER' | 'SYSTEM_HEALTH' | 'STORAGE_WARNING' | 'DARKROOM_APPLIED' | 'REVEAL_REAL_DONE' | 'REVEAL_REAL_ERROR' | 'RETRY_ATTEMPT' | 'ANALYTICS_LOG' | 'IMAGE_EDIT_DONE';
  timestamp: string;
  details: string;
  severity?: 'info' | 'warning' | 'error';
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
  preferredProvider: 'gemini' | 'fal-ai';
  isThinkingMode: boolean;
}

export interface InternalState {
  version: string;
  poseBank: Pose[];
  promptLibrary: PromptItem[];
  analysisLibrary: AnalysisItem[];
  renderLibrary: RenderItem[];
  auditLog: AuditLog[];
  currentSession: CurrentSession;
  falApiKey?: string;
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

export interface RetryConfig {
  maxRetries: number;
  minAcceptableScore: number;
  retryDelay: number;
  improvementThreshold: number;
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
