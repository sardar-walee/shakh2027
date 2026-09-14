import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './i18n/config';
import AppErrorBoundary from './components/common/AppErrorBoundary';

const App = lazy(() => import('./App'));
const root = document.getElementById('root');

function BootScreen() {
  return <div dir="rtl" className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><div className="text-center"><div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-blue-600 text-white flex items-center justify-center text-2xl font-black shadow-lg">ش</div><div className="mt-4 w-8 h-8 mx-auto rounded-full border-4 border-orange-200 border-t-orange-600 animate-spin"/><p className="mt-3 text-sm font-semibold text-slate-500">SHAKH ـە بار دەکرێت...</p></div></div>;
}

if (!root) throw new Error('SHAKH root element was not found');

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<BootScreen />}><App /></Suspense>
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
);
