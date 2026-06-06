import React, { useState, useEffect } from 'react';
import { Database, Clock, ChevronRight, Trash2, HelpCircle, History, Sparkles, RefreshCw } from 'lucide-react';
import { TaskMetadata } from '../types.ts';

interface HistorySidebarProps {
  onLoadTask: (task: TaskMetadata) => void;
  activeTaskId: string | null;
  triggerRefresh: boolean;
}

export default function HistorySidebar({ onLoadTask, activeTaskId, triggerRefresh }: HistorySidebarProps) {
  const [tasks, setTasks] = useState<TaskMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorCount, setErrorCount] = useState(0);

  // Fetch past saved reconciliation tasks
  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to fetch tasks history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [triggerRefresh]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // prevent loading
    if (!window.confirm('Are you sure you want to permanently delete this reconciliation task and drop its associated PostgreSQL tables?')) {
      return;
    }

    try {
      const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        // filter out
        setTasks(tasks.filter((t) => t.id !== id));
      } else {
        alert('Failed to delete reconciliation task.');
      }
    } catch (err) {
      console.error('Error deleting task:', err);
      alert('Network failure deleting task.');
    }
  };

  return (
    <div id="history_sidebar_container" className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-50 pb-3 bg-white">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-slate-500" />
          <h4 className="font-bold text-slate-800 text-sm">Audit Trail Ledger</h4>
        </div>
        
        <button
          onClick={fetchTasks}
          title="Refresh ledger"
          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading && tasks.length === 0 ? (
        <div className="space-y-2 py-4">
          <div className="h-6 bg-slate-50 rounded-lg animate-pulse" />
          <div className="h-6 bg-slate-50 rounded-lg animate-pulse" />
          <div className="h-6 bg-slate-50 rounded-lg animate-pulse" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="py-8 text-center space-y-1 text-slate-400">
          <Database className="w-8 h-8 text-slate-200 mx-auto" />
          <p className="text-xs font-semibold">No saved permanent runs.</p>
          <p className="text-[10px] text-slate-400 max-w-[190px] mx-auto leading-relaxed">
            Choose "Save Run & Map Keys" when initializing to create SQL tables.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
          {tasks.map((task) => {
            const isActive = activeTaskId === task.id;
            const formattedDate = new Date(task.createdAt).toLocaleString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={task.id}
                onClick={() => onLoadTask(task)}
                className={`p-3.5 rounded-xl border cursor-pointer select-none transition-all group flex items-start justify-between gap-2.5 ${
                  isActive
                    ? 'border-brand-500 bg-brand-50/20 shadow-sm'
                    : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="space-y-1.5 min-w-0">
                  <div>
                    <h5 className="font-bold text-slate-800 text-xs block truncate" title={task.name}>
                      {task.name}
                    </h5>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                      <Clock className="w-3 h-3 text-slate-350" />
                      <span>{formattedDate}</span>
                    </div>
                  </div>

                  <div className="font-mono text-[9px] text-slate-500 bg-slate-50 p-1 rounded-md max-w-full truncate">
                    A: {task.fileAName} <br />
                    B: {task.fileBName}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, task.id)}
                    className="p-1 px-1.5 hover:bg-rose-50 text-slate-400 group-hover:text-rose-500 hover:text-rose-600 rounded transition-colors"
                    title="Purge Task"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Side footnote explaining auto retention drops */}
      <div className="p-3 bg-amber-50/50 border border-amber-100/50 rounded-xl text-[10px] leading-relaxed text-slate-500 flex items-start gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
        <span>
          <strong>Retention Period:</strong> Local and cloud tables is configured to auto-drop precisely 7 days after creation for security.
        </span>
      </div>
    </div>
  );
}
