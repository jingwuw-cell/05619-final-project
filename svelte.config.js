// svelte.config.js
import adapter from '@sveltejs/adapter-static';

const dev = process.env.NODE_ENV === 'development';
const base = dev ? '' : '/05619final';

const config = {
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html'
    }),
    paths: {
      base
    }
  }
};

export default config;
