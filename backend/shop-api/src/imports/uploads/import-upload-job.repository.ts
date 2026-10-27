import { Injectable } from '@nestjs/common';
import { Transactional, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import type { UploadRecord } from './upload.repository.js';
@Injectable()
export class ImportUploadJobRepository {
  constructor(
    private readonly host: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}
  async claim(token: string): Promise<UploadRecord | undefined> {
    const rows: UploadRecord[] = await this.host.tx.query(
      `WITH due AS (SELECT id FROM import_uploads WHERE (state='queued' OR (state='processing' AND lease_until<now())) AND attempts<3 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1), claimed AS (UPDATE import_uploads u SET state='processing',lease_token=$1,lease_until=now()+interval '10 minutes',attempts=attempts+1 FROM due WHERE u.id=due.id RETURNING u.*) SELECT * FROM claimed`,
      [token],
    );
    return rows[0];
  }
  async lock(id: string, token: string): Promise<UploadRecord | undefined> {
    const rows: UploadRecord[] = await this.host.tx.query(
      "SELECT * FROM import_uploads WHERE id=$1 AND state='processing' AND lease_token=$2 FOR UPDATE",
      [id, token],
    );
    return rows[0];
  }
  async finish(id: string, token: string, importId: number) {
    await this.host.tx.query(
      "UPDATE import_uploads SET state='ready',import_id=$3,error=NULL,lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2",
      [id, token, importId],
    );
  }
  async fail(id: string, token: string, permanent: boolean, error: string) {
    await this.host.tx.query(
      "UPDATE import_uploads SET state=CASE WHEN $3 OR attempts>=3 THEN 'failed' ELSE 'queued' END,error=$4,lease_token=NULL,lease_until=NULL WHERE id=$1 AND state='processing' AND lease_token=$2",
      [id, token, permanent, error],
    );
  }
  @Transactional()
  async cleanupCandidates(): Promise<UploadRecord[]> {
    await this.host.tx.query(
      "UPDATE import_uploads SET state='failed',error='Processing stopped repeatedly. Upload the file again.',lease_token=NULL,lease_until=NULL WHERE state='processing' AND lease_until<now() AND attempts>=3",
    );
    await this.host.tx.query(
      "UPDATE import_uploads SET state='cancelled',lease_token=NULL,lease_until=NULL WHERE state IN ('starting','uploading','completing') AND expires_at<now()",
    );
    return this.host.tx.query(
      "SELECT * FROM import_uploads WHERE state IN ('cancelled','failed') AND cleaned_at IS NULL ORDER BY created_at LIMIT 10",
    );
  }
  async cleaned(id: string) {
    await this.host.tx.query(
      'UPDATE import_uploads SET cleaned_at=now() WHERE id=$1',
      [id],
    );
  }
}
