import { useEffect, useRef } from 'react';
import { useGlobe } from '../../context/GlobeContext';
import { Bot, User } from 'lucide-react';

export default function ChatView() {
  const { state } = useGlobe();
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.chatHistory, state.activeEvent]);

  return (
    <div className="flex flex-col gap-4 pb-20">
      
      {state.activeEvent && (
        <div className="bg-primary/10 border border-primary/30 p-3 rounded-lg flex flex-col gap-1 shadow-[0_0_15px_rgba(0,229,255,0.1)]">
          <span className="text-[10px] uppercase text-primary font-mono tracking-widest">Active Context</span>
          <span className="text-sm font-semibold text-white">{state.activeEvent.threatName}</span>
          <span className="text-xs text-gray-400">{state.activeEvent.regionLabel}</span>
        </div>
      )}

      {state.chatHistory.map((msg, i) => (
        <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
          <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center border ${msg.role === 'user' ? 'bg-surface border-gray-600 text-gray-300' : 'bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(0,229,255,0.3)]'}`}>
            {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
          </div>
          
          <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[80%]`}>
            <div className={`p-3 rounded-xl text-sm leading-relaxed ${msg.role === 'user' ? 'bg-surface border border-white/10 text-white rounded-tr-sm' : 'bg-[#0a1120] border border-primary/20 text-gray-200 rounded-tl-sm shadow-[inset_0_0_20px_rgba(0,229,255,0.05)]'}`}>
              {msg.content}
            </div>
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
