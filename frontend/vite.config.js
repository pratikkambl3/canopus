import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, path.resolve(__dirname, '../../'), ''),
    ...loadEnv(mode, path.resolve(__dirname, '../'), ''),
    ...loadEnv(mode, process.cwd(), ''),
  }

  const supportEmail = env.SUPPORT_EMAIL || env.VITE_SUPPORT_EMAIL || env.SMTP_FROM_EMAIL || env.SMTP_USER || 'mr.canopus111@gmail.com';

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_SUPPORT_EMAIL': JSON.stringify(supportEmail),
    },
    server: {
      port: parseInt(env.FRONTEND_PORT || '3000', 10),
      open: true,
      // Proxy API calls to the backend in dev mode
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
          rewrite: (path) => path, // keep /api prefix
        },
        '/uploads': {
          target: env.VITE_API_URL || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },
  }
})
