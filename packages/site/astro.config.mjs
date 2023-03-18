import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import netlify from '@astrojs/netlify/functions'

// https://astro.build/config
export default defineConfig({
    outDir: '../../docs',
    output: 'static',
    integrations: [svelte()],
});
