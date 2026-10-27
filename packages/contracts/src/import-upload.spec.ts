import { describe, expect, it } from "vitest";
import {
  IMPORT_PART_BYTES,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_PARTS,
  startImportUploadSchema,
  uploadPartNumberSchema,
} from "./import-upload.js";
describe("large import upload contract", () => {
  it("accepts exactly ten decimal megabytes and rejects the next byte", () => {
    expect(
      startImportUploadSchema.parse({
        filename: "products.csv",
        size: MAX_IMPORT_BYTES,
      }).size,
    ).toBe(10_000_000);
    expect(
      startImportUploadSchema.safeParse({
        filename: "products.csv",
        size: MAX_IMPORT_BYTES + 1,
      }).success,
    ).toBe(false);
  });
  it("rejects empty files and untrusted object keys", () => {
    expect(
      startImportUploadSchema.safeParse({ filename: "products.csv", size: 0 })
        .success,
    ).toBe(false);
    expect(
      startImportUploadSchema.safeParse({
        filename: "products.csv",
        size: 10,
        key: "other-admin/file",
      }).success,
    ).toBe(false);
  });
  it("bounds multipart numbers for the fixed chunk size", () => {
    expect(MAX_IMPORT_PARTS * IMPORT_PART_BYTES).toBeGreaterThanOrEqual(
      MAX_IMPORT_BYTES,
    );
    expect(uploadPartNumberSchema.safeParse(MAX_IMPORT_PARTS + 1).success).toBe(
      false,
    );
    expect(uploadPartNumberSchema.safeParse(0).success).toBe(false);
  });
});
