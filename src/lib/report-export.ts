export type ReportCell = string | number | boolean | null;

function csvCell(value: ReportCell): string {
  let text = value === null ? "" : String(value);
  if (/^[\t\r ]*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildCsv(headers: string[], rows: ReportCell[][]): string {
  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
