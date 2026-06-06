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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Data Health Score */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:scale-[1.01] hover:shadow-md transition-all flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-slate-400 block tracking-wide uppercase">Match Integrity</span>
            <span className="text-2xl font-bold text-slate-800 font-mono tracking-tight shrink-0">
              {report.stats.dataHealthScore}%
            </span>
          </div>
          {/* subtle accent background arc matching progress */}
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-5 pointer-events-none">
            <Award className="w-24 h-24 text-blue-600" />
          </div>
        </div>

        {/* KPI 2: Total records key depth */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:scale-[1.01] hover:shadow-md transition-all flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-500 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-slate-400 block tracking-wide uppercase">Total Records</span>
            <span className="text-2xl font-bold text-slate-800 font-mono tracking-tight shrink-0">
              {report.stats.totalRecordsProcessed.toLocaleString()}
            </span>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-5 pointer-events-none">
            <Layers className="w-24 h-24 text-slate-600" />
          </div>
        </div>

        {/* KPI 3: Perfect exact match counts */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:scale-[1.01] hover:shadow-md transition-all flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-slate-400 block tracking-wide uppercase">Perfect Matches</span>
            <span className="text-2xl font-bold text-emerald-700 font-mono tracking-tight shrink-0">
              {report.stats.exactMatchesCount.toLocaleString()}
            </span>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-5 pointer-events-none">
            <CheckCircle2 className="w-24 h-24 text-emerald-600" />
          </div>
        </div>

        {/* KPI 4: Discrepancy counts */}
        <div className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:scale-[1.01] hover:shadow-md transition-all flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-0.5">
            <span className="text-xs font-medium text-slate-400 block tracking-wide uppercase">Mismatched Rows</span>
            <span className="text-2xl font-bold text-rose-600 font-mono tracking-tight shrink-0">
              {report.stats.discrepanciesCount.toLocaleString()}
            </span>
          </div>
          <div className="absolute right-0 bottom-0 translate-x-3 translate-y-3 opacity-5 pointer-events-none">
            <AlertTriangle className="w-24 h-24 text-rose-500" />
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
                  return (
                    <tr key={row.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Column 1: Key Info */}
                      <td className="py-4 px-5">
                        <div className="space-y-0.5">
                          <span className="font-mono text-slate-800 font-semibold text-xs block truncate bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md max-w-sm w-fit">
                            {row.keyValues}
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
                          <span className="text-slate-400">
                            All audited properties verify identically matches across both spreadsheets.
                          </span>
                        )}
                        
                        {row.type === 'discrepancy' && row.differences && (
                          <div className="space-y-1 bg-rose-50/20 border border-rose-100 rounded-xl p-2.5 max-w-lg">
                            <span className="text-[10px] font-bold text-rose-700 block uppercase tracking-wide">
                              Mismatched Column Breakdown ({row.differences.length}):
                            </span>
                            <div className="space-y-1 flex flex-col font-mono text-[11px] text-slate-600 mt-1">
                              {row.differences.map((diff, idx) => (
                                <div key={`diff_detail_${row.id}_${idx}`} className="flex flex-wrap items-center gap-2 border-b border-rose-50/50 pb-1 last:border-0 last:pb-0">
                                  <span className="text-slate-800 font-semibold">{diff.column}:</span>
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
                        )}

                        {row.type === 'missingA' && (
                          <span className="text-indigo-600">
                            This primary key was not found in Dataset A. It is present exclusively in Dataset B.
                          </span>
                        )}

                        {row.type === 'missingB' && (
                          <span className="text-violet-600">
                            This primary key was not found in Dataset B. It is present exclusively in Dataset A.
                          </span>
                        )}
                      </td>

                    </tr>
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
