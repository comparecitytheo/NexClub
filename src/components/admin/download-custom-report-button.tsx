"use client";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * PDF export for the CUSTOM report, separate from the club-wide one at the top
 * of the page.
 *
 * Uses the same mechanism as that export — window.print() with a print
 * stylesheet — rather than a second library. The difference is which document
 * prints: setting `data-print-target="custom"` on <html> switches the print CSS
 * to the custom results instead of the club-wide document.
 */
export function DownloadCustomReportButton({
  ready,
  metricCount,
}: {
  /** False until a run has produced results — there is nothing to export before then. */
  ready: boolean;
  metricCount: number;
}) {
  function download() {
    if (!ready) return;
    const root = document.documentElement;
    const previousTitle = document.title;

    root.setAttribute("data-print-target", "custom");
    document.title = `NEX Custom Report (${metricCount} metric${metricCount === 1 ? "" : "s"})`;

    const restore = () => {
      root.removeAttribute("data-print-target");
      document.title = previousTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
    // Safari does not always fire afterprint.
    setTimeout(restore, 3000);
  }

  return (
    <Button
      variant="outline"
      onClick={download}
      disabled={!ready}
      title={ready ? "Opens your print dialog — choose 'Save as PDF'" : "Run the report first"}
    >
      <Download className="h-4 w-4" /> Download PDF
    </Button>
  );
}
