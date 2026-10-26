import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Include the lazy picker in the initial dev optimization so its first click does not discover a new dependency.
  optimizeDeps: { include: ['emoji-picker-react'] },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
