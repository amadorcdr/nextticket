import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

/**
 * Carpeta donde se guardan las imágenes de portada de los eventos. Vive
 * junto al proceso (no en el repo, ver .gitignore) — para producción real
 * esto se cambiaría por un bucket, pero no hay uno disponible aquí.
 */
export const EVENT_IMAGES_DIR = join(process.cwd(), 'uploads', 'events');

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export const EVENT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const eventImageMulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, callback) => {
      if (!existsSync(EVENT_IMAGES_DIR)) {
        mkdirSync(EVENT_IMAGES_DIR, { recursive: true });
      }
      callback(null, EVENT_IMAGES_DIR);
    },
    // Nombre generado, nunca el original: evita colisiones y path traversal
    // (el nombre que manda el cliente no se usa para nada más que la extensión).
    filename: (_req, file, callback) => {
      const ext = extname(file.originalname).toLowerCase();
      callback(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: {
    fileSize: EVENT_IMAGE_MAX_BYTES,
  },
  fileFilter: (
    _req: unknown,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      callback(
        new BadRequestException(
          'Solo se aceptan imágenes JPEG, PNG, WEBP o GIF',
        ),
        false,
      );
      return;
    }
    callback(null, true);
  },
};
