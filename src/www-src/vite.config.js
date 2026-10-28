import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Write .br and .gz next to every hashed asset. The server sends those
// as-is, so a small VPS never spends CPU compressing responses and browsers
// download roughly a third of the bytes.
function precompress() {
  return {
    name: 'precompress-assets',
    apply: 'build',
    writeBundle(options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (!fileName.startsWith('assets/') || !/\.(js|css|svg|json)$/.test(fileName)) continue;
        const file = path.join(options.dir, fileName);
        const data = fs.readFileSync(file);
        if (data.length < 1024) continue;
        fs.writeFileSync(`${file}.gz`, zlib.gzipSync(data, { level: 9 }));
        fs.writeFileSync(`${file}.br`, zlib.brotliCompressSync(data, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: data.length,
          },
        }));
      }
    },
  };
}

export default defineConfig({
  plugins: [vue(), precompress()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../www'),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router'],
          icons: ['@hugeicons/vue', '@hugeicons/core-free-icons'],
          ui: ['reka-ui'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:51821',
    },
  },
});
