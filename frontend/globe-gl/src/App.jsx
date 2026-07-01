import ThreatGlobe from './components/Globe/ThreatGlobe';
import CommandCenter from './components/Sidebar/CommandCenter';
import { ArrowLeft } from 'lucide-react';

function App() {
  return (
    <div className="w-screen h-screen overflow-hidden bg-background relative font-sans text-white">
      {/* 3D Canvas Layer */}
      <div className="absolute inset-0">
        <ThreatGlobe />
      </div>

      {/* Top Left Navigation back to Main Dashboard */}
      <div className="absolute top-6 left-6 z-20">
        <button 
          onClick={() => window.location.href = '../index.html'}
          className="flex items-center gap-2 bg-black/40 backdrop-blur-md border border-primary/20 hover:bg-primary/20 hover:border-primary text-gray-300 hover:text-white px-4 py-2 rounded-lg transition-all"
        >
          <ArrowLeft size={16} />
          <span className="text-sm font-semibold tracking-wide uppercase">Exit Command Center</span>
        </button>
      </div>

      {/* Floating Legend / Info */}
      <div className="absolute bottom-6 left-6 z-20 bg-black/60 backdrop-blur-md border border-white/10 p-4 rounded-xl flex flex-col gap-2 shadow-2xl pointer-events-none">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]"></div>
          <span className="text-xs font-mono text-gray-300">Geopolitical Event</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ff3b3b] shadow-[0_0_8px_#ff3b3b]"></div>
          <span className="text-xs font-mono text-gray-300">Energy & Macro Risk</span>
        </div>
        <p className="text-[10px] text-gray-500 mt-2 max-w-[200px] leading-tight">
          System automatically updates based on live ticker data from LABH core.
        </p>
      </div>

      {/* Right Sidebar Layer */}
      <CommandCenter />
    </div>
  );
}

export default App;
