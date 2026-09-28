import legacy from '@vitejs/plugin-legacy';
import { defineConfig, loadEnv } from 'vite';
import checker from 'vite-plugin-checker';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ←–– add these two lines so __dirname exists in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    root: 'src',
    publicDir: '../public',
    plugins: [
      legacy({ targets: ['defaults', 'not IE 11'] }),
      checker({ typescript: true }),
      nodePolyfills({
        protocolImports: true,
        globals: { Buffer: true, global: true, process: true },
      }),
    ],
    define: {
      'process.env': {},
      global: {},
      // expose only VITE_ vars
      ...Object.fromEntries(
        Object.entries(env)
          .filter(([k]) => k.startsWith('VITE_'))
          .map(([k, v]) => ([ `import.meta.env.${k}`, JSON.stringify(v) ]))
      ),
    },
    optimizeDeps: {
      esbuildOptions: { define: { global: 'globalThis' } },
      include: ['buffer', 'process'],
    },
    resolve: {
      alias: {
        '@':        resolve(__dirname, 'src'),
        '@core':    resolve(__dirname, 'src/core'),
        '@entities':resolve(__dirname, 'src/entities'),
        '@managers':resolve(__dirname, 'src/managers'),
        '@ui':      resolve(__dirname, 'src/ui'),
        '@utils':   resolve(__dirname, 'src/utils'),
        '@constants':resolve(__dirname, 'src/constants'),
        '@server':  resolve(__dirname, 'server'),
        buffer:     'buffer',
        process:    'process',
      },
    },
    build: {
      outDir: '../dist',
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'src/index.html'),
        },
      },
    },
    server: { 
      open: true,
      host: '0.0.0.0', // Allow external connections
      port: 5173,
      // src/ imports the shared rules from server/constants
      fs: { allow: [__dirname] },
      allowedHosts: ['*.azurecontainerapps.io',
        'ascend.drewclark.io',
        'ascend-avoid.livelyisland-db4ad2db.eastus.azurecontainerapps.io'],
    },
    preview: {
      host: '0.0.0.0',
      port: 5173
    },
  };
});
