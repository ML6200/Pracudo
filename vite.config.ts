import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Pracudo/',
  server: { port: parseInt(process.env.PORT || '3000') },
});
