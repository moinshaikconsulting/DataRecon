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

export interface DiscrepancyDetail {
  column: string;
  valA: any;
  valB: any;
}

export interface ExactMatchRow {
  key: string;
  keyValues: string;
  rowA: Record<string, any>;
  rowB: Record<string, any>;
}

export interface DiscrepancyRow {
  key: string;
  keyValues: string;
  rowA: Record<string, any>;
  rowB: Record<string, any>;
  differences: DiscrepancyDetail[];
}

export interface MissingRowA {
  key: string;
  keyValues: string;
  rowB: Record<string, any>;
}

export interface MissingRowB {
  key: string;
  keyValues: string;
  rowA: Record<string, any>;
}

export interface DiscrepancyBarItem {
  column: string;
  count: number;
}

export interface ReconciliationReport {
  taskId: string;
  taskName: string;
  fileAName: string;
  fileBName: string;
  createdAt: string;
  isSaved: boolean;
  keysA: string[];
  keysB: string[];
  stats: {
    totalRecordsProcessed: number;
    totalUniqueKeys: number;
    exactMatchesCount: number;
    discrepanciesCount: number;
    missingInACount: number;
    missingInBCount: number;
    dataHealthScore: number;
    datasetARecordsCount: number;
    datasetBRecordsCount: number;
  };
  exactMatches: ExactMatchRow[];
  discrepancies: DiscrepancyRow[];
  missingInA: MissingRowA[];
  missingInB: MissingRowB[];
  discrepancyBarData: DiscrepancyBarItem[];
}
