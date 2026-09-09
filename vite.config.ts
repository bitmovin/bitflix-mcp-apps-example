import react from '@vitejs/plugin-react';
import path from 'node:path';
import { skybridge } from 'skybridge/vite';
import { defineConfig, type PluginOption } from 'vite';

export default defineConfig({
  plugins: [skybridge() as PluginOption, react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
