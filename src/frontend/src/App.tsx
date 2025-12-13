import { useState } from 'react';
import './index.css';
import ScreenerMode from './components/ScreenerMode';
import ListenerMode from './components/ListenerMode';
import ChartPeekMode from './components/ChartPeekMode';
import { Activity, Ear, FileText } from 'lucide-react';

type Mode = 'screener' | 'listener' | 'chart';

function App() {
  console.log('App component rendering');
  const [currentMode, setCurrentMode] = useState<Mode>('screener');

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      {/* Header */}
      <header className="glass-card" style={{
        margin: 'var(--spacing-xl)',
        padding: 'var(--spacing-xl)',
        borderRadius: 'var(--radius-2xl)'
      }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-md">
            <div style={{
              width: '48px',
              height: '48px',
              background: 'var(--gradient-primary)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Activity size={28} color="white" />
            </div>
            <div>
              <h1 className="gradient-text" style={{ marginBottom: '0', fontSize: 'var(--font-size-3xl)' }}>
                ClinIQ
              </h1>
              <p className="text-secondary" style={{ fontSize: 'var(--font-size-sm)', marginBottom: '0' }}>
                AI-Powered Clinical Trial Matching
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex gap-sm" style={{
            background: 'var(--color-bg-secondary)',
            padding: 'var(--spacing-xs)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <button
              className={`btn ${currentMode === 'screener' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setCurrentMode('screener')}
              style={{ padding: 'var(--spacing-md) var(--spacing-lg)' }}
            >
              <Activity size={18} />
              Screener
            </button>
            <button
              className={`btn ${currentMode === 'listener' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setCurrentMode('listener')}
              style={{ padding: 'var(--spacing-md) var(--spacing-lg)' }}
            >
              <Ear size={18} />
              Listener
            </button>
            <button
              className={`btn ${currentMode === 'chart' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setCurrentMode('chart')}
              style={{ padding: 'var(--spacing-md) var(--spacing-lg)' }}
            >
              <FileText size={18} />
              Chart Peek
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container" style={{ paddingBottom: 'var(--spacing-2xl)' }}>
        <div className="fade-in">
          {currentMode === 'screener' && <ScreenerMode />}
          {currentMode === 'listener' && <ListenerMode />}
          {currentMode === 'chart' && <ChartPeekMode />}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        textAlign: 'center',
        padding: 'var(--spacing-xl)',
        color: 'var(--color-text-tertiary)',
        fontSize: 'var(--font-size-sm)'
      }}>
        <p>ClinIQ © 2025 • Powered by Gemini AI • Built for Oncologists</p>
      </footer>
    </div>
  );
}

export default App;
