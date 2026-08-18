"use client";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Download PDF" for the reporting page.
 *
 * Uses the browser's own print-to-PDF rather than a PDF library. That is a
 * deliberate choice: the export is guaranteed to match what the page produced,
 * because it renders from the same data, and it adds no dependency.
 *
 * The saved FILE NAME comes from document.title — every browser derives the
 * default PDF name from it. So the title is swapped for the report name just
 * long enough to print, then put back, otherwise the browser tab would be left
 * reading "NEX Report ..." for the rest of the session.
 */
export function DownloadReportButton({ from, to }: { from: string; to: string }) {
  function download() {
    const previous = document.title;
    // Slashes are path separators and are stripped or rejected in filenames, so
    // the date parts are joined with dots and the range with a hyphen.
    document.title = `NEX Report ${from} - ${to}`;
    // Restore on the way back, whichever way the dialog was dismissed.
    const restore = () => {
      document.title = previous;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
    // Safari does not always fire afterprint; this is the backstop.
    setTimeout(restore, 3000);
  }

  return (
    <Button
      onClick={download}
      title="Opens your print dialog — choose 'Save as PDF' as the destination"
    >
      <Download className="h-4 w-4" /> Download PDF
    </Button>
  );
}
