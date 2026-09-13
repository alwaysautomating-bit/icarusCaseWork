"use client";

export function PrintReportButton() {
  return <button className="children-report-print" type="button" onClick={() => window.print()}>Print / save PDF</button>;
}
