import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { DpsCounter, DpsCounterScope } from 'open-nfse';

interface CounterRow {
  nextNumber: string;
}

@Injectable()
export class PostgresDpsCounterService implements DpsCounter {
  constructor(private readonly dataSource: DataSource) {}

  async next(scope: DpsCounterScope): Promise<string> {
    const rows = await this.dataSource.query<CounterRow[]>(
      `INSERT INTO nfse_dps_counters (cnpj, series, last_number)
       VALUES ($1, $2, 1)
       ON CONFLICT (cnpj, series)
       DO UPDATE SET last_number = nfse_dps_counters.last_number + 1
       RETURNING last_number::text AS "nextNumber"`,
      [scope.emitenteCnpj, scope.serie],
    );
    const nextNumber = rows[0]?.nextNumber;
    if (!nextNumber) {
      throw new Error(
        `Contador DPS não retornou número para CNPJ '${scope.emitenteCnpj}' e série '${scope.serie}'`,
      );
    }
    return nextNumber;
  }
}
