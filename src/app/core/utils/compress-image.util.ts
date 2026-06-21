export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  /** Целевой размер data URL в байтах (примерно). */
  maxBytes?: number;
  mimeType?: 'image/jpeg' | 'image/webp';
  initialQuality?: number;
}

const DEFAULT_WORK_OPTIONS: Required<CompressImageOptions> = {
  maxWidth: 1280,
  maxHeight: 1280,
  maxBytes: 200_000,
  mimeType: 'image/jpeg',
  initialQuality: 0.82,
};

const AVATAR_OPTIONS: Required<CompressImageOptions> = {
  maxWidth: 512,
  maxHeight: 512,
  maxBytes: 80_000,
  mimeType: 'image/jpeg',
  initialQuality: 0.8,
};

function fitDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function estimateDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.ceil((base64.length * 3) / 4);
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image load failed'));
    };
    image.src = url;
  });
}

function canvasToDataUrl(
  image: HTMLImageElement,
  width: number,
  height: number,
  mimeType: 'image/jpeg' | 'image/webp',
  quality: number,
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas is not supported');
  }
  ctx.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL(mimeType, quality);
}

/** Сжимает фото работы до data URL для localStorage. */
export async function compressWorkImageFile(file: File): Promise<string> {
  return compressImageFile(file, DEFAULT_WORK_OPTIONS);
}

/** Сжимает аватар профиля. */
export async function compressAvatarImageFile(file: File): Promise<string> {
  return compressImageFile(file, AVATAR_OPTIONS);
}

export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {},
): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Not an image file');
  }

  const opts = { ...DEFAULT_WORK_OPTIONS, ...options };
  const image = await loadImageFromFile(file);

  let { width, height } = fitDimensions(image.width, image.height, opts.maxWidth, opts.maxHeight);
  let quality = opts.initialQuality;
  let dataUrl = canvasToDataUrl(image, width, height, opts.mimeType, quality);

  while (estimateDataUrlBytes(dataUrl) > opts.maxBytes && quality > 0.42) {
    quality -= 0.08;
    dataUrl = canvasToDataUrl(image, width, height, opts.mimeType, quality);
  }

  while (estimateDataUrlBytes(dataUrl) > opts.maxBytes && width > 320) {
    width = Math.round(width * 0.85);
    height = Math.round(height * 0.85);
    quality = opts.initialQuality;
    dataUrl = canvasToDataUrl(image, width, height, opts.mimeType, quality);
    while (estimateDataUrlBytes(dataUrl) > opts.maxBytes && quality > 0.42) {
      quality -= 0.08;
      dataUrl = canvasToDataUrl(image, width, height, opts.mimeType, quality);
    }
  }

  return dataUrl;
}
