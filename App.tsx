
import React, { useState, useCallback, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { 
  InternalState, 
  ViewMode, 
  AuditLog, 
  PromptItem, 
  AnalysisItem, 
  CurrentSession,
  RenderItem,
  DarkroomSettings,
  IdentityValidation
} from './types';
import { INITIAL_POSES, STYLE_MAP, SKIN_MAP, ICONS, NEGATIVE_DEFAULTS, DARKROOM_PRESETS, PROVIDERS } from './constants';
import { analyzeFaceImage } from './geminiService';
import { generateRealImageFal, generateRealImageGemini } from './imageGenService';

// --- UI Components ---

interface BadgeProps {
  children?: React.ReactNode;
  color?: string;
  className?: string;
}

const Badge = ({ children, color = 'emerald', className = "" }: BadgeProps) => {
    const colors: Record<string, string> = {
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        zinc: 'bg-zinc-800 text-zinc-400 border-zinc-700',
        indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    };
    return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${colors[color] || colors.zinc} ${className}`}>
            {children}
        </span>
    );
};

interface CardProps {
  children?: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  key?: React.Key;
}

const Card = ({ children, className = "", title, subtitle }: CardProps) => (
  <div className={`glass rounded-2xl overflow-hidden flex flex-col border border-white/5 shadow-2xl ${className}`}>
    {(title || subtitle) && (
        <div className="px-6 py-4 border-b border-white/5 flex flex-col bg-white/[0.02]">
            {title && <h3 className="text-xs font-black text-white uppercase italic tracking-wider flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
              {title}
            </h3>}
            {subtitle && <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5 ml-3.5">{subtitle}</p>}
        </div>
    )}
    <div className="flex-1 p-6 relative">
        {children}
    </div>
  </div>
);

interface ButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
  disabled?: boolean;
}

const Button = ({ children, onClick, variant = 'primary', className = "", disabled = false }: ButtonProps) => {
  const variants = {
    primary: "bg-white text-black hover:bg-zinc-200 active:bg-zinc-300 shadow-[0_0_15px_rgba(255,255,255,0.1)]",
    secondary: "bg-zinc-900 text-white hover:bg-zinc-800 border border-white/10",
    danger: "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20",
    ghost: "bg-transparent text-zinc-400 hover:text-white hover:bg-white/5"
  };

  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
};

const IdentityMatchIndicator = ({ validation }: { validation?: IdentityValidation }) => {
  if (!validation) return null;
  const isGood = validation.isValid;
  return (
    <div className={`mt-4 p-4 rounded-xl border ${isGood ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black uppercase text-zinc-500">Match de Identidad</span>
        <span className={`text-[12px] font-black ${isGood ? 'text-emerald-400' : 'text-rose-400'}`}>
          {validation.matchScore}% {isGood ? '✓' : '⚠️'}
        </span>
      </div>
      <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden">
        <div className={`h-full transition-all duration-1000 ${isGood ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${validation.matchScore}%` }} />
      </div>
      {validation.warnings.length > 0 && (
        <ul className="mt-3 space-y-1">
          {validation.warnings.map((w, i) => (
            <li key={i} className="text-[8px] text-zinc-500 uppercase font-bold">• {w}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

// --- Main Application ---

const App = () => {
  const STORAGE_KEY = 'fotografo_state_v131_platinum_native';
  
  const [view, setView] = useState<ViewMode>(ViewMode.ANALYSIS);
  const [loading, setLoading] = useState(false);
  const [darkroomLoading, setDarkroomLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  
  const [state, setState] = useState<InternalState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            return JSON.parse(saved);
        } catch(e) { console.error("Error cargando estado local.", e); }
    }
    return {
        version: "1.3.1",
        poseBank: INITIAL_POSES,
        promptLibrary: [],
        analysisLibrary: [],
        renderLibrary: [],
        auditLog: [],
        falApiKey: "",
        currentSession: {
          facialTraits: null,
          facialId: null,
          currentPose: INITIAL_POSES[0],
          currentStyle: 'natural',
          currentSkin: 'natural',
          currentContext: '',
          darkroomSettings: {
            preset: "natural",
            strength: 0.5,
            guidance: 5,
            steps: 30,
            customPrompt: ""
          },
          preferredProvider: 'gemini'
        }
    };
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
        if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setHasGeminiKey(hasKey);
        } else {
            setHasGeminiKey(true);
        }
    };
    checkKey();
  }, []);

  const handleSelectGeminiKey = async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        await window.aistudio.openSelectKey();
        setHasGeminiKey(true);
    }
  };

  const addLog = useCallback((type: AuditLog['type'], details: string, severity: AuditLog['severity'] = 'info') => {
    const log: AuditLog = { 
      type, 
      timestamp: new Date().toISOString(), 
      details,
      severity
    };
    setState(prev => ({ ...prev, auditLog: [log, ...prev.auditLog].slice(0, 50) }));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setLoading(true);
    addLog('ANALYZE_START', `Ingiriendo ADN de archivo: ${file.name}`);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target?.result as string;
        try {
          const traits = await analyzeFaceImage(base64);
          const fid = `ADN_${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
          const newAnalysis: AnalysisItem = {
            id: fid,
            traits,
            timestamp: new Date().toISOString(),
            imageBase64: base64
          };
          setState(prev => ({
            ...prev,
            analysisLibrary: [newAnalysis, ...prev.analysisLibrary].slice(0, 10),
            currentSession: {
              ...prev.currentSession,
              facialTraits: traits,
              facialId: fid,
              previewImage: base64
            }
          }));
          addLog('ANALYZE_DONE', `Perfil facial ${fid} estabilizado.`);
          setView(ViewMode.ARCHITECT);
        } catch (err) {
          addLog('ANALYZE_ERROR', `Fallo en el escaneo: ${err instanceof Error ? err.message : 'Desconocido'}`, 'error');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setLoading(false);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFileUpload(e.dataTransfer.files[0]);
  }, []);

  const generatePrompt = useCallback(() => {
    const { facialTraits, currentPose, currentStyle, currentSkin, currentContext, darkroomSettings } = state.currentSession;
    if (!facialTraits || !currentPose) return "";
    const dna = `person with ${facialTraits.shape} face, ${facialTraits.eyes} eyes, ${facialTraits.nose} nose, ${facialTraits.mouth} mouth, traits: ${facialTraits.features.join(', ')}`;
    const pose = `posing as: ${currentPose.prompt}, using ${currentPose.optics.lensMm}mm lens, ${currentPose.optics.angle} angle`;
    const style = STYLE_MAP[currentStyle];
    const skin = SKIN_MAP[currentSkin];
    const darkroom = `preset: ${DARKROOM_PRESETS[darkroomSettings.preset]}, ${darkroomSettings.customPrompt}`;
    return `${dna}, ${pose}, ${style}, ${skin}, ${currentContext ? 'in ' + currentContext : ''}, ${darkroom}`.replace(/  +/g, ' ');
  }, [state.currentSession]);

  const handleSavePrompt = useCallback(() => {
    const s = state.currentSession;
    if (!s.facialTraits) return;

    const finalPrompt = generatePrompt();
    const newPrompt: PromptItem = {
      id: `PRMPT_${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      title: `Plano ${s.facialId || 'ID'} - ${s.currentPose?.name || 'Manual'}`,
      finalPrompt,
      blocks: [s.currentStyle, s.currentSkin, s.currentContext].filter(Boolean),
      createdAt: new Date().toISOString(),
      reference: {
        previewImageBase64: s.previewImage
      },
      meta: {
        provider: s.preferredProvider
      }
    };

    setState(prev => ({
      ...prev,
      promptLibrary: [newPrompt, ...prev.promptLibrary].slice(0, 50)
    }));
    addLog('SAVE_PROMPT', `Plano ${newPrompt.id} guardado correctamente en la biblioteca.`);
  }, [state.currentSession, addLog, generatePrompt]);

  const handleReveal = async () => {
    const s = state.currentSession;
    if (!s.previewImage) return;

    setDarkroomLoading(true);
    addLog('DARKROOM_APPLIED', `Generando revelado real con Gemini Native (Identidad Blindada)...`);

    try {
        const finalPrompt = generatePrompt();
        
        if (s.preferredProvider === 'gemini') {
            const { renderItem } = await generateRealImageGemini(finalPrompt, s.previewImage, s.darkroomSettings.strength);
            
            setState(prev => ({ 
              ...prev, 
              renderLibrary: [renderItem, ...prev.renderLibrary].slice(0, 15) 
            }));
            addLog('REVEAL_REAL_DONE', `Revelado Platinum finalizado con match del ${renderItem.metadata?.identityValidation?.matchScore}%.`);
        } else {
            const result = await generateRealImageFal(state.falApiKey!, finalPrompt, s.previewImage, s.darkroomSettings.strength, s.darkroomSettings.guidance, s.darkroomSettings.steps);
            const renderId = `FLUX_${Date.now()}`;
            const newRender: RenderItem = {
                id: renderId,
                status: "final",
                provider: s.preferredProvider,
                createdAt: new Date().toISOString(),
                finalPrompt,
                outUrl: result,
                darkroomApplied: true
            };
            setState(prev => ({ 
              ...prev, 
              renderLibrary: [newRender, ...prev.renderLibrary].slice(0, 15) 
            }));
            addLog('REVEAL_REAL_DONE', `Revelado Flux finalizado.`);
        }

        setView(ViewMode.RENDER_VAULT);
    } catch (err: any) {
        addLog('REVEAL_REAL_ERROR', `Fallo: ${err.message}`, 'error');
        alert("Fallo en la generación real.");
    } finally {
        setDarkroomLoading(false);
    }
  };

  const exportZeroLossZip = async () => {
    const zip = new JSZip();
    addLog('EXPORT_ZIP', 'Generando paquete síncrono...');
    const imagesFolder = zip.folder("revelados_platinum");
    
    for (const r of state.renderLibrary) {
        const content = r.outBase64 || r.outUrl;
        if (content) {
            if (content.startsWith('data:')) {
                imagesFolder?.file(`${r.id}.png`, content.split(',')[1], { base64: true });
            } else {
                try {
                    const blob = await fetch(content).then(res => res.blob());
                    imagesFolder?.file(`${r.id}.png`, blob);
                } catch(e) { imagesFolder?.file(`${r.id}_link.txt`, content); }
            }
        }
    }

    zip.file("manifiesto_v131.json", JSON.stringify(state, null, 2));
    const zipBlob = await zip.generateAsync({ type: "blob" });
    saveAs(zipBlob, `FOTOGRAFO_PLATINUM_V131_${Date.now()}.zip`);
  };

  // --- Views ---

  const renderAnalysis = () => (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
      <div 
        onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
        className={`relative group cursor-pointer h-[400px] rounded-[3rem] border-2 border-dashed transition-all duration-500 flex flex-col items-center justify-center space-y-8
          ${dragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'}`}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-500"><ICONS.ANALYSIS /></div>
        <div className="text-center">
            <h2 className="text-xl font-black text-white uppercase italic tracking-widest mb-1">Ingesta de Sujeto</h2>
            <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-[0.4em]">Subir ADN Fotográfico para Procesado</p>
        </div>
        {loading && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md rounded-[3rem] flex flex-col items-center justify-center z-50">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_20px_#4f46e5]" />
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-indigo-400">Analizando Biometría...</span>
            </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {state.analysisLibrary.map(item => (
          <Card key={item.id} title={item.id} subtitle={new Date(item.timestamp).toLocaleString()}>
            <div className="flex gap-5">
                <img src={item.imageBase64} className="w-20 h-20 rounded-xl object-cover grayscale brightness-75 border border-white/5" alt="DNA" />
                <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap gap-1"><Badge color="zinc">{item.traits.shape}</Badge><Badge color="zinc">{item.traits.skin}</Badge></div>
                    <Button variant="ghost" className="text-[9px] p-0" onClick={() => { setState(prev => ({ ...prev, currentSession: { ...prev.currentSession, facialTraits: item.traits, facialId: item.id, previewImage: item.imageBase64 } })); setView(ViewMode.ARCHITECT); }}>Activar ADN</Button>
                </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderArchitect = () => {
    const s = state.currentSession;
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-700">
        <div className="lg:col-span-8 space-y-8">
          <Card title="Estructura de Pose" subtitle="Blueprint para Inyección IA">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">PoseBank</label>
                    <div className="grid grid-cols-1 gap-2 h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {state.poseBank.map(p => (
                        <button key={p.id} onClick={() => setState(prev => ({ ...prev, currentSession: { ...prev.currentSession, currentPose: p } }))}
                          className={`p-4 rounded-xl text-left border transition-all ${s.currentPose?.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl' : 'bg-white/5 border-white/5 text-zinc-500 hover:bg-white/[0.08]'}`}>
                          <div className="text-[10px] font-black uppercase">{p.name}</div>
                          <div className="text-[8px] opacity-60 font-mono mt-1">{p.optics.lensMm}mm • {p.optics.angle}</div>
                        </button>
                      ))}
                    </div>
                </div>
                <div className="space-y-6">
                   <div className="space-y-4">
                       <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Estética Lumínica</label>
                       <div className="flex flex-wrap gap-2">{Object.keys(STYLE_MAP).map(st => (<button key={st} onClick={() => setState(prev => ({ ...prev, currentSession: { ...prev.currentSession, currentStyle: st as any } }))} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${s.currentStyle === st ? 'bg-white text-black border-white' : 'bg-transparent border-white/10 text-zinc-500 hover:border-white/20'}`}>{st}</button>))}</div>
                   </div>
                   <div className="space-y-4">
                       <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Textura Dermis</label>
                       <div className="flex flex-wrap gap-2">{Object.keys(SKIN_MAP).map(sk => (<button key={sk} onClick={() => setState(prev => ({ ...prev, currentSession: { ...prev.currentSession, currentSkin: sk as any } }))} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all ${s.currentSkin === sk ? 'bg-white text-black border-white' : 'bg-transparent border-white/10 text-zinc-500 hover:border-white/20'}`}>{sk}</button>))}</div>
                   </div>
                   <div className="space-y-4">
                       <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest">Entorno</label>
                       <input type="text" value={s.currentContext} onChange={(e) => setState(prev => ({ ...prev, currentSession: { ...prev.currentSession, currentContext: e.target.value } }))} className="w-full bg-black/40 border border-white/5 rounded-xl p-4 text-[11px] font-mono text-indigo-300 outline-none focus:border-indigo-500" placeholder="E.G. LUXURY HOTEL, PARIS, RAINY NIGHT..." />
                   </div>
                </div>
             </div>
          </Card>
          <Card title="Blueprint de Inyección" subtitle="Código Síncrono Compilado">
             <div className="bg-black/60 rounded-2xl p-6 border border-white/5 min-h-[100px]"><code className="text-[10px] font-mono text-indigo-400 leading-relaxed block break-words">{generatePrompt() || "// SELECCIONE UN ADN PARA GENERAR CÓDIGO"}</code></div>
             <div className="flex gap-4 mt-6">
                <Button variant="primary" className="flex-1 h-12" onClick={handleSavePrompt} disabled={!s.facialTraits}>Archivar Plano</Button>
                <Button variant="secondary" className="px-10 h-12" onClick={() => setView(ViewMode.DARKROOM)} disabled={!s.facialTraits}>Ir al Darkroom</Button>
             </div>
          </Card>
        </div>
        <div className="lg:col-span-4 space-y-6">
           <Card title="Referencia Ingesta" subtitle={s.facialId || 'VOID'}>
              <div className="aspect-[3/4] bg-black rounded-3xl overflow-hidden border border-white/5 shadow-2xl relative">
                  {s.previewImage ? <img src={s.previewImage} className="w-full h-full object-cover grayscale brightness-90" alt="DNA Ref" /> : <div className="w-full h-full flex items-center justify-center font-black text-zinc-900 uppercase">Void</div>}
                  <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.8)_100%)] pointer-events-none" />
              </div>
           </Card>
        </div>
      </div>
    );
  };

  const renderDarkroom = () => {
    const s = state.currentSession.darkroomSettings;
    const pref = state.currentSession.preferredProvider;
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in slide-in-from-right-12 duration-700">
          <div className="lg:col-span-7 space-y-6">
              <Card title="Cámara Oscura Platinum" subtitle="Revelado Real Embebido v1.3.1">
                  <div className="aspect-square bg-black rounded-3xl overflow-hidden border border-white/5 relative group shadow-3xl">
                      {state.currentSession.previewImage ? <img src={state.currentSession.previewImage} className="w-full h-full object-cover" alt="Base" /> : <div className="w-full h-full flex items-center justify-center font-black">VOID</div>}
                      {darkroomLoading && (
                          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center space-y-6 backdrop-blur-md z-50">
                              <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin shadow-[0_0_30px_#4f46e5]" />
                              <div className="text-center">
                                  <p className="text-indigo-400 font-black tracking-[0.6em] uppercase text-[10px] animate-pulse">Revelando Nativo...</p>
                                  <p className="text-zinc-600 text-[8px] uppercase font-bold mt-2">Motor: Gemini Platinum (Imagen 3)</p>
                              </div>
                          </div>
                      )}
                      <div className="absolute inset-0 pointer-events-none border-[24px] border-black/10" />
                  </div>
              </Card>
          </div>
          <div className="lg:col-span-5 space-y-6">
              <Card title="Configuración de Motor" subtitle="Proveedor: Gemini Native">
                  <div className="space-y-6">
                      <div className="grid grid-cols-1 gap-3">
                          {PROVIDERS.map(p => (
                              <button key={p.id} onClick={() => setState(prev => ({ ...prev, currentSession: { ...prev.currentSession, preferredProvider: p.id as any } }))}
                                className={`p-5 rounded-2xl border text-left transition-all ${pref === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl scale-[1.02]' : 'bg-white/5 border-white/5 text-zinc-500 hover:bg-white/[0.08]'}`}>
                                <div className="flex justify-between font-black uppercase text-[10px] mb-1">
                                    <span className="flex items-center gap-2">{p.icon} {p.name}</span>
                                    {pref === p.id && <Badge color="emerald">Seleccionado</Badge>}
                                </div>
                                <p className="text-[8px] opacity-70 uppercase leading-relaxed font-bold tracking-tight">{p.description}</p>
                              </button>
                          ))}
                      </div>

                      <div className="space-y-4 border-t border-white/5 pt-6">
                          <label className="text-[9px] font-black uppercase text-zinc-600 tracking-widest flex justify-between items-center">
                            Filtros de Darkroom
                            <Badge color="zinc">{s.preset}</Badge>
                          </label>
                          <div className="grid grid-cols-3 gap-2">
                              {Object.keys(DARKROOM_PRESETS).map(p => (
                                  <button key={p} onClick={() => setState(prev => ({ ...prev, currentSession: { ...prev.currentSession, darkroomSettings: { ...prev.currentSession.darkroomSettings, preset: p } } }))} 
                                    className={`p-2 rounded-xl text-[8px] font-black uppercase border transition-all ${s.preset === p ? 'bg-white text-black border-white' : 'bg-transparent text-zinc-700 border-zinc-900 hover:border-zinc-700'}`}>
                                    {p}
                                  </button>
                              ))}
                          </div>

                          <div className="space-y-3">
                              <div className="flex justify-between text-[9px] font-black">
                                  <span className="text-zinc-600 uppercase">Nivel de Transformación (Strength)</span>
                                  <span className="text-indigo-400">{Math.round(s.strength * 100)}%</span>
                              </div>
                              <input type="range" min="0.1" max="0.9" step="0.05" value={s.strength} onChange={(e) => setState(prev => ({ ...prev, currentSession: { ...prev.currentSession, darkroomSettings: { ...prev.currentSession.darkroomSettings, strength: parseFloat(e.target.value) } } }))} className="w-full accent-indigo-500" />
                              <div className="flex justify-between text-[7px] text-zinc-800 font-bold uppercase tracking-wider">
                                <span>Retoque Sutil (Identidad +++)</span>
                                <span>Transformación Dramática</span>
                              </div>
                          </div>

                          <textarea value={s.customPrompt} onChange={(e) => setState(prev => ({ ...prev, currentSession: { ...prev.currentSession, darkroomSettings: { ...prev.currentSession.darkroomSettings, customPrompt: e.target.value } } }))} placeholder="AJUSTES ADICIONALES..." className="w-full bg-black/60 border border-white/5 rounded-2xl p-4 text-[9px] font-mono text-zinc-300 h-20 outline-none focus:border-indigo-500 custom-scrollbar" />
                      </div>

                      <Button className="w-full h-16 bg-white text-black hover:bg-zinc-200 shadow-3xl flex items-center justify-center gap-3 text-sm" onClick={handleReveal} disabled={darkroomLoading}>
                          <span className="text-lg">🟀</span> REVELAR IMAGEN REAL
                      </Button>
                      
                      <div className="text-center space-y-1">
                        <p className="text-[7px] text-zinc-800 uppercase font-black tracking-[0.2em]">PLATINUM NATIVE EMBEDDED v1.3.1</p>
                        <p className="text-[7px] text-zinc-900 uppercase font-bold tracking-[0.1em]">La identidad facial está blindada algorítmicamente.</p>
                      </div>
                  </div>
              </Card>
          </div>
      </div>
    );
  };

  const renderVault = () => (
    <div className="space-y-12 animate-in fade-in duration-700">
       <div className="flex justify-between items-end border-b border-white/5 pb-8">
          <div>
            <h2 className="text-5xl font-black text-white italic uppercase leading-none">La Bóveda</h2>
            <p className="text-zinc-600 text-[10px] font-black uppercase tracking-[0.5em] mt-3">Revelados Zero-Loss Platinum</p>
          </div>
          <Button className="h-14 px-12 bg-emerald-600 text-white" onClick={exportZeroLossZip}>EXPORTAR ARCHIVO ZIP</Button>
       </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {state.renderLibrary.map(render => (
            <Card key={render.id} title={render.id} subtitle={new Date(render.createdAt).toLocaleString()} className="group hover:scale-[1.02] transition-transform duration-500">
                <div className="aspect-square bg-black rounded-3xl overflow-hidden border border-white/5 mb-4 relative shadow-3xl">
                  <img src={render.outUrl || render.outBase64} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[8s]" alt="Render" />
                  <div className="absolute top-3 right-3 flex flex-col gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Badge color={render.provider === 'fal-ai' ? 'amber' : 'indigo'}>{render.provider}</Badge>
                  </div>
                </div>
                
                <IdentityMatchIndicator validation={render.metadata?.identityValidation} />

                <div className="flex gap-2 mt-4">
                  <Button variant="secondary" className="text-[9px] flex-1 h-9" onClick={() => window.open(render.outUrl || render.outBase64 || '', '_blank')}>Ver HD</Button>
                  <Button variant="danger" className="w-9 h-9 flex items-center justify-center p-0" onClick={() => setState(prev => ({ ...prev, renderLibrary: prev.renderLibrary.filter(r => r.id !== render.id) }))}>
                      <ICONS.Trash />
                  </Button>
                </div>
            </Card>
          ))}
       </div>
    </div>
  );

  const renderAudit = () => {
    const usage = JSON.stringify(state).length;
    const limit = 5 * 1024 * 1024;
    const pct = (usage / limit) * 100;
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in slide-in-from-right-12">
        <div className="lg:col-span-4 space-y-8">
          <Card title="Estado del Sistema" subtitle="Almacenamiento Platinum">
            <div className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-zinc-600 uppercase tracking-widest">Sincronización Local</span>
                    <span className={pct > 80 ? "text-rose-500 font-black" : "text-white"}>{pct.toFixed(2)}%</span>
                  </div>
                  <div className="h-2 bg-zinc-950 rounded-full overflow-hidden border border-white/5">
                    <div className={`h-full transition-all duration-[2s] ${pct > 80 ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-[9px] font-mono uppercase">
                  <div className="bg-black/40 p-4 rounded-xl border border-white/5"><span className="text-zinc-600 block mb-1">Versión</span>v1.3.1_PL</div>
                  <div className="bg-black/40 p-4 rounded-xl border border-white/5"><span className="text-zinc-600 block mb-1">Motor</span>NATIVE</div>
                </div>
            </div>
          </Card>
        </div>
        <div className="lg:col-span-8">
          <Card title="Telemetría" subtitle="Log de Operaciones Síncronas">
            <div className="space-y-3 h-[600px] overflow-y-auto pr-4 custom-scrollbar">
              {state.auditLog.map((log, i) => (
                <div key={i} className="flex items-center gap-5 p-4 rounded-xl border border-white/5 bg-white/[0.01]">
                  <Badge color={log.severity === 'error' ? 'rose' : log.severity === 'warning' ? 'amber' : 'emerald'} className="shrink-0">{log.type}</Badge>
                  <p className="text-[10px] text-zinc-500 truncate flex-1">{log.details}</p>
                  <span className="text-[8px] text-zinc-800 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex bg-[#010101] text-zinc-300 font-sans overflow-hidden">
      
      {!hasGeminiKey && view !== ViewMode.ANALYSIS && (
          <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl z-[200] flex items-center justify-center p-8 animate-in fade-in duration-500">
              <Card className="w-full max-w-lg p-12 text-center space-y-10" title="Motor Platinum Desconectado" subtitle="Activación Gemini Multimodal">
                  <div className="w-24 h-24 rounded-full bg-indigo-600/10 flex items-center justify-center mx-auto text-indigo-400"><ICONS.Key /></div>
                  <p className="text-zinc-500 text-[11px] uppercase font-bold tracking-widest leading-relaxed">
                    Para el revelado nativo 2K Platinum, active su clave de API de Google AI Studio vinculada a un proyecto de pago.
                  </p>
                  <Button variant="primary" className="w-full h-16 text-lg" onClick={handleSelectGeminiKey}>VINCULAR CLAVE DE API</Button>
              </Card>
          </div>
      )}

      {showSettings && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-3xl z-[100] flex items-center justify-center p-8 animate-in fade-in">
              <Card className="w-full max-w-lg p-12 space-y-10" title="Ajustes Externos" subtitle="Servicios de Terceros">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-zinc-600 tracking-widest flex items-center gap-2">Fal.ai API Key</label>
                    <input type="password" value={state.falApiKey} onChange={(e) => setState(prev => ({ ...prev, falApiKey: e.target.value }))}
                        placeholder="f-..." className="w-full bg-black border border-white/10 rounded-2xl p-5 text-xs font-mono text-emerald-400 outline-none focus:border-emerald-500" />
                  </div>
                  <Button variant="primary" className="w-full h-12" onClick={() => setShowSettings(false)}>Guardar Cambios</Button>
              </Card>
          </div>
      )}

      <nav className="w-24 bg-black border-r border-white/5 flex flex-col items-center py-12 space-y-10 z-50">
        <div className="text-white font-black italic text-3xl mb-8 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">FA</div>
        {[
          { mode: ViewMode.ANALYSIS, icon: <ICONS.ANALYSIS />, title: "Ingesta" },
          { mode: ViewMode.ARCHITECT, icon: <ICONS.ARCHITECT />, title: "Planos" },
          { mode: ViewMode.DARKROOM, icon: <ICONS.DARKROOM />, title: "Darkroom" },
          { mode: ViewMode.LIBRARY, icon: <ICONS.LIBRARY />, title: "Archivo" },
          { mode: ViewMode.RENDER_VAULT, icon: <ICONS.RENDER_VAULT />, title: "Bóveda" },
          { mode: ViewMode.AUDIT, icon: <ICONS.AUDIT />, title: "Auditoría" }
        ].map(item => (
          <button key={item.mode} onClick={() => setView(item.mode)} title={item.title}
            className={`p-5 rounded-[2rem] transition-all duration-500 ${view === item.mode ? 'bg-indigo-600 text-white shadow-[0_0_30px_#4f46e5] scale-110' : 'text-zinc-800 hover:text-white hover:bg-white/5'}`}>
            {item.icon}
          </button>
        ))}
        <div className="flex-1"></div>
        <button onClick={() => setShowSettings(true)} className="p-5 text-zinc-800 hover:text-white transition-colors"><ICONS.Key /></button>
      </nav>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-12 bg-black/50 backdrop-blur-3xl z-40">
          <div className="flex items-center space-x-8">
            <h1 className="text-lg font-black italic uppercase text-white leading-none">EL FOTÓGRAFO <span className="text-[9px] block font-mono text-zinc-700 tracking-[0.5em] mt-1 uppercase">Platinum Native v1.3.1</span></h1>
            <Badge color={state.currentSession.preferredProvider === 'gemini' ? 'indigo' : 'amber'}>Provider: {state.currentSession.preferredProvider.toUpperCase()}</Badge>
          </div>
          <button onClick={exportZeroLossZip} className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"><ICONS.Export /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-[#020202]">
          <div className="max-w-[1600px] mx-auto pb-32">
            {view === ViewMode.ANALYSIS && renderAnalysis()}
            {view === ViewMode.ARCHITECT && renderArchitect()}
            {view === ViewMode.DARKROOM && renderDarkroom()}
            {view === ViewMode.LIBRARY && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {state.promptLibrary.map(item => (
                        <Card key={item.id} title={item.title} subtitle={new Date(item.createdAt).toLocaleString()} className="group hover:border-indigo-500/40">
                            <div className="flex gap-6">
                                {item.reference?.previewImageBase64 && <img src={item.reference.previewImageBase64} className="w-20 h-20 rounded-2xl object-cover grayscale border border-white/5" alt="Ref" />}
                                <div className="flex-1 min-w-0">
                                  <p className="text-[11px] text-zinc-500 line-clamp-2 italic mb-4">"{item.finalPrompt}"</p>
                                  <Button variant="secondary" className="text-[9px] h-8 px-4" onClick={() => navigator.clipboard.writeText(item.finalPrompt)}>Copiar Blueprint</Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
            {view === ViewMode.RENDER_VAULT && renderVault()}
            {view === ViewMode.AUDIT && renderAudit()}
          </div>
        </div>

        <div className="h-10 bg-black/90 border-t border-white/5 px-12 flex items-center justify-between text-[9px] font-mono text-zinc-800 uppercase tracking-widest z-40">
           <div className="flex gap-10">
              <span className="flex items-center gap-2 font-black">ADN: {state.currentSession.facialId || 'VOID'}</span>
              <span>RENDER_CAP: {state.renderLibrary.length}/15</span>
           </div>
           <div className="flex gap-6 items-center">
              <span className="text-zinc-600">v1.3.1_PLATINUM</span>
              <span className="text-emerald-500">STABLE</span>
           </div>
        </div>
      </main>
      <style dangerouslySetInnerHTML={{ __html: `
        .shadow-3xl { box-shadow: 0 40px 100px -20px rgba(0,0,0,1); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); border-radius: 10px; }
      `}} />
    </div>
  );
};

export default App;
