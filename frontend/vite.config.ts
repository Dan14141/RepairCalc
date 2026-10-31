import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    allowedHosts: ['maliciously-charmed-gelding.cloudpub.ru'],
  },
});