
import React, { useState } from 'react';
import { AuditEvent } from './types';

interface SessionHistoryPanelProps {
  events: AuditEvent[];
  onClearHistory: () => void;
  onExportHistory: () => void;
}

export const SessionHistoryPanel: React.FC<SessionHistoryPanelProps> = ({ events, onClearHistory, onExportHistory }) => {
  const [filter, setFilter] = useState<string>('ALL');

  const filteredEvents = filter === 'ALL'
    ? events
    : events.filter(e => e.type === filter);

  const uniqueTypes = Array.from(new Set(events.map(e => e.type)));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
        <div className="flex items-center gap-4">
           <h3 className="text-sm font-mono font-bold text-zinc-500 uppercase tracking-widest">Historial de Sesión</h3>
           <span className="text-[9px] px-2 py-0.5 rounded bg-zinc-900 text-zinc-500 font-mono">{events.length} Eventos</span>
        </div>
        <div className="flex gap-2">
            <button onClick={onExportHistory} className="px-3 py-1.5 rounded bg-black/40 border border-zinc-800 text-[8px] font-mono font-bold text-zinc-400 uppercase hover:bg-white/5 transition-colors">Exportar JSON</button>
            <button onClick={onClearHistory} className="px-3 py-1.5 rounded bg-red-950/10 border border-red-900/20 text-[8px] font-mono font-bold text-red-600 uppercase hover:bg-red-900/20 transition-colors">Limpiar</button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1 rounded text-[9px] font-mono font-bold uppercase transition-colors ${filter === 'ALL' ? 'bg-amber-600 text-white' : 'bg-black/20 text-zinc-600 hover:text-zinc-400'}`}
        >
          TODOS
        </button>
        {uniqueTypes.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1 rounded text-[9px] font-mono font-bold uppercase transition-colors ${filter === t ? 'bg-amber-600 text-white' : 'bg-black/20 text-zinc-600 hover:text-zinc-400'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
        {filteredEvents.length === 0 ? (
           <div className="p-8 text-center border border-dashed border-zinc-900 rounded-lg">
             <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-widest">Sin eventos registrados</p>
           </div>
        ) : (
          filteredEvents.map((e) => (
            <div key={e.id} className="group p-3 rounded bg-black/20 border border-white/5 hover:border-white/10 transition-colors flex flex-col gap-2">
               <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <span className={`w-1.5 h-1.5 rounded-full ${getEventColor(e.type)}`}></span>
                    <span className="text-[9px] font-mono font-bold text-zinc-400 uppercase tracking-wider">{e.type}</span>
                    <span className="text-[9px] font-mono text-zinc-600 ml-2">{new Date(e.ts).toLocaleTimeString()}</span>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-zinc-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">ID: {e.id.slice(-4)}</span>
               </div>
               <div className="pl-4.5">
                  <p className="text-[10px] text-zinc-300 font-medium mb-1">{e.label}</p>
                  {e.payload && (
                    <pre className="text-[8px] font-mono text-zinc-600 bg-black/30 p-2 rounded overflow-x-auto">
                      {JSON.stringify(e.payload, null, 2)}
                    </pre>
                  )}
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

function getEventColor(type: string): string {
  if (type.includes('FAIL')) return 'bg-red-500';
  if (type.includes('SUCCESS')) return 'bg-emerald-500';
  if (type.includes('SET')) return 'bg-amber-500';
  if (type.includes('SAVE')) return 'bg-blue-500';
  return 'bg-zinc-500';
}
