import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'api/**/*.test.ts'],
      exclude: ['e2e/**', 'dist/**', 'node_modules/**'],
    },
  })
);
