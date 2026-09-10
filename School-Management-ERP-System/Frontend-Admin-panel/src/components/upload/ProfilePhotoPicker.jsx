import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Avatar } from "../UI";
import AvatarEditor from "./AvatarEditor";

const PHOTO_MAX_SIZE = 5 * 1024 * 1024;

/**
 * Standard profile-picture uploader used across the platform: a circular
 * dropzone with a Camera overlay, drag & drop support, and the AvatarEditor
 * crop modal. Selecting or cropping never uploads — onFileChange(file) is
 * only called when the user confirms the crop.
 */
export default function ProfilePhotoPicker({
  name = "",
  file = null,
  initialSrc = "",
  onFileChange,
  disabled = false,
  onError,
}) {
  const [preview, setPreview] = useState("");
  const [pendingFile, setPendingFile] = useState(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!file) {
      setPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const acceptFile = (picked) => {
    if (!picked) return;
    const isImage =
      (picked.type && picked.type.startsWith("image/")) ||
      /\.(jpe?g|png|gif|webp)$/i.test(picked.name || "");
    if (!isImage) {
      onError?.("Please choose a photo file (JPG, PNG, GIF, WEBP).");
      return;
    }
    if (picked.size > PHOTO_MAX_SIZE) {
      onError?.("Photo is too large — the maximum size is 5 MB.");
      return;
    }
    onError?.("");
    setPendingFile(picked);
    setAvatarOpen(true);
  };

  const handlePick = (e) => {
    acceptFile(e.target.files?.[0] || null);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer?.files?.[0] || null);
  };

  return (
    <>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={preview ? "Change profile photo" : "Upload profile photo"}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openPicker();
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`relative w-32 h-32 rounded-full overflow-hidden cursor-pointer select-none outline-none ring-2 ring-offset-2 transition-colors group ${
          dragging ? "ring-amber bg-amber/10" : "ring-black/[0.08] hover:ring-amber/60"
        } ${focused ? "ring-amber/60" : ""} ${
          disabled ? "opacity-60 cursor-not-allowed" : ""
        }`}
      >
        <Avatar src={preview || initialSrc || undefined} name={name || "Student"} size={128} />
        <div className="absolute inset-0 bg-ink/45 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-0.5 text-white">
          <Camera size={22} />
          <span className="text-[11px] font-semibold">
            {preview ? "Change photo" : "Upload photo"}
          </span>
        </div>
        {dragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-amber/85 text-ink text-[12.5px] font-bold">
            Drop here
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          className="sr-only"
          tabIndex={-1}
          onChange={handlePick}
        />
      </div>
      <p className="text-[11.5px] text-slate-text/55 text-center max-w-[260px]">
        {preview
          ? "Click the photo to crop or change it."
          : "Click or drag & drop a photo here — JPG, PNG, GIF, WEBP · Max 5 MB"}
      </p>
      <AvatarEditor
        open={avatarOpen}
        title="Profile avatar"
        initialFile={pendingFile}
        name={name}
        onClose={() => setAvatarOpen(false)}
        onSave={(cropped) => {
          setAvatarOpen(false);
          onFileChange?.(cropped);
        }}
      />
    </>
  );
}