import { ImagePlus } from "lucide-react";
import FileDropzone from "./FileDropzone";

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
export const AVATAR_MAX_SIZE = 5 * 1024 * 1024;

/**
 * Image-only dropzone: wraps FileDropzone with image constraints and hints.
 * Keeps the same controlled value/onChange contract.
 */
export default function ImageDropzone({
  value,
  onChange,
  maxSize = AVATAR_MAX_SIZE,
  label,
  helperText = "JPG, JPEG, PNG, GIF, WEBP · Max 5 MB",
  ...rest
}) {
  return (
    <FileDropzone
      label={label}
      value={value}
      onChange={onChange}
      accept={IMAGE_EXTENSIONS}
      mimeTypes={IMAGE_MIME_TYPES}
      maxSize={maxSize}
      helperText={helperText}
      emptyIcon={ImagePlus}
      {...rest}
    />
  );
}