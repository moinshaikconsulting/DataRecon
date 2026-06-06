import React, { useState } from 'react';
import { Layers, Sparkles, Database, HelpCircle, Columns, RefreshCw, AlertTriangle, ShieldAlert } from 'lucide-react';
import UploadStep from './components/UploadStep.tsx';
import MappingStep from './components/MappingStep.tsx';
import DashboardStep from './components/DashboardStep.tsx';
import HistorySidebar from './components/HistorySidebar.tsx';
import { TaskMetadata, ReconciliationReport } from './types.ts';

export default function App() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Reconciliation state
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskName, setTaskName] = useState('');
  const [fileAName, setFileAName] = useState('');
  const [fileBName, setFileBName] = useState('');
  const [headersA, setHeadersA] = useState<string[]>([]);
  const [headersB, setHeadersB] = useState<string[]>([]);
  const [report, setReport] = useState<ReconciliationReport | null>(null);

  // Trigger history sidebar ledger refresh
  const [triggerRefresh, setTriggerRefresh] = useState(false);

  // Handler for uploading new files
  const handleIngestCompleted = async (
    name: string,
    datasetA: Record<string, any>[],
    datasetB: Record<string, any>[],
    fileAName: string,
    fileBName: string,
    save: boolean
  ) => {
    setIsLoading(true);
    setGlobalError(null);

    const payload = {
      name,
      fileAName,
      fileBName,
      datasetA,
      datasetB,
      save
    };

    try {
      const res = await fetch('/api/reconcile/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Server rejected dataset ingestion.');
      }

      const data = await res.json();
      
      // Save metadata to local state
      setActiveTaskId(data.taskId);
      setTaskName(data.name);
      setFileAName(data.fileAName);
      setFileBName(data.fileBName);
      setHeadersA(data.headersA);
      setHeadersB(data.headersB);
      
      // Advance wizard
      setStep(2);

      // Force history reload if saved permanently
      if (save) {
        setTriggerRefresh((prev) => !prev);
      }
    } catch (err: any) {
      console.error('Ingestion error:', err);
      setGlobalError(err.message || 'Network failure connecting to Express API server.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for running reconciliation engine with specific primary keys
  const handleRunReconciliation = async (keysA: string[], keysB: string[]) => {
    if (!activeTaskId) return;

    setIsLoading(true);
    setGlobalError(null);

    const payload = {
      taskId: activeTaskId,
      keysA,
      keysB
    };

    try {
      const res = await fetch('/api/reconcile/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Reconciliation comparison execution failed.');
      }

      const reportData: ReconciliationReport = await res.json();
      setReport(reportData);
      
      // Advance to full dashboard presentation
      setStep(3);
    } catch (err: any) {
      console.error('Reconciliation execution error:', err);
      setGlobalError(err.message || 'Failed to compare datasets.');
    } finally {
      setIsLoading(false);
    }
  };

  // Reload past runs from PostgreSQL database ledger sidebar
  const handleLoadSavedTask = (task: TaskMetadata) => {
    setGlobalError(null);
    setActiveTaskId(task.id);
    setTaskName(task.name);
    setFileAName(task.fileAName);
    setFileBName(task.fileBName);
    setHeadersA(task.headersA);
    setHeadersB(task.headersB);
    setReport(null);
    
    // Hop straight to key mapping step
    setStep(2);
  };

  // Reset flow
  const handleReset = () => {
    setStep(1);
    setActiveTaskId(null);
    setTaskName('');
    setFileAName('');
    setFileBName('');
    setHeadersA([]);
    setHeadersB([]);
    setReport(null);
    setGlobalError(null);
  };

  return (
    <div id="reconciliation_app_root" className="min-h-screen bg-[#F8FAFC] pb-12">
      
      {/* Brand header navigation strip */}
      <nav className="border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <div className="flex items-center gap-2.5 cursor-pointer" onClick={handleReset}>
              <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-brand-500/20">
                <Columns className="w-5 h-5" />
              </div>
              <div>
                <span className="font-display font-bold text-slate-800 text-sm block tracking-tight uppercase">ReconFlow</span>
                <span className="text-[10px] text-slate-400 font-mono -mt-1 block">Data Audit Workspace</span>
              </div>
            </div>

            {/* Step Breadcrumbs panel */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span className={step === 1 ? 'text-brand-600 font-bold' : ''}>Ingestion</span>
              <span className="text-slate-300">/</span>
              <span className={step === 2 ? 'text-brand-600 font-bold' : ''}>Key Mapping</span>
              <span className="text-slate-300">/</span>
              <span className={step === 3 ? 'text-brand-600 font-bold' : ''}>Dashboard Audit</span>
            </div>

            {/* System Status online marker */}
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Engine Status: Live</span>
            </div>

          </div>
        </div>
      </nav>

      {/* Main Content Space */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        
        {globalError && (
          <div className="p-4 bg-rose-50 border border-rose-150 text-rose-800 rounded-2xl mb-6 flex items-start gap-3 text-sm animate-shake max-w-4xl mx-auto">
            <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-semibold block">System Operations alert</strong>
              <span>{globalError}</span>
            </div>
          </div>
        )}

        {/* Dynamic split grid structure when configuring (step 1 or 2) */}
        {step < 3 ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Left rail / Side sidebar ledger (takes 1 col) */}
            <div className="lg:col-span-1 order-last lg:order-first">
              <HistorySidebar
                activeTaskId={activeTaskId}
                onLoadTask={handleLoadSavedTask}
                triggerRefresh={triggerRefresh}
              />
            </div>

            {/* Primary workspace layout widget (takes 3 cols) */}
            <div className="lg:col-span-3">
              {step === 1 && (
                <UploadStep
                  onComplete={handleIngestCompleted}
                  isLoading={isLoading}
                />
              )}

              {step === 2 && (
                <MappingStep
                  taskName={taskName}
                  fileAName={fileAName}
                  fileBName={fileBName}
                  headersA={headersA}
                  headersB={headersB}
                  onBack={() => setStep(1)}
                  onRunReconciliation={handleRunReconciliation}
                  isLoading={isLoading}
                />
              )}
            </div>

          </div>
        ) : (
          // Full-screen desktop width layout whenever displaying the heavy dashboard summary reports
          <div className="w-full">
            {report && (
              <DashboardStep
                report={report}
                onRestart={handleReset}
              />
            )}
          </div>
        )}

      </main>
    </div>
  );
}
