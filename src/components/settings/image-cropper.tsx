"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Crop an image before upload.
 *
 * Avatars are shown in circles and logos in a wide box, so an uncropped photo
 * gets squashed or arbitrarily centre-cut. This lets the member choose what is
 * inside the frame, then exports exactly that region at a fixed size — so what
 * they see here is what appears everywhere in the CRM.
 *
 * No cropping library: a canvas plus drag-and-zoom is all this needs, and it
 * keeps the bundle free of another dependency.
 */
export function ImageCropper({
  file,
  aspect,
  outputWidth,
  shape = "circle",
  fit = "cover",
  onCancel,
  onCropped,
}: {
  file: File;
  /** width / height of the crop frame. 1 for avatars, ~3 for a logo. */
  aspect: number;
  /** Exported width in pixels; height follows the aspect. */
  outputWidth: number;
  shape?: "circle" | "rect";
  /**
   * "cover" fills the frame and crops the overflow — right for avatars, where a
   * gap inside the circle would look broken. "contain" fits the whole image with
   * padding — right for a logo, which is displayed with object-contain and must
   * not lose its edges just because it is wide.
   */
  fit?: "cover" | "contain";
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // Frame size on screen. The exported image is outputWidth regardless, so the
  // preview size is purely a display choice.
  const frameW = 320;
  const frameH = Math.round(frameW / aspect);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // The starting scale. Cover fills the frame (cropping the overflow); contain
  // fits the whole image inside it. This is also the floor for zoom, so an
  // avatar can never show a gap, while a wide logo can still be seen whole.
  const baseScale = img
    ? fit === "contain"
      ? Math.min(frameW / img.width, frameH / img.height)
      : Math.max(frameW / img.width, frameH / img.height)
    : 1;
  const scale = baseScale * zoom;

  const clamp = useCallback(
    (next: { x: number; y: number }) => {
      if (!img) return next;
      const w = img.width * scale;
      const h = img.height * scale;
      const maxX = Math.max(0, (w - frameW) / 2);
      const maxY = Math.max(0, (h - frameH) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      };
    },
    [img, scale, frameW, frameH]
  );

  useEffect(() => {
    setOffset((o) => clamp(o));
  }, [clamp]);

  function onPointerDown(e: React.PointerEvent) {
    drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setOffset(clamp({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }));
  }
  function onPointerUp() {
    drag.current = null;
  }

  async function apply() {
    if (!img) return;
    setBusy(true);
    const outW = outputWidth;
    const outH = Math.round(outputWidth / aspect);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setBusy(false);
      return;
    }
    // White behind the image: JPEG has no alpha, and a transparent PNG would
    // otherwise export as black.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, outW, outH);

    // Map the on-screen frame onto the export canvas.
    const ratio = outW / frameW;
    const drawW = img.width * scale * ratio;
    const drawH = img.height * scale * ratio;
    const dx = (outW - drawW) / 2 + offset.x * ratio;
    const dy = (outH - drawH) / 2 + offset.y * ratio;
    ctx.drawImage(img, dx, dy, drawW, drawH);

    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (blob) onCropped(blob);
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-card p-5 shadow-2xl">
        <h3 className="text-base font-semibold">Position your image</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Drag to move, and zoom to fill the frame.
        </p>

        <div
          className="relative mx-auto mt-4 cursor-grab touch-none overflow-hidden bg-muted active:cursor-grabbing"
          style={{
            width: frameW,
            height: frameH,
            borderRadius: shape === "circle" ? "9999px" : "0.75rem",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {img && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={img.src}
              alt=""
              draggable={false}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: img.width * scale,
                height: img.height * scale,
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                maxWidth: "none",
              }}
            />
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <ZoomOut className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            aria-label="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
            className="min-w-0 flex-1"
          />
          <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!img || busy}>
            {busy ? "Saving…" : "Save image"}
          </Button>
        </div>
      </div>
    </div>
  );
}
