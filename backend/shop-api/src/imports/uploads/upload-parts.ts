import { IMPORT_PART_BYTES } from '@shop/contracts';
import { ValidationError } from '../../common/errors.js';
import type { ObjectPart } from '../storage/import-object-store.js';
export function verifyUploadParts(
  parts: ObjectPart[],
  size: number,
): ObjectPart[] {
  const sorted = [...parts].sort((a, b) => a.number - b.number);
  const count = Math.ceil(size / IMPORT_PART_BYTES);
  if (
    sorted.length !== count ||
    sorted.some(
      (part, index) =>
        part.number !== index + 1 ||
        part.size !==
          Math.min(IMPORT_PART_BYTES, size - index * IMPORT_PART_BYTES),
    )
  ) {
    throw new ValidationError(
      'Uploaded parts do not match the declared file size. Retry the upload.',
    );
  }
  return sorted;
}
