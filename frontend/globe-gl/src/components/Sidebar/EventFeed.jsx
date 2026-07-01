import { useState, useMemo } from 'react';
import { useGlobe } from '../../context/GlobeContext';
import { Target, Search, AlertTriangle, Crosshair } from 'lucide-react';

export default function EventFeed() {
  const { state, dispatch } = useGlobe();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEvents = useMemo(() => {
    return state.threatZones.filter(z => {
      const matchesSearch = z.threatName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            z.regionLabel.toLowerCase().includes(searchTerm.toLowerCase());
      
      const activeCategories = state.filters.category;
      const matchesCategory = activeCategories.length === 0 || activeCategories.includes(z.riskCategory);
      
      return matchesSearch && matchesCategory;
    });
  }, [state.threatZones, searchTerm, state.filters]);

  const toggleCategory = (cat) => {
    dispatch({ type: 'TOGGLE_FILTER', payload: { type: 'category', value: cat } });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search & Filters */}
      <div className="sticky top-0 bg-background/80 backdrop-blur pb-2 z-10 -mx-2 px-2">
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input 
            type="text" 
            placeholder="Search active threats..." 
            className="w-full bg-surface border border-primary/20 rounded-md py-2 pl-9 pr-3 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 placeholder-gray-600 transition-all text-white"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          {['energy', 'tech', 'macro', 'conflict'].map(cat => (
            <button 
              key={cat}
              onClick={() => toggleCategory(cat)}
              className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all ${state.filters.category.includes(cat) ? 'bg-primary/20 border-primary text-primary shadow-[0_0_8px_rgba(0,229,255,0.3)]' : 'bg-surface border-gray-700 text-gray-400 hover:border-gray-500'}`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Event Cards */}
      <div className="flex flex-col gap-3 pb-8">
        {filteredEvents.map(event => (
          <div 
            key={event.id}
            onClick={() => dispatch({ type: 'SET_ACTIVE_EVENT', payload: event })}
            className={`p-4 rounded-lg border transition-all cursor-pointer group ${state.activeEvent?.id === event.id ? 'bg-primary/10 border-primary shadow-[0_0_15px_rgba(0,229,255,0.15)]' : 'bg-surface border-primary/10 hover:border-primary/40'}`}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${event.riskCategory === 'energy' ? 'bg-red-400' : 'bg-primary'}`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${event.riskCategory === 'energy' ? 'bg-red-500' : 'bg-primary'}`}></span>
                </span>
                <span className="text-xs font-mono text-gray-400 uppercase tracking-widest">{event.regionLabel}</span>
              </div>
              <Crosshair size={14} className={`opacity-0 group-hover:opacity-100 transition-opacity ${state.activeEvent?.id === event.id ? 'opacity-100 text-primary' : 'text-gray-500'}`} />
            </div>
            
            <h3 className="text-lg font-semibold text-white mb-2 leading-tight">
              {event.threatName}
            </h3>
            
            <p className="text-sm text-gray-400 line-clamp-2 mb-3 border-l-2 border-gray-700 pl-2">
              {event.newsHeadline}
            </p>
            
            <div className="flex flex-wrap gap-2">
              {event.topStocks?.map(stock => (
                <div key={stock.ticker} className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded text-xs border border-white/5">
                  <span className="text-gray-300 font-mono">{stock.ticker}</span>
                  <span className={stock.stockDrop >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {stock.stockDrop >= 0 ? '+' : ''}{Number(stock.stockDrop).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filteredEvents.length === 0 && (
          <div className="text-center py-12 text-gray-500 flex flex-col items-center">
            <AlertTriangle size={32} className="mb-3 opacity-20" />
            <p>No events matching criteria</p>
          </div>
        )}
      </div>
    </div>
  );
}
