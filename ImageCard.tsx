
import React from 'react';
import { RenderItem, EngineMode } from './types';

// Simple Badge component internal to ImageCard to allow standalone usage if needed
const Badge = ({ children, color = 'red', className = "" }: { children: React.ReactNode, color?: string, className?: string }) => {
  const colors: any = {
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
    amber: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    zinc: 'bg-zinc-800/40 text-zinc-500 border-zinc-700/50'
  };
  return <span className={`px-2 py-0.5 rounded-sm text-[9px] font-mono font-bold uppercase tracking-wider border ${colors[color] || colors.zinc} ${className}`}>{children}</span>;
};

interface ImageCardProps {
  item: RenderItem;
  title?: string;
  subtitle?: string;
  onExport: (base64: string, id: string) => void;
  onSave?: (item: RenderItem) => void;
  onDelete: (id: string) => void;
  variant?: 'vault' | 'session';
}

export const ImageCard: React.FC<ImageCardProps> = ({
  item, title, subtitle, onExport, onSave, onDelete, variant = 'session'
}) => {
  const isVault = variant === 'vault';
  const metadata = item.metadata || {};
  const gear = metadata.gear || { focalLength: '50mm', filmStock: 'Standard Digital' };
  const engine = metadata.engineMode === 'live' ? 'FullFrame' : 'Standard';

  return (
    <div className="hardware-panel rounded-xl overflow-hidden border border-white/5 flex flex-col bg-black/10">
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

      <div className="p-5 flex-1 flex flex-col gap-4">
        <div className="aspect-[3/4] rounded-lg overflow-hidden border border-zinc-900 bg-zinc-950 shadow-inner relative group">
          <img src={item.outBase64} className={`w-full h-full object-cover transition-all duration-700 ${!isVault ? 'grayscale group-hover:grayscale-0' : ''}`} alt={item.id} />

          {!isVault && metadata.identityValidation && (
            <div className="absolute bottom-3 left-3">
              <Badge color="red">M: {metadata.identityValidation.matchScore}%</Badge>
            </div>
          )}

          {isVault && (
             <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-4">
               <p className="text-[7px] font-mono text-white/60 leading-tight">{item.finalPrompt}</p>
             </div>
          )}
        </div>

        {/* Telemetría EXIF Strip */}
        <div className="flex justify-between items-center px-2 py-1.5 bg-black/30 rounded border border-white/5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[7px] font-mono text-amber-500/80 uppercase tracking-wider">LENS: {gear.focalLength}</span>
            <span className="text-[7px] font-mono text-amber-500/60 uppercase tracking-wider">FILM: {gear.filmStock}</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
             <span className="text-[7px] font-mono text-zinc-500 uppercase tracking-wider">SENSOR: {engine}</span>
             <span className="text-[7px] font-mono text-zinc-600 uppercase tracking-wider">ID: {item.id.split('_')[1]}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-auto">
          {variant === 'session' ? (
             <div className="flex gap-2">
               <button onClick={() => onExport(item.outBase64!, item.id)} className="flex-1 px-3 py-2 rounded bg-transparent border border-zinc-800 text-zinc-400 text-[9px] font-mono font-bold uppercase hover:bg-white/5">Exportar</button>
               {onSave && (
                 <button onClick={() => onSave(item)} className="flex-1 px-3 py-2 rounded bg-[#18181b] border border-white/5 text-zinc-100 text-[9px] font-mono font-bold uppercase hover:bg-[#202024]">Guardar</button>
               )}
             </div>
          ) : (
            <button onClick={() => onExport(item.outBase64!, item.id)} className="w-full px-3 py-2 rounded bg-[#18181b] border border-white/5 text-zinc-100 text-[9px] font-mono font-bold uppercase hover:bg-[#202024]">Exportar Original</button>
          )}

          <button onClick={() => onDelete(item.id)} className="w-full px-3 py-2 rounded bg-red-950/20 border border-red-900/30 text-red-500 text-[9px] font-mono font-bold uppercase hover:bg-red-900/30">
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
};
