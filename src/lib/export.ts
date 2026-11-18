import * as XLSX from "xlsx";

export function downloadBlob(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportRows(rows: Record<string, unknown>[], name: string, kind: "csv" | "xlsx") {
  const ws = XLSX.utils.json_to_sheet(rows);

  // Auto-fit column widths so no header or content is truncated
  if (rows.length > 0) {
    const keys = Object.keys(rows[0]!);
    ws["!cols"] = keys.map((key) => {
      let maxLen = key.length;
      for (const row of rows) {
        const val = row[key];
        const strVal = val != null ? String(val) : "";
        if (strVal.length > maxLen) {
          maxLen = Math.min(strVal.length, 75);
        }
      }
      return { wch: Math.max(maxLen + 6, 24) };
    });
  }

  if (kind === "csv") return downloadBlob(XLSX.utils.sheet_to_csv(ws), `${name}.csv`, "text/csv");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  downloadBlob(XLSX.write(wb, { type: "array", bookType: "xlsx" }), `${name}.xlsx`, "application/octet-stream");
}

export async function readSheet(file: File): Promise<Record<string, string>[]> {
  const wb = XLSX.read(await file.arrayBuffer());
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "", raw: false });
}
