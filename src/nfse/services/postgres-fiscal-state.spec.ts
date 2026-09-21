import { DataSource } from 'typeorm';
import type { PendingEmission } from 'open-nfse';
import { PostgresDpsCounterService } from './postgres-dps-counter.service';
import { PostgresRetryStoreService } from './postgres-retry-store.service';

class FakeDataSource {
  readonly query = jest.fn();
}

describe('PostgresDpsCounterService', () => {
  it('incrementa o contador de forma atômica e retorna o próximo número', async () => {
    const dataSource = new FakeDataSource();
    dataSource.query.mockResolvedValue([{ nextNumber: '42' }]);
    const service = new PostgresDpsCounterService(
      dataSource as unknown as DataSource,
    );

    const number = await service.next({
      emitenteCnpj: '08299621000120',
      serie: '1',
    });

    expect(number).toBe('42');
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (cnpj, series)'),
      ['08299621000120', '1'],
    );
  });
});

describe('PostgresRetryStoreService', () => {
  it('salva e reidrata datas de uma emissão pendente', async () => {
    const dataSource = new FakeDataSource();
    const pending = {
      id: 'emission:DPS1',
      kind: 'emission',
      idDps: 'DPS1',
      emitenteCnpj: '08299621000120',
      serie: '1',
      nDPS: '1',
      xmlAssinado: '<DPS/>',
      firstAttemptAt: new Date('2026-09-13T15:00:00Z'),
      lastAttemptAt: new Date('2026-09-13T15:01:00Z'),
      lastError: {
        message: 'timeout',
        errorName: 'TimeoutError',
        transient: true,
      },
    } satisfies PendingEmission;
    const service = new PostgresRetryStoreService(
      dataSource as unknown as DataSource,
    );

    await service.save(pending);
    dataSource.query.mockResolvedValueOnce([
      {
        payload: JSON.parse(JSON.stringify(pending)) as Record<string, unknown>,
      },
    ]);
    const restored = await service.list();

    expect(restored[0]?.firstAttemptAt).toBeInstanceOf(Date);
    expect(restored[0]?.lastAttemptAt).toEqual(pending.lastAttemptAt);
    expect(dataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (id)'),
      [pending.id, JSON.stringify(pending)],
    );
  });
});
