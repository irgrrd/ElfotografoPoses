
import React, { useState } from 'react';

interface GuideSection {
  id: string;
  title: string;
  content: React.ReactNode;
  icon: string;
}

export const UserGuide: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('intro');
  
  const sections: GuideSection[] = [
    {
      id: 'intro',
      title: 'Introducción',
      icon: '📖',
      content: (
        <div className="space-y-6">
          <h3 className="text-2xl font-black text-amber-400 uppercase italic">Estudio Maestro v1.7.0</h3>
          <p className="text-zinc-400 leading-relaxed">
            EL FOTÓGRAFO es un sistema avanzado de estudio digital que permite
            transformar composiciones y escenarios preservando al 100% la identidad del sujeto.
          </p>
          
          <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4">
            <h4 className="text-sm font-black text-white uppercase tracking-widest">Capacidades del Sensor:</h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li>✓ Análisis de firma facial automática (ADN)</li>
              <li>✓ Selección de distancias focales reales (Gear Rack)</li>
              <li>✓ Emulación de química de película analógica</li>
              <li>✓ Validación biométrica en tiempo real</li>
              <li>✓ Protocolo Sentinel de revelado inteligente</li>
            </ul>
          </div>
        </div>
      )
    },
    {
        id: 'workflow',
        title: 'Revelado Químico',
        icon: '🔄',
        content: (
          <div className="space-y-8">
            <h3 className="text-2xl font-black text-amber-400 uppercase italic">Protocolo de Laboratorio</h3>
            
            <div className="space-y-6">
              {[
                  { n: 1, t: 'Exposición RAW', d: 'Carga el negativo digital maestro. El sensor analiza la firma facial única del sujeto.' },
                  { n: 2, t: 'Configuración de Set', d: 'Define el esquema de pose, la locación y el set de luces profesional.' },
                  { n: 3, t: 'Óptica y Química', d: 'Selecciona la lente (35mm/50mm/85mm) y el stock de película (Portra/Ilford/CineStill).' },
                  { n: 4, t: 'Revelado Digital', d: 'El sensor procesa la ampliación y valida la fidelidad EXIF antes de guardarla en la Bóveda.' }
              ].map(step => (
                <div key={step.n} className="flex gap-6 items-start">
                  <div className="w-10 h-10 rounded-full bg-amber-600 flex items-center justify-center font-black text-black shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.5)]">{step.n}</div>
                  <div>
                      <h4 className="text-white font-black uppercase text-sm mb-1">{step.t}</h4>
                      <p className="text-zinc-500 text-sm leading-relaxed">{step.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
    }
  ];
  
  return (
    <div className="flex flex-col lg:flex-row gap-10 min-h-[600px] animate-in fade-in duration-500">
      <div className="lg:w-64 space-y-2">
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 font-black uppercase text-[10px] tracking-widest border
              ${activeSection === section.id 
                ? 'bg-amber-600 border-amber-500 text-black shadow-xl translate-x-2' 
                : 'bg-white/5 border-white/5 text-zinc-500 hover:bg-white/[0.08]'}`}
          >
            <span className="text-lg">{section.icon}</span>
            {section.title}
          </button>
        ))}
      </div>
      
      <div className="flex-1 bg-white/[0.02] border border-white/5 rounded-[3rem] p-10 lg:p-16 overflow-y-auto custom-scrollbar">
        {sections.find(s => s.id === activeSection)?.content}
      </div>
    </div>
  );
};
