"use client";
import { useRef, useState } from "react";
import { CONSENT_STATEMENT, CONSENT_STATEMENT_VERSION } from "@/lib/consent";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = { exportHref: string; importEndpoint: string };

export function CsvTools({ exportHref, importEndpoint }: Props) {
  const isLeadImport = importEndpoint.includes("/leads/");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    // Same consent confirmation the single-lead form requires — asked once for
    // the whole file, since an import discloses many people's details at once.
    if (isLeadImport && !window.confirm(CONSENT_STATEMENT)) {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const res = await fetch(importEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/csv",
          ...(isLeadImport ? { "x-consent-confirmed": CONSENT_STATEMENT_VERSION } : {}),
        },
        body: text,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Import failed.");
        return;
      }
      const skipped = data.skipped ? `, ${data.skipped} skipped` : "";
      toast.success(`Imported ${data.created} row${data.created === 1 ? "" : "s"}${skipped}.`);
      if (data.errors?.length) {
        console.warn("Import issues:", data.errors);
      }
      router.refresh();
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
        }}
      />
      <Button variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
        <Upload className="h-4 w-4" /> {busy ? "Importing…" : "Import"}
      </Button>
      <Button variant="outline" size="sm" asChild>
        <a href={exportHref}>
          <Download className="h-4 w-4" /> Export
        </a>
      </Button>
    </div>
  );
}
