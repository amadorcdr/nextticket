import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ParseQrHashPipe } from './pipes/parse-qr-hash.pipe';
import { CreateValidationDto } from './dto/create-validation.dto';
import { CreateTicketDto } from '../tickets/dto/create-ticket.dto';

// Misma configuración que main.ts, para probar el contrato real de entrada.
const pipe = new ValidationPipe({ whitelist: true, transform: true });

const QR_HASH =
  'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9';
const EVENT_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('CreateValidationDto', () => {
  const meta = { type: 'body' as const, metatype: CreateValidationDto };

  it('accepts a 64 char SHA-256 hexadecimal hash', async () => {
    await expect(
      pipe.transform({ eventId: EVENT_ID, qrHash: QR_HASH }, meta),
    ).resolves.toEqual(expect.objectContaining({ qrHash: QR_HASH }));
  });

  it('accepts a folio when qrHash is not provided', async () => {
    await expect(
      pipe.transform({ eventId: EVENT_ID, folio: 'TK-A1B2C3D4E5' }, meta),
    ).resolves.toEqual(expect.objectContaining({ folio: 'TK-A1B2C3D4E5' }));
  });

  it('rejects a hash with the wrong length', async () => {
    await expect(
      pipe.transform({ eventId: EVENT_ID, qrHash: 'abc123' }, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a hash with non hexadecimal characters', async () => {
    await expect(
      pipe.transform({ eventId: EVENT_ID, qrHash: 'z'.repeat(64) }, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when neither qrHash nor folio is provided', async () => {
    await expect(
      pipe.transform({ eventId: EVENT_ID }, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when eventId is missing', async () => {
    await expect(
      pipe.transform({ qrHash: QR_HASH }, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when eventId is not a UUID', async () => {
    await expect(
      pipe.transform({ eventId: 'not-a-uuid', qrHash: QR_HASH }, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('strips unknown fields so validatorId cannot be spoofed from the body', async () => {
    const result = await pipe.transform(
      { eventId: EVENT_ID, qrHash: QR_HASH, validatorId: 'attacker-id' },
      meta,
    );

    expect(result).not.toHaveProperty('validatorId');
  });
});

describe('CreateTicketDto', () => {
  const meta = { type: 'body' as const, metatype: CreateTicketDto };

  it('rejects a non UUID v4 eventZoneId', async () => {
    await expect(
      pipe.transform({ eventZoneId: 'not-a-uuid' }, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('PaginationQueryDto', () => {
  const meta = { type: 'query' as const, metatype: PaginationQueryDto };

  it('applies the default page and limit when the query is empty', async () => {
    await expect(pipe.transform({}, meta)).resolves.toEqual(
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it('converts the query strings into numbers', async () => {
    const result = await pipe.transform({ page: '3', limit: '50' }, meta);

    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it('rejects a limit above the maximum', async () => {
    await expect(
      pipe.transform({ limit: '500' }, meta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a page below 1', async () => {
    await expect(pipe.transform({ page: '0' }, meta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('ParseQrHashPipe', () => {
  const qrHashPipe = new ParseQrHashPipe();

  it('lets a valid SHA-256 hash through', () => {
    expect(qrHashPipe.transform(QR_HASH)).toBe(QR_HASH);
  });

  it('rejects anything that is not a SHA-256 hash', () => {
    expect(() => qrHashPipe.transform('abc')).toThrow(BadRequestException);
  });
});
