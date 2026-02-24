import { LayoutDashboard, Package, Settings, LogOut, ShoppingCart, BarChart3, Download } from 'lucide-react';
import { ViewState } from '../types';
import { useInstallPWA } from '../hooks/useInstallPWA';

interface SidebarProps {
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
}

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const { isInstallable, install } = useInstallPWA();

  return (
    <div className="w-64 bg-gray-900 text-white h-screen flex flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold tracking-wider flex items-center gap-2">
          <Package className="w-6 h-6 text-indigo-400" />
          V79<span className="text-indigo-400 font-light">INV</span>
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-8">
        <button
          onClick={() => onViewChange('dashboard')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            currentView === 'dashboard' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' 
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="font-medium">Dashboard</span>
        </button>
        
        <button
          onClick={() => onViewChange('inventory')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            currentView === 'inventory' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' 
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <Package className="w-5 h-5" />
          <span className="font-medium">Inventory</span>
        </button>

        <button
          onClick={() => onViewChange('pos')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            currentView === 'pos' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' 
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="font-medium">Point of Sale</span>
        </button>

        <button
          onClick={() => onViewChange('reports')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            currentView === 'reports' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' 
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="font-medium">Reports</span>
        </button>
      </nav>

      <div className="p-4 border-t border-gray-800">
        {isInstallable && (
          <button 
            onClick={install}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600 hover:text-white transition-all mb-2 border border-indigo-500/30"
          >
            <Download className="w-5 h-5" />
            <span className="font-medium">Install App</span>
          </button>
        )}
        <button 
          onClick={() => onViewChange('settings')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
            currentView === 'settings' 
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/20' 
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="font-medium">Settings</span>
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white transition-all mt-2">
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
}
