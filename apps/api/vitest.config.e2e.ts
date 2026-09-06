import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Se aplican antes de cargar los modulos: el coste bcrypt y el limite de
    // login se leen en tiempo de import (decorador @Throttle, constructor de
    // PasswordService). Ver apps/api/test/auth.e2e-spec.ts.
    env: {
      NODE_ENV: 'test',
      BCRYPT_COST: '4',
      AUTH_LOGIN_RATE_LIMIT: '100000',
    },
  },
});
