import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  dbInit,
  dbSaveTask,
  dbGetTask,
  dbListTasks,
  dbDeleteTask,
  tempStorage
} from './db-adapter.ts';

const app = express();
const PORT = 3000;

// Increase payload limit to support large CSV/Excel uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Healthy check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// GET list of saved reconciliation tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await dbListTasks();
    res.json({ tasks });
  } catch (error: any) {
    console.error('Failed to retrieve tasks:', error);
    res.status(500).json({ error: 'Failed to retrieve tasks' });
  }
});

// DELETE a reconciliation task
app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const success = await dbDeleteTask(id);
    if (success) {
      res.json({ message: 'Task deleted successfully' });
    } else {
      res.status(500).json({ error: 'Failed to delete task' });
    }
  } catch (error: any) {
    console.error('Failed to delete task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// POST to initialize a reconciliation task
app.post('/api/reconcile/initialize', async (req, res) => {
  const { name, fileAName, fileBName, datasetA, datasetB, save } = req.body;

  if (!name || !fileAName || !fileBName || !datasetA || !datasetB) {
    return res.status(400).json({ error: 'Missing required configuration or datasets.' });
  }

  const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Extract unique headers
  const headersA = datasetA.length > 0 ? Object.keys(datasetA[0]) : [];
  const headersB = datasetB.length > 0 ? Object.keys(datasetB[0]) : [];

  try {
    const isSaved = !!save;
    if (isSaved) {
      console.log(`[Task Save] Saving permanent task ${name} (${taskId}) with ${datasetA.length + datasetB.length} rows.`);
      await dbSaveTask(taskId, name, fileAName, fileBName, headersA, headersB, datasetA, datasetB);
    } else {
      console.log(`[Task Memory] Holding temporary task ${name} (${taskId}) in cache.`);
      tempStorage.set(taskId, {
        name,
        fileAName,
        fileBName,
        headersA,
        headersB,
        datasetA,
        datasetB,
        createdAt: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      taskId,
      name,
      fileAName,
      fileBName,
      headersA,
      headersB,
      isSaved
    });
  } catch (error: any) {
    console.error('Task initialization failed:', error);
    res.status(500).json({ error: 'Failed to initialize reconciliation task' });
  }
});

// POST to execute reconciliation based on primary keys
app.post('/api/reconcile/run', async (req, res) => {
  const { taskId, keysA, keysB } = req.body;

  if (!taskId || !keysA || !keysB || !Array.isArray(keysA) || !Array.isArray(keysB) || keysA.length === 0 || keysB.length === 0) {
    return res.status(400).json({ error: 'A valid Task ID and set of primary keys for both datasets is required.' });
  }

  try {
    const taskDetails = await dbGetTask(taskId);
    if (!taskDetails) {
      return res.status(404).json({ error: 'Reconciliation task not found. It may have expired or been deleted.' });
    }

    const { metadata, datasetA, datasetB } = taskDetails;

    // 1. Build a Map of Dataset B rows index by Composite Keys
    const mapB = new Map<string, { row: Record<string, any>; matched: boolean }>();
    datasetB.forEach((row) => {
      const keyString = keysB.map((k) => {
        const val = row[k];
        return val === undefined || val === null ? '' : String(val).trim();
      }).join('__');
      
      // If there are duplicate keys, the last one wins, but we store it
      mapB.set(keyString, { row, matched: false });
    });

    // 2. Determine overlapping columns to check for discrepancies
    const keySetA = new Set(keysA);
    const keySetB = new Set(keysB);
    const overlappingColumns = metadata.headersA.filter(
      (h) => metadata.headersB.includes(h) && !keySetA.has(h) && !keySetB.has(h)
    );

    const exactMatches: any[] = [];
    const discrepancies: any[] = [];
    const missingInB: any[] = [];
    const columnErrorCounts: Record<string, number> = {};

    // Prime column error counts for all overlapping columns
    overlappingColumns.forEach((col) => {
      columnErrorCounts[col] = 0;
    });

    // 3. Scan Dataset A
    datasetA.forEach((rowA) => {
      const keyStringA = keysA.map((k) => {
        const val = rowA[k];
        return val === undefined || val === null ? '' : String(val).trim();
      }).join('__');

      const entryB = mapB.get(keyStringA);

      if (!entryB) {
        // Missing in B
        const keyValues = keysA.map((k) => `${k}: ${rowA[k] || 'N/A'}`).join(', ');
        missingInB.push({
          key: keyStringA,
          keyValues,
          rowA
        });
      } else {
        // Mark matched
        entryB.matched = true;
        const rowB = entryB.row;

        // Check for discrepancies in overlapping column names only
        const diffs: { column: string; valA: any; valB: any }[] = [];
        
        overlappingColumns.forEach((col) => {
          const valA = rowA[col] === undefined || rowA[col] === null ? '' : String(rowA[col]).trim();
          const valB = rowB[col] === undefined || rowB[col] === null ? '' : String(rowB[col]).trim();

          if (valA !== valB) {
            diffs.push({
              column: col,
              valA: rowA[col],
              valB: rowB[col]
            });
            // Increment error frequency count for this column
            columnErrorCounts[col] = (columnErrorCounts[col] || 0) + 1;
          }
        });

        const keyValues = keysA.map((k) => `${k}: ${rowA[k] || 'N/A'}`).join(', ');

        if (diffs.length === 0) {
          exactMatches.push({
            key: keyStringA,
            keyValues,
            rowA,
            rowB
          });
        } else {
          discrepancies.push({
            key: keyStringA,
            keyValues,
            rowA,
            rowB,
            differences: diffs
          });
        }
      }
    });

    // 4. Scan B for rows missing in A (entries in mapB that were not matched)
    const missingInA: any[] = [];
    mapB.forEach((value, keyStr) => {
      if (!value.matched) {
        const rowB = value.row;
        const keyValues = keysB.map((k) => `${k}: ${rowB[k] || 'N/A'}`).join(', ');
        missingInA.push({
          key: keyStr,
          keyValues,
          rowB
        });
      }
    });

    // 5. Calculate KPI Metrics
    const totalRecords = datasetA.length + datasetB.length;
    const totalUniqueKeys = exactMatches.length + discrepancies.length + missingInA.length + missingInB.length;
    
    // Overall Data Health score representing successfully matched records (exact matches + zero discrepancies fraction)
    const dataHealthScore = totalUniqueKeys > 0 
      ? Math.round((exactMatches.length / totalUniqueKeys) * 100) 
      : 0;

    // Compile bar chart data for discrepancies
    const discrepancyBarData = Object.entries(columnErrorCounts)
      .map(([column, count]) => ({ column, count }))
      .sort((a, b) => b.count - a.count); // desc

    const summaryReport = {
      taskId,
      taskName: metadata.name,
      fileAName: metadata.fileAName,
      fileBName: metadata.fileBName,
      createdAt: metadata.createdAt,
      isSaved: metadata.isSaved,
      keysA,
      keysB,
      stats: {
        totalRecordsProcessed: totalRecords,
        totalUniqueKeys,
        exactMatchesCount: exactMatches.length,
        discrepanciesCount: discrepancies.length,
        missingInACount: missingInA.length,
        missingInBCount: missingInB.length,
        dataHealthScore,
        datasetARecordsCount: datasetA.length,
        datasetBRecordsCount: datasetB.length
      },
      exactMatches,
      discrepancies,
      missingInA,
      missingInB,
      discrepancyBarData
    };

    // 6. Memory enforcement cleanup for "Proceed Without Save"
    if (!metadata.isSaved) {
      console.log(`[Wiping Temporary Cache] Erasing raw temporary dataset memory for ${metadata.name} (${taskId}) immediately post-summary.`);
      tempStorage.delete(taskId);
    }

    res.json(summaryReport);
  } catch (error: any) {
    console.error('Failed to run reconciliation comparison:', error);
    res.status(500).json({ error: 'Failed to compute dataset comparisons.' });
  }
});

// Assemble static/middleware serving
async function startServer() {
  // Try initializing databases
  await dbInit();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Reconciliation Server successfully booting on http://0.0.0.0:${PORT}`);
  });
}

startServer();
