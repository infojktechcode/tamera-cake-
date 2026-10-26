"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildCsv, type ReportCell } from "@/lib/report-export";

type ReportType = "sales" | "orders" | "customers" | "expenses";
type ReportData = {
  type: ReportType;
  from: string;
  to: string;
  headers: string[];
  rows: ReportCell[][];
};

const reportOptions: { value: ReportType; label: string; description: string }[] = [
  { value: "sales", label: "Sales", description: "Daily order counts and booked sales, excluding cancelled orders." },
  { value: "orders", label: "Orders", description: "Order status, fulfilment, customer and payment totals." },
  { value: "customers", label: "Customers", description: "New customer contacts and their marketing-consent status." },
  { value: "expenses", label: "Expenses", description: "Owner-only expense entries by the date spent." },
];

function filename(type: ReportType, from: string, to: string, extension: string) {
  return `tamera-${type}-${from}-to-${to}.${extension}`;
}

export function ReportsExport({ today }: { today: string }) {
  const [type, setType] = useState<ReportType>("sales");
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadReport(): Promise<ReportData> {
    const query = new URLSearchParams({ type, from, to });
    const response = await fetch(`/api/admin/reports?${query}`, { cache: "no-store" });
    const data = (await response.json()) as ReportData | { error?: string };
    if (!response.ok || !("headers" in data)) {
      throw new Error("error" in data ? data.error ?? "Could not load this report." : "Could not load this report.");
    }
    return data;
  }

  async function downloadCsv() {
    setBusy("csv");
    setError("");
    setNotice("");
    try {
      const report = await loadReport();
      const content = buildCsv(report.headers, report.rows);
      const url = URL.createObjectURL(new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename(report.type, report.from, report.to, "csv");
      link.click();
      URL.revokeObjectURL(url);
      setNotice("CSV downloaded.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not download this report.");
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    setBusy("pdf");
    setError("");
    setNotice("");
    try {
      const report = await loadReport();
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const pdf = new jsPDF({ orientation: "landscape" });
      pdf.setFontSize(16);
      pdf.text(`Tamera's Cakes & Bakery — ${type} report`, 14, 16);
      pdf.setFontSize(9);
      pdf.text(`${from} to ${to} · ${report.rows.length} row(s)`, 14, 23);
      autoTableModule.default(pdf, {
        head: [report.headers],
        body: report.rows.map((row) => row.map((cell) => cell === null ? "" : String(cell))),
        startY: 29,
        styles: { fontSize: 8, overflow: "linebreak" },
        headStyles: { fillColor: [58, 38, 32] },
      });
      pdf.save(filename(report.type, report.from, report.to, "pdf"));
      setNotice("PDF downloaded.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not download this report.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export a report</CardTitle>
        <p className="text-sm text-ink-muted">
          Exports are limited to 20,000 rows and a date range of up to 367 days.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium">
            Report
            <select
              value={type}
              onChange={(event) => setType(event.target.value as ReportType)}
              className="min-h-11 rounded-xl border border-cocoa/20 bg-white px-3"
            >
              {reportOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <span className="font-normal text-ink-muted">
              {reportOptions.find((option) => option.value === type)?.description}
            </span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid content-start gap-1 text-sm font-medium">
              From
              <input
                type="date"
                value={from}
                max={to}
                onChange={(event) => setFrom(event.target.value)}
                className="min-h-11 rounded-xl border border-cocoa/20 bg-white px-3"
              />
            </label>
            <label className="grid content-start gap-1 text-sm font-medium">
              To
              <input
                type="date"
                value={to}
                min={from}
                max={today}
                onChange={(event) => setTo(event.target.value)}
                className="min-h-11 rounded-xl border border-cocoa/20 bg-white px-3"
              />
            </label>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={downloadCsv} disabled={busy !== null || !from || !to}>
            {busy === "csv" ? "Preparing CSV…" : "Download CSV"}
          </Button>
          <Button variant="outline" onClick={downloadPdf} disabled={busy !== null || !from || !to}>
            {busy === "pdf" ? "Preparing PDF…" : "Download PDF"}
          </Button>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mt-4 text-sm text-ink-muted">{notice}</p>}
      </CardContent>
    </Card>
  );
}
