import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { db, postAttachments } from "@sn/db";
import { env } from "../env.js";

const UPLOAD_ROOT = join(process.cwd(), env.UPLOAD_DIR);

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 МБ
const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15 МБ

export interface SavedFile {
  url: string; // публичный путь, напр. /uploads/<name>
}

async function saveBuffer(file: File, fallbackExt: string): Promise<SavedFile> {
  await mkdir(UPLOAD_ROOT, { recursive: true });
  const ext = extname(file.name) || fallbackExt;
  const name = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(join(UPLOAD_ROOT, name), buffer);
  return { url: `/${env.UPLOAD_DIR}/${name}` };
}

/** Сохраняет картинку на диск, возвращает публичный url. Бросает Error при невалидном файле. */
export async function saveImage(file: File): Promise<SavedFile> {
  if (!IMAGE_TYPES.has(file.type)) {
    throw new Error("Допустимы только изображения (jpeg, png, webp, gif)");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Файл больше 8 МБ");
  }
  return saveBuffer(file, `.${file.type.split("/")[1] ?? "bin"}`);
}

/** Сохраняет аудио (голосовое сообщение или музыкальный трек). */
export async function saveAudio(file: File, maxBytes = MAX_AUDIO_BYTES): Promise<SavedFile> {
  // некоторые браузеры дают тип "audio/webm;codecs=opus"
  const baseType = file.type.split(";")[0];
  if (!AUDIO_TYPES.has(baseType)) {
    throw new Error("Недопустимый формат аудио");
  }
  if (file.size > maxBytes) {
    throw new Error(`Аудио больше ${Math.round(maxBytes / 1024 / 1024)} МБ`);
  }
  return saveBuffer(file, baseType === "audio/mpeg" ? ".mp3" : ".webm");
}

/** Максимальный размер музыкального трека (30 МБ). */
export const MAX_TRACK_BYTES = 30 * 1024 * 1024;

/** Максимальный размер произвольного файла/видео (100 МБ). */
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export type AttachmentKind = "image" | "video" | "audio" | "voice" | "video_note" | "file";

export function kindFromMime(mime: string): AttachmentKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "file";
}

export interface SavedAttachment {
  url: string;
  kind: AttachmentKind;
  name: string;
  mime: string;
  size: number;
}

/** Сохраняет файл любого типа, возвращает метаданные вложения. */
export async function saveAnyFile(
  file: File,
  kindOverride?: AttachmentKind,
  maxBytes = MAX_FILE_BYTES,
): Promise<SavedAttachment> {
  if (file.size > maxBytes) {
    throw new Error(`Файл больше ${Math.round(maxBytes / 1024 / 1024)} МБ`);
  }
  const mime = file.type || "application/octet-stream";
  const fallbackExt = mime.includes("/") ? `.${mime.split("/")[1].split(";")[0]}` : ".bin";
  const { url } = await saveBuffer(file, fallbackExt);
  return {
    url,
    kind: kindOverride ?? kindFromMime(mime),
    name: file.name || "файл",
    mime,
    size: file.size,
  };
}

/** Сохраняет файлы поста параллельно и пишет их одним батчем. Пустые файлы пропускает. */
export async function savePostAttachments(postId: string, files: File[]): Promise<void> {
  const nonEmpty = files.filter((f) => f.size > 0);
  if (nonEmpty.length === 0) return;
  const saved = await Promise.all(nonEmpty.map((f) => saveAnyFile(f)));
  await db.insert(postAttachments).values(
    saved.map((s) => ({
      postId,
      url: s.url,
      kind: s.kind,
      name: s.name,
      mime: s.mime,
      size: s.size,
    })),
  );
}
