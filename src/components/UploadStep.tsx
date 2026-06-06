import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, CheckCircle2, FileSpreadsheet, Layers, Sparkles, Database, ShieldAlert } from 'lucide-react';

interface UploadStepProps {
  onComplete: (
    name: string,
    datasetA: Record<string, any>[],
    datasetB: Record<string, any>[],
    fileAName: string,
    fileBName: string,
    save: boolean
  ) => void;
  isLoading: boolean;
}

export default function UploadStep({ onComplete, isLoading }: UploadStepProps) {
  const [taskName, setTaskName] = useState('');
  const [fileA, setFileA] = useState<{ name: string; rowsCount: number; colsCount: number; data: any[] } | null>(null);
  const [fileB, setFileB] = useState<{ name: string; rowsCount: number; colsCount: number; data: any[] } | null>(null);
  const [dragActiveA, setDragActiveA] = useState(false);
  const [dragActiveB, setDragActiveB] = useState(false);

  const fileInputRefA = useRef<HTMLInputElement>(null);
  const fileInputRefB = useRef<HTMLInputElement>(null);

  const [parseError, setParseError] = useState<string | null>(null);

  // Parse Excel/.CSV using SheetJS as ArrayBuffer
  const parseSpreadsheet = (file: File, type: 'A' | 'B') => {
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const data = new Uint8Array(buffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (workbook.SheetNames.length === 0) {
          throw new Error('Spreadsheet has no worksheets.');
        }

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON array of objects
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonData.length === 0) {
          throw new Error('Worksheet is completely empty.');
        }

        const headers = Object.keys(jsonData[0]);

        const fileStats = {
          name: file.name,
          rowsCount: jsonData.length,
          colsCount: headers.length,
          data: jsonData
        };

        if (type === 'A') {
          setFileA(fileStats);
        } else {
          setFileB(fileStats);
        }
      } catch (err: any) {
        console.error('File parsing error:', err);
        setParseError(`Failed to load "${file.name}": ${err.message || 'Check if file format is supported.'}`);
      }
    };

    reader.onerror = () => {
      setParseError(`Failed to read file ${file.name}`);
    };

    reader.readAsArrayBuffer(file);
  };

  // Input change handlers
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'A' | 'B') => {
    if (e.target.files && e.target.files[0]) {
      parseSpreadsheet(e.target.files[0], type);
    }
  };

  // Drag handlers
  const handleDrag = (e: React.DragEvent, type: 'A' | 'B', active: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'A') {
      setDragActiveA(active);
    } else {
      setDragActiveB(active);
    }
  };

  const handleDrop = (e: React.DragEvent, type: 'A' | 'B') => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'A') {
      setDragActiveA(false);
    } else {
      setDragActiveB(false);
    }

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      const validExtensions = ['.csv', '.xlsx', '.xls'];
      const fileExt = droppedFile.name.substring(droppedFile.name.lastIndexOf('.')).toLowerCase();
      
      if (validExtensions.includes(fileExt)) {
        parseSpreadsheet(droppedFile, type);
      } else {
        setParseError('Unsupported file type. Please upload a .csv, .xlsx, or .xls file.');
      }
    }
  };

  const isFormValid = taskName.trim().length > 0 && fileA !== null && fileB !== null;

  const triggerSubmit = (save: boolean) => {
    if (!isFormValid || !fileA || !fileB) return;
    onComplete(
      taskName.trim(),
      fileA.data,
      fileB.data,
      fileA.name,
      fileB.name,
      save
    );
  };

  return (
    <div id="upload_step_container" className="max-w-4xl mx-auto space-y-8 animate-fade-in">
      {/* Step Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-50 text-brand-600 rounded-full text-xs font-semibold tracking-wide border border-brand-100">
          <Layers className="w-3.5 h-3.5" />
          <span>Step 1 of 3: Dataset Ingestion</span>
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Initialize Your Reconciliation
        </h2>
        <p className="text-base text-slate-500 max-w-lg mx-auto">
          Choose a name for this run and import the two spreadsheets you intend to cross-reference and map.
        </p>
      </div>

      {/* Main card box */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-xl p-6 md:p-8 space-y-6">
        
        {/* Name Input */}
        <div className="space-y-2">
          <label htmlFor="task_name_input" className="text-sm font-medium text-slate-700 block">
            Reconciliation Task Name
          </label>
          <input
            id="task_name_input"
            type="text"
            required
            className="w-full text-base px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all font-sans text-slate-800 placeholder:text-slate-400 bg-slate-50/50"
            placeholder="e.g., Q2 Retail Transactions Match, Inventory Audit June 2026"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
          />
        </div>

        {parseError && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-700 text-sm rounded-xl flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{parseError}</span>
          </div>
        )}

        {/* Binary Uploaders Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-2">
          
          {/* Dataset A Upload */}
          <div className="space-y-2">
            <span className="text-sm font-semibold text-slate-700 block px-0.5">
              Dataset A <span className="text-slate-400 font-normal">(Primary Source)</span>
            </span>
            
            <div
              onDragOver={(e) => handleDrag(e, 'A', true)}
              onDragLeave={(e) => handleDrag(e, 'A', false)}
              onDrop={(e) => handleDrop(e, 'A')}
              onClick={() => fileInputRefA.current?.click()}
              className={`glass-button w-full min-h-[170px] py-6 px-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer relative transition-all duration-300 ${
                dragActiveA ? 'border-brand-500 bg-brand-50/50 scale-[1.01]' : ''
              } ${fileA ? 'border-emerald-200 bg-emerald-50/10' : ''}`}
            >
              <input
                ref={fileInputRefA}
                type="file"
                className="hidden"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => handleFileChange(e, 'A')}
              />

              {fileA ? (
                <div className="flex flex-col items-center space-y-2 text-emerald-800">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-sm">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-mono font-semibold max-w-[210px] truncate text-slate-700">
                      {fileA.name}
                    </p>
                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
                      <span>{fileA.rowsCount.toLocaleString()} rows</span>
                      <span className="text-slate-300">•</span>
                      <span>{fileA.colsCount} columns</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center shadow-sm">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Drop Dataset A or click</p>
                    <p className="text-xs text-slate-400 mt-1">Accepts CSV, XLSX, XLS up to 50MB</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Dataset B Upload */}
          <div className="space-y-2">
            <span className="text-sm font-semibold text-slate-700 block px-0.5">
              Dataset B <span className="text-slate-400 font-normal">(Comparison Source)</span>
            </span>

            <div
              onDragOver={(e) => handleDrag(e, 'B', true)}
              onDragLeave={(e) => handleDrag(e, 'B', false)}
              onDrop={(e) => handleDrop(e, 'B')}
              onClick={() => fileInputRefB.current?.click()}
              className={`glass-button w-full min-h-[170px] py-6 px-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer relative transition-all duration-300 ${
                dragActiveB ? 'border-brand-500 bg-brand-50/50 scale-[1.01]' : ''
              } ${fileB ? 'border-emerald-200 bg-emerald-50/10' : ''}`}
            >
              <input
                ref={fileInputRefB}
                type="file"
                className="hidden"
                accept=".csv, .xlsx, .xls"
                onChange={(e) => handleFileChange(e, 'B')}
              />

              {fileB ? (
                <div className="flex flex-col items-center space-y-2 text-emerald-800">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-sm">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-mono font-semibold max-w-[210px] truncate text-slate-700">
                      {fileB.name}
                    </p>
                    <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
                      <span>{fileB.rowsCount.toLocaleString()} rows</span>
                      <span className="text-slate-300">•</span>
                      <span>{fileB.colsCount} columns</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center shadow-sm">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Drop Dataset B or click</p>
                    <p className="text-xs text-slate-400 mt-1">Accepts CSV, XLSX, XLS up to 50MB</p>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Informative Footnote about Retention */}
        <div className="p-3 bg-slate-50 rounded-xl flex items-center gap-3 border border-slate-100 text-xs text-slate-500">
          <Database className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            <strong>Note:</strong> Columns from both spreadsheets will be scanned dynamically to let you select matching index criteria in the next step.
          </span>
        </div>

        {/* Action Buttons Frame */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
          
          {/* Proceed Without Save Button */}
          <button
            type="button"
            disabled={!isFormValid || isLoading}
            onClick={() => triggerSubmit(false)}
            className="w-full py-3.5 px-5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300 text-slate-700 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:cursor-not-allowed"
          >
            <Sparkles className={`w-4 h-4 text-slate-500 ${!isFormValid ? 'opacity-40' : ''}`} />
            <span>Proceed Without Save</span>
          </button>

          {/* Proceed With Save Button */}
          <button
            type="button"
            disabled={!isFormValid || isLoading}
            onClick={() => triggerSubmit(true)}
            className="w-full py-3.5 px-5 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-100 disabled:text-slate-300 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm focus:ring-4 focus:ring-brand-500/20 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            <span>Save Run & Map Keys</span>
          </button>

        </div>

      </div>
    </div>
  );
}
