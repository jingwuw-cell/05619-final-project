// svelte.config.js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

const dev = process.argv.includes('dev');
const base = dev ? '' : '/05619-final-project';

const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter({
      fallback: 'index.html'
    }),
    paths: {
      base
    },
    alias: {
      $lib: 'src/lib'
    }
  }
};

export default config;
