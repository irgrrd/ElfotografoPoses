
import React, { useState, useCallback, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import saveAs from 'file-saver';
import { 
  InternalState, 
  ViewMode, 
  AuditLog, 
  AnalysisItem, 
  RenderItem,
  DarkroomSettings,
  IdentityValidation,
  RevealResult,
  AspectRatio,
  ImageSize
} from './types';
import { INITIAL_POSES, STYLE_MAP, SKIN_MAP, ICONS, DARKROOM_PRESETS } from './constants';
import { analyzeFaceImage } from './geminiService';
import { revealImageWithRetry, editWithNanoBanana } from './imageGenService';
import { analytics } from './analyticsService';

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
  const base = "px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50";
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
  const [editPrompt, setEditPrompt] = useState("");
  
  const [state, setState] = useState<InternalState>({
    version: "1.5.0",
    poseBank: INITIAL_POSES,
    promptLibrary: [],
    analysisLibrary: [],
    renderLibrary: [],
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
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const has = await window.aistudio.hasSelectedApiKey();
        setHasGeminiKey(!!has);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasGeminiKey(true);
    }
  };

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const result = await analyzeFaceImage(base64, state.currentSession.isThinkingMode);
        const fid = `ADN_${Math.random().toString(36).substr(2,4).toUpperCase()}`;
        setState(prev => ({
          ...prev,
          analysisLibrary: [{ id: fid, traits: result.traits, analysisText: result.analysisText, timestamp: new Date().toISOString(), imageBase64: base64 }, ...prev.analysisLibrary],
          currentSession: { ...prev.currentSession, facialTraits: result.traits, facialId: fid, previewImage: base64 }
        }));
        setView(ViewMode.ARCHITECT);
      };
      reader.readAsDataURL(file);
    } catch (err) { 
      console.error(err); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleReveal = async () => {
    const s = state.currentSession;
    if (!s.previewImage) return;

    if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
      await handleSelectKey();
    }

    setDarkroomLoading(true);
    try {
      const prompt = `portrait of a person with ${s.facialTraits?.shape} face, ${s.facialTraits?.eyes} eyes, features: ${s.facialTraits?.features.join(', ')}. pose: ${s.currentPose?.prompt}. style: ${STYLE_MAP[s.currentStyle]}. environment: ${s.currentContext || 'high-end studio'}. ultra-realistic skin texture: ${SKIN_MAP[s.currentSkin]}.`;
      const result = await revealImageWithRetry(prompt, s.previewImage, s.darkroomSettings, (attempt, score) => setRetryInfo({ attempt, score }));
      setState(prev => ({ ...prev, renderLibrary: [result.renderItem, ...prev.renderLibrary] }));
      setView(ViewMode.RENDER_VAULT);
    } catch (err: any) {
      if (err.message?.includes("entity was not found")) {
        setHasGeminiKey(false);
        await handleSelectKey();
      }
      console.error(err);
    } finally { 
      setDarkroomLoading(false); 
      setRetryInfo(null); 
    }
  };

  const renderAnalysis = () => (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
      <div className="text-center space-y-4">
        <Badge>Fase 01: Ingesta Pro Thinking</Badge>
        <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter">Captura de <span className="text-indigo-500">ADN</span></h2>
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Extraiga la biometría única mediante razonamiento profundo de Gemini 3 Pro.</p>
      </div>
      <div className="h-[400px] border-2 border-dashed border-white/10 rounded-[3rem] bg-white/[0.02] flex flex-col items-center justify-center p-12 group hover:border-indigo-500/50 transition-all cursor-pointer relative overflow-hidden" onClick={() => fileInputRef.current?.click()}>
        <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
        {loading ? (
          <div className="flex flex-col items-center space-y-6">
            <div className="animate-spin w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full" />
            <p className="text-white font-black uppercase italic tracking-widest animate-pulse">Analizando estructura ósea...</p>
          </div>
        ) : (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto mb-6 text-indigo-400"><ICONS.ANALYSIS /></div>
            <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">Arrastre o seleccione un retrato</p>
          </div>
        )}
        <div className="scan-line absolute w-full left-0 z-0"></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {state.analysisLibrary.map(item => (
          <Card key={item.id} title={item.id}>
            <img src={item.imageBase64} className="aspect-square object-cover rounded-xl grayscale opacity-50 hover:opacity-100 transition-all cursor-pointer border border-white/5" onClick={() => { setState(prev => ({ ...prev, currentSession: { ...prev.currentSession, facialTraits: item.traits, facialId: item.id, previewImage: item.imageBase64 } })); setView(ViewMode.ARCHITECT); }} />
          </Card>
        ))}
      </div>
    </div>
  );

  const renderArchitect = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-700">
      <div className="lg:col-span-4 space-y-8">
        <Card title="ADN Activo" subtitle={state.currentSession.facialId || ""}>
          <div className="relative group">
            <img src={state.currentSession.previewImage} className="w-full aspect-[3/4] object-cover rounded-2xl shadow-2xl border border-white/5" />
            <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
          </div>
          {state.currentSession.facialTraits && (
             <div className="mt-4 p-4 rounded-xl bg-white/5 border border-white/5 space-y-2">
                <p className="text-[8px] text-indigo-400 font-black uppercase">Rasgos Detectados</p>
                <div className="flex flex-wrap gap-2">
                  {state.currentSession.facialTraits.features.map((f, i) => <Badge key={i} color="indigo" className="text-[8px]">{f}</Badge>)}
                </div>
             </div>
          )}
        </Card>
        <Card title="Edición Inteligente Flash">
          <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder="Ej: añadir gafas de sol, cambiar ropa a cuero, fondo neón..." className="w-full bg-black/40 border border-white/5 rounded-xl p-4 text-[10px] text-white outline-none h-24 mb-4 focus:border-indigo-500 transition-colors" />
          <Button className="w-full" onClick={async () => { 
            setLoading(true);
            try {
              const res = await editWithNanoBanana(state.currentSession.previewImage!, editPrompt); 
              setState(p => ({ ...p, currentSession: { ...p.currentSession, previewImage: res } }));
              setEditPrompt("");
            } catch(e) { console.error(e); } finally { setLoading(false); }
          }}>Aplicar Edición</Button>
        </Card>
      </div>
      <div className="lg:col-span-8 space-y-8">
        <Card title="Blueprint de Pose">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-[350px] overflow-y-auto custom-scrollbar pr-4">
            {state.poseBank.map(p => (
              <button key={p.id} onClick={() => setState(s => ({ ...s, currentSession: { ...s.currentSession, currentPose: p } }))} className={`p-5 rounded-2xl border text-left transition-all group ${state.currentSession.currentPose?.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg scale-[0.98]' : 'bg-white/5 border-white/5 text-zinc-500 hover:border-white/20'}`}>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-black uppercase tracking-widest">{p.name}</p>
                  <Badge color={state.currentSession.currentPose?.id === p.id ? 'indigo' : 'zinc'}>{p.optics.lensMm}mm</Badge>
                </div>
                <p className="text-[9px] opacity-60 font-mono italic leading-relaxed">{p.prompt}</p>
              </button>
            ))}
          </div>
        </Card>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card title="Estética & Luz">
             <div className="grid grid-cols-2 gap-3">
                {Object.keys(STYLE_MAP).map(style => (
                  <button key={style} onClick={() => setState(s => ({ ...s, currentSession: { ...s.currentSession, currentStyle: style as any } }))}
                    className={`p-3 rounded-xl border text-[9px] font-black uppercase transition-all ${state.currentSession.currentStyle === style ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-zinc-500 hover:bg-white/10'}`}>
                    {style}
                  </button>
                ))}
             </div>
          </Card>
          <Card title="Textura Cutánea">
             <div className="grid grid-cols-1 gap-2">
                {Object.keys(SKIN_MAP).map(skin => (
                  <button key={skin} onClick={() => setState(s => ({ ...s, currentSession: { ...s.currentSession, currentSkin: skin as any } }))}
                    className={`p-3 rounded-xl border text-[9px] font-black uppercase transition-all flex justify-between items-center ${state.currentSession.currentSkin === skin ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white/5 border-white/10 text-zinc-500'}`}>
                    {skin}
                    <div className={`w-1.5 h-1.5 rounded-full ${state.currentSession.currentSkin === skin ? 'bg-white animate-pulse' : 'bg-zinc-800'}`} />
                  </button>
                ))}
             </div>
          </Card>
        </div>
        <Card title="Escenario">
          <input type="text" value={state.currentSession.currentContext} onChange={(e) => setState(s => ({ ...s, currentSession: { ...s.currentSession, currentContext: e.target.value } }))} placeholder="Ej: penthouse minimalista en Nueva York, callejón neón en Tokio..." className="w-full bg-black/40 border border-white/5 rounded-xl p-5 text-sm outline-none focus:border-indigo-500 transition-colors" />
        </Card>
        <div className="flex justify-end"><Button onClick={() => setView(ViewMode.DARKROOM)} className="h-16 px-16 text-lg">Finalizar Arquitectura</Button></div>
      </div>
    </div>
  );

  const renderDarkroom = () => (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
      <Card title="Cámara Oscura Platinum" className="h-[600px] relative overflow-hidden group shadow-[0_50px_100px_rgba(0,0,0,1)]">
        {darkroomLoading ? (
          <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center space-y-10 z-50">
            <div className="relative">
              <div className="w-24 h-24 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-indigo-500"><ICONS.DARKROOM /></div>
            </div>
            <div className="space-y-4 text-center">
              <p className="text-white font-black italic uppercase tracking-[0.3em] text-xl animate-pulse">Revelando Calidad Nativa</p>
              {retryInfo && (
                <div className="space-y-2">
                  <Badge color="amber">Fidelidad: {retryInfo.score}%</Badge>
                  <p className="text-[9px] text-zinc-600 uppercase font-black">Optimizando rasgos biométricos (Intento {retryInfo.attempt})</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center space-y-12 p-20 text-center">
            <div className="w-32 h-32 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mx-auto animate-pulse text-indigo-400 scale-125"><ICONS.DARKROOM /></div>
            <div className="space-y-6">
              <h3 className="text-5xl font-black italic text-white uppercase tracking-tighter">Motor <span className="text-indigo-500">Platinum</span></h3>
              <p className="text-zinc-500 text-sm uppercase font-bold tracking-widest max-w-lg mx-auto leading-relaxed">Gemini 3 Pro Image generará su retrato en 4K preservando su ADN facial con precisión algorítmica.</p>
            </div>
            <Button onClick={handleReveal} className="h-24 px-32 text-2xl shadow-[0_0_80px_rgba(79,70,229,0.3)] hover:scale-105 transition-transform">Iniciar Revelado</Button>
          </div>
        )}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-indigo-500/5 to-transparent pointer-events-none"></div>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card title="Ajustes de Render">
           <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center"><label className="text-[9px] text-zinc-500 font-black uppercase">Fidelidad ADN</label><span className="text-white font-mono text-[10px]">{Math.round(state.currentSession.darkroomSettings.strength * 100)}%</span></div>
                <input type="range" min="0" max="1" step="0.05" value={state.currentSession.darkroomSettings.strength} onChange={(e) => setState(s => ({ ...s, currentSession: { ...s.currentSession, darkroomSettings: { ...s.currentSession.darkroomSettings, strength: parseFloat(e.target.value) } } }))} className="w-full accent-indigo-500" />
              </div>
           </div>
        </Card>
        <Card title="Resolución Nativa">
          <div className="grid grid-cols-3 gap-2">
            {['1K', '2K', '4K'].map(res => (
              <button key={res} onClick={() => setState(s => ({ ...s, currentSession: { ...s.currentSession, darkroomSettings: { ...s.currentSession.darkroomSettings, resolution: res as any } } }))}
                className={`p-3 rounded-xl border text-[10px] font-black uppercase transition-all ${state.currentSession.darkroomSettings.resolution === res ? 'bg-white text-black border-white' : 'bg-white/5 border-white/10 text-zinc-500'}`}>
                {res}
              </button>
            ))}
          </div>
        </Card>
        <Card title="Aspect Ratio">
          <div className="grid grid-cols-2 gap-2">
            {['1:1', '4:3', '16:9', '9:16'].map(ratio => (
              <button key={ratio} onClick={() => setState(s => ({ ...s, currentSession: { ...s.currentSession, darkroomSettings: { ...s.currentSession.darkroomSettings, aspectRatio: ratio as any } } }))}
                className={`p-3 rounded-xl border text-[10px] font-black uppercase transition-all ${state.currentSession.darkroomSettings.aspectRatio === ratio ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white/5 border-white/10 text-zinc-500'}`}>
                {ratio}
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );

  const renderAnalytics = () => {
    const stats = analytics.getSessionStats();
    const distribution = analytics.getStrengthDistribution();
    
    return (
      <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
        <div className="text-center space-y-4">
          <Badge>Protocolo Sentinel v1.5</Badge>
          <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter">Telemetría de <span className="text-indigo-500">Sesión</span></h2>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Optimización de identidad y métricas de rendimiento del motor Platinum.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card title="Total" subtitle="Generaciones">
            <div className="text-4xl font-black text-white italic">{stats.totalGenerations}</div>
          </Card>
          <Card title="Éxito" subtitle="Preservación OK">
            <div className="text-4xl font-black text-emerald-400 italic">{stats.successfulGenerations}</div>
          </Card>
          <Card title="Match Promedio" subtitle="Score Biométrico">
            <div className="text-4xl font-black text-indigo-400 italic">{Math.round(stats.averageMatchScore)}%</div>
          </Card>
          <Card title="Iteraciones" subtitle="Avg Attempts">
            <div className="text-4xl font-black text-amber-400 italic">{stats.averageAttempts.toFixed(1)}</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card title="Distribución por Strength" subtitle="Performance Sentinel">
            <div className="space-y-6">
              {[
                { label: 'Low (<0.3)', data: distribution.low, color: 'emerald' },
                { label: 'Medium (0.3-0.7)', data: distribution.medium, color: 'indigo' },
                { label: 'High (>0.7)', data: distribution.high, color: 'amber' }
              ].map(item => (
                <div key={item.label} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-zinc-500">{item.label}</span>
                    <Badge color={item.color}>{item.data.count} renders</Badge>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
                    <span>Score Promedio</span>
                    <span>{Math.round(item.data.avgScore)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-1000 bg-${item.color}-500`} style={{ width: `${item.data.avgScore}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          
          <Card title="Control de Telemetría" subtitle="Gestión de Datos">
             <div className="flex flex-col gap-4 h-full justify-center">
                <Button onClick={() => {
                  const data = analytics.exportMetrics();
                  const blob = new Blob([data], { type: 'application/json' });
                  saveAs(blob, `SENTINEL_METRICS_${Date.now()}.json`);
                }}>Exportar Dataset JSON</Button>
                <Button variant="danger" onClick={() => {
                  if (confirm('¿Purgar base de datos de telemetría?')) {
                    analytics.clearMetrics();
                    setView(ViewMode.ANALYSIS);
                  }
                }}>Purgar Métricas</Button>
             </div>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#010101] text-zinc-300 font-sans flex overflow-hidden">
      {!hasGeminiKey && view !== ViewMode.ANALYSIS && (
        <div className="fixed inset-0 bg-black/98 z-[200] flex items-center justify-center p-8 backdrop-blur-3xl animate-in fade-in">
          <Card title="Motor Nativo Desconectado" className="max-w-xl p-16 text-center space-y-12 shadow-[0_0_100px_rgba(79,70,229,0.2)]">
            <div className="w-24 h-24 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto text-indigo-400 scale-125 mb-4"><ICONS.Key /></div>
            <div className="space-y-4">
              <p className="text-white font-black uppercase tracking-widest text-lg">Requiere Autorización Pro</p>
              <p className="text-zinc-500 text-[11px] uppercase font-black tracking-widest leading-relaxed">Para habilitar el motor Platinum 4K, debe vincular su propia clave de Google AI Studio mediante el sistema seguro.</p>
            </div>
            <div className="space-y-6">
              <Button className="w-full h-20 text-sm shadow-[0_20px_40px_rgba(255,255,255,0.05)]" onClick={handleSelectKey}>Vincular Clave Nativa Pro</Button>
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="block text-[9px] text-zinc-600 hover:text-white transition-colors uppercase font-black tracking-widest underline">Guía de Facturación y Límites</a>
            </div>
          </Card>
        </div>
      )}
      
      <nav className="w-24 bg-black border-r border-white/5 flex flex-col items-center py-12 space-y-10 z-50">
        <div className="text-white font-black italic text-3xl mb-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">FA</div>
        {[
          { m: ViewMode.ANALYSIS, icon: <ICONS.ANALYSIS />, t: 'ADN' },
          { m: ViewMode.ARCHITECT, icon: <ICONS.ARCHITECT />, t: 'Arq' },
          { m: ViewMode.DARKROOM, icon: <ICONS.DARKROOM />, t: 'Revel' },
          { m: ViewMode.RENDER_VAULT, icon: <ICONS.RENDER_VAULT />, t: 'Vault' },
          { m: ViewMode.ANALYTICS, icon: <ICONS.ANALYTICS />, t: 'Metrics' }
        ].map(item => (
          <button key={item.m} onClick={() => setView(item.m)} className={`group relative p-4 rounded-3xl transition-all duration-500 ${view === item.m ? 'bg-indigo-600 text-white shadow-[0_0_30px_#4f46e5] scale-110' : 'text-zinc-800 hover:text-zinc-400 hover:bg-white/5'}`}>
             {/* Fix: item.icon is already a rendered JSX element, no need to call it as a function */}
             {item.icon}
             <span className="absolute left-full ml-4 px-2 py-1 rounded bg-zinc-900 border border-white/10 text-[8px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity z-[100] pointer-events-none">{item.t}</span>
          </button>
        ))}
      </nav>
      
      <main className="flex-1 overflow-y-auto p-12 custom-scrollbar relative bg-gradient-to-br from-[#010101] to-[#050505]">
        <header className="flex justify-between items-center mb-16 h-12">
          <div className="flex flex-col">
            <h1 className="text-2xl font-black italic text-white uppercase tracking-tighter">EL FOTÓGRAFO</h1>
            <span className="text-[9px] font-black text-zinc-700 tracking-[0.3em] uppercase">Platinum Core v1.5.0</span>
          </div>
          <div className="flex items-center gap-6">
            <Badge color="indigo">Engine: Gemini 3 Pro Native</Badge>
            <button onClick={async () => {
              const zip = new JSZip();
              const folder = zip.folder("fotografo_export");
              state.renderLibrary.forEach(r => {
                if(r.outBase64) folder?.file(`${r.id}.png`, r.outBase64.split(',')[1], {base64: true});
              });
              const blob = await zip.generateAsync({type: "blob"});
              saveAs(blob, `FOTOGRAFO_PLATINUM_${Date.now()}.zip`);
            }} className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all"><ICONS.Export /></button>
          </div>
        </header>
        
        {view === ViewMode.ANALYSIS && renderAnalysis()}
        {view === ViewMode.ARCHITECT && renderArchitect()}
        {view === ViewMode.DARKROOM && renderDarkroom()}
        {view === ViewMode.ANALYTICS && renderAnalytics()}
        {view === ViewMode.RENDER_VAULT && (
          <div className="space-y-12 animate-in fade-in duration-700">
            <div className="flex justify-between items-end">
              <h2 className="text-4xl font-black italic text-white uppercase tracking-tighter">Bóveda <span className="text-indigo-500">Digital</span></h2>
              <Button variant="danger" onClick={() => setState(p => ({...p, renderLibrary: []}))}>Purgar Bóveda</Button>
            </div>
            {state.renderLibrary.length === 0 ? (
               <div className="h-[400px] border border-dashed border-white/5 rounded-[3rem] bg-white/[0.01] flex flex-col items-center justify-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-700"><ICONS.RENDER_VAULT /></div>
                  <p className="text-zinc-600 text-[10px] font-black uppercase italic tracking-widest">Vault vacío</p>
               </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12">
                {state.renderLibrary.map(r => (
                  <Card key={r.id} title={r.id} subtitle={new Date(r.createdAt).toLocaleString()}>
                    <div className="relative group aspect-[4/5] rounded-2xl overflow-hidden bg-zinc-900 border border-white/5 shadow-2xl mb-6">
                      <img src={r.outBase64} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" />
                      <div className="absolute top-4 right-4"><Badge color="emerald">NATIVO 4K</Badge></div>
                    </div>
                    {r.metadata?.identityValidation && (
                       <div className="mt-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] space-y-3">
                          <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase text-zinc-500">Match Facial</span><span className={`text-[12px] font-black ${r.metadata.identityValidation.isValid ? 'text-emerald-400' : 'text-amber-400'}`}>{r.metadata.identityValidation.matchScore}%</span></div>
                          <div className="h-1 w-full bg-zinc-900 rounded-full overflow-hidden"><div className={`h-full transition-all duration-1000 ${r.metadata.identityValidation.isValid ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{width: `${r.metadata.identityValidation.matchScore}%`}} /></div>
                       </div>
                    )}
                    <div className="mt-6 flex gap-3">
                      <Button variant="secondary" className="flex-1" onClick={() => r.outBase64 && saveAs(r.outBase64, `${r.id}.png`)}>Descargar</Button>
                      <Button variant="danger" className="px-4" onClick={() => setState(p => ({...p, renderLibrary: p.renderLibrary.filter(x => x.id !== r.id)}))}><ICONS.Trash /></Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
