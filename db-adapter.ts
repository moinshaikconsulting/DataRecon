import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

export interface TaskMetadata {
  id: string;
  name: string;
  fileAName: string;
  fileBName: string;
  headersA: string[];
  headersB: string[];
  createdAt: string;
  isSaved: boolean;
}

export interface TaskDataRow {
  source: 'A' | 'B';
  data: Record<string, any>;
}

const FALLBACK_FILE = path.join(process.cwd(), 'reconciliation_tasks_fallback.json');

// Memory cache for "Proceed Without Save" tasks
export const tempStorage = new Map<string, {
  name: string;
  fileAName: string;
  fileBName: string;
  headersA: string[];
  headersB: string[];
  datasetA: Record<string, any>[];
  datasetB: Record<string, any>[];
  createdAt: string;
}>();

let pool: any = null;
let isFallbackMode = false;

// Initialize Postgres connection pool
try {
  let poolConfig: any;
  const connectionString = process.env.DATABASE_URL;

  if (connectionString) {
    console.log('Connecting to PostgreSQL using DATABASE_URL connection string...');
    poolConfig = {
      connectionString,
      ssl: process.env.NODE_ENV === 'production' || connectionString.includes('sslmode=require') || connectionString.includes('render.com') || connectionString.includes('railway')
        ? { rejectUnauthorized: false }
        : false,
      connectionTimeoutMillis: 7000,
    };
  } else {
    const pgConfig = {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'reconciliation_db',
      user: process.env.PGUSER || 'recon_user',
      password: process.env.PGPASSWORD || 'secure_password',
      connectionTimeoutMillis: 5000,
    };
    console.log(`Connecting to Postgres at ${pgConfig.host}:${pgConfig.port} as user ${pgConfig.user}...`);
    poolConfig = pgConfig;
  }

  pool = new Pool(poolConfig);

  // Bind an error listener to prevent idle client issues from crashing server
  pool.on('error', (err: any) => {
    console.error('Unexpected error on idle PostgreSQL pool client:', err);
  });
} catch (error) {
  console.warn('Postgres connection setup failed. Entering JSON fallback mode.', error);
  isFallbackMode = true;
}

// Ensure local fallback file is primed
function initFallbackFile() {
  if (!fs.existsSync(FALLBACK_FILE)) {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify({ tasks: {}, records: {} }, null, 2));
  }
}

// Read fallback data
function readFallbackData() {
  try {
    initFallbackFile();
    const content = fs.readFileSync(FALLBACK_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to read fallback database file:', error);
    return { tasks: {}, records: {} };
  }
}

// Write fallback data
function writeFallbackData(data: any) {
  try {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to write fallback database file:', error);
  }
}

// Initialize tables or fallback
export async function dbInit() {
  if (isFallbackMode) {
    console.log('Database running in Local JSON Fallback Mode.');
    initFallbackFile();
    runCleanup(); // Run rentention policy cleanup
    return;
  }

  try {
    // Check connection by executing a basic select
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL!');
    client.release();

    // Create the master metadata table if not exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reconciliation_tasks (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        file_a_name VARCHAR(255),
        file_b_name VARCHAR(255),
        headers_a TEXT NOT NULL, -- JSON string representation
        headers_b TEXT NOT NULL, -- JSON string representation
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Schema matching completed. reconciliation_tasks table is healthy.');
    runCleanup(); // Run retention cleanup
  } catch (error) {
    console.warn('PostgreSQL database connection failed or table creation error.');
    console.warn('ACTUAL DATABASE CONNECTION ERROR:', error);
    console.warn('--- GENTLE FALLBACK ---: Switching to Local JSON file database persistence for premium sandboxed experience.');
    isFallbackMode = true;
    initFallbackFile();
    runCleanup();
  }
}

// Delete a task and its tables
export async function dbDeleteTask(taskId: string): Promise<boolean> {
  if (isFallbackMode) {
    const dbData = readFallbackData();
    delete dbData.tasks[taskId];
    delete dbData.records[taskId];
    writeFallbackData(dbData);
    return true;
  }

  try {
    // Drop dynamic data table
    await pool.query(`DROP TABLE IF EXISTS "recon_data_${taskId}"`);
    // Delete task metadata
    await pool.query('DELETE FROM reconciliation_tasks WHERE id = $1', [taskId]);
    return true;
  } catch (error) {
    console.error(`Failed to delete task ${taskId} from PostgreSQL:`, error);
    return false;
  }
}

// Store task metadata and raw dataset
export async function dbSaveTask(
  taskId: string,
  name: string,
  fileAName: string,
  fileBName: string,
  headersA: string[],
  headersB: string[],
  datasetA: Record<string, any>[],
  datasetB: Record<string, any>[]
): Promise<void> {
  const createdAt = new Date().toISOString();

  if (isFallbackMode) {
    const dbData = readFallbackData();
    dbData.tasks[taskId] = {
      id: taskId,
      name,
      fileAName,
      fileBName,
      headersA,
      headersB,
      createdAt,
      isSaved: true
    };
    dbData.records[taskId] = {
      datasetA,
      datasetB
    };
    writeFallbackData(dbData);
    return;
  }

  try {
    // Insert into metadata table
    await pool.query(
      `INSERT INTO reconciliation_tasks (id, name, file_a_name, file_b_name, headers_a, headers_b, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [taskId, name, fileAName, fileBName, JSON.stringify(headersA), JSON.stringify(headersB), createdAt]
    );

    // Create a dynamic table dedicated to storing these datasets
    const tableName = `recon_data_${taskId}`;
    await pool.query(`
      CREATE TABLE "${tableName}" (
        id SERIAL PRIMARY KEY,
        source CHAR(1) NOT NULL, -- 'A' or 'B'
        data JSONB NOT NULL
      )
    `);

    // Batch insert Dataset A rows
    if (datasetA.length > 0) {
      // Chunk insertions for big CSVs to avoid query size limits
      const chunkSize = 100;
      for (let i = 0; i < datasetA.length; i += chunkSize) {
        const chunk = datasetA.slice(i, i + chunkSize);
        const values: string[] = [];
        const params: any[] = [];
        chunk.forEach((row, idx) => {
          values.push(`('A', $${idx + 1})`);
          params.push(JSON.stringify(row));
        });
        await pool.query(
          `INSERT INTO "${tableName}" (source, data) VALUES ${values.join(', ')}`,
          params
        );
      }
    }

    // Batch insert Dataset B rows
    if (datasetB.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < datasetB.length; i += chunkSize) {
        const chunk = datasetB.slice(i, i + chunkSize);
        const values: string[] = [];
        const params: any[] = [];
        chunk.forEach((row, idx) => {
          values.push(`('B', $${idx + 1})`);
          params.push(JSON.stringify(row));
        });
        await pool.query(
          `INSERT INTO "${tableName}" (source, data) VALUES ${values.join(', ')}`,
          params
        );
      }
    }
  } catch (error) {
    console.error('Failed to save to PostgreSQL database. Saving to JSON fallback instead.', error);
    // Write fallback logic
    const dbData = readFallbackData();
    dbData.tasks[taskId] = {
      id: taskId,
      name,
      fileAName,
      fileBName,
      headersA,
      headersB,
      createdAt,
      isSaved: true
    };
    dbData.records[taskId] = {
      datasetA,
      datasetB
    };
    writeFallbackData(dbData);
  }
}

// Retrieve task and datasets
export async function dbGetTask(taskId: string): Promise<{
  metadata: TaskMetadata;
  datasetA: Record<string, any>[];
  datasetB: Record<string, any>[];
} | null> {
  // Check memory cache first (for "Proceed Without Save" tasks)
  const tempTask = tempStorage.get(taskId);
  if (tempTask) {
    return {
      metadata: {
        id: taskId,
        name: tempTask.name,
        fileAName: tempTask.fileAName,
        fileBName: tempTask.fileBName,
        headersA: tempTask.headersA,
        headersB: tempTask.headersB,
        createdAt: tempTask.createdAt,
        isSaved: false
      },
      datasetA: tempTask.datasetA,
      datasetB: tempTask.datasetB
    };
  }

  if (isFallbackMode) {
    const dbData = readFallbackData();
    const task = dbData.tasks[taskId];
    const records = dbData.records[taskId];
    if (!task) return null;
    return {
      metadata: task,
      datasetA: records?.datasetA || [],
      datasetB: records?.datasetB || []
    };
  }

  try {
    const res = await pool.query('SELECT * FROM reconciliation_tasks WHERE id = $1', [taskId]);
    if (res.rows.length === 0) return null;

    const row = res.rows[0];
    const metadata: TaskMetadata = {
      id: row.id,
      name: row.name,
      fileAName: row.file_a_name,
      fileBName: row.file_b_name,
      headersA: JSON.parse(row.headers_a),
      headersB: JSON.parse(row.headers_b),
      createdAt: row.created_at.toISOString(),
      isSaved: true
    };

    // Load data from the dedicated table
    const tableName = `recon_data_${taskId}`;
    const dataRes = await pool.query(`SELECT source, data FROM "${tableName}"`);
    const datasetA: Record<string, any>[] = [];
    const datasetB: Record<string, any>[] = [];

    dataRes.rows.forEach((r: any) => {
      // JSON parsed automatically by pg driver or manually
      const parsedData = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      if (r.source === 'A') {
        datasetA.push(parsedData);
      } else {
        datasetB.push(parsedData);
      }
    });

    return {
      metadata,
      datasetA,
      datasetB
    };
  } catch (error) {
    console.error(`Failed to get task ${taskId} from PostgreSQL:`, error);
    // Try to fallback if the table doesn't exist but has JSON copy
    const dbData = readFallbackData();
    const task = dbData.tasks[taskId];
    const records = dbData.records[taskId];
    if (task) {
      return {
        metadata: task,
        datasetA: records?.datasetA || [],
        datasetB: records?.datasetB || []
      };
    }
    return null;
  }
}

// List all saved tasks in DB
export async function dbListTasks(): Promise<TaskMetadata[]> {
  if (isFallbackMode) {
    const dbData = readFallbackData();
    return Object.values(dbData.tasks);
  }

  try {
    const res = await pool.query('SELECT * FROM reconciliation_tasks ORDER BY created_at DESC');
    return res.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      fileAName: row.file_a_name,
      fileBName: row.file_b_name,
      headersA: JSON.parse(row.headers_a),
      headersB: JSON.parse(row.headers_b),
      createdAt: row.created_at.toISOString(),
      isSaved: true
    }));
  } catch (error) {
    console.error('Failed to list tasks from PostgreSQL:', error);
    const dbData = readFallbackData();
    return Object.values(dbData.tasks);
  }
}

// Background Retention Policy: auto-delete tables older than 7 days (7 * 24 * 60 * 60 * 1000 ms)
export function runCleanup() {
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const now = new Date().getTime();
  console.log('Retention policy check running...');

  if (isFallbackMode) {
    const dbData = readFallbackData();
    const updatedTasks: any = {};
    const updatedRecords: any = {};
    let deletedCount = 0;

    for (const id in dbData.tasks) {
      const task = dbData.tasks[id];
      const taskTime = new Date(task.createdAt).getTime();
      if (now - taskTime < SEVEN_DAYS_MS) {
        updatedTasks[id] = task;
        updatedRecords[id] = dbData.records[id];
      } else {
        deletedCount++;
        console.log(`[Retention Fallback] Auto-cleaned old task: ${task.name} (${id})`);
      }
    }

    if (deletedCount > 0) {
      dbData.tasks = updatedTasks;
      dbData.records = updatedRecords;
      writeFallbackData(dbData);
      console.log(`Retention Policy: Cleared ${deletedCount} fallback tasks.`);
    }
    return;
  }

  // Postgres cleanup
  (async () => {
    try {
      const sevenDaysAgo = new Date(now - SEVEN_DAYS_MS).toISOString();
      const res = await pool.query(
        'SELECT id, name, created_at FROM reconciliation_tasks WHERE created_at < $1',
        [sevenDaysAgo]
      );

      for (const row of res.rows) {
        console.log(`[Retention PG] Auto-cleaning old task: ${row.name} (${row.id})`);
        await pool.query(`DROP TABLE IF EXISTS "recon_data_${row.id}"`);
        await pool.query('DELETE FROM reconciliation_tasks WHERE id = $1', [row.id]);
      }
      if (res.rows.length > 0) {
        console.log(`Retention Policy: Cleared ${res.rows.length} PG tasks.`);
      }
    } catch (error) {
      console.error('Failed to run PostgreSQL retention cleanup:', error);
    }
  })();
}

// Schedule retention policy check every 6 hours
setInterval(runCleanup, 6 * 60 * 1000 * 60);
