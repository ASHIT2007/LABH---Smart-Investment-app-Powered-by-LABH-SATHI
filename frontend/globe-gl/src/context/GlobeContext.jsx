import { createContext, useReducer, useContext, useEffect } from 'react';

const GlobeContext = createContext();

const initialState = {
  activeEvent: null,
  marketHealth: "neutral",
  sidebarMode: "events", // 'events' | 'chat'
  chatHistory: [{ role: 'ai', content: 'Command Center active. Select an event on the globe or ask a question.' }],
  filters: { severity: [], category: [] },
  threatZones: [],
  marketPulse: [],
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ACTIVE_EVENT':
      return { ...state, activeEvent: action.payload, sidebarMode: 'chat' };
    case 'SET_SIDEBAR_MODE':
      return { ...state, sidebarMode: action.payload };
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatHistory: [...state.chatHistory, action.payload] };
    case 'TOGGLE_FILTER':
      const { type, value } = action.payload; // type: 'severity' | 'category'
      const current = state.filters[type];
      const updated = current.includes(value) 
        ? current.filter(v => v !== value) 
        : [...current, value];
      return { ...state, filters: { ...state.filters, [type]: updated } };
    case 'SET_THREAT_ZONES':
      return { ...state, threatZones: action.payload };
    case 'SET_MARKET_PULSE':
      return { ...state, marketPulse: action.payload };
    case 'SET_MARKET_HEALTH':
      return { ...state, marketHealth: action.payload };
    default:
      return state;
  }
}

export function GlobeProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    // Fetch data
    Promise.all([
      fetch('/api/globe-threat-zones').then(res => res.json()),
      fetch('/api/global-market-pulse').then(res => res.json()),
      fetch('/api/sentiment').then(res => res.json())
    ]).then(([threatData, pulseData, sentimentData]) => {
      dispatch({ type: 'SET_THREAT_ZONES', payload: threatData.zones || [] });
      dispatch({ type: 'SET_MARKET_PULSE', payload: pulseData.pulse || [] });
      dispatch({ type: 'SET_MARKET_HEALTH', payload: sentimentData.overallMood || 'neutral' });
    }).catch(err => console.error("Data load failed:", err));
  }, []);

  return (
    <GlobeContext.Provider value={{ state, dispatch }}>
      {children}
    </GlobeContext.Provider>
  );
}

export function useGlobe() {
  return useContext(GlobeContext);
}
