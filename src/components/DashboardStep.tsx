import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Award,
  BookOpen,
  Trash2,
  HelpCircle,
  Home,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Database
} from 'lucide-react';
import { ReconciliationReport, ExactMatchRow, DiscrepancyRow, MissingRowA, MissingRowB } from '../types.ts';

interface DashboardStepProps {
  report: ReconciliationReport;
  onRestart: () => void;
}

type FilterType = 'all' | 'matches' | 'discrepancies' | 'missingA' | 'missingB';

export default function DashboardStep({ report, onRestart }: DashboardStepProps) {
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Recharts Pie/Donut Data Compilation
  const pieData = useMemo(() => {
    return [
      { name: 'Exact Matches', value: report.stats.exactMatchesCount, color: '#10b981' }, // emerald
      { name: 'Value Discrepancies', value: report.stats.discrepanciesCount, color: '#f43f5e' }, // rose
      { name: 'Missing in Dataset A', value: report.stats.missingInACount, color: '#6366f1' }, // indigo
      { name: 'Missing in Dataset B', value: report.stats.missingInBCount, color: '#8b5cf6' }  // violet
    ].filter(item => item.value > 0); // only show populated slices
  }, [report]);

  // Handle SheetJS Excel multi-sheet exporting
  const handleExportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // Tab 1: Analytics Brief Summary
    const briefSummary = [
      ['Data Reconciliation Audit Summary'],
      [],
      ['Task Name', report.taskName],
      ['Original File A (Primary)', report.fileAName],
      ['Original File B (Comparison)', report.fileBName],
      ['Mapping Criteria (Keys A)', report.keysA.join(', ')],
      ['Mapping Criteria (Keys B)', report.keysB.join(', ')],
      ['Scan Executed At', report.createdAt],
      ['Persistence State', report.isSaved ? 'Permanently Saved' : 'Transient Session Store (Wiped)'],
      [],
      ['Core Audit Metrics', 'Value'],
      ['Dataset Health Score (Match Rate)', `${report.stats.dataHealthScore}%`],
      ['Total Records Processed', report.stats.totalRecordsProcessed],
      ['Total Unique Keys Evaluated', report.stats.totalUniqueKeys],
      ['Exact Matches', report.stats.exactMatchesCount],
      ['Mismatches / Value Discrepancies', report.stats.discrepanciesCount],
      ['Missing Records in A', report.stats.missingInACount],
      ['Missing Records in B', report.stats.missingInBCount],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(briefSummary);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Audit Executive Summary');

    // Tab 2: Value Discrepancies detailed
    const discrepancyTabRows = report.discrepancies.flatMap((d) =>
      d.differences.map((diff) => ({
        'Primary Key Criteria': d.keyValues,
        'Mismatched Property / Column Name': diff.column,
        'Source Value (Dataset A)': diff.valA === undefined ? 'N/A' : String(diff.valA),
        'Comparison Value (Dataset B)': diff.valB === undefined ? 'N/A' : String(diff.valB),
      }))
    );
    const wsDiscrepancies = XLSX.utils.json_to_sheet(discrepancyTabRows);
    XLSX.utils.book_append_sheet(wb, wsDiscrepancies, 'Value Mismatches');

    // Tab 3: Missing in A Rows
    const missingInATabRows = report.missingInA.map((m) => ({
      'Primary Key String': m.keyValues,
      'Audit Notice': 'Present only in Dataset B. Omitted from Dataset A.',
      ...m.rowB
    }));
    const wsMissingA = XLSX.utils.json_to_sheet(missingInATabRows);
    XLSX.utils.book_append_sheet(wb, wsMissingA, 'Missing in Source A');

    // Tab 4: Missing in B Rows
    const missingInBTabRows = report.missingInB.map((m) => ({
      'Primary Key String': m.keyValues,
      'Audit Notice': 'Present only in Dataset A. Omitted from Dataset B.',
      ...m.rowA
    }));
    const wsMissingB = XLSX.utils.json_to_sheet(missingInBTabRows);
    XLSX.utils.book_append_sheet(wb, wsMissingB, 'Missing in Source B');

    // Tab 5: Perfect Matches
    const perfectMatcheTabRows = report.exactMatches.map((m) => ({
      'Primary Key String': m.keyValues,
      ...m.rowA
    }));
    const wsMatches = XLSX.utils.json_to_sheet(perfectMatcheTabRows);
    XLSX.utils.book_append_sheet(wb, wsMatches, 'Perfect Matches');

    // Trigger file download
    const safeOutputName = report.taskName.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    XLSX.writeFile(wb, `Reconciliation_Audit_${safeOutputName}.xlsx`);
  };

  // Compile individual filterable lists
  const filteredRows = useMemo(() => {
    let rows: Array<{
      id: string;
      keyValues: string;
      type: 'match' | 'discrepancy' | 'missingA' | 'missingB';
      rowA?: Record<string, any>;
      rowB?: Record<string, any>;
      differences?: Array<{ column: string; valA: any; valB: any }>;
    }> = [];

    // Push matches
    if (activeFilter === 'all' || activeFilter === 'matches') {
      rows = rows.concat(
        report.exactMatches.map((r, i) => ({
          id: `match_${i}`,
          keyValues: r.keyValues,
          type: 'match' as const,
          rowA: r.rowA,
          rowB: r.rowB
        }))
      );
    }

    // Push discrepancies
    if (activeFilter === 'all' || activeFilter === 'discrepancies') {
      rows = rows.concat(
        report.discrepancies.map((r, i) => ({
          id: `discrepancy_${i}`,
          keyValues: r.keyValues,
          type: 'discrepancy' as const,
          rowA: r.rowA,
          rowB: r.rowB,
          differences: r.differences
        }))
      );
    }

    // Push missing in A
    if (activeFilter === 'all' || activeFilter === 'missingA') {
      rows = rows.concat(
        report.missingInA.map((r, i) => ({
          id: `missingA_${i}`,
          keyValues: r.keyValues,
          type: 'missingA' as const,
          rowB: r.rowB
        }))
      );
    }

    // Push missing in B
    if (activeFilter === 'all' || activeFilter === 'missingB') {
      rows = rows.concat(
        report.missingInB.map((r, i) => ({
          id: `missingB_${i}`,
          keyValues: r.keyValues,
          type: 'missingB' as const,
          rowA: r.rowA
        }))
      );
    }

    // Search filter
    if (searchTerm.trim() !== '') {
      const q = searchTerm.toLowerCase();
      rows = rows.filter((row) => row.keyValues.toLowerCase().includes(q));
    }

    return rows;
  }, [report, activeFilter, searchTerm]);

  // Paginate list
  const totalItems = filteredRows.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedRows = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    return filteredRows.slice(startIdx, startIdx + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Adjust page count securely
  const setPageSecurely = (p: number) => {
    if (p >= 1 && p <= totalPages) {
      setCurrentPage(p);
    }
  };

  const hasColumnsWithDiscrepancies = report.discrepancyBarData && report.discrepancyBarData.length > 0;

  return (
    <div id="dashboard_step_container" className="space-y-8 animate-fade-in">
      
      {/* Upper header action toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-200">
              Analysis Lock Completed
            </span>
            {!report.isSaved && (
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full border border-amber-200">
                Transient Mode
              </span>
            )}
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
            {report.taskName}
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Audit Run Criteria: {report.fileAName} ⇄ {report.fileBName}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onRestart}
            className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-semibold tracking-wide transition-all bg-white flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Home className="w-4 h-4" />
            <span>Map New Files</span>
          </button>

          <button
            type="button"
            onClick={handleExportToExcel}
            className="px-4.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold tracking-wide transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/10"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export XLS Audit Report</span>
          </button>
        </div>
      </div>

      {/* KPI METRICS SHELF */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        
        {/* KPI 1: Data Health Score */}
        <div className="bg-white border border-slate-100 p-4.5 rounded-2xl shadow-sm hover:scale-[1.01] hover:shadow-md transition-all flex items-center gap-3 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] font-bold text-slate-400 block tracking-wide uppercase">Match Rate</span>
            <span className="text-xl font-black text-slate-800 font-mono tracking-tight block">
              {report.stats.dataHealthScore}%
            </span>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-5 pointer-events-none">
            <Award className="w-16 h-16 text-blue-600" />
          </div>
        </div>

        {/* KPI 2: Dataset A Count */}
        <div className="bg-white border border-slate-100 p-4.5 rounded-2xl shadow-sm hover:scale-[1.01] hover:shadow-md transition-all flex items-center gap-3 relative overflow-hidden" title={`File A: ${report.fileAName}`}>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] font-bold text-slate-400 block tracking-wide uppercase truncate" title={`Dataset A Size: ${report.fileAName}`}>
              Dataset A Size
            </span>
            <span className="text-xl font-black text-teal-700 font-mono tracking-tight block">
              {(report.stats.datasetARecordsCount ?? report.exactMatches.length + report.discrepancies.length + report.missingInB.length).toLocaleString()}
            </span>
            <span className="text-[9px] text-slate-400 block truncate" style={{ maxWidth: '100%' }}>
              {report.fileAName}
            </span>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-5 pointer-events-none">
            <FileSpreadsheet className="w-16 h-16 text-teal-600" />
          </div>
        </div>

        {/* KPI 3: Dataset B Count */}
        <div className="bg-white border border-slate-100 p-4.5 rounded-2xl shadow-sm hover:scale-[1.01] hover:shadow-md transition-all flex items-center gap-3 relative overflow-hidden" title={`File B: ${report.fileBName}`}>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] font-bold text-slate-400 block tracking-wide uppercase truncate" title={`Dataset B Size: ${report.fileBName}`}>
              Dataset B Size
            </span>
            <span className="text-xl font-black text-indigo-700 font-mono tracking-tight block">
              {(report.stats.datasetBRecordsCount ?? report.exactMatches.length + report.discrepancies.length + report.missingInA.length).toLocaleString()}
            </span>
            <span className="text-[9px] text-slate-400 block truncate" style={{ maxWidth: '100%' }}>
              {report.fileBName}
            </span>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-5 pointer-events-none">
            <FileSpreadsheet className="w-16 h-16 text-indigo-600" />
          </div>
        </div>

        {/* KPI 4: Total records key depth */}
        <div className="bg-white border border-slate-100 p-4.5 rounded-2xl shadow-sm hover:scale-[1.01] hover:shadow-md transition-all flex items-center gap-3 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] font-bold text-slate-400 block tracking-wide uppercase/n">Processed rows</span>
            <span className="text-xl font-black text-slate-800 font-mono tracking-tight block">
              {report.stats.totalRecordsProcessed.toLocaleString()}
            </span>
            <span className="text-[9px] text-slate-400 block">
              Combined records
            </span>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-5 pointer-events-none">
            <Layers className="w-16 h-16 text-slate-600" />
          </div>
        </div>

        {/* KPI 5: Perfect exact match counts */}
        <div className="bg-white border border-slate-100 p-4.5 rounded-2xl shadow-sm hover:scale-[1.01] hover:shadow-md transition-all flex items-center gap-3 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] font-bold text-slate-400 block tracking-wide uppercase">Matches</span>
            <span className="text-xl font-black text-emerald-700 font-mono tracking-tight block">
              {report.stats.exactMatchesCount.toLocaleString()}
            </span>
            <span className="text-[9px] text-slate-400 block">
              Zero discrepancy rows
            </span>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-5 pointer-events-none">
            <CheckCircle2 className="w-16 h-16 text-emerald-600" />
          </div>
        </div>

        {/* KPI 6: Discrepancy counts */}
        <div className="bg-white border border-slate-100 p-4.5 rounded-2xl shadow-sm hover:scale-[1.01] hover:shadow-md transition-all flex items-center gap-3 relative overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-0.5 min-w-0">
            <span className="text-[10px] font-bold text-slate-400 block tracking-wide uppercase">Variances</span>
            <span className="text-xl font-black text-rose-600 font-mono tracking-tight block">
              {report.stats.discrepanciesCount.toLocaleString()}
            </span>
            <span className="text-[9px] text-slate-400 block">
              Incompatible values
            </span>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-5 pointer-events-none">
            <AlertTriangle className="w-16 h-16 text-rose-500" />
          </div>
        </div>

      </div>

      {/* DUAL CHART DATA DISPLAY BLOCKS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Chart A: Match Breakdown Pie Donut chart (spanning 5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-slate-800 text-base">Reconciliation Proportions</h4>
            <p className="text-xs text-slate-400">Relative percentage of matching status</p>
          </div>
          
          <div className="h-[240px] w-full flex items-center justify-center my-4">
            {pieData.length === 0 ? (
              <p className="text-sm text-slate-400 font-medium">No records evaluated.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell_${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val) => [`${val.toLocaleString()} units`, 'Impact']}
                    contentStyle={{ background: '#1e293b', color: '#fff', borderRadius: '10px', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Simple custom legend tags */}
          <div className="space-y-2 mt-2">
            {[
              { label: 'Exact Matches', count: report.stats.exactMatchesCount, color: 'bg-emerald-500' },
              { label: 'Value Discrepancies', count: report.stats.discrepanciesCount, color: 'bg-rose-500' },
              { label: 'Missing in A', count: report.stats.missingInACount, color: 'bg-indigo-500' },
              { label: 'Missing in B', count: report.stats.missingInBCount, color: 'bg-violet-500' }
            ].map((tag) => (
              <div key={`legend_tag_${tag.label}`} className="flex items-center justify-between text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${tag.color}`} />
                  <span>{tag.label}</span>
                </div>
                <span className="font-mono font-semibold text-slate-800">{tag.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart B: Discrepancy by Column Bar Chart (spanning 7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h4 className="font-bold text-slate-800 text-base font-display">Mismatches by Header Field</h4>
            <p className="text-xs text-slate-400">Properties breaking frequency rate across dataset datasets</p>
          </div>

          <div className="h-[280px] w-full mt-6">
            {!hasColumnsWithDiscrepancies ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                <p className="text-sm font-semibold text-slate-700">Perfect Column Consistency!</p>
                <p className="text-xs text-slate-400 max-w-[280px]">No differences were found in shared headers between datasets.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {/* Horizontal bar chart to ensure long header names are aligned readably */}
                <BarChart
                  data={report.discrepancyBarData}
                  layout="vertical"
                  margin={{ top: 0, right: 30, left: 24, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} fontFamily="var(--font-mono)" />
                  <YAxis
                    dataKey="column"
                    type="category"
                    stroke="#475569"
                    fontSize={11}
                    fontFamily="var(--font-mono)"
                    width={90}
                  />
                  <Tooltip
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ background: '#1e293b', color: '#fff', borderRadius: '10px', fontSize: '11px' }}
                    formatter={(val) => [`${val} discrepancies`, 'Counts']}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="p-3 bg-blue-50/50 rounded-xl text-[11px] text-slate-500 mt-4 flex items-center gap-2 border border-blue-50">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
            <span>High integrity columns map perfectly. Focused auditing in high failure columns saves time.</span>
          </div>
        </div>

      </div>

      {/* FILTERABLE INTERACTIVE RESULTS AUDIT DATABASE TABLE */}
      <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden" id="audit_table_frame">
        
        {/* Table Search & Filter Toolbar */}
        <div className="p-5 border-b border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h4 className="font-bold text-slate-800 text-base">Granular Discrepancy Registry</h4>
            
            {/* Search Box */}
            <div className="relative max-w-xs w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                className="w-full text-xs pl-9 pr-4 py-2 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 rounded-xl font-sans"
                placeholder="Search mapped key string..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // restart
                }}
              />
            </div>
          </div>

          {/* Filtering Switch Slider Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'all', label: 'All Audited Rows', count: report.stats.totalUniqueKeys },
              { id: 'matches', label: 'Perfect Matches', count: report.stats.exactMatchesCount, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
              { id: 'discrepancies', label: 'Value discrepancies', count: report.stats.discrepanciesCount, color: 'text-rose-600 bg-rose-50 border-rose-100' },
              { id: 'missingA', label: 'Missing in Source A', count: report.stats.missingInACount, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
              { id: 'missingB', label: 'Missing in Source B', count: report.stats.missingInBCount, color: 'text-violet-600 bg-violet-50 border-violet-100' }
            ].map((tab) => {
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={`filter_tab_${tab.id}`}
                  onClick={() => {
                    setActiveFilter(tab.id as FilterType);
                    setCurrentPage(1); // reset pagination
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer select-none flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-slate-900 border-slate-900 text-white shadow-sm font-bold'
                      : 'bg-white border-slate-100 hover:border-slate-200 text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 text-[10px] font-mono rounded-full ${
                    isActive ? 'bg-white/20 text-white' : tab.color || 'bg-slate-50 text-slate-500'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabular List Scroll Canvas */}
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-bold text-[10px] uppercase tracking-wider border-b border-slate-100 font-sans">
                <th className="py-3 px-5">Audited Key Field Values</th>
                <th className="py-3 px-5">Row Match Status</th>
                <th className="py-3 px-5">Status Breakdown Explanation / Variance details</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-slate-100 text-slate-700 font-sans text-xs">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-400 space-y-1">
                    <Database className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-sm">No matched reconciliation rows match criteria.</p>
                    <p className="text-xs">Try searching a different keyword or adjusting search filter criteria.</p>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const isExpanded = expandedRowId === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <tr 
                        onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                        className={`hover:bg-slate-50/70 transition-all cursor-pointer border-b border-slate-100 last:border-0 ${
                          isExpanded ? 'bg-slate-50/80 font-medium' : ''
                        }`}
                      >
                        {/* Column 1: Key Info */}
                        <td className="py-4 px-5">
                          <div className="space-y-1">
                            <span className="font-mono text-slate-800 font-bold text-xs block truncate bg-slate-100/80 border border-slate-200 px-2.5 py-1 rounded-lg w-fit shadow-xs">
                              {row.keyValues}
                            </span>
                            <span className="text-[9px] text-brand-600 font-medium block">
                              {isExpanded ? 'Click to collapse details' : '⚡ Click to inspect side-by-side'}
                            </span>
                          </div>
                        </td>

                        {/* Column 2: Status Tag */}
                        <td className="py-4 px-5 shrink-0 align-middle">
                          {row.type === 'match' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Match
                            </span>
                          )}
                          {row.type === 'discrepancy' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-rose-100 text-rose-800 border border-rose-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              Variance
                            </span>
                          )}
                          {row.type === 'missingA' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                              Omit in A
                            </span>
                          )}
                          {row.type === 'missingB' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-violet-100 text-violet-800 border border-violet-200">
                              Omit in B
                            </span>
                          )}
                        </td>

                        {/* Column 3: Variance / Detail transponders */}
                        <td className="py-4 px-5 max-w-md">
                          {row.type === 'match' && (
                            <div className="flex flex-col gap-1">
                              <span className="text-slate-400">
                                All audited properties verify identically matches across both spreadsheets.
                              </span>
                              <span className="text-[10px] text-emerald-600 font-bold">
                                100% matched row value
                              </span>
                            </div>
                          )}
                          
                          {row.type === 'discrepancy' && row.differences && (
                            <div className="space-y-2">
                              <div className="space-y-1 bg-rose-50/20 border border-rose-100 rounded-xl p-2.5 max-w-lg">
                                <span className="text-[10px] font-bold text-rose-700 block uppercase tracking-wide">
                                  Mismatched Column Breakdown ({row.differences.length}):
                                </span>
                                <div className="space-y-1 flex flex-col font-mono text-[11px] text-slate-600 mt-1">
                                  {row.differences.map((diff, idx) => (
                                    <div key={`diff_detail_${row.id}_${idx}`} className="flex flex-wrap items-center gap-2 border-b border-rose-50/50 pb-1 last:border-0 last:pb-0">
                                      <span className="text-slate-850 font-bold">{diff.column}:</span>
                                      <span className="bg-red-50 text-rose-650 px-1 py-0.2 rounded border border-red-100">
                                        A: {diff.valA === '' ? <em className="text-slate-350">empty</em> : String(diff.valA)}
                                      </span>
                                      <span className="text-slate-400 text-[10px]">⇄</span>
                                      <span className="bg-blue-50 text-blue-800 px-1 py-0.2 rounded border border-blue-100">
                                        B: {diff.valB === '' ? <em className="text-slate-350">empty</em> : String(diff.valB)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <span className="text-[10px] text-brand-600 font-bold flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-brand-500 shrink-0" />
                                Click to inspect interactive side-by-side table matrix
                              </span>
                            </div>
                          )}

                          {row.type === 'missingA' && (
                            <span className="text-indigo-650 font-medium block">
                              This primary key was not found in Dataset A. It is present exclusively in Dataset B.
                            </span>
                          )}

                          {row.type === 'missingB' && (
                            <span className="text-violet-650 font-medium block">
                              This primary key was not found in Dataset B. It is present exclusively in Dataset A.
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* SIDE-BY-SIDE EXPANDED DETAILS */}
                      {isExpanded && (
                        <tr className="bg-slate-50/50">
                          <td colSpan={3} className="p-4 sm:p-6 border-b border-slate-100">
                            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-inner space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-black text-slate-800 tracking-tight flex items-center gap-1">
                                    <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
                                    Interactive Side-by-Side Value Inspected:
                                  </span>
                                  <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono font-bold">
                                    Key ({row.keyValues})
                                  </span>
                                </div>
                                <button 
                                  type="button" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedRowId(null);
                                  }}
                                  className="text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer underline underline-offset-2"
                                >
                                  Collapse inspector
                                </button>
                              </div>

                              {/* Split View */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                
                                {/* PANE A: SOURCE A */}
                                <div className="border border-slate-150 rounded-xl overflow-hidden shadow-xs bg-white">
                                  <div className="bg-slate-50 p-2.5 px-4 border-b border-slate-150 flex items-center justify-between">
                                    <span className="font-bold text-slate-800 text-[11px] truncate max-w-[220px]" title={report.fileAName}>
                                      Dataset A: {report.fileAName}
                                    </span>
                                    <span className="px-1.5 py-0.5 text-[9px] bg-teal-100 text-teal-800 font-bold rounded uppercase">
                                      Source A
                                    </span>
                                  </div>
                                  
                                  <div className="p-2.5 divide-y divide-slate-50 max-h-[320px] overflow-y-auto">
                                    {!row.rowA ? (
                                      <div className="py-12 text-center text-rose-500 font-semibold space-y-1">
                                        <span className="text-xs font-bold block">✕ Key Omitted</span>
                                        <p className="text-[10px] text-slate-400 font-normal">This record is completely missing from Dataset A.</p>
                                      </div>
                                    ) : (
                                      Array.from(new Set([
                                        ...Object.keys(row.rowA), 
                                        ...(row.rowB ? Object.keys(row.rowB) : [])
                                      ])).map((key) => {
                                        const valA = row.rowA ? row.rowA[key] : undefined;
                                        const isPrimaryKey = report.keysA.includes(key);
                                        const isMismatched = row.type === 'discrepancy' && row.differences?.some(d => d.column === key);
                                        
                                        return (
                                          <div 
                                            key={`inspect_cell_A_${row.id}_${key}`} 
                                            className={`py-2 px-3 flex items-start justify-between gap-4 text-xs transition-colors ${
                                              isMismatched 
                                                ? 'bg-rose-50/60 border-l-3 border-rose-500 font-medium' 
                                                : isPrimaryKey 
                                                  ? 'bg-amber-50/50 border-l-3 border-amber-500 font-medium' 
                                                  : 'hover:bg-slate-50/45'
                                            }`}
                                          >
                                            <span className="font-mono text-slate-500 text-[10px] shrink-0 min-w-[120px] max-w-[160px] truncate block" title={key}>
                                              {key} {isPrimaryKey && <span className="text-amber-500 text-[9px]" title="Composite Primary Key">🔑</span>}
                                            </span>
                                            <span className={`break-all text-right max-w-[200px] font-mono text-[11px] ${
                                              isMismatched ? 'text-rose-700 font-bold' : 'text-slate-800'
                                            }`}>
                                              {valA === undefined ? (
                                                <em className="text-slate-300">not a column in A</em>
                                              ) : valA === '' ? (
                                                <em className="text-slate-400">"" (empty)</em>
                                              ) : (
                                                String(valA)
                                              )}
                                            </span>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>

                                {/* PANE B: SOURCE B */}
                                <div className="border border-slate-150 rounded-xl overflow-hidden shadow-xs bg-white">
                                  <div className="bg-slate-50 p-2.5 px-4 border-b border-slate-150 flex items-center justify-between">
                                    <span className="font-bold text-slate-800 text-[11px] truncate max-w-[220px]" title={report.fileBName}>
                                      Dataset B: {report.fileBName}
                                    </span>
                                    <span className="px-1.5 py-0.5 text-[9px] bg-indigo-100 text-indigo-800 font-bold rounded uppercase">
                                      Source B
                                    </span>
                                  </div>

                                  <div className="p-2.5 divide-y divide-slate-50 max-h-[320px] overflow-y-auto">
                                    {!row.rowB ? (
                                      <div className="py-12 text-center text-rose-500 font-semibold space-y-1">
                                        <span className="text-xs font-bold block">✕ Key Omitted</span>
                                        <p className="text-[10px] text-slate-400 font-normal">This record is completely missing from Dataset B.</p>
                                      </div>
                                    ) : (
                                      Array.from(new Set([
                                        ...(row.rowA ? Object.keys(row.rowA) : []), 
                                        ...Object.keys(row.rowB)
                                      ])).map((key) => {
                                        const valB = row.rowB ? row.rowB[key] : undefined;
                                        const isPrimaryKey = report.keysB.includes(key);
                                        const isMismatched = row.type === 'discrepancy' && row.differences?.some(d => d.column === key);

                                        return (
                                          <div 
                                            key={`inspect_cell_B_${row.id}_${key}`} 
                                            className={`py-2 px-3 flex items-start justify-between gap-4 text-xs transition-colors ${
                                              isMismatched 
                                                ? 'bg-rose-50/60 border-l-3 border-rose-500 font-medium' 
                                                : isPrimaryKey 
                                                  ? 'bg-amber-50/50 border-l-3 border-amber-500 font-medium' 
                                                  : 'hover:bg-slate-50/45'
                                            }`}
                                          >
                                            <span className="font-mono text-slate-500 text-[10px] shrink-0 min-w-[120px] max-w-[160px] truncate block" title={key}>
                                              {key} {isPrimaryKey && <span className="text-amber-500 text-[9px]" title="Composite Primary Key">🔑</span>}
                                            </span>
                                            <span className={`break-all text-right max-w-[200px] font-mono text-[11px] ${
                                              isMismatched ? 'text-rose-700 font-bold' : 'text-slate-800'
                                            }`}>
                                              {valB === undefined ? (
                                                <em className="text-slate-300">not a column in B</em>
                                              ) : valB === '' ? (
                                                <em className="text-slate-400">"" (empty)</em>
                                              ) : (
                                                String(valB)
                                              )}
                                            </span>
                                          </div>
                                        );
                                      })
                                    )}
                                  </div>
                                </div>

                              </div>

                              {row.type === 'discrepancy' && row.differences && (
                                <div className="p-3 bg-rose-50 border border-rose-100/70 rounded-xl text-xs text-rose-800 flex items-start gap-1.5 font-sans shadow-xs">
                                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-extrabold">Comparative Value Audit Alert:</span> 
                                    <span className="ml-1">We located discrepancies on {row.differences.length} spreadsheet property metrics:{' '}
                                      <strong className="font-bold underline">{row.differences.map(d => d.column).join(', ')}</strong>.
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Dynamic Pagination Controls Row */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50">
            <span className="text-xs text-slate-500 font-sans">
              Showing <strong className="text-slate-700">{(currentPage - 1) * pageSize + 1}</strong> to{' '}
              <strong className="text-slate-700">
                {Math.min(currentPage * pageSize, totalItems)}
              </strong>{' '}
              of <strong className="text-slate-700">{totalItems}</strong> entries
            </span>

            <div className="flex items-center gap-2">
              {/* Rows dropdown */}
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span>View</span>
                <select
                  className="bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span>rows</span>
              </div>

              {/* Prev / Next buttons */}
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPageSecurely(currentPage - 1)}
                className="p-1 px-1.5 rounded bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 select-none cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              
              <span className="text-xs font-mono text-slate-600 px-1">
                Page {currentPage} of {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setPageSecurely(currentPage + 1)}
                className="p-1 px-1.5 rounded bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 select-none cursor-pointer disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
