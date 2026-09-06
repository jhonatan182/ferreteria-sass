import { ConfigService } from '@nestjs/config';

import { PasswordService } from './password.service.js';

// Coste bajo en tests: bcrypt(12) es deliberadamente lento.
const config = new ConfigService({ BCRYPT_COST: 4 });
const service = new PasswordService(config);

describe('PasswordService', () => {
  it('hashea y verifica la misma contrasena', async () => {
    const hash = await service.hash('correcta-123');
    expect(hash).not.toContain('correcta-123');
    expect(await service.verify('correcta-123', hash)).toBe(true);
  });

  it('rechaza una contrasena incorrecta', async () => {
    const hash = await service.hash('correcta-123');
    expect(await service.verify('incorrecta', hash)).toBe(false);
  });

  it('devuelve false (sin lanzar) cuando el usuario no tiene hash', async () => {
    expect(await service.verify('lo-que-sea', null)).toBe(false);
    expect(await service.verify('lo-que-sea', undefined)).toBe(false);
  });
});
