import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const proxyTarget = supabaseUrl || 'http://127.0.0.1:54321';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/functions/v1': {
          target: proxyTarget,
          changeOrigin: true,
          secure: proxyTarget.startsWith('https://'),
        },
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
