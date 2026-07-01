import { useState } from 'react';
import { useGlobe } from '../../context/GlobeContext';
import { Terminal, Send, Loader2 } from 'lucide-react';

export default function CommandInput() {
  const { state, dispatch } = useGlobe();
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    // Switch to chat view if not already
    if (state.sidebarMode !== 'chat') {
      dispatch({ type: 'SET_SIDEBAR_MODE', payload: 'chat' });
    }

    const userPrompt = input.trim();
    setInput('');
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: { role: 'user', content: userPrompt } });
    setIsLoading(true);

    try {
      // Build invisible context
      let contextualPrompt = userPrompt;
      if (state.activeEvent) {
        const stocks = (state.activeEvent.topStocks || []).map(s => `${s.ticker} (${s.stockDrop}%)`).join(', ');
        contextualPrompt = `[SYSTEM CONTEXT]\nActive Threat Event: ${state.activeEvent.threatName} in Region: ${state.activeEvent.regionLabel}\nAffected Tickers: ${stocks}\nGlobal Market Health: ${state.marketHealth}\n[END CONTEXT]\n\nUser: ${userPrompt}`;
      }

      // We hit the existing Labh backend endpoint
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: contextualPrompt,
          modelId: window.currentAiModel || 'auto'
        })
      });

      const data = await response.json();
      const reply = data.reply || "I'm sorry, I couldn't process that request at this moment.";
      
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: { role: 'ai', content: reply } });
    } catch (err) {
      console.error(err);
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: { role: 'ai', content: "Error connecting to Labh Core. Check network." } });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute bottom-0 w-full p-4 bg-background/95 backdrop-blur-md border-t border-primary/20">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-3 text-primary/70 animate-pulse">
          <Terminal size={18} />
        </div>
        <input 
          type="text" 
          value={input}
          onChange={e => setInput(e.target.value)}
          onFocus={() => {
            if (state.sidebarMode !== 'chat') {
              dispatch({ type: 'SET_SIDEBAR_MODE', payload: 'chat' });
            }
          }}
          placeholder="Ask Labh Sathi about this event..." 
          className="w-full bg-[#0a1120] border border-primary/30 rounded-lg py-3 pl-10 pr-12 text-sm text-primary font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-[inset_0_0_15px_rgba(0,229,255,0.05)] placeholder-primary/30"
          disabled={isLoading}
        />
        <button 
          type="submit" 
          disabled={!input.trim() || isLoading}
          className="absolute right-2 p-1.5 text-primary hover:text-white hover:bg-primary/20 rounded-md transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-primary"
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
    </div>
  );
}
