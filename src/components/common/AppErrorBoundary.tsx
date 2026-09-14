import React from 'react';

interface State { hasError: boolean; message?: string; }

export default class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : 'Unknown application error' };
  }
  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[SHAKH] Unhandled render error', error, info);
  }
  reset = () => { window.location.reload(); };
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <main dir="rtl" className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
        <section className="w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-7 shadow-xl text-center">
          <div className="mx-auto mb-5 w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-blue-600 text-white flex items-center justify-center text-3xl font-black">ش</div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">SHAKH</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">کێشەیەکی کاتی لە بارکردنی ئەپەکە ڕوویدا.</p>
          <p className="mt-1 text-sm text-slate-500">تکایە Refresh بکە یان دووبارە هەوڵ بدەرەوە.</p>
          {this.state.message && <details className="mt-5 text-left" dir="ltr"><summary className="cursor-pointer text-xs text-slate-400">Technical details</summary><pre className="mt-2 overflow-auto rounded-xl bg-slate-100 dark:bg-slate-950 p-3 text-xs text-rose-600 whitespace-pre-wrap">{this.state.message}</pre></details>}
          <button onClick={this.reset} className="mt-6 rounded-xl bg-orange-600 px-6 py-3 text-white font-bold hover:bg-orange-700">نوێکردنەوەی پەڕە</button>
        </section>
      </main>
    );
  }
}
