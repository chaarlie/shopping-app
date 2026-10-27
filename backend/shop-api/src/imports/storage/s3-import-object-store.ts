import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Readable } from 'node:stream';
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  HeadObjectCommand,
  GetObjectCommand,
  AbortMultipartUploadCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ImportObjectStore, type ObjectPart } from './import-object-store.js';
import { importStorageSchema } from './storage-config.js';
@Injectable()
export class S3ImportObjectStore
  extends ImportObjectStore
  implements OnModuleDestroy
{
  private readonly client: S3Client;
  private readonly signer: S3Client;
  private readonly bucket: string;
  constructor(config: ConfigService) {
    super();
    const settings = importStorageSchema.parse({
      endpoint: config.get('IMPORT_STORAGE_ENDPOINT'),
      publicEndpoint: config.get('IMPORT_STORAGE_PUBLIC_ENDPOINT'),
      region: config.get('IMPORT_STORAGE_REGION'),
      bucket: config.get('IMPORT_STORAGE_BUCKET'),
      accessKey: config.get('IMPORT_STORAGE_ACCESS_KEY'),
      secretKey: config.get('IMPORT_STORAGE_SECRET_KEY'),
    });
    const options = {
      region: settings.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: settings.accessKey,
        secretAccessKey: settings.secretKey,
      },
      requestChecksumCalculation: 'WHEN_REQUIRED' as const,
      responseChecksumValidation: 'WHEN_REQUIRED' as const,
      maxAttempts: 3,
    };
    this.bucket = settings.bucket;
    this.client = new S3Client({ ...options, endpoint: settings.endpoint });
    this.signer = new S3Client({
      ...options,
      endpoint: settings.publicEndpoint,
    });
  }
  onModuleDestroy() {
    this.client.destroy();
    this.signer.destroy();
  }
  async start(key: string) {
    const result = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: 'text/csv',
      }),
    );
    if (!result.UploadId) {
      throw new Error('Storage did not create an upload');
    }
    return result.UploadId;
  }
  signPart(key: string, uploadId: string, number: number) {
    return getSignedUrl(
      this.signer,
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: number,
      }),
      { expiresIn: 900 },
    );
  }
  async parts(key: string, uploadId: string) {
    const parts: ObjectPart[] = [];
    let marker: string | undefined;
    do {
      const page = await this.client.send(
        new ListPartsCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumberMarker: marker,
        }),
      );
      for (const part of page.Parts ?? []) {
        if (
          part.PartNumber === undefined ||
          !part.ETag ||
          part.Size === undefined
        ) {
          throw new Error('Storage returned an incomplete part');
        }
        parts.push({
          number: part.PartNumber,
          etag: part.ETag,
          size: part.Size,
        });
      }
      marker = page.IsTruncated ? page.NextPartNumberMarker : undefined;
    } while (marker);
    return parts;
  }
  async complete(key: string, uploadId: string, parts: ObjectPart[]) {
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((part) => ({
            PartNumber: part.number,
            ETag: part.etag,
          })),
        },
      }),
    );
  }
  async size(key: string) {
    try {
      return (
        (
          await this.client.send(
            new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
          )
        ).ContentLength ?? null
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'NotFound') {
        return null;
      }
      throw error;
    }
  }
  async read(key: string) {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!(result.Body instanceof Readable)) {
      throw new Error('Storage did not return a readable file');
    }
    return result.Body;
  }
  download(key: string, filename: string) {
    return getSignedUrl(
      this.signer,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      }),
      { expiresIn: 300 },
    );
  }
  async abort(key: string, uploadId: string) {
    try {
      await this.client.send(
        new AbortMultipartUploadCommand({
          Bucket: this.bucket,
          Key: key,
          UploadId: uploadId,
        }),
      );
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'NoSuchUpload') {
        throw error;
      }
    }
  }
  async remove(key: string) {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
