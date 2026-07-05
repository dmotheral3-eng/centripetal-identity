import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The sandbox consumes the package straight from source so the component can be
// rendered without a build step. Real apps install it as a git dependency.
const pkgSrc = fileURLToPath(new URL('../src/index.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@centripetal/identity': pkgSrc },
  },
  server: {
    port: 5188,
    fs: { allow: ['..'] },
  },
});
