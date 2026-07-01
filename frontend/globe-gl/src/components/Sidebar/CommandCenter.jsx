import { useState } from 'react';
import { useGlobe } from '../../context/GlobeContext';
import EventFeed from './EventFeed';
import ChatView from './ChatView';
import CommandInput from './CommandInput';
import { ShieldAlert, Activity, ChevronRight } from 'lucide-react';

export default function CommandCenter() {
  const { state, dispatch } = useGlobe();
  
  return (
    <div className="absolute right-0 top-0 bottom-0 w-full max-w-[420px] bg-black/60 backdrop-blur-xl border-l border-primary/20 flex flex-col z-10 shadow-[-10px_0_30px_rgba(0,229,255,0.1)] transition-transform duration-300">
      
      {/* Header */}
      <div className="p-6 border-b border-primary/20 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 text-primary">
            <ShieldAlert size={24} className="animate-pulse" />
            <h1 className="text-xl font-bold tracking-wider">THREAT MAP</h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-gray-400 bg-surface px-3 py-1.5 rounded-full border border-primary/10">
            <Activity size={14} className={state.marketHealth === 'bearish' ? 'text-red-500' : 'text-primary'} />
            <span className="uppercase">{state.marketHealth}</span>
          </div>
        </div>
        
        {/* State Toggle */}
        <div className="flex bg-surface rounded-lg p-1 border border-primary/10">
          <button 
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${state.sidebarMode === 'events' ? 'bg-primary/20 text-primary shadow-[0_0_10px_rgba(0,229,255,0.2)]' : 'text-gray-400 hover:text-gray-200'}`}
            onClick={() => dispatch({ type: 'SET_SIDEBAR_MODE', payload: 'events' })}
          >
            Event Feed
          </button>
          <button 
            className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${state.sidebarMode === 'chat' ? 'bg-primary/20 text-primary shadow-[0_0_10px_rgba(0,229,255,0.2)]' : 'text-gray-400 hover:text-gray-200'}`}
            onClick={() => dispatch({ type: 'SET_SIDEBAR_MODE', payload: 'chat' })}
          >
            Labh Sathi AI
          </button>
        </div>
      </div>

      {/* Main Content Area (Scrollable) */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 relative">
        {state.sidebarMode === 'events' ? <EventFeed /> : <ChatView />}
      </div>

      {/* Fixed Footer Input */}
      <CommandInput />
    </div>
  );
}
