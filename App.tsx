
import React, { useState, useCallback, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { 
  InternalState, 
  ViewMode, 
  RenderItem,
  EngineMode,
  DarkroomSettings,
  GearSettings
} from './types';
import { INITIAL_POSES, STYLE_MAP, SKIN_MAP, ICONS, GEAR_CONFIG } from './constants';
import { analyzeFaceImage } from './geminiService';
import { revealImageWithRetry, editWithNanoBanana } from './imageGenService';
import { analytics } from './analyticsService';
import { GearRack } from './GearRack';

// --- UI Components ---

const Badge = ({ children, color = 'red', className = "" }: { children: React.ReactNode, color?: string, className?: string }) => {
  const colors: any = { 
    red: 'bg-red-500/10 text-red-500 border-red-500/20', 
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    zinc: 'bg-zinc-800/40 text-zinc-500 border-zinc-700/50'
  };
  return <span className={`px-2 py-0.5 rounded-sm text-[9px] font-mono font-bold uppercase tracking-wider border ${colors[color] || colors.zinc} ${className}`}>{children}</span>;
};

const Card = ({ children, title, subtitle, className = "" }: { children: React.ReactNode, title?: string, subtitle?: string, className?: string }) => (
  <div className={`hardware-panel rounded-xl overflow-hidden border border-white/5 flex flex-col ${className}`}>
    {(title || subtitle) && (
      <div className="px-5 py-3 border-b border-black/20 bg-black/10 flex justify-between items-center">
        <div className="flex flex-col">
          {title && <h3 className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-[0.2em]">{title}</h3>}
          {subtitle && <p className="text-[8px] text-zinc-600 uppercase font-medium tracking-[0.1em] mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex gap-1">
            <div className="w-1 h-1 rounded-full bg-zinc-800"></div>
            <div className="w-1 h-1 rounded-full bg-zinc-800"></div>
        </div>
      </div>
    )}
    <div className="p-5 flex-1">{children}</div>
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = "", disabled = false }: { children: React.ReactNode, onClick?: () => void, variant?: 'primary' | 'secondary' | 'danger' | 'shutter', className?: string, disabled?: boolean }) => {
  const base = "px-5 py-2.5 rounded-md font-mono font-bold text-[10px] uppercase tracking-widest transition-all active:scale-[0.98] disabled:opacity-30 flex items-center justify-center gap-2 border rim-light";
  const variants = {
    primary: "bg-[#18181b] text-zinc-100 border-white/5 hover:bg-[#202024] hover:border-white/10",
    secondary: "bg-transparent text-zinc-400 border-zinc-800 hover:bg-white/5",
    danger: "bg-red-950/20 text-red-500 border-red-900/30 hover:bg-red-900/30",
    shutter: "bg-gradient-to-br from-red-600 to-red-800 text-white border-red-500 shutter-glow hover:from-red-500 hover:to-red-700"
  };
  return <button onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>{children}</button>;
};

// --- Main Application ---

const App = () => {
  const [view, setView] = useState<ViewMode>(ViewMode.ANALYSIS);
  const [loading, setLoading] = useState(false);
  const [darkroomLoading, setDarkroomLoading] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [retryInfo, setRetryInfo] = useState<{ attempt: number, score: number } | null>(null);
  const [engineMode, setEngineMode] = useState<EngineMode>('offline'); 
  const [toast, setToast] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  
  const [state, setState] = useState<InternalState>(() => {
    const saved = localStorage.getItem('fotografo_vault_v1.7');
    const base: InternalState = {
      version: "1.7.0",
      poseBank: INITIAL_POSES,
      promptLibrary: [],
      analysisLibrary: [],
      renderLibrary: [],
      savedRenders: [],
      auditLog: [],
      currentSession: {
        facialTraits: null,
        facialId: null,
        currentPose: INITIAL_POSES[0],
        currentStyle: 'natural',
        currentSkin: 'natural',
        currentContext: '',
        darkroomSettings: {
          preset: "natural", strength: 0.5, guidance: 5, steps: 30, customPrompt: "",
          resolution: '2K', aspectRatio: '1:1', identityProtection: 'maximum',
          validateOutput: true, enableRetry: true
        },
        gearSettings: {
          focalLength: '50mm',
          filmStock: 'Standard Digital'
        },
        preferredProvider: 'gemini',
        isThinkingMode: true
      }
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...base, ...parsed };
      } catch (e) { return base; }
    }
    return base;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('fotografo_vault_v1.7', JSON.stringify({
      savedRenders: state.savedRenders,
      analysisLibrary: state.analysisLibrary
    }));
  }, [state.savedRenders, state.analysisLibrary]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasGeminiKey(!!has);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      const has = await window.aistudio.hasSelectedApiKey();
      setHasGeminiKey(!!has);
      return !!has;
    }
    return false;
  };

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        try {
          const result = await analyzeFaceImage(base64, true, engineMode);
          const fid = `ADN_${Math.random().toString(36).substr(2,4).toUpperCase()}`;
          setState(prev => ({
            ...prev,
            analysisLibrary: [{ 
              id: fid, 
              traits: result.traits, 
              analysisText: result.analysisText, 
              timestamp: new Date().toISOString(), 
              imageBase64: base64 
            }, ...prev.analysisLibrary],
            currentSession: { ...prev.currentSession, facialTraits: result.traits, facialId: fid, previewImage: base64 }
          }));
          setView(ViewMode.ARCHITECT);
        } catch (err: any) {
          alert(`Error en análisis: ${err.message}`);
        } finally { setLoading(false); }
      };
      reader.readAsDataURL(file);
    } catch (err) { setLoading(false); }
  };

  const handleReveal = async () => {
    const s = state.currentSession;
    if (!s.previewImage) return;

    if (engineMode === 'live' && !hasGeminiKey) {
      const ok = await handleSelectKey();
      if (!ok) return;
    }

    setDarkroomLoading(true);
    try {
      // Inyección de prompts ópticos y químicos (v1.7.0)
      const focalPrompt = GEAR_CONFIG.lenses[s.gearSettings.focalLength];
      const stockPrompt = GEAR_CONFIG.stocks[s.gearSettings.filmStock];
      
      const prompt = `portrait of a person with ${s.facialTraits?.shape} face, ${s.facialTraits?.eyes} eyes. pose: ${s.currentPose?.prompt}. style: ${STYLE_MAP[s.currentStyle]}. environment: ${s.currentContext || 'professional studio'}. skin: ${SKIN_MAP[s.currentSkin]}${focalPrompt}${stockPrompt}.`;
      
      const result = await revealImageWithRetry(prompt, s.previewImage, s.darkroomSettings, engineMode, (attempt, score) => setRetryInfo({ attempt, score }));
      
      // Añadir metadatos Gear al item de renderizado
      const updatedItem = {
        ...result.renderItem,
        metadata: {
          ...result.renderItem.metadata,
          gear: s.gearSettings,
          engineMode: engineMode
        }
      };

      setState(prev => ({ ...prev, renderLibrary: [updatedItem, ...prev.renderLibrary] }));
      setView(ViewMode.RENDER_VAULT);
    } catch (err: any) {
      alert(`Fallo en motor: ${err.message}`);
    } finally { 
      setDarkroomLoading(false); 
      setRetryInfo(null); 
    }
  };

  const downloadHighRes = async (imageBase64: string, id: string) => {
    try {
      setToast("Ampliando negativo para impresión...");
      const res = await fetch(imageBase64);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FOTOGRAFO_ORIGINAL_${id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToast("Exportación exitosa");
    } catch (e) {
      setToast("Error al exportar");
    }
  };

  const saveToVault = (item: RenderItem) => {
    if (state.savedRenders.find(s => s.id === item.id)) {
      setToast("Ya guardado");
      return;
    }
    setState(prev => ({ ...prev, savedRenders: [item, ...prev.savedRenders] }));
    setToast("Añadido al Archivo Maestro");
  };

  // Session Stats for Analytics View
  const stats = analytics.getSessionStats();
  const distribution = analytics.getStrengthDistribution();

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-400 font-sans flex overflow-hidden selection:bg-red-500 selection:text-white">
      {toast && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] bg-red-600 text-white px-6 py-2.5 rounded-sm font-mono font-bold uppercase tracking-widest text-[10px] shadow-[0_0_40px_rgba(220,38,38,0.4)] animate-in fade-in slide-in-from-bottom-4 duration-500 border border-red-500/50">
          {toast}
        </div>
      )}

      {/* Sensor Switch (Responsive) */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col items-end gap-2">
        <div className="bg-black/60 backdrop-blur-md border border-white/5 p-1 rounded-lg flex items-center shadow-2xl hardware-panel">
          <button 
            onClick={() => setEngineMode('offline')}
            className={`px-3 py-1.5 rounded-md text-[9px] font-mono font-bold uppercase tracking-widest transition-all ${engineMode === 'offline' ? 'bg-zinc-800 text-zinc-100 shadow-inner' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            <span className="md:inline hidden">Sensor </span>Standard
          </button>
          <button 
            onClick={() => setEngineMode('live')}
            className={`px-3 py-1.5 rounded-md text-[9px] font-mono font-bold uppercase tracking-widest transition-all ${engineMode === 'live' ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            <span className="md:inline hidden">Sensor </span>Full Frame
          </button>
        </div>
        {engineMode === 'live' && !hasGeminiKey && (
          <button onClick={handleSelectKey} className="text-[8px] font-mono font-bold uppercase tracking-widest text-red-500 bg-red-500/5 px-2 py-1 rounded border border-red-500/20 animate-pulse">
            Calibrar Óptica Pro
          </button>
        )}
      </div>
      
      {/* Navigation (Industrial Column) */}
      <nav className="hidden sm:flex w-20 bg-black/40 border-r border-white/5 flex-col items-center py-10 space-y-12 z-50 hardware-panel">
        <div className="text-white font-black italic text-2xl mb-8 tracking-tighter opacity-80">F.</div>
        {[
          { m: ViewMode.ANALYSIS, icon: <ICONS.ANALYSIS />, t: 'SUJETO' },
          { m: ViewMode.ARCHITECT, icon: <ICONS.ARCHITECT />, t: 'SET' },
          { m: ViewMode.DARKROOM, icon: <ICONS.DARKROOM />, t: 'LAB' },
          { m: ViewMode.RENDER_VAULT, icon: <ICONS.RENDER_VAULT />, t: 'ARCHIVO' },
          { m: ViewMode.ANALYTICS, icon: <ICONS.ANALYTICS />, t: 'BITÁCORA' }
        ].map(item => (
          <button key={item.m} onClick={() => setView(item.m)} className={`group relative p-3 rounded-xl transition-all duration-300 ${view === item.m ? 'text-red-500 bg-red-500/5 shadow-[0_0_25px_rgba(220,38,38,0.15)] border border-red-500/20' : 'text-zinc-700 hover:text-zinc-400 hover:bg-white/5'}`}>
             {item.icon}
             <span className="absolute left-full ml-5 px-2 py-1 rounded bg-black border border-white/10 text-[8px] font-mono font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity z-[100] whitespace-nowrap pointer-events-none">{item.t}</span>
          </button>
        ))}
      </nav>
      
      <main className="flex-1 overflow-y-auto p-6 sm:p-12 custom-scrollbar relative">
        {/* Mobile Navigation Bar */}
        <div className="flex sm:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-black/80 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl gap-3 hardware-panel">
          {[
            { m: ViewMode.ANALYSIS, icon: <ICONS.ANALYSIS /> },
            { m: ViewMode.ARCHITECT, icon: <ICONS.ARCHITECT /> },
            { m: ViewMode.DARKROOM, icon: <ICONS.DARKROOM /> },
            { m: ViewMode.RENDER_VAULT, icon: <ICONS.RENDER_VAULT /> },
            { m: ViewMode.ANALYTICS, icon: <ICONS.ANALYTICS /> }
          ].map(item => (
            <button key={item.m} onClick={() => setView(item.m)} className={`p-4 rounded-xl transition-all ${view === item.m ? 'text-red-500 bg-red-500/10 border border-red-500/20' : 'text-zinc-600'}`}>
              {item.icon}
            </button>
          ))}
        </div>

        <header className="flex flex-col mb-16 sm:mb-20">
          <div className="flex justify-between items-end">
            <div className="flex flex-col">
              <h1 className="text-xl font-mono font-black italic text-zinc-100 uppercase tracking-tighter">EL FOTÓGRAFO <span className="text-red-600 font-normal">STUDIO MASTER</span></h1>
              <span className="text-[8px] font-mono font-bold text-zinc-700 tracking-[0.4em] uppercase">v1.7.0 Optica Platinum</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[8px] font-mono font-bold text-zinc-600 uppercase tracking-widest">Estado Sensor:</span>
              <div className={`w-1.5 h-1.5 rounded-full ${engineMode === 'live' ? 'bg-red-500 animate-pulse shadow-[0_0_8px_var(--safe-red)]' : 'bg-zinc-700'}`}></div>
            </div>
          </div>
          <div className="w-full h-px bg-zinc-900 mt-4 opacity-50"></div>
        </header>
        
        {view === ViewMode.ANALYSIS && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="text-center space-y-4">
              <Badge color="zinc">{engineMode === 'live' ? 'LENTE PRO 4K' : 'LENTE STANDARD'}</Badge>
              <h2 className="text-3xl sm:text-5xl font-mono font-black text-zinc-100 italic uppercase tracking-tighter">Negativo <span className="text-red-600">Digital</span></h2>
              <p className="text-zinc-600 text-[9px] font-mono font-bold uppercase tracking-[0.2em]">Paso 1: Exposición de la firma facial para el revelado.</p>
            </div>
            
            <div className="h-[300px] sm:h-[400px] border-2 border-dashed border-zinc-800 rounded-3xl bg-black/20 flex flex-col items-center justify-center p-12 group hover:border-red-600/30 transition-all cursor-pointer relative overflow-hidden" onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
              {loading ? (
                <div className="flex flex-col items-center space-y-6">
                  <div className="w-12 h-12 border-b-2 border-red-600 rounded-full animate-spin" />
                  <p className="text-zinc-100 font-mono text-[10px] uppercase tracking-widest animate-pulse">Analizando estructura de luz...</p>
                </div>
              ) : (
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 rounded-full bg-red-600/5 flex items-center justify-center mx-auto text-red-500 group-hover:scale-105 transition-transform border border-red-500/10"><ICONS.ANALYSIS /></div>
                  <p className="text-[10px] font-mono font-bold uppercase text-zinc-600 tracking-[0.2em]">Importar Negativo</p>
                </div>
              )}
              <div className="scan-line absolute w-full left-0 z-0"></div>
            </div>
          </div>
        )}

        {view === ViewMode.ARCHITECT && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-500 pb-24 sm:pb-0">
            <div className="lg:col-span-4 space-y-8">
              <Card title="Sujeto en Foco" subtitle={state.currentSession.facialId || "SIN EXPOSICIÓN"}>
                <div className="relative group aspect-[3/4] rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl">
                  {state.currentSession.previewImage && <img src={state.currentSession.previewImage} className="w-full h-full object-cover grayscale opacity-80" />}
                  <div className="absolute top-2 right-2"><Badge color="red">RAW</Badge></div>
                </div>
                {state.currentSession.facialTraits && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {state.currentSession.facialTraits.features.map((f, i) => <Badge key={i} color="zinc">{f}</Badge>)}
                  </div>
                )}
              </Card>
              
              <Card title="Equipo Óptico y Químico" subtitle="Gear Rack v1.7">
                <GearRack 
                  settings={state.currentSession.gearSettings} 
                  onChange={(gear) => setState(p => ({ ...p, currentSession: { ...p.currentSession, gearSettings: gear } }))} 
                />
              </Card>
            </div>
            
            <div className="lg:col-span-8 space-y-8">
               <Card title="Esquema de Composición">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                    {state.poseBank.map(p => (
                      <button key={p.id} onClick={() => setState(s => ({ ...s, currentSession: { ...s.currentSession, currentPose: p } }))} className={`p-5 rounded-lg border text-left transition-all ${state.currentSession.currentPose?.id === p.id ? 'bg-zinc-100 text-black border-zinc-100' : 'bg-black/20 border-zinc-800 text-zinc-500 hover:bg-black/30'}`}>
                        <p className="text-[9px] font-mono font-bold uppercase tracking-wider mb-1">{p.name}</p>
                        <p className="text-[8px] font-mono opacity-60 leading-relaxed truncate">{p.prompt}</p>
                      </button>
                    ))}
                  </div>
               </Card>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Card title="Set de Luces">
                    <div className="grid grid-cols-2 gap-2">
                      {Object.keys(STYLE_MAP).map(s => (
                        <button key={s} onClick={() => setState(p => ({ ...p, currentSession: { ...p.currentSession, currentStyle: s as any } }))} className={`py-2 rounded-md border text-[8px] font-mono font-bold uppercase tracking-widest transition-colors ${state.currentSession.currentStyle === s ? 'bg-red-600 border-red-500 text-white' : 'bg-black/20 border-zinc-800 hover:border-zinc-700'}`}>{s}</button>
                      ))}
                    </div>
                  </Card>
                  
                  <Card title="Grano y Textura">
                    <div className="grid grid-cols-1 gap-2">
                      {Object.keys(SKIN_MAP).map(s => (
                        <button key={s} onClick={() => setState(p => ({ ...p, currentSession: { ...p.currentSession, currentSkin: s as any } }))} className={`py-2 px-4 rounded-md border text-[8px] font-mono font-bold uppercase tracking-widest flex justify-between items-center ${state.currentSession.currentSkin === s ? 'bg-zinc-100 text-black border-zinc-100' : 'bg-black/20 border-zinc-800 hover:border-zinc-700'}`}>
                          {s}
                          <div className={`w-1 h-1 rounded-full ${state.currentSession.currentSkin === s ? 'bg-black' : 'bg-zinc-800'}`} />
                        </button>
                      ))}
                    </div>
                  </Card>
               </div>
               
               <Card title="Locación">
                <input type="text" value={state.currentSession.currentContext} onChange={(e) => setState(s => ({ ...s, currentSession: { ...s.currentSession, currentContext: e.target.value } }))} placeholder="Ej: penthouse en París, estudio minimalista..." className="w-full bg-black/40 border border-zinc-800 rounded-md p-4 text-[10px] font-mono outline-none focus:border-red-900/50 transition-colors" />
               </Card>
               
               <div className="flex justify-end pt-4">
                <Button onClick={() => setView(ViewMode.DARKROOM)} className="h-16 px-12 text-xs">Entrar al Laboratorio</Button>
               </div>
            </div>
          </div>
        )}

        {view === ViewMode.DARKROOM && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500 pb-24 sm:pb-0">
            <Card title={`Laboratorio de Revelado — ${engineMode === 'live' ? 'Full Frame' : 'Standard'}`} className="h-[500px] sm:h-[600px] relative overflow-hidden group">
              {darkroomLoading ? (
                <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center space-y-10 z-50">
                  <div className="w-20 h-20 border border-red-600/20 rounded-full flex items-center justify-center text-red-600 shadow-[0_0_30px_rgba(220,38,38,0.1)]"><ICONS.DARKROOM /></div>
                  <div className="text-center space-y-4">
                    <p className="text-zinc-100 font-mono font-black italic uppercase tracking-[0.4em] text-lg animate-pulse">Revelando Grano Fino {engineMode === 'live' ? '4K' : 'HD'}</p>
                    {retryInfo && <Badge color="amber">Filtro Biométrico: {retryInfo.score}%</Badge>}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-10">
                  <div className="w-24 h-24 rounded-full bg-red-600/5 border border-red-600/10 flex items-center justify-center mx-auto text-red-600 scale-125 mb-4 shadow-[0_0_50px_rgba(220,38,38,0.05)]"><ICONS.DARKROOM /></div>
                  <div className="space-y-4">
                    <h3 className="text-4xl font-mono font-black italic text-zinc-100 uppercase tracking-tighter">Disparo de <span className="text-red-600">Sensor</span></h3>
                    <p className="text-zinc-600 text-[9px] font-mono font-bold uppercase tracking-[0.2em] max-w-sm mx-auto leading-relaxed">
                      Calibración de haz de luz activa. Lente {state.currentSession.gearSettings.focalLength} | Stock {state.currentSession.gearSettings.filmStock}.
                    </p>
                  </div>
                  <Button onClick={handleReveal} variant="shutter" className="h-24 px-24 text-xl shadow-[0_0_60px_rgba(220,38,38,0.2)]">Disparar Revelado</Button>
                </div>
              )}
            </Card>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <Card title="Resolución Óptica">
                <div className="grid grid-cols-3 gap-2">
                  {['1K', '2K', '4K'].map(r => (
                    <button key={r} onClick={() => setState(p => ({ ...p, currentSession: { ...p.currentSession, darkroomSettings: { ...p.currentSession.darkroomSettings, resolution: r as any } } }))} className={`py-2 rounded-md border text-[8px] font-mono font-bold uppercase ${state.currentSession.darkroomSettings.resolution === r ? 'bg-zinc-100 text-black border-zinc-100' : 'bg-black/20 border-zinc-800 hover:border-zinc-700'}`}>{r}</button>
                  ))}
                </div>
              </Card>
              
              <Card title="Aspect Ratio">
                <div className="grid grid-cols-2 gap-2">
                  {['1:1', '16:9', '9:16', '4:3'].map(r => (
                    <button key={r} onClick={() => setState(p => ({ ...p, currentSession: { ...p.currentSession, darkroomSettings: { ...p.currentSession.darkroomSettings, aspectRatio: r as any } } }))} className={`py-2 rounded-md border text-[8px] font-mono font-bold uppercase ${state.currentSession.darkroomSettings.aspectRatio === r ? 'bg-red-600 border-red-500 text-white' : 'bg-black/20 border-zinc-800 hover:border-zinc-700'}`}>{r}</button>
                  ))}
                </div>
              </Card>
              
              <Card title="Fidelidad del Sujeto">
                <div className="flex flex-col gap-3">
                    <input type="range" min="0" max="1" step="0.1" value={state.currentSession.darkroomSettings.strength} onChange={(e) => setState(p => ({ ...p, currentSession: { ...p.currentSession, darkroomSettings: { ...p.currentSession.darkroomSettings, strength: parseFloat(e.target.value) } } }))} className="w-full" />
                    <div className="flex justify-between text-[8px] font-mono font-bold text-zinc-600 uppercase">
                        <span>Fijo</span>
                        <span>Creativo</span>
                    </div>
                </div>
              </Card>
            </div>
          </div>
        )}

        {view === ViewMode.RENDER_VAULT && (
          <div className="space-y-20 animate-in fade-in duration-500 pb-24 sm:pb-0">
            <div className="space-y-10">
              <div className="flex justify-between items-end border-b border-zinc-900 pb-6">
                <div className="flex flex-col">
                  <h2 className="text-3xl font-mono font-black italic text-zinc-100 uppercase tracking-tighter">Archivo <span className="text-red-600">Maestro</span></h2>
                  <span className="text-[8px] font-mono text-zinc-700 uppercase tracking-widest mt-1">Negativos Originales Exportados</span>
                </div>
                <Badge color="amber">VIP ARCHIVE</Badge>
              </div>
              
              {state.savedRenders.length === 0 ? (
                <div className="h-40 rounded-2xl border border-dashed border-zinc-900 flex items-center justify-center text-[9px] font-mono font-bold uppercase text-zinc-700 tracking-widest">Archivo vacío</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {state.savedRenders.map(r => (
                    <Card key={r.id} title={r.id.split('_')[1]} subtitle={new Date(r.createdAt).toLocaleDateString()}>
                      <div className="aspect-[3/4] rounded-lg overflow-hidden mb-3 border border-zinc-900 bg-zinc-950 shadow-inner relative group">
                        <img src={r.outBase64} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
                           <p className="text-[7px] font-mono text-white/60 leading-tight">{r.finalPrompt}</p>
                        </div>
                      </div>
                      
                      {/* Telemetría EXIF Strip */}
                      <div className="flex justify-between items-center mb-5 px-1 bg-black/30 py-1 rounded border border-white/5">
                        <div className="flex flex-col">
                          <span className="text-[7px] font-mono text-zinc-500 uppercase">Óptica: {r.metadata?.gear?.focalLength || '50mm'}</span>
                          <span className="text-[7px] font-mono text-zinc-500 uppercase">Film: {r.metadata?.gear?.filmStock || 'Digital'}</span>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="text-[7px] font-mono text-zinc-600 uppercase">Sensor: {r.metadata?.engineMode === 'live' ? 'FullFrame' : 'Standard'}</span>
                           <span className="text-[7px] font-mono text-zinc-700 uppercase">ID: {r.id.split('_')[1]}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <Button onClick={() => downloadHighRes(r.outBase64!, r.id)}>Exportar Original</Button>
                        <Button variant="danger" onClick={() => setState(p => ({ ...p, savedRenders: p.savedRenders.filter(x => x.id !== r.id) }))}>Eliminar</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-10">
              <div className="flex justify-between items-end border-b border-zinc-900 pb-6">
                <div className="flex flex-col">
                  <h2 className="text-3xl font-mono font-black italic text-zinc-700 uppercase tracking-tighter">Hoja de <span className="text-zinc-800">Contactos</span></h2>
                  <span className="text-[8px] font-mono text-zinc-800 uppercase tracking-widest mt-1">Tomas Recientes de la Sesión</span>
                </div>
                <Button variant="danger" className="text-[8px] py-1 px-3" onClick={() => setState(p => ({...p, renderLibrary: []}))}>Vaciar Carrete</Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {state.renderLibrary.map(r => (
                  <Card key={r.id} title={r.id.split('_')[1]} subtitle={r.metadata?.usedModel || "RAW"}>
                    <div className="aspect-[3/4] rounded-lg overflow-hidden mb-3 border border-zinc-900 bg-zinc-950 group relative">
                      <img src={r.outBase64} className="w-full h-full object-cover transition-all duration-700 grayscale group-hover:grayscale-0" />
                      <div className="absolute bottom-3 left-3"><Badge color="red">M: {r.metadata?.identityValidation?.matchScore}%</Badge></div>
                    </div>

                    {/* Telemetría EXIF Strip */}
                    <div className="flex justify-between items-center mb-5 px-1 bg-black/30 py-1 rounded border border-white/5">
                        <div className="flex flex-col">
                          <span className="text-[7px] font-mono text-zinc-500 uppercase">Óptica: {r.metadata?.gear?.focalLength || '50mm'}</span>
                          <span className="text-[7px] font-mono text-zinc-500 uppercase">Film: {r.metadata?.gear?.filmStock || 'Digital'}</span>
                        </div>
                        <div className="flex flex-col items-end">
                           <span className="text-[7px] font-mono text-zinc-600 uppercase">Sensor: {r.metadata?.engineMode === 'live' ? 'FullFrame' : 'Standard'}</span>
                           <span className="text-[7px] font-mono text-zinc-700 uppercase">ID: {r.id.split('_')[1]}</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Button variant="secondary" className="flex-1" onClick={() => downloadHighRes(r.outBase64!, r.id)}>Exportar</Button>
                        <Button variant="primary" className="flex-1" onClick={() => saveToVault(r)}><ICONS.RENDER_VAULT /></Button>
                      </div>
                      <Button variant="danger" onClick={() => setState(p => ({ ...p, renderLibrary: p.renderLibrary.filter(x => x.id !== r.id) }))}>Eliminar</Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === ViewMode.ANALYTICS && (
          <div className="max-w-5xl mx-auto space-y-12 animate-in fade-in duration-700 pb-24">
            <div className="text-center space-y-4">
                <Badge>Telemetría v1.7.0</Badge>
                <h2 className="text-5xl font-mono font-black text-zinc-100 italic uppercase tracking-tighter">Bitácora de <span className="text-red-600">Exposición</span></h2>
                <p className="text-zinc-600 text-[9px] font-mono font-bold uppercase tracking-[0.2em]">Rendimiento del sensor y calidad de los revelados químicos.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
                <Card title="Disparos" subtitle="Total Sesión">
                    <p className="text-4xl font-mono font-black text-white">{stats.totalGenerations}</p>
                </Card>
                <Card title="Eficiencia" subtitle="Match Promedio">
                    <p className="text-4xl font-mono font-black text-red-600">{Math.round(stats.averageMatchScore)}%</p>
                </Card>
                <Card title="Protocolos" subtitle="Intentos Avg">
                    <p className="text-4xl font-mono font-black text-white">{stats.averageAttempts.toFixed(1)}</p>
                </Card>
                <Card title="Fidelidad" subtitle="Ratio Éxito">
                    <p className="text-4xl font-mono font-black text-emerald-500">{stats.totalGenerations ? Math.round((stats.successfulGenerations / stats.totalGenerations) * 100) : 0}%</p>
                </Card>
            </div>

            <Card title="Distribución de Calidad por Nivel de 'Strength'" subtitle="Análisis de preservación de identidad">
                <div className="space-y-8 py-4">
                    {[
                        { label: 'RETOQUE (0-30%)', data: distribution.low },
                        { label: 'BALANCE (30-70%)', data: distribution.medium },
                        { label: 'DRAMA (70-100%)', data: distribution.high }
                    ].map((row, idx) => (
                        <div key={idx} className="space-y-3">
                            <div className="flex justify-between items-center text-[10px] font-mono font-bold uppercase tracking-widest">
                                <span className="text-zinc-500">{row.label}</span>
                                <span className="text-zinc-300">Score: {Math.round(row.data.avgScore)}% | {row.data.count} Disparos</span>
                            </div>
                            <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-1000 ${row.data.avgScore > 90 ? 'bg-emerald-500' : row.data.avgScore > 80 ? 'bg-red-600' : 'bg-zinc-700'}`} 
                                    style={{ width: `${row.data.avgScore}%` }} 
                                />
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <div className="flex justify-center">
                <Button variant="danger" onClick={() => analytics.clearMetrics()}>Limpiar Telemetría de Sesión</Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
