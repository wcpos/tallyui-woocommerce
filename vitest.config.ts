import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  esbuild: { jsx: 'automatic' },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      'react-native': 'react-native-web',
      // react-native-svg's native modules import Flow source; use its web entry, as TallyUI's own tests do.
      'react-native-svg': path.resolve(__dirname, 'apps/pos/node_modules/react-native-svg/src/elements.web.ts'),
      react: path.resolve(__dirname, 'apps/pos/node_modules/react'),
      'react-dom': path.resolve(__dirname, 'apps/pos/node_modules/react-dom'),
    },
  },
  test: {
    include: ['apps/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**'],
    passWithNoTests: false,
    // The shared agent host caps test workers at 2.
    maxWorkers: 2,
    environment: 'jsdom',
    server: { deps: { inline: [/@tallyui\//] } },
  },
});
