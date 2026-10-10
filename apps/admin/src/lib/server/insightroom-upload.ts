import fs from 'node:fs';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '$env/dynamic/private';

export type ResolvedUpload = {
  buffer: Buffer;
  fileType: string;
  originalName: string;
  source: string;
};

function guessMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.avif') return 'image/avif';
  if (ext === '.png') return 'image/png';
  return 'image/png';
}

function isHttpUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

function normalizeFileCandidate(candidate: unknown): { path?: string; name?: string; mimeType?: string; source: string } | null {
  if (!candidate) return null;
  if (typeof candidate === 'string') {
    return { path: candidate, source: 'string' };
  }
  if (typeof candidate !== 'object' || candidate === null) {
    return null;
  }
  const obj = candidate as Record<string, any>;
  const filePath = typeof obj.filePath === 'string'
    ? obj.filePath
    : typeof obj.path === 'string'
      ? obj.path
      : typeof obj.localPath === 'string'
        ? obj.localPath
        : typeof obj.url === 'string'
          ? obj.url
          : typeof obj.uri === 'string'
            ? obj.uri
            : undefined;

  const name = typeof obj.filename === 'string'
    ? obj.filename
    : typeof obj.name === 'string'
      ? obj.name
      : undefined;

  const mimeType = typeof obj.mimeType === 'string'
    ? obj.mimeType
    : typeof obj.type === 'string'
      ? obj.type
      : undefined;

  if (!filePath) return null;
  return { path: filePath, name, mimeType, source: 'object' };
}

async function loadFromUrl(
  value: string,
  fetchImpl: typeof fetch,
  preferredName?: string,
  preferredMimeType?: string
): Promise<ResolvedUpload> {
  const imgRes = await fetchImpl(value);
  if (!imgRes.ok) {
    throw new Error(`Failed to fetch image URL: Status ${imgRes.status}`);
  }
  const arrayBuffer = await imgRes.arrayBuffer();
  const urlPath = new URL(value).pathname;
  const derivedName = preferredName || path.basename(urlPath) || 'upload.png';

  return {
    buffer: Buffer.from(arrayBuffer),
    fileType: preferredMimeType || imgRes.headers.get('Content-Type') || guessMimeType(derivedName),
    originalName: derivedName,
    source: 'url'
  };
}

function loadFromLocalPath(filePath: string, preferredName?: string, preferredMimeType?: string): ResolvedUpload {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Local file not found at path: ${filePath}`);
  }
  const originalName = preferredName || path.basename(resolvedPath);
  return {
    buffer: fs.readFileSync(resolvedPath),
    fileType: preferredMimeType || guessMimeType(originalName),
    originalName,
    source: 'local-path'
  };
}

async function loadFromImageField(image: string, fetchImpl: typeof fetch, preferredName?: string): Promise<ResolvedUpload> {
  if (image.startsWith('data:')) {
    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Invalid base64 image data URI format');
    return {
      buffer: Buffer.from(match[2], 'base64'),
      fileType: match[1],
      originalName: preferredName || 'upload',
      source: 'data-uri'
    };
  }
  if (isHttpUrl(image)) {
    return loadFromUrl(image, fetchImpl, preferredName, undefined);
  }
  return {
    buffer: Buffer.from(image, 'base64'),
    fileType: guessMimeType(preferredName || 'upload.png'),
    originalName: preferredName || 'upload',
    source: 'base64'
  };
}

export async function resolveUploadInput(input: Record<string, any>, fetchImpl: typeof fetch): Promise<ResolvedUpload> {
  const preferredName = typeof input.filename === 'string' ? input.filename : undefined;
  const fileCandidate =
    normalizeFileCandidate(input.file) ||
    normalizeFileCandidate(input.image_file) ||
    normalizeFileCandidate(input.uploadedFile) ||
    normalizeFileCandidate(input.filePath) ||
    normalizeFileCandidate(input.local_path);

  if (fileCandidate?.path) {
    if (isHttpUrl(fileCandidate.path)) {
      return loadFromUrl(fileCandidate.path, fetchImpl, preferredName || fileCandidate.name, fileCandidate.mimeType);
    }
    if (
      fileCandidate.path.startsWith('data:') ||
      (fileCandidate.source === 'string' &&
        fileCandidate.path.length > 64 &&
        /^[A-Za-z0-9+/=\s]+$/.test(fileCandidate.path.trim()))
    ) {
      return loadFromImageField(fileCandidate.path, fetchImpl, preferredName || fileCandidate.name);
    }
    return loadFromLocalPath(fileCandidate.path, preferredName || fileCandidate.name, fileCandidate.mimeType);
  }

  if (typeof input.image === 'string' && input.image.trim()) {
    return loadFromImageField(input.image, fetchImpl, preferredName);
  }

  throw new Error('Either image, local_path, filePath, file, image_file, or uploadedFile is required');
}

export function initCloudinary() {
  const cloud_name = env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME || 'dvsdsl7iw';
  const api_key = env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY || '412819653886923';
  const api_secret = env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET || 'LPARAweIryTEMsJ_tmv4-RtkFGs';

  cloudinary.config({
    cloud_name,
    api_key,
    api_secret,
    secure: true
  });
  return cloudinary;
}

export async function uploadBufferToCloudinary(buffer: Buffer, filename: string): Promise<string> {
  initCloudinary();
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'insightroom/writer',
        public_id: path.parse(filename).name + '-' + Date.now(),
        resource_type: 'image'
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error('Upload failed'));
        } else {
          resolve(result.secure_url || result.url);
        }
      }
    );
    uploadStream.end(buffer);
  });
}
