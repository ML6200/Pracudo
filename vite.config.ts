import { defineConfig } from 'vite';

export default defineConfig({
  base: '/pracudo/',
  server: { port: parseInt(process.env.PORT || '3000') },
});
