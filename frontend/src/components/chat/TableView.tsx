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
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/5 to-violet-600/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

        <div className="relative bg-[#0A0F16]/80 ring-1 ring-gray-800/30 rounded-xl p-5 my-4 backdrop-blur-xl transition-all duration-200">
          <div className="text-sm text-gray-300 font-medium mb-4">{summarizeResults(results)}</div>
          
          <div className="flex flex-wrap gap-3 items-center">
            <button
              onClick={() => setShowJson((v) => !v)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-black/20 hover:bg-indigo-600/10 text-gray-300 hover:text-indigo-400 rounded-lg text-xs font-medium transition-all duration-200 ring-1 ring-gray-800/50"
              type="button"
            >
              {showJson ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showJson ? "Hide JSON" : "View JSON"}
            </button>

            <button
              onClick={copyJson}
              className="inline-flex items-center gap-2 px-4 py-2 bg-black/20 hover:bg-indigo-600/10 text-gray-300 hover:text-indigo-400 rounded-lg text-xs font-medium transition-all duration-200 ring-1 ring-gray-800/50"
              type="button"
              title="Copy JSON to clipboard"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy JSON
            </button>

            <button
              onClick={downloadJson}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 rounded-lg text-xs font-medium transition-all duration-200 ring-1 ring-indigo-500/20 hover:ring-indigo-500/30"
              type="button"
              title="Download JSON"
            >
              <Download className="w-3.5 h-3.5" />
              Download JSON
            </button>
          </div>
          
          {showJson && (
            <div className="mt-4 relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/5 to-violet-600/5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
              <div className="relative bg-black/30 rounded-lg p-4 overflow-auto backdrop-blur-sm [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-gray-900/20 [&::-webkit-scrollbar-thumb]:bg-gray-700/30 [&::-webkit-scrollbar-thumb]:rounded-full ring-1 ring-gray-800/50">
                <pre className="text-xs text-gray-300 font-mono leading-relaxed">{jsonText}</pre>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const { columns, rows: filteredRows } = processedData;
  if (columns.length === 0) {
    return (
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/5 to-violet-600/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
        <div className="relative bg-[#0A0F16]/80 ring-1 ring-gray-800/30 rounded-xl p-8 my-4 text-center backdrop-blur-xl transition-all duration-200">
          <div className="text-gray-400 text-sm font-medium">No tabular data to display.</div>
        </div>
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
    <div className="relative group">
      {/* Gradient hover effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/5 to-violet-600/5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

      <div className="relative rounded-xl bg-[#0A0F16]/80 ring-1 ring-gray-800/30 backdrop-blur-xl my-6 mx-auto transition-all duration-200 text-[13px]">
        {/* Controls */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/30">
          <div className="text-xs font-medium text-gray-300 tracking-wide">
            <span className="text-white/90 font-semibold">{effectiveRows.length}</span>
            <span className="mx-1 text-gray-500">/</span>
            <span className="text-gray-400">{filteredRows.length} rows</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={rowLimit}
                onChange={(e) => setRowLimit(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="appearance-none bg-black/20 ring-1 ring-gray-800/50 rounded-lg px-4 py-2 pr-8 text-xs font-medium text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all duration-200"
                title="Rows per page"
              >
                <option value={10}>10 rows</option>
                <option value={25}>25 rows</option>
                <option value={50}>50 rows</option>
                <option value={100}>100 rows</option>
                <option value={"all"}>All rows</option>
              </select>
              <ChevronDown className="absolute right-3 top-2.5 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={copyCsv}
                className="p-2 rounded-lg hover:bg-indigo-600/10 transition-colors text-gray-400 hover:text-indigo-400 ring-1 ring-gray-800/50"
                title="Copy CSV to clipboard"
                aria-label="Copy CSV"
              >
                <Copy className="w-4 h-4" />
              </button>
              <button
                onClick={downloadCsv}
                className="p-2 rounded-lg hover:bg-indigo-600/10 transition-colors text-gray-400 hover:text-indigo-400 ring-1 ring-gray-800/50"
                title="Download CSV"
                aria-label="Download CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Table with custom scrollbar */}
        <div className="overflow-x-auto [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-gray-900/20 [&::-webkit-scrollbar-thumb]:bg-gray-700/30 [&::-webkit-scrollbar-thumb]:rounded-full">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-[#0A0F16]/95 backdrop-blur-xl border-b border-gray-800/30">
              <tr>
                {columns.map((col: string) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-left font-medium text-indigo-400/90 whitespace-nowrap first:pl-4 last:pr-4"
                  >
                    <div className="truncate max-w-[180px]" title={col}>
                      {col}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {effectiveRows.map((row, i) => (
                <tr 
                  key={i} 
                  className="group/row border-b border-gray-800/30 last:border-0 hover:bg-indigo-600/5 transition-colors"
                >
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
                        className={`px-4 py-2.5 group-hover/row:text-gray-200 transition-colors first:pl-4 last:pr-4 ${
                          isNumeric ? 'text-right font-medium text-gray-300' : 'text-left text-gray-400'
                        }`}
                      >
                        <div className="truncate max-w-[180px]" title={display || 'null'}>
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
          <div className="px-6 py-3 text-xs text-gray-400 border-t border-gray-800/30">
            Showing {effectiveRows.length} of {filteredRows.length} rows
          </div>
        )}
      </div>
    </div>
  );
}