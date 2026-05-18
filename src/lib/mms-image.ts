"use client";

const MMS_MAX_BYTES = 500 * 1024;
const MAX_DIMENSION = 1280;
const JPEG_QUALITIES = [0.82, 0.72, 0.62, 0.52, 0.44, 0.36];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not compress image.")), "image/jpeg", quality);
  });
}

export async function prepareMmsImage(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/gif"].includes(file.type)) {
    throw new Error("Photos must be JPG, PNG, or GIF.");
  }
  if (file.type === "image/gif") {
    if (file.size > MMS_MAX_BYTES) throw new Error("GIFs must be 500 KB or smaller for MMS.");
    return file;
  }
  if (file.size <= MMS_MAX_BYTES) return file;

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  let width = Math.max(1, Math.round(image.naturalWidth * scale));
  let height = Math.max(1, Math.round(image.naturalHeight * scale));
  let best: Blob | null = null;

  for (let pass = 0; pass < 3; pass += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not compress image.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    for (const quality of JPEG_QUALITIES) {
      const blob = await canvasToBlob(canvas, quality);
      best = blob;
      if (blob.size <= MMS_MAX_BYTES) {
        const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
        return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
      }
    }
    width = Math.max(1, Math.round(width * 0.75));
    height = Math.max(1, Math.round(height * 0.75));
  }

  if (best) throw new Error("That photo is still too large after compression. Try a smaller crop or screenshot.");
  throw new Error("Could not compress image.");
}

