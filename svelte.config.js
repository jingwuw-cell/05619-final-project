// svelte.config.js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';


const dev = process.argv.includes('dev');
// 仓库名：如果你是 05619-final-project，就写下面这个
const base = dev ? '' : '/05619-final-project';

const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter(),
    paths: {
      base
    },
    alias: {
      $lib: 'src/lib'
    }
  }
};

export default config;
