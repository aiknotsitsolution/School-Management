import { useCallback, useEffect, useRef, useState } from "react";
import { X, ZoomIn, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "../UI";
import ImageDropzone, { AVATAR_MAX_SIZE } from "./ImageDropzone";

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read this image"));
    img.src = src;
  });
}

function initialsOf(name = "") {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  return (words[0]?.[0] || "?").toUpperCase();
}

/**
 * Avatar editing modal: select an image, adjust zoom/position against a square
 * crop, preview, then Save or Cancel. Selecting or cancelling never uploads —
 * onSave(file) is only called when the user confirms.
 */
export default function AvatarEditor({
  open,
  title = "Profile avatar",
  currentSrc,
  name = "",
  onClose,
  onSave,
  maxSize = AVATAR_MAX_SIZE,
}) {
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [errorMsg, setErrorMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewport, setViewport] = useState(280);
  const boxRef = useRef(null);
  const dragRef = useRef(null);

  const resetAdjustments = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    if (!fileUrl) {
      setFileUrl(null);
      return undefined;
    }
    const img = new Image();
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = fileUrl;
    return () => img.onload = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fileUrl]);

  useEffect(() => {
    if (!open) return undefined;
    const el = boxRef.current;
    if (!el) return undefined;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width || 280;
      setViewport(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, file]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const coverScale = natural.w ? Math.max(viewport / natural.w, viewport / natural.h) : 1;
  const dispW = natural.w ? natural.w * coverScale * zoom : viewport;
  const dispH = natural.h ? natural.h * coverScale * zoom : viewport;
  const maxPanX = Math.max(0, (dispW - viewport) / 2);
  const maxPanY = Math.max(0, (dispH - viewport) / 2);
  const panX = clamp(pan.x, -maxPanX, maxPanX);
  const panY = clamp(pan.y, -maxPanY, maxPanY);

  const handlePointerDown = (e) => {
    if (!file) return;
    dragRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY, px: panX, py: panY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const handlePointerMove = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    setPan({
      x: drag.px + (e.clientX - drag.x),
      y: drag.py + (e.clientY - drag.y),
    });
  };
  const endDrag = () => {
    dragRef.current = null;
  };

  const pickFile = (next) => {
    setFile(next);
    setErrorMsg("");
    resetAdjustments();
    if (next) {
      const url = URL.createObjectURL(next);
      setFileUrl(url);
    } else {
      setFileUrl(null);
      setNatural({ w: 0, h: 0 });
    }
  };

  const handleSave = async () => {
    if (!file || !natural.w || busy) return;
    setBusy(true);
    setErrorMsg("");
    try {
      const el = boxRef.current;
      const V = el ? el.getBoundingClientRect().width : viewport;
      const fit = Math.max(V / natural.w, V / natural.h);
      const eff = fit * zoom;
      const left = (V - natural.w * eff) / 2 + panX;
      const top = (V - natural.h * eff) / 2 + panY;
      const sx = clamp(-left / eff, 0, natural.w);
      const sy = clamp(-top / eff, 0, natural.h);
      const sSize = Math.min(V / eff, natural.w - sx, natural.h - sy);

      const img = await loadImage(fileUrl);
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, 512, 512);

      const blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process image"))), "image/png"),
      );
      const safeBase = String(file.name).replace(/\.[^/.]+$/, "") || "avatar";
      const outFile = new File([blob], `${safeBase}.png`, { type: "image/png" });
      await onSave?.(outFile);
      onClose?.();
    } catch (err) {
      setErrorMsg(err.message || "Could not save the image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
        onClick={() => !busy && onClose?.()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={(node) => {
          if (node) node.focus?.();
        }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[92vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.06] sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-display font-semibold text-ink text-[17px]">{title}</h3>
            <p className="text-[12.5px] text-slate-text/70 mt-0.5">
              Adjust the image, then save your changes.
            </p>
          </div>
          <button
            onClick={() => !busy && onClose?.()}
            className="p-2 rounded-lg hover:bg-paper text-slate-text"
            aria-label="Close avatar editor"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div
            ref={boxRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="relative w-full max-w-[280px] mx-auto aspect-square rounded-xl overflow-hidden bg-paper border border-black/[0.08] select-none"
            style={{ touchAction: "none" }}
          >
            {file && natural.w ? (
              <img
                src={fileUrl}
                alt="New avatar preview"
                draggable={false}
                className="absolute left-1/2 top-1/2"
                style={{
                  width: dispW,
                  height: dispH,
                  maxWidth: "none",
                  transform: `translate(-50%,-50%) translate(${panX}px, ${panY}px)`,
                }}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                {currentSrc ? (
                  <img
                    src={currentSrc}
                    alt="Current avatar"
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-sm"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-amber/20 text-amber-dark flex items-center justify-center font-display text-4xl font-bold">
                    {initialsOf(name)}
                  </div>
                )}
                <p className="text-[12px] text-slate-text/60 mt-3">
                  {file ? "New image selected" : "Current preview"}
                </p>
              </div>
            )}
          </div>

          {file && (
            <div className="max-w-[280px] mx-auto space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="avatar-zoom" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                    <ZoomIn size={13} className="text-slate-text/50" /> Zoom
                  </label>
                  <button
                    type="button"
                    onClick={resetAdjustments}
                    className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-slate-text/60 hover:text-amber-dark"
                  >
                    <RefreshCw size={12} /> Reset
                  </button>
                </div>
                <input
                  id="avatar-zoom"
                  type="range"
                  min="1"
                  max="2.5"
                  step="0.05"
                  value={zoom}
                  disabled={busy}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full accent-[#E8A33D]"
                />
                <p className="text-[11px] text-slate-text/55 mt-1">
                  Drag the image to reposition. The final photo is cropped to a square.
                </p>
              </div>
            </div>
          )}

          <ImageDropzone
            value={file}
            onChange={pickFile}
            maxSize={maxSize}
            label="Photo"
            disabled={busy}
            helperText={file ? undefined : "JPG, JPEG, PNG, GIF, WEBP · Max 5 MB"}
          />

          {errorMsg && (
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-alert" role="alert">
              <AlertCircle size={13} aria-hidden="true" /> {errorMsg}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-black/[0.06] flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => onClose?.()} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="amber"
            onClick={handleSave}
            disabled={!file || !natural.w || busy}
          >
            {busy ? (
              <>
                <Loader2 size={15} className="animate-spin" /> Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}