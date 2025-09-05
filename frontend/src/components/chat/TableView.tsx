import React, { useMemo, useState } from "react";
import { 
  ChevronDown, 
  Copy, 
  Download, 
  Eye, 
  EyeOff
} from "lucide-react";

type AnyObject = Record<string, unknown>;

function summarizeResults(results: unknown): string {
  if (Array.isArray(results)) {
    if (results.length === 0) return "No rows returned.";
    const first = results[0];
    if (typeof first === "object" && first !== null && !Array.isArray(first)) {
      const cols = Object.keys(first as AnyObject).slice(0, 8);
      return `Returned ${results.length} row(s). Sample columns: ${cols.join(", ")}`;
    }
    return `Returned ${results.length} value(s).`;
  } else if (results && typeof results === "object") {
    const keys = Object.keys(results as AnyObject).slice(0, 10);
    return `Object with keys: ${keys.join(", ")}`;
  } else {
    return String(results ?? "No data");
  }
}

export default function TableView({ results }: { results: unknown }) {
  const [showJson, setShowJson] = useState(false);
  const [rowLimit, setRowLimit] = useState<number | "all">(50);

  const tableData = useMemo(() => {
    // Normalize results into { columns: string[], rows: Array<Record<string,unknown>> }
    if (Array.isArray(results)) {
      // legacy: array of rows (objects) or values
      const rows = (results as unknown[]).map((r) => {
        if (r && typeof r === "object" && !Array.isArray(r)) return r as AnyObject;
        return { value: r } as AnyObject;
      });

      const columns = Array.from(
        rows.reduce((set, r) => {
          Object.keys(r).forEach((k) => set.add(k));
          return set;
        }, new Set<string>())
      );

      return { columns, rows };
    }

    // New structured shape: { columns?: string[], rows: Array<object|array> }
    if (results && typeof results === "object") {
      const maybe = results as unknown as { columns?: unknown; rows?: unknown };
      if (Array.isArray(maybe.rows)) {
        const rawRows = maybe.rows as unknown[];
        const providedCols = Array.isArray(maybe.columns)
          ? (maybe.columns as unknown[]).map((c) => String(c))
          : undefined;

        const normalizedRows: AnyObject[] = rawRows.map((r) => {
          if (Array.isArray(r)) {
            // Map positional array to object using providedCols when available.
            if (providedCols && providedCols.length >= r.length) {
              const obj: AnyObject = {};
              (r as unknown[]).forEach((val, idx) => {
                obj[providedCols[idx]] = val;
              });
              return obj;
            }
            // Fallback: numeric column names
            const obj: AnyObject = {};
            (r as unknown[]).forEach((val, idx) => {
              obj[`col_${idx}`] = val;
            });
            return obj;
          }

          if (r && typeof r === "object") return r as AnyObject;
          return { value: r } as AnyObject;
        });

        const derivedCols = normalizedRows.length > 0 ? Object.keys(normalizedRows[0]) : [];
        const columns = providedCols && providedCols.length ? providedCols : derivedCols;
        return { columns, rows: normalizedRows };
      }
    }

    return null;
  }, [results]);

  const processedData = useMemo(() => {
    if (!tableData) return null;
    return { ...tableData, rows: tableData.rows };
  }, [tableData]);

  if (!processedData) {
    const jsonText = JSON.stringify(results, null, 2);
    const copyJson = async () => {
      try {
        await navigator.clipboard.writeText(jsonText);
      } catch {
        // ignore
      }
    };

    const downloadJson = () => {
      const blob = new Blob([jsonText], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "results.json";
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div className="bg-gray-900/40 rounded-lg border border-gray-600/50 p-3 sm:p-4 my-3 sm:my-4">
        <div className="text-sm text-gray-200 font-medium mb-3">{summarizeResults(results)}</div>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setShowJson((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm font-medium transition-colors"
            type="button"
          >
            {showJson ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showJson ? "Hide JSON" : "View JSON"}
          </button>

          <button
            onClick={copyJson}
            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded text-sm font-medium transition-colors"
            type="button"
            title="Copy JSON to clipboard"
          >
            <Copy className="w-3 h-3" />
            <span className="hidden sm:inline">Copy JSON</span>
            <span className="sm:hidden">Copy</span>
          </button>

          <button
            onClick={downloadJson}
            className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm font-medium transition-colors"
            type="button"
            title="Download JSON"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Download JSON</span>
            <span className="sm:hidden">JSON</span>
          </button>
        </div>
        {showJson && (
          <div className="mt-3 bg-gray-800 rounded p-3 overflow-auto">
            <pre className="text-xs text-gray-100 font-mono whitespace-pre-wrap break-words">{jsonText}</pre>
          </div>
        )}
      </div>
    );
  }

  const { columns, rows: filteredRows } = processedData;
  if (columns.length === 0) {
    return (
      <div className="bg-gray-900/40 rounded-lg border border-gray-600/50 p-3 sm:p-4 my-3 sm:my-4 text-center">
        <div className="text-gray-400 text-sm">No tabular data to display.</div>
      </div>
    );
  }

  const effectiveRows = rowLimit === "all" ? filteredRows : filteredRows.slice(0, rowLimit);

  const toCsv = (dataRows: AnyObject[]) => {
    const esc = (v: unknown) => {
      if (v === null || typeof v === "undefined") return "";
      if (typeof v === "object") return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
      const s = String(v);
      return s.includes(",") || s.includes("\n") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = columns.join(",");
    const lines = dataRows.map((r: AnyObject) => columns.map((c: string) => esc(r[c])).join(","));
    return [header, ...lines].join("\n");
  };

  const downloadCsv = () => {
    const csv = toCsv(effectiveRows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCsv = async () => {
    try {
      await navigator.clipboard.writeText(toCsv(effectiveRows));
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-gray-900/40 rounded-lg border border-gray-600/50 shadow-sm my-3 sm:my-4">
      {/* Header Controls - Mobile Optimized */}
      <div className="bg-gray-800/60 border-b border-gray-600/50 px-3 sm:px-4 py-2 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-t-lg gap-2 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-sm font-medium text-gray-100">
            {effectiveRows.length} of {filteredRows.length} rows
          </div>
          {filteredRows.length !== (tableData?.rows?.length ?? 0) && (
            <div className="text-xs text-gray-400">(filtered from {tableData?.rows?.length ?? 0} total)</div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400">Rows:</label>
            <div className="relative">
              <select
                value={rowLimit}
                onChange={(e) => setRowLimit(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="appearance-none bg-gray-700 border border-gray-600 rounded px-2 py-1 pr-6 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 text-gray-100"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={"all"}>All</option>
              </select>
              <ChevronDown className="absolute right-1 top-1.5 h-3 w-3 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <button
            onClick={copyCsv}
            className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-200 hover:bg-gray-600 transition-colors"
          >
            <Copy className="w-3 h-3" />
            <span className="hidden sm:inline">Copy CSV</span>
            <span className="sm:hidden">Copy</span>
          </button>

          <button
            onClick={downloadCsv}
            className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs transition-colors"
          >
            <Download className="w-3 h-3" />
            <span className="hidden sm:inline">Download CSV</span>
            <span className="sm:hidden">CSV</span>
          </button>
        </div>
      </div>

      {/* Table View - Unified for all screen sizes */}
      <div className="overflow-x-auto overscroll-x-contain">
        <table className="min-w-full divide-y divide-gray-700/50">
          <thead className="bg-gray-800/40">
            <tr>
              {columns.map((col: string) => (
                <th
                  key={col}
                  className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider border-r border-gray-700/30 last:border-r-0 whitespace-nowrap"
                >
                  <div className="truncate max-w-[120px] sm:max-w-[200px]" title={col}>
                    {col}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-gray-900/20 divide-y divide-gray-700/30">
            {effectiveRows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-800/20 transition-colors">
                {columns.map((col: string) => {
                  const cell = row[col];
                  let display = "";
                  let isNumeric = false;

                  if (cell === null || typeof cell === "undefined") {
                    display = "";
                  } else if (typeof cell === "number") {
                    display = String(cell);
                    isNumeric = true;
                  } else if (typeof cell === "object") {
                    try {
                      display = JSON.stringify(cell);
                    } catch {
                      display = String(cell);
                    }
                  } else {
                    display = String(cell);
                    isNumeric = !isNaN(Number(display)) && display.trim() !== "";
                  }

                  return (
                    <td
                      key={col}
                      className={`px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm border-r border-gray-700/20 last:border-r-0 whitespace-nowrap ${
                        isNumeric ? 'text-right font-mono text-emerald-300' : 'text-left text-gray-200'
                      }`}
                    >
                      <div className="truncate max-w-[120px] sm:max-w-[200px]" title={display || 'null'}>
                        {display || <span className="text-gray-500 italic text-xs">null</span>}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      {filteredRows.length > effectiveRows.length && (
        <div className="bg-gray-800/40 border-t border-gray-600/50 px-3 sm:px-4 py-2 text-xs text-gray-400 rounded-b-lg">
          Showing {effectiveRows.length} of {filteredRows.length} rows
        </div>
      )}
    </div>
  );
}