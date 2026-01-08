
import React, { useState, useCallback, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { 
  InternalState, 
  ViewMode, 
  RenderItem,
  EngineMode,
  DarkroomSettings
} from './types';
import { INITIAL_POSES, STYLE_MAP, SKIN_MAP, ICONS } from './constants';
import { analyzeFaceImage } from './geminiService';
import { revealImageWithRetry, editWithNanoBanana } from './imageGenService';

// --- UI Components ---

const Badge = ({ children, color = 'indigo', className = "" }: { children: React.ReactNode, color?: string, className?: string }) => {
  const colors: any = { 
    indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', 
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    zinc: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
  };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${colors[color] || ''} ${className}`}>{children}</span>;
};

const Card = ({ children, title, subtitle, className = "" }: { children: React.ReactNode, title?: string, subtitle?: string, className?: string }) => (
  <div className={`glass rounded-[2rem] overflow-hidden border border-white/5 flex flex-col ${className}`}>
    {(title || subtitle) && (
      <div className="px-6 py-4 border-b border-white/5 bg-white/[0.02]">
        {title && <h3 className="text-[10px] font-black text-white uppercase italic tracking-widest">{title}</h3>}
        {subtitle && <p className="text-[8px] text-zinc-500 uppercase font-bold tracking-widest mt-0.5">{subtitle}</p>}
      </div>
    )}
    <div className="p-6 flex-1">{children}</div>
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = "", disabled = false }: { children: React.ReactNode, onClick?: () => void, variant?: 'primary' | 'secondary' | 'danger', className?: string, disabled?: boolean }) => {
  const base = "px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2";
  const variants = {
    primary: "bg-white text-black hover:bg-zinc-200 shadow-xl",
    secondary: "bg-zinc-900 text-white border border-white/10 hover:bg-zinc-800",
    danger: "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
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
  const [engineMode, setEngineMode] = useState<EngineMode>('offline'); // offline = Nativo, live = Pro
  const [toast, setToast] = useState<string | null>(null);
  // Add missing state for Retoque Express feature
  const [editPrompt, setEditPrompt] = useState('');
  
  const [state, setState] = useState<InternalState>(() => {
    const saved = localStorage.getItem('fotografo_vault_v1.6');
    const base: InternalState = {
      version: "1.6.0",
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

  // Persistence
  useEffect(() => {
    localStorage.setItem('fotografo_vault_v1.6', JSON.stringify({
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
      const prompt = `portrait of a person with ${s.facialTraits?.shape} face, ${s.facialTraits?.eyes} eyes. pose: ${s.currentPose?.prompt}. style: ${STYLE_MAP[s.currentStyle]}. environment: ${s.currentContext || 'professional studio'}. skin: ${SKIN_MAP[s.currentSkin]}.`;
      const result = await revealImageWithRetry(prompt, s.previewImage, s.darkroomSettings, engineMode, (attempt, score) => setRetryInfo({ attempt, score }));
      setState(prev => ({ ...prev, renderLibrary: [result.renderItem, ...prev.renderLibrary] }));
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
      setToast("Procesando descarga 4K...");
      const res = await fetch(imageBase64);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FOTOGRAFO_NATIVE_${id}_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToast("Descarga exitosa");
    } catch (e) {
      setToast("Error al descargar");
    }
  };

  const saveToVault = (item: RenderItem) => {
    if (state.savedRenders.find(s => s.id === item.id)) {
      setToast("Ya guardado");
      return;
    }
    setState(prev => ({ ...prev, savedRenders: [item, ...prev.savedRenders] }));
    setToast("Añadido a la Bóveda");
  };

  return (
    <div className="min-h-screen bg-[#010101] text-zinc-300 font-sans flex overflow-hidden selection:bg-indigo-500 selection:text-white">
      {toast && (
        <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[300] bg-white text-black px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          {toast}
        </div>
      )}

      {/* Responsive Engine Switch */}
      <div className="fixed top-6 right-6 z-[100] flex flex-col sm:flex-row gap-2 items-end">
        <div className="bg-black/40 backdrop-blur-3xl border border-white/5 p-1 rounded-2xl flex items-center shadow-2xl">
          <button 
            onClick={() => setEngineMode('offline')}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${engineMode === 'offline' ? 'bg-zinc-100 text-black' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            Nativo
          </button>
          <button 
            onClick={() => setEngineMode('live')}
            className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${engineMode === 'live' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-zinc-600 hover:text-zinc-400'}`}
          >
            Pro
          </button>
        </div>
        {engineMode === 'live' && !hasGeminiKey && (
          <button onClick={handleSelectKey} className="text-[8px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-lg border border-indigo-500/20 animate-pulse">
            Configurar API Key
          </button>
        )}
      </div>
      
      <nav className="hidden sm:flex w-24 bg-black border-r border-white/5 flex-col items-center py-12 space-y-10 z-50">
        <div className="text-white font-black italic text-3xl mb-10 select-none">FA</div>
        {[
          { m: ViewMode.ANALYSIS, icon: <ICONS.ANALYSIS />, t: 'ADN' },
          { m: ViewMode.ARCHITECT, icon: <ICONS.ARCHITECT />, t: 'Arq' },
          { m: ViewMode.DARKROOM, icon: <ICONS.DARKROOM />, t: 'Revel' },
          { m: ViewMode.RENDER_VAULT, icon: <ICONS.RENDER_VAULT />, t: 'Vault' }
        ].map(item => (
          <button key={item.m} onClick={() => setView(item.m)} className={`group relative p-4 rounded-3xl transition-all duration-500 ${view === item.m ? 'bg-indigo-600 text-white shadow-[0_0_30px_#4f46e5]' : 'text-zinc-800 hover:text-zinc-400 hover:bg-white/5'}`}>
             {item.icon}
             <span className="absolute left-full ml-4 px-2 py-1 rounded bg-zinc-900 border border-white/10 text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity z-[100] whitespace-nowrap pointer-events-none">{item.t}</span>
          </button>
        ))}
      </nav>
      
      <main className="flex-1 overflow-y-auto p-6 sm:p-12 custom-scrollbar relative bg-gradient-to-br from-[#010101] to-[#040404]">
        {/* Mobile Navigation */}
        <div className="flex sm:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-black/80 backdrop-blur-xl border border-white/10 p-2 rounded-3xl shadow-2xl gap-2">
          {[
            { m: ViewMode.ANALYSIS, icon: <ICONS.ANALYSIS /> },
            { m: ViewMode.ARCHITECT, icon: <ICONS.ARCHITECT /> },
            { m: ViewMode.DARKROOM, icon: <ICONS.DARKROOM /> },
            { m: ViewMode.RENDER_VAULT, icon: <ICONS.RENDER_VAULT /> }
          ].map(item => (
            <button key={item.m} onClick={() => setView(item.m)} className={`p-4 rounded-2xl transition-all ${view === item.m ? 'bg-indigo-600 text-white' : 'text-zinc-500'}`}>
              {item.icon}
            </button>
          ))}
        </div>

        <header className="flex justify-between items-center mb-16 sm:mb-24 h-12">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black italic text-white uppercase tracking-tighter">EL FOTÓGRAFO</h1>
            <span className="text-[9px] font-black text-zinc-700 tracking-[0.3em] uppercase">Platinum Core v1.6.0</span>
          </div>
        </header>
        
        {view === ViewMode.ANALYSIS && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
            <div className="text-center space-y-4">
              <Badge>{engineMode === 'live' ? 'Stack Pro 4K' : 'Stack Nativo Flash'}</Badge>
              <h2 className="text-4xl sm:text-6xl font-black text-white italic uppercase tracking-tighter">Captura de <span className="text-indigo-500">ADN</span></h2>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">Extraiga biometría facial única para una preservación perfecta.</p>
            </div>
            <div className="h-[300px] sm:h-[400px] border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.02] flex flex-col items-center justify-center p-12 group hover:border-indigo-500/50 transition-all cursor-pointer relative overflow-hidden" onClick={() => fileInputRef.current?.click()}>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
              {loading ? (
                <div className="flex flex-col items-center space-y-6">
                  <div className="animate-spin w-16 h-16 border-2 border-indigo-500 border-t-transparent rounded-full" />
                  <p className="text-white font-black uppercase italic tracking-widest animate-pulse">Mapeando geometría...</p>
                </div>
              ) : (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto text-indigo-400 group-hover:scale-110 transition-transform"><ICONS.ANALYSIS /></div>
                  <p className="text-[10px] font-black uppercase text-zinc-600 tracking-[0.3em]">Cargar negativo digital</p>
                </div>
              )}
              <div className="scan-line absolute w-full left-0 z-0"></div>
            </div>
          </div>
        )}

        {view === ViewMode.ARCHITECT && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-700 pb-24 sm:pb-0">
            <div className="lg:col-span-4 space-y-8">
              <Card title="ADN Activo" subtitle={state.currentSession.facialId || "PENDIENTE"}>
                <div className="relative group aspect-[3/4] rounded-2xl overflow-hidden border border-white/5 shadow-2xl">
                  {state.currentSession.previewImage && <img src={state.currentSession.previewImage} className="w-full h-full object-cover" />}
                </div>
                {state.currentSession.facialTraits && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {state.currentSession.facialTraits.features.map((f, i) => <Badge key={i} color="zinc">{f}</Badge>)}
                  </div>
                )}
              </Card>
              <Card title="Retoque Express">
                <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder="Ej: cambiar ropa a traje negro, añadir gafas..." className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-[11px] text-white outline-none h-24 focus:border-indigo-500 transition-colors" />
                <Button className="w-full mt-4" onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await editWithNanoBanana(state.currentSession.previewImage!, editPrompt);
                    setState(p => ({ ...p, currentSession: { ...p.currentSession, previewImage: res } }));
                    setToast("Edición aplicada");
                  } catch (e) { alert("Error"); } finally { setLoading(false); }
                }}>Ejecutar Flash Edit</Button>
              </Card>
            </div>
            <div className="lg:col-span-8 space-y-8">
               <Card title="Blueprint de Pose">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-4">
                    {state.poseBank.map(p => (
                      <button key={p.id} onClick={() => setState(s => ({ ...s, currentSession: { ...s.currentSession, currentPose: p } }))} className={`p-6 rounded-[2rem] border text-left transition-all ${state.currentSession.currentPose?.id === p.id ? 'bg-white text-black border-white' : 'bg-white/5 border-white/5 text-zinc-500 hover:bg-white/[0.08]'}`}>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-2">{p.name}</p>
                        <p className="text-[9px] font-mono italic opacity-60 leading-relaxed">{p.prompt}</p>
                      </button>
                    ))}
                  </div>
               </Card>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <Card title="Iluminación">
                    <div className="grid grid-cols-2 gap-2">
                      {Object.keys(STYLE_MAP).map(s => (
                        <button key={s} onClick={() => setState(p => ({ ...p, currentSession: { ...p.currentSession, currentStyle: s as any } }))} className={`py-3 rounded-xl border text-[9px] font-black uppercase tracking-widest ${state.currentSession.currentStyle === s ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/5'}`}>{s}</button>
                      ))}
                    </div>
                  </Card>
                  <Card title="Textura Piel">
                    <div className="grid grid-cols-1 gap-2">
                      {Object.keys(SKIN_MAP).map(s => (
                        <button key={s} onClick={() => setState(p => ({ ...p, currentSession: { ...p.currentSession, currentSkin: s as any } }))} className={`py-3 px-4 rounded-xl border text-[9px] font-black uppercase tracking-widest flex justify-between items-center ${state.currentSession.currentSkin === s ? 'bg-white text-black border-white' : 'bg-white/5 border-white/5'}`}>
                          {s}
                          <div className={`w-1.5 h-1.5 rounded-full ${state.currentSession.currentSkin === s ? 'bg-black animate-pulse' : 'bg-zinc-800'}`} />
                        </button>
                      ))}
                    </div>
                  </Card>
               </div>
               <div className="flex justify-end"><Button onClick={() => setView(ViewMode.DARKROOM)} className="h-20 px-12 text-lg">Preparar Revelado</Button></div>
            </div>
          </div>
        )}

        {view === ViewMode.DARKROOM && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700 pb-24 sm:pb-0">
            <Card title={`Darkroom ${engineMode === 'live' ? 'Pro' : 'Nativo'}`} className="h-[500px] sm:h-[600px] relative overflow-hidden group shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
              {darkroomLoading ? (
                <div className="absolute inset-0 bg-black/98 flex flex-col items-center justify-center space-y-10 z-50">
                  <div className="w-24 h-24 border border-white/10 rounded-full flex items-center justify-center text-white"><ICONS.DARKROOM /></div>
                  <div className="text-center space-y-4">
                    <p className="text-white font-black italic uppercase tracking-[0.4em] text-xl animate-pulse">Revelando Calidad {engineMode === 'live' ? '4K' : 'HD'}</p>
                    {retryInfo && <Badge color="amber">Afinando biometría: {retryInfo.score}%</Badge>}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-20 text-center space-y-12">
                  <div className="w-32 h-32 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto text-indigo-400 scale-125 mb-6"><ICONS.DARKROOM /></div>
                  <div className="space-y-6">
                    <h3 className="text-5xl font-black italic text-white uppercase tracking-tighter">Renderizado <span className="text-indigo-500">Nativo</span></h3>
                    <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] max-w-md mx-auto leading-relaxed">
                      El motor Platinum utilizará {engineMode === 'live' ? 'un stack de cascada Pro' : 'un modelo Flash optimizado'} para garantizar identidad y realismo.
                    </p>
                  </div>
                  <Button onClick={handleReveal} className="h-24 px-32 text-2xl shadow-[0_0_80px_rgba(79,70,229,0.3)] hover:scale-105 transition-transform">Ejecutar Render</Button>
                </div>
              )}
            </Card>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <Card title="Resolución">
                <div className="grid grid-cols-3 gap-2">
                  {['1K', '2K', '4K'].map(r => (
                    <button key={r} onClick={() => setState(p => ({ ...p, currentSession: { ...p.currentSession, darkroomSettings: { ...p.currentSession.darkroomSettings, resolution: r as any } } }))} className={`py-3 rounded-xl border text-[9px] font-black uppercase ${state.currentSession.darkroomSettings.resolution === r ? 'bg-white text-black' : 'bg-white/5 border-white/5'}`}>{r}</button>
                  ))}
                </div>
              </Card>
              <Card title="Aspect Ratio">
                <div className="grid grid-cols-2 gap-2">
                  {['1:1', '16:9', '9:16', '4:3'].map(r => (
                    <button key={r} onClick={() => setState(p => ({ ...p, currentSession: { ...p.currentSession, darkroomSettings: { ...p.currentSession.darkroomSettings, aspectRatio: r as any } } }))} className={`py-3 rounded-xl border text-[9px] font-black uppercase ${state.currentSession.darkroomSettings.aspectRatio === r ? 'bg-indigo-600 text-white' : 'bg-white/5 border-white/5'}`}>{r}</button>
                  ))}
                </div>
              </Card>
              <Card title="Fidelidad ADN">
                <input type="range" min="0" max="1" step="0.1" value={state.currentSession.darkroomSettings.strength} onChange={(e) => setState(p => ({ ...p, currentSession: { ...p.currentSession, darkroomSettings: { ...p.currentSession.darkroomSettings, strength: parseFloat(e.target.value) } } }))} className="w-full accent-indigo-500" />
              </Card>
            </div>
          </div>
        )}

        {view === ViewMode.RENDER_VAULT && (
          <div className="space-y-24 animate-in fade-in duration-700 pb-24 sm:pb-0">
            {/* Saved Vault Section */}
            <div className="space-y-12">
              <div className="flex justify-between items-end border-b border-white/5 pb-8">
                <h2 className="text-5xl font-black italic text-white uppercase tracking-tighter">Bóveda <span className="text-indigo-500">Permanente</span></h2>
                <Badge color="emerald">Colección VIP</Badge>
              </div>
              {state.savedRenders.length === 0 ? (
                <div className="h-48 rounded-[3rem] border border-dashed border-white/5 flex items-center justify-center text-[10px] font-black uppercase text-zinc-800 tracking-widest">Vault vacío</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                  {state.savedRenders.map(r => (
                    <Card key={r.id} title={r.id} subtitle={new Date(r.createdAt).toLocaleDateString()}>
                      <div className="aspect-[3/4] rounded-2xl overflow-hidden mb-6 border border-white/5 shadow-2xl bg-zinc-900">
                        <img src={r.outBase64} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col gap-3">
                        <Button variant="secondary" onClick={() => downloadHighRes(r.outBase64!, r.id)}>Descargar Full</Button>
                        <Button variant="danger" onClick={() => setState(p => ({ ...p, savedRenders: p.savedRenders.filter(x => x.id !== r.id) }))}>Eliminar</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Session History Section */}
            <div className="space-y-12">
              <div className="flex justify-between items-end border-b border-white/5 pb-8">
                <h2 className="text-5xl font-black italic text-zinc-600 uppercase tracking-tighter">Historial <span className="text-zinc-800">Sesión</span></h2>
                <Button variant="danger" onClick={() => setState(p => ({...p, renderLibrary: []}))}>Purgar</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                {state.renderLibrary.map(r => (
                  <Card key={r.id} title={r.id} subtitle={r.metadata?.usedModel || "DESCONOCIDO"}>
                    <div className="aspect-[3/4] rounded-2xl overflow-hidden mb-6 border border-white/5 shadow-2xl bg-zinc-900 group relative">
                      <img src={r.outBase64} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                      <div className="absolute top-4 right-4"><Badge color="indigo">Match: {r.metadata?.identityValidation?.matchScore}%</Badge></div>
                    </div>
                    <div className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <Button variant="secondary" className="flex-1" onClick={() => downloadHighRes(r.outBase64!, r.id)}>Descargar</Button>
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
      </main>
    </div>
  );
};

export default App;
