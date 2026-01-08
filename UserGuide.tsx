
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
          <h3 className="text-2xl font-black text-indigo-400 uppercase italic">Bienvenido a EL FOTÓGRAFO</h3>
          <p className="text-zinc-400 leading-relaxed">
            EL FOTÓGRAFO es un sistema avanzado de fotografía asistida por IA que te permite
            transformar poses y entornos mientras preserva al 100% la identidad del sujeto.
          </p>
          
          <div className="bg-white/5 p-6 rounded-2xl border border-white/5 space-y-4">
            <h4 className="text-sm font-black text-white uppercase tracking-widest">Características principales:</h4>
            <ul className="space-y-2 text-sm text-zinc-500">
              <li>✓ Análisis biométrico facial automático</li>
              <li>✓ Control total sobre pose, iluminación y entorno</li>
              <li>✓ Preservación garantizada de identidad</li>
              <li>✓ Validación automática de resultados</li>
              <li>✓ Sistema de reintentos inteligente</li>
            </ul>
          </div>
        </div>
      )
    },
    {
        id: 'workflow',
        title: 'Flujo de Trabajo',
        icon: '🔄',
        content: (
          <div className="space-y-8">
            <h3 className="text-2xl font-black text-indigo-400 uppercase italic">Proceso Paso a Paso</h3>
            
            <div className="space-y-6">
              {[
                  { n: 1, t: 'Ingesta', d: 'Carga la imagen del sujeto. El sistema analiza la geometría facial, estructura ósea y rasgos distintivos.' },
                  { n: 2, t: 'Arquitectura', d: 'Define la pose, el lente fotográfico, el esquema de luz y el escenario deseado.' },
                  { n: 3, t: 'Darkroom', d: 'Ajusta el slider Strength. 0-30% Retoque, 30-70% Balance, 70-100% Drama. La identidad es sagrada en todos los niveles.' },
                  { n: 4, t: 'Validación', d: 'El sistema verifica el Identity Score. Si es < 85%, se inicia el protocolo Sentinel de reintentos automáticos.' }
              ].map(step => (
                <div key={step.n} className="flex gap-6 items-start">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-black text-white shrink-0 shadow-[0_0_15px_#4f46e5]">{step.n}</div>
                  <div>
                      <h4 className="text-white font-black uppercase text-sm mb-1">{step.t}</h4>
                      <p className="text-zinc-500 text-sm leading-relaxed">{step.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
    },
    {
      id: 'analytics',
      title: 'Métricas y Analytics',
      icon: '📊',
      content: (
        <div className="space-y-8">
          <h3 className="text-2xl font-black text-indigo-400 uppercase italic">Entendiendo las Métricas</h3>
          <p className="text-zinc-400 leading-relaxed">El sistema recopila métricas detalladas de cada generación para ayudarte a optimizar tus resultados.</p>
          
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
              <h5 className="text-indigo-400 font-black uppercase text-xs mb-2">Identity Match Score</h5>
              <p className="text-xs text-zinc-500">Porcentaje de similitud facial entre la imagen original y la generada. 95-100% es excelente, { '< 75%' } dispara el reintento.</p>
            </div>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
              <h5 className="text-indigo-400 font-black uppercase text-xs mb-2">Facial Features Breakdown</h5>
              <p className="text-xs text-zinc-500">Análisis pormenorizado de: Forma del rostro, Ojos, Nariz y Boca.</p>
            </div>
            <div className="bg-white/5 p-6 rounded-2xl border border-white/5">
              <h5 className="text-indigo-400 font-black uppercase text-xs mb-2">Attempts Count</h5>
              <p className="text-xs text-zinc-500">Indica cuántas veces el motor Platinum tuvo que iterar para blindar la identidad del sujeto.</p>
            </div>
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
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl translate-x-2' 
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
