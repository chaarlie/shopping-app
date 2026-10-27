import { Injectable } from '@nestjs/common';
import { TransactionHost, Transactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import {
  IMPORT_PART_BYTES,
  type ImportUpload,
  type StartImportUpload,
} from '@shop/contracts';
import { NotFoundError, ConflictError } from '../../common/errors.js';
export type UploadRecord = {
  id: string;
  admin_id: number;
  filename: string;
  size: string;
  object_key: string;
  multipart_id: string | null;
  state: string;
  expires_at: Date;
  import_id: number | null;
  error: string | null;
  lease_token: string | null;
};
export abstract class UploadRepository {
  abstract create(
    id: string,
    adminId: number,
    input: StartImportUpload,
  ): Promise<void>;
  abstract owned(id: string, adminId: number): Promise<UploadRecord>;
  abstract attach(id: string, multipartId: string): Promise<boolean>;
  abstract claimCompletion(id: string, token: string): Promise<boolean>;
  abstract queue(id: string, token: string): Promise<boolean>;
  abstract release(id: string, token: string): Promise<void>;
  abstract cancel(id: string): Promise<boolean>;
}
export function uploadView(row: UploadRecord): ImportUpload {
  return {
    id: row.id,
    filename: row.filename,
    size: Number(row.size),
    partSize: IMPORT_PART_BYTES,
    partCount: Math.ceil(Number(row.size) / IMPORT_PART_BYTES),
    state:
      row.state === 'starting' || row.state === 'completing'
        ? 'uploading'
        : (row.state as ImportUpload['state']),
    expiresAt: row.expires_at.toISOString(),
    importId: row.import_id,
    error: row.error,
  };
}
@Injectable()
export class TypeOrmUploadRepository extends UploadRepository {
  constructor(
    private readonly host: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {
    super();
  }
  @Transactional()
  async create(id: string, adminId: number, input: StartImportUpload) {
    await this.host.tx.query('SELECT pg_advisory_xact_lock(1793050000)');
    const [quota]: { own: string; bytes: string }[] = await this.host.tx.query(
      "SELECT count(*) FILTER(WHERE admin_id=$1) AS own,coalesce(sum(size),0) AS bytes FROM import_uploads WHERE state NOT IN ('cancelled','failed','ready') AND expires_at>now()",
      [adminId],
    );
    if (
      Number(quota.own) >= 2 ||
      Number(quota.bytes) + input.size > 100_000_000
    ) {
      throw new ConflictError(
        'Upload capacity is busy. Finish or cancel an existing upload first.',
      );
    }
    await this.host.tx.query(
      'INSERT INTO import_uploads(id,admin_id,filename,size,object_key) VALUES($1,$2,$3,$4,$5)',
      [id, adminId, input.filename, input.size, `imports/${adminId}/${id}.csv`],
    );
  }
  async owned(id: string, adminId: number): Promise<UploadRecord> {
    const rows: UploadRecord[] = await this.host.tx.query(
      'SELECT * FROM import_uploads WHERE id=$1 AND admin_id=$2',
      [id, adminId],
    );
    if (!rows[0]) {
      throw new NotFoundError('Upload not found');
    }
    return rows[0];
  }
  private async changed(sql: string, params: unknown[]) {
    const rows: { id: string }[] = await this.host.tx.query(
      `WITH changed AS (${sql}) SELECT id FROM changed`,
      params,
    );
    return rows.length === 1;
  }
  attach(id: string, multipartId: string) {
    return this.changed(
      "UPDATE import_uploads SET multipart_id=$2,state='uploading' WHERE id=$1 AND state='starting' RETURNING id",
      [id, multipartId],
    );
  }
  claimCompletion(id: string, token: string) {
    return this.changed(
      "UPDATE import_uploads SET state='completing',lease_token=$2,lease_until=now()+interval '5 minutes' WHERE id=$1 AND expires_at>now() AND (state='uploading' OR (state='completing' AND lease_until<now())) RETURNING id",
      [id, token],
    );
  }
  queue(id: string, token: string) {
    return this.changed(
      "UPDATE import_uploads SET state='queued',lease_token=NULL,lease_until=NULL WHERE id=$1 AND state='completing' AND lease_token=$2 RETURNING id",
      [id, token],
    );
  }
  async release(id: string, token: string) {
    await this.host.tx.query(
      "UPDATE import_uploads SET state='uploading',lease_token=NULL,lease_until=NULL WHERE id=$1 AND state='completing' AND lease_token=$2",
      [id, token],
    );
  }
  cancel(id: string) {
    return this.changed(
      "UPDATE import_uploads SET state='cancelled' WHERE id=$1 AND state IN ('starting','uploading','failed','cancelled') RETURNING id",
      [id],
    );
  }
}
export function assertUploadActive(row: UploadRecord) {
  if (
    row.state !== 'uploading' ||
    row.expires_at.getTime() <= Date.now() ||
    !row.multipart_id
  ) {
    throw new ConflictError('This upload is not active. Start a new upload.');
  }
}
