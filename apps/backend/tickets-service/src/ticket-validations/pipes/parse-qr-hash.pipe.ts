import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

/** El QR guarda un hash SHA-256 en hexadecimal, no un UUID. */
export const QR_HASH_PATTERN = /^[a-fA-F0-9]{64}$/;

@Injectable()
export class ParseQrHashPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!QR_HASH_PATTERN.test(value ?? '')) {
      throw new BadRequestException(
        'Validation failed (SHA-256 hexadecimal hash is expected)',
      );
    }

    return value;
  }
}
