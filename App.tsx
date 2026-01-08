
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
import { generateRealImageFal, revealImageWithRetry, editWithNanoBanana } from './imageGenService';

// --- UI Components ---

const Badge = ({ children, color = 'indigo' }: { children: React.ReactNode, color?: string }) => {
  const colors: any = { indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
  return <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border ${colors[color]}`}>{children}</span>;
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

const Button = ({ children, onClick, variant = 'primary', className = "", disabled = false }: { children: React.ReactNode, onClick?: () => void, variant?: 'primary' | 'secondary', className?: string, disabled?: boolean }) => (
  <button onClick={onClick} disabled={disabled} className={`px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 ${variant === 'primary' ? 'bg-white text-black' : 'bg-zinc-900 text-white border border-white/10'} ${className}`}>
    {children}
  </button>
);

// --- Main Application ---

const App = () => {
  const [view, setView] = useState<ViewMode>(ViewMode.ANALYSIS);
  const [loading, setLoading] = useState(false);
  const [darkroomLoading, setDarkroomLoading] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [retryInfo, setRetryInfo] = useState<{ attempt: number, score: number } | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  
  const [state, setState] = useState<InternalState>({
    version: "1.4.5",
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
      const has = await window.aistudio?.hasSelectedApiKey();
      setHasGeminiKey(!!has);
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    await window.aistudio?.openSelectKey();
    setHasGeminiKey(true);
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
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const handleReveal = async () => {
    const s = state.currentSession;
    if (!s.previewImage) return;

    if (!(await window.aistudio?.hasSelectedApiKey())) {
      await handleSelectKey();
    }

    setDarkroomLoading(true);
    try {
      const prompt = `person with ${s.facialTraits?.shape} face, ${s.facialTraits?.eyes} eyes, posing: ${s.currentPose?.prompt}. style: ${STYLE_MAP[s.currentStyle]}. environment: ${s.currentContext || 'studio'}.`;
      const result = await revealImageWithRetry(prompt, s.previewImage, s.darkroomSettings, (attempt, score) => setRetryInfo({ attempt, score }));
      setState(prev => ({ ...prev, renderLibrary: [result.renderItem, ...prev.renderLibrary] }));
      setView(ViewMode.RENDER_VAULT);
    } catch (err: any) {
      if (err.message?.includes("entity was not found")) setHasGeminiKey(false);
    } finally { setDarkroomLoading(false); setRetryInfo(null); }
  };

  const renderAnalysis = () => (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700">
      <div className="text-center space-y-4">
        <Badge>Fase 01: Ingesta Pro Thinking</Badge>
        <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter">ADN <span className="text-indigo-500">Fotográfico</span></h2>
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Extraiga la esencia biométrica mediante razonamiento profundo.</p>
      </div>
      <div className="h-[400px] border-2 border-dashed border-white/10 rounded-[3rem] bg-white/[0.02] flex flex-col items-center justify-center p-12 group hover:border-indigo-500/50 transition-all cursor-pointer" onClick={() => fileInputRef.current?.click()}>
        <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
        {loading ? <div className="animate-spin w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full" /> : <div className="text-center"><ICONS.ANALYSIS /><p className="mt-4 text-[10px] font-black uppercase text-zinc-600">Subir Negativo para Escaneo</p></div>}
      </div>
      <div className="grid grid-cols-4 gap-4">
        {state.analysisLibrary.map(item => (
          <Card key={item.id} title={item.id}>
            <img src={item.imageBase64} className="aspect-square object-cover rounded-xl grayscale opacity-50 hover:opacity-100 transition-all cursor-pointer" onClick={() => { setState(prev => ({ ...prev, currentSession: { ...prev.currentSession, facialTraits: item.traits, facialId: item.id, previewImage: item.imageBase64 } })); setView(ViewMode.ARCHITECT); }} />
          </Card>
        ))}
      </div>
    </div>
  );

  const renderArchitect = () => (
    <div className="grid grid-cols-12 gap-10 animate-in fade-in duration-700">
      <div className="col-span-4 space-y-6">
        <Card title="Referencia ADN" subtitle={state.currentSession.facialId || ""}>
          <img src={state.currentSession.previewImage} className="w-full aspect-[3/4] object-cover rounded-2xl shadow-2xl" />
        </Card>
        <Card title="Edición Flash 2.5">
          <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder="Ej: añadir gafas, cambiar luz..." className="w-full bg-black/40 border border-white/5 rounded-xl p-4 text-[10px] text-white outline-none h-24 mb-4" />
          <Button className="w-full" onClick={async () => { 
            const res = await editWithNanoBanana(state.currentSession.previewImage!, editPrompt); 
            setState(p => ({ ...p, currentSession: { ...p.currentSession, previewImage: res } }));
            setEditPrompt("");
          }}>Aplicar Cambio</Button>
        </Card>
      </div>
      <div className="col-span-8 space-y-8">
        <Card title="Configuración de Pose">
          <div className="grid grid-cols-2 gap-3 h-[300px] overflow-y-auto custom-scrollbar pr-2">
            {state.poseBank.map(p => (
              <button key={p.id} onClick={() => setState(s => ({ ...s, currentSession: { ...s.currentSession, currentPose: p } }))} className={`p-4 rounded-xl border text-left transition-all ${state.currentSession.currentPose?.id === p.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/5 text-zinc-500'}`}>
                <p className="text-[10px] font-black uppercase">{p.name}</p>
                <p className="text-[8px] opacity-60 font-mono mt-1">{p.prompt}</p>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Entorno">
          <input type="text" value={state.currentSession.currentContext} onChange={(e) => setState(s => ({ ...s, currentSession: { ...s.currentSession, currentContext: e.target.value } }))} placeholder="Ej: callejón neón en Tokio..." className="w-full bg-black/40 border border-white/5 rounded-xl p-5 text-sm outline-none" />
        </Card>
        <div className="flex justify-end"><Button onClick={() => setView(ViewMode.DARKROOM)} className="h-16 px-16 text-lg">Ir al Darkroom</Button></div>
      </div>
    </div>
  );

  const renderDarkroom = () => (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-700 text-center">
      <Card title="Cámara Oscura Platinum" className="h-[600px] relative">
        {darkroomLoading ? (
          <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center space-y-8 z-50">
            <div className="w-20 h-20 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <div className="space-y-2">
              <p className="text-white font-black italic uppercase tracking-widest">Revelando en Calidad Nativa...</p>
              {retryInfo && <Badge color="amber">Fidelidad: {retryInfo.score}% (Intento {retryInfo.attempt})</Badge>}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center space-y-10">
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mx-auto animate-pulse text-indigo-400"><ICONS.DARKROOM /></div>
            <div className="space-y-4">
              <h3 className="text-4xl font-black italic text-white uppercase tracking-tighter">Proceso <span className="text-indigo-500">Platinum</span></h3>
              <p className="text-zinc-500 text-xs uppercase font-bold tracking-widest max-w-md mx-auto">Motor Gemini 3 Pro Image Activo. Generación nativa sin dependencias externas.</p>
            </div>
            <Button onClick={handleReveal} className="h-20 px-24 text-xl shadow-[0_0_50px_rgba(79,70,229,0.2)]">Iniciar Revelado</Button>
          </div>
        )}
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#010101] text-zinc-300 font-sans flex overflow-hidden">
      {!hasGeminiKey && view !== ViewMode.ANALYSIS && (
        <div className="fixed inset-0 bg-black/98 z-[200] flex items-center justify-center p-8 backdrop-blur-3xl animate-in fade-in">
          <Card title="Motor Desconectado" className="max-w-lg p-12 text-center space-y-10">
            <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center mx-auto text-indigo-400"><ICONS.Key /></div>
            <p className="text-zinc-500 text-[11px] uppercase font-black tracking-widest leading-relaxed">Vincule su clave de Google AI Studio para habilitar el motor Platinum 4K.</p>
            <Button className="w-full h-16" onClick={handleSelectKey}>Vincular Clave Nativa</Button>
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="block text-[8px] text-zinc-700 underline uppercase font-black">Guía de Facturación Pro</a>
          </Card>
        </div>
      )}
      <nav className="w-24 bg-black border-r border-white/5 flex flex-col items-center py-12 space-y-8 z-50">
        <div className="text-white font-black italic text-3xl mb-8">FA</div>
        {[ViewMode.ANALYSIS, ViewMode.ARCHITECT, ViewMode.DARKROOM, ViewMode.RENDER_VAULT].map(m => (
          <button key={m} onClick={() => setView(m)} className={`p-4 rounded-3xl transition-all ${view === m ? 'bg-indigo-600 text-white shadow-2xl' : 'text-zinc-800 hover:text-white'}`}>
             {m === ViewMode.ANALYSIS && <ICONS.ANALYSIS />}
             {m === ViewMode.ARCHITECT && <ICONS.ARCHITECT />}
             {m === ViewMode.DARKROOM && <ICONS.DARKROOM />}
             {m === ViewMode.RENDER_VAULT && <ICONS.RENDER_VAULT />}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-y-auto p-12 custom-scrollbar relative">
        <header className="flex justify-between items-center mb-12">
          <h1 className="text-xl font-black italic text-white uppercase">EL FOTÓGRAFO <span className="text-[9px] block text-zinc-700 mt-1">Native v1.4.5 Platinum</span></h1>
          <Badge>Engine: Gemini 3 Pro</Badge>
        </header>
        {view === ViewMode.ANALYSIS && renderAnalysis()}
        {view === ViewMode.ARCHITECT && renderArchitect()}
        {view === ViewMode.DARKROOM && renderDarkroom()}
        {view === ViewMode.RENDER_VAULT && (
          <div className="grid grid-cols-3 gap-10 animate-in fade-in duration-700">
            {state.renderLibrary.map(r => (
              <Card key={r.id} title={r.id} subtitle={new Date(r.createdAt).toLocaleString()}>
                <img src={r.outBase64} className="w-full aspect-[4/5] object-cover rounded-2xl mb-4" />
                <Button variant="secondary" className="w-full" onClick={() => r.outBase64 && saveAs(r.outBase64, `${r.id}.png`)}>Descargar 4K</Button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
