import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            if (res && !res.headersSent && typeof res.writeHead === 'function') {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, message: 'Server warming up...' }));
            }
          });
        }
      },
    },
  },
  build: {
    // 512MB instance: keep build RAM low and split huge vendor chunks
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          mixpanel: ['mixpanel-browser'],
          pdf: ['jspdf', 'html2canvas'],
          icons: ['lucide-react'],
        },
      },
    },
    chunkSizeWarningLimit: 650,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'lucide-react'],
  },
});
