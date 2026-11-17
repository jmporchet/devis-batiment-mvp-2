import { MAX_PHOTO_SIDE, scaledDimensions } from "./capture-utils";

const JPEG_QUALITY = 0.85;

/**
 * Réduit une photo avant l'envoi : côté long ≤ 2000 px, JPEG qualité 0,85,
 * orientation EXIF appliquée. Si le navigateur ne sait pas la décoder
 * (HEIC sur Chrome, par exemple), le fichier d'origine est renvoyé tel quel.
 */
export async function resizePhoto(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      const { width, height } = scaledDimensions(bitmap.width, bitmap.height, MAX_PHOTO_SIDE);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
      );
      if (!blob || blob.size === 0) return file;
      const name = file.name.replace(/\.[^.]+$/, "") || "photo";
      return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
