import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, searchForWorkspaceRoot } from 'vite';

export default defineConfig({
	envDir: '../../',
	server: {
		fs: {
			allow: [
				searchForWorkspaceRoot(process.cwd())
			]
		}
	},
	plugins: [
		tailwindcss(),
		sveltekit()
	]
});
