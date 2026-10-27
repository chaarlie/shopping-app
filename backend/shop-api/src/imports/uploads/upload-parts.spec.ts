import { IMPORT_PART_BYTES } from '@shop/contracts';
import { verifyUploadParts } from './upload-parts.js';
it('requires exact part numbers and sizes, including the final byte', () => {
  const parts = [
    { number: 2, etag: 'b', size: 1 },
    { number: 1, etag: 'a', size: IMPORT_PART_BYTES },
  ];
  expect(
    verifyUploadParts(parts, IMPORT_PART_BYTES + 1).map((p) => p.number),
  ).toEqual([1, 2]);
  expect(() => verifyUploadParts(parts, IMPORT_PART_BYTES + 2)).toThrow(
    'declared file size',
  );
  expect(() => verifyUploadParts([parts[1]], IMPORT_PART_BYTES + 1)).toThrow();
  expect(() =>
    verifyUploadParts([parts[1], parts[1]], IMPORT_PART_BYTES + 1),
  ).toThrow();
});
