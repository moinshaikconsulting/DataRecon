import React, { useState } from 'react';
import { Columns, ArrowLeft, ArrowRight, ShieldAlert, CheckSquare, Square, Info } from 'lucide-react';

interface MappingStepProps {
  taskName: string;
  fileAName: string;
  fileBName: string;
  headersA: string[];
  headersB: string[];
  onBack: () => void;
  onRunReconciliation: (keysA: string[], keysB: string[]) => void;
  isLoading: boolean;
}

export default function MappingStep({
  taskName,
  fileAName,
  fileBName,
  headersA,
  headersB,
  onBack,
  onRunReconciliation,
  isLoading
}: MappingStepProps) {
  const [selectedKeysA, setSelectedKeysA] = useState<string[]>([]);
  const [selectedKeysB, setSelectedKeysB] = useState<string[]>([]);

  // Toggle Selection for A
  const toggleKeyA = (col: string) => {
    if (selectedKeysA.includes(col)) {
      setSelectedKeysA(selectedKeysA.filter((k) => k !== col));
    } else {
      setSelectedKeysA([...selectedKeysA, col]);
    }
  };

  // Toggle Selection for B
  const toggleKeyB = (col: string) => {
    if (selectedKeysB.includes(col)) {
      setSelectedKeysB(selectedKeysB.filter((k) => k !== col));
    } else {
      setSelectedKeysB([...selectedKeysB, col]);
    }
  };

  const keysCountA = selectedKeysA.length;
  const keysCountB = selectedKeysB.length;
  const isBalanced = keysCountA > 0 && keysCountA === keysCountB;

  const handleSubmit = () => {
    if (!isBalanced) return;
    onRunReconciliation(selectedKeysA, selectedKeysB);
  };

  return (
    <div id="mapping_step_container" className="max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 text-brand-600 rounded-full text-xs font-semibold tracking-wide border border-brand-100">
          <Columns className="w-3.5 h-3.5" />
          <span>Step 2 of 3: Primary Key Mapping</span>
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">
          Match Your Primary Fields
        </h2>
        <p className="text-base text-slate-500 max-w-xl mx-auto">
          Select the column(s) that identify matching records. For composite indices, select multiple keys in the same relative index order.
        </p>
      </div>

      {/* Task identity banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs text-brand-100 font-semibold uppercase tracking-wider block">Active Run Config</span>
          <h3 className="text-lg font-bold font-display">{taskName}</h3>
        </div>
        <div className="flex gap-4 text-xs font-mono text-slate-300">
          <div>
            <span className="text-slate-400 block font-sans">Dataset A:</span>
            <span className="text-emerald-300 font-semibold">{fileAName}</span>
          </div>
          <div>
            <span className="text-slate-400 block font-sans">Dataset B:</span>
            <span className="text-emerald-300 font-semibold">{fileBName}</span>
          </div>
        </div>
      </div>

      {/* Selector side-by-side grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Dataset A Columns list */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden">
          <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center bg-slate-50">
            <div>
              <h4 className="font-bold text-slate-800">Dataset A Headers</h4>
              <p className="text-xs text-slate-500 max-w-sm truncate">{fileAName}</p>
            </div>
            <span className="px-2.5 py-1 bg-brand-500 text-white rounded-full text-xs font-semibold">
              {keysCountA} Selected
            </span>
          </div>

          <div className="p-6 max-h-[400px] overflow-y-auto space-y-2">
            {headersA.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No columns detected</p>
            ) : (
              headersA.map((header) => {
                const isSelected = selectedKeysA.includes(header);
                const orderIndex = selectedKeysA.indexOf(header);
                return (
                  <div
                    key={`header_a_${header}`}
                    onClick={() => toggleKeyA(header)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/30 text-brand-900 font-medium'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-brand-600 shrink-0" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300 shrink-0" />
                      )}
                      <span className="text-sm font-mono truncate max-w-[240px]">{header}</span>
                    </div>

                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px] font-bold">
                        {orderIndex + 1}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Dataset B Columns list */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-md overflow-hidden">
          <div className="p-5 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center bg-slate-50">
            <div>
              <h4 className="font-bold text-slate-800">Dataset B Headers</h4>
              <p className="text-xs text-slate-500 max-w-sm truncate">{fileBName}</p>
            </div>
            <span className="px-2.5 py-1 bg-brand-500 text-white rounded-full text-xs font-semibold">
              {keysCountB} Selected
            </span>
          </div>

          <div className="p-6 max-h-[400px] overflow-y-auto space-y-2">
            {headersB.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">No columns detected</p>
            ) : (
              headersB.map((header) => {
                const isSelected = selectedKeysB.includes(header);
                const orderIndex = selectedKeysB.indexOf(header);
                return (
                  <div
                    key={`header_b_${header}`}
                    onClick={() => toggleKeyB(header)}
                    className={`flex items-center justify-between p-3.5 rounded-xl border cursor-pointer select-none transition-all ${
                      isSelected
                        ? 'border-brand-500 bg-brand-50/30 text-brand-900 font-medium'
                        : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-brand-600 shrink-0" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300 shrink-0" />
                      )}
                      <span className="text-sm font-mono truncate max-w-[240px]">{header}</span>
                    </div>

                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-[10px] font-bold">
                        {orderIndex + 1}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Validation status / warning box banner */}
      <div className="space-y-4">
        {!isBalanced && (keysCountA > 0 || keysCountB > 0) && (
          <div className="p-4 bg-amber-50 border border-amber-100 text-amber-800 rounded-xl flex items-start gap-3 text-sm">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-semibold block">Mismatched Mapping Sequence</strong>
              <span>
                To reconcile accurately, choose the exact same count of primary key columns in both lists. Current counts: Source A = {keysCountA} keys, Source B = {keysCountB} keys.
              </span>
            </div>
          </div>
        )}

        {isBalanced && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl flex items-start gap-3 text-sm animate-fade-in bg-emerald-50">
            <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-semibold block">Balanced Key Configuration Locked!</strong>
              <div className="font-mono text-xs text-slate-600 space-y-0.5 mt-1.5">
                {selectedKeysA.map((keyA, idx) => (
                  <div key={`summary_mapping_${idx}`} className="flex items-center gap-2">
                    <span className="text-slate-500 font-semibold">Key Column {idx + 1}:</span>
                    <span className="bg-emerald-100 px-1.5 py-0.5 rounded text-slate-800">{keyA}</span>
                    <span className="text-slate-400">⟶</span>
                    <span className="bg-emerald-100 px-1.5 py-0.5 rounded text-slate-800">{selectedKeysB[idx]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Global Navigation controls */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-100">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Upload</span>
          </button>

          <button
            type="button"
            disabled={!isBalanced || isLoading}
            onClick={handleSubmit}
            className="px-6 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-100 disabled:text-slate-300 text-white rounded-xl text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-md disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>Run Reconciliation Engine</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
