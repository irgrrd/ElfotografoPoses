
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

export interface DarkroomSettings {
  preset: string;
  strength: number;
  guidance: number;
  steps: number;
  customPrompt: string;
  validateOutput?: boolean;
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
  timestamp: string;
  imageBase64?: string;
}

export interface AuditLog {
  type: 'ANALYZE_DONE' | 'LIB_POSE_CREATE' | 'REVEAL_DONE' | 'SAVE_PROMPT' | 'EXPORT_ZIP' | 'ANALYZE_START' | 'ANALYZE_ERROR' | 'COPY_PROMPT' | 'FINALIZE_RENDER' | 'SYSTEM_HEALTH' | 'STORAGE_WARNING' | 'DARKROOM_APPLIED' | 'REVEAL_REAL_DONE' | 'REVEAL_REAL_ERROR';
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
  AUDIT = 'AUDIT'
}
