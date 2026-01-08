
import React from 'react';
import { GearSettings, FocalLength, FilmStock } from './types';

interface GearRackProps {
  settings: GearSettings;
  onChange: (settings: GearSettings) => void;
}

const FocalLengths: FocalLength[] = ['35mm', '50mm', '85mm'];
const FilmStocks: FilmStock[] = ['Standard Digital', 'Portra 400', 'Ilford HP5', 'CineStill 800T'];

export const GearRack: React.FC<GearRackProps> = ({ settings, onChange }) => {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-[0.2em] block mb-2">Óptica (Focal Length)</label>
        <div className="grid grid-cols-3 gap-2">
          {FocalLengths.map(f => (
            <button
              key={f}
              onClick={() => onChange({ ...settings, focalLength: f })}
              className={`py-2 px-1 rounded-md border text-[8px] font-mono font-bold uppercase transition-all flex flex-col items-center justify-center gap-1 ${
                settings.focalLength === f 
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.1)]' 
                  : 'bg-black/20 border-zinc-800 text-zinc-600 hover:border-zinc-700'
              }`}
            >
              <span>{f}</span>
              <div className={`w-1 h-1 rounded-full ${settings.focalLength === f ? 'bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,1)]' : 'bg-zinc-800'}`} />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <label className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-[0.2em] block mb-2">Química (Film Stock)</label>
        <div className="grid grid-cols-2 gap-2">
          {FilmStocks.map(s => (
            <button
              key={s}
              onClick={() => onChange({ ...settings, filmStock: s })}
              className={`py-2 px-3 rounded-md border text-[8px] font-mono font-bold uppercase transition-all flex justify-between items-center ${
                settings.filmStock === s 
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.1)]' 
                  : 'bg-black/20 border-zinc-800 text-zinc-600 hover:border-zinc-700'
              }`}
            >
              <span className="truncate">{s}</span>
              <div className={`w-1 h-1 rounded-full ${settings.filmStock === s ? 'bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,1)]' : 'bg-zinc-800'}`} />
            </button>
          ))}
        </div>
      </div>
      
      <div className="pt-2 border-t border-white/5">
         <p className="text-[7px] text-zinc-600 font-mono italic leading-tight">
           * Los modificadores ópticos y químicos se inyectan directamente en el haz de luz del sensor para garantizar coherencia estética.
         </p>
      </div>
    </div>
  );
};
