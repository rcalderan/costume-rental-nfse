import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { PendingEvent, RetryStore } from 'open-nfse';

interface RetryRow {
  payload: Record<string, unknown>;
}

@Injectable()
export class PostgresRetryStoreService implements RetryStore {
  constructor(private readonly dataSource: DataSource) {}

  async save(entry: PendingEvent): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO nfse_retry_events (id, payload, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
      [entry.id, JSON.stringify(entry)],
    );
  }

  async list(): Promise<readonly PendingEvent[]> {
    const rows = await this.dataSource.query<RetryRow[]>(
      'SELECT payload FROM nfse_retry_events ORDER BY updated_at',
    );
    return rows.map(({ payload }) => this.hydrate(payload));
  }

  async delete(id: string): Promise<void> {
    await this.dataSource.query('DELETE FROM nfse_retry_events WHERE id = $1', [
      id,
    ]);
  }

  private hydrate(payload: Record<string, unknown>): PendingEvent {
    return {
      ...payload,
      firstAttemptAt: new Date(String(payload['firstAttemptAt'])),
      lastAttemptAt: new Date(String(payload['lastAttemptAt'])),
      notBefore: payload['notBefore']
        ? new Date(String(payload['notBefore']))
        : undefined,
    } as unknown as PendingEvent;
  }
}
