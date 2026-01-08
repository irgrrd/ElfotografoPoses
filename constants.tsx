
import React from 'react';
import { Pose } from './types';

export const INITIAL_POSES: Pose[] = [
  { id: 'SIT-01', name: 'Asiento de Poder Ejecutivo', prompt: 'sentado erguido en un escritorio de caoba, manos entrelazadas, presencia de mando', optics: { lensMm: '85', angle: 'a nivel de los ojos' } },
  { id: 'SIT-02', name: 'Inclinación Casual', prompt: 'apoyado en una silla moderna de mediados de siglo, postura relajada, ambiente informal', optics: { lensMm: '50', angle: 'a nivel de los ojos' } },
  { id: 'SIT-03', name: 'El Pensador', prompt: 'sentado hacia adelante, mano en la barbilla, contemplación profunda', optics: { lensMm: '85', angle: 'ligeramente alto' } },
  { id: 'STD-01', name: 'Postura de Poder', prompt: 'de pie, manos en las caderas, pose de superhéroe confiado', optics: { lensMm: '35', angle: 'ángulo bajo' } },
  { id: 'STD-02', name: 'Brazos Cruzados', prompt: 'de pie con los brazos cruzados, desafío amistoso', optics: { lensMm: '50', angle: 'a nivel de los ojos' } },
  { id: 'PRT-01', name: 'Primer Plano Intenso', prompt: 'retrato de primer plano extremo, mirada intensa, ojos profundos', optics: { lensMm: '105', angle: 'a nivel de los ojos' } },
  { id: 'PRT-02', name: 'Silueta de Perfil', prompt: 'perfil lateral, iluminación de contorno dramática, silueta', optics: { lensMm: '85', angle: 'perfil' } },
  { id: 'PRT-03', name: 'Luz Rembrandt', prompt: 'retratística clásica, iluminación Rembrandt, sombras artísticas', optics: { lensMm: '85', angle: '45 grados' } }
];

export const PROVIDERS = [
  { 
    id: 'gemini', 
    name: 'Gemini Native', 
    description: 'Motor Multimodal Embebido (Imagen 3 / 2K). Sin coste de API externa. Incluye protección SynthID.', 
    icon: '✨',
    badge: 'RECOMENDADO'
  },
  { 
    id: 'fal-ai', 
    name: 'Fal.ai Flux', 
    description: 'Motor Externo Flux.1 [Dev]. Requiere API Key de terceros configurada en Ajustes.', 
    icon: '⚡',
    badge: 'EXTERNO'
  }
];

export const STYLE_MAP = {
  natural: "luz de ventana natural suave, hora dorada, sombras orgánicas, grano de película, altamente cinematográfico",
  studio: "iluminación de estudio profesional, configuración de 3 puntos, softbox, luz de contorno, calidad comercial premium",
  noir: "claroscuro dramático, alto contraste, blanco y negro, sombras profundas, atmósfera artística melancólica",
  neon: "iluminación vibrante en azul neón y rosa, estética cyberpunk, resplandor atmosférico, iluminación de contorno futurista"
};

export const DARKROOM_PRESETS: Record<string, string> = {
  natural: "fotografía realista sin procesar, colores neutros, sombras suaves",
  cinematic: "estética de cine de 35 mm, gradación de color profesional, profundidad de campo sutil, alto rango dinámico",
  vintage: "película analógica antigua, grano Kodak Portra 400, tonos cálidos, ligero desvanecimiento",
  noir: "monocromático profundo, alto contraste, sombras definidas, grano fino",
  golden: "iluminación cálida de atardecer, destellos solares suaves, tonos miel",
  studio: "limpieza comercial, iluminación perfecta de tres puntos, nitidez máxima"
};

export const SKIN_MAP = {
  natural: "textura de piel natural, poros visibles, vello facial sutil, aspecto auténtico, sin filtros de belleza",
  event: "acabado de maquillaje premium, cutis impecable, estilo de retoque profesional, textura mate suave",
  raw: "textura ultra cruda, poros 8k altamente detallados, micro-imperfecciones, dispersión subsuperficial, hiperrealismo extremo"
};

export const NEGATIVE_DEFAULTS = "lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry, artist name, lens flare, deformed, cartoon, illustration, drawing";

export const ICONS = {
  ANALYSIS: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  ARCHITECT: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
  DARKROOM: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  ENGINE: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
  LIBRARY: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>,
  RENDER_VAULT: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  AUDIT: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  ANALYTICS: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  Trash: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Export: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>,
  Key: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
};
