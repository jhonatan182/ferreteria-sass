import { Test } from '@nestjs/testing';

import { PrismaService } from '../prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('reporta db "up" cuando la consulta funciona', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { $queryRaw: () => Promise.resolve([{ 1: 1 }]) } },
      ],
    }).compile();

    const result = await moduleRef.get(HealthController).check();

    expect(result).toMatchObject({ status: 'ok', db: 'up' });
  });

  it('reporta db "down" y status "degraded" cuando la consulta falla', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: { $queryRaw: () => Promise.reject(new Error('sin conexion')) },
        },
      ],
    }).compile();

    const result = await moduleRef.get(HealthController).check();

    expect(result).toMatchObject({ status: 'degraded', db: 'down' });
  });
});
