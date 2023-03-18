import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';

// https://astro.build/config
export default defineConfig({
    outDir: '../../docs',
    output: 'static',
    integrations: [svelte()],
});
