// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://docs.nemar.org',
	integrations: [
		starlight({
			title: 'NEMAR',
			description: 'Documentation for the NEMAR CLI and dataset platform.',
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/nemarOrg/nemar-cli' },
			],
			sidebar: [
				{
					label: 'Getting Started',
					items: [
						{ label: 'Installation', slug: 'getting-started/installation' },
						{ label: 'Quick Start', slug: 'getting-started/quickstart' },
						{ label: 'Authentication', slug: 'getting-started/authentication' },
					],
				},
				{
					label: 'Commands',
					items: [
						{ label: 'Overview', slug: 'commands' },
						{ label: 'auth', slug: 'commands/auth' },
						{ label: 'dataset', slug: 'commands/dataset' },
						{ label: 'sandbox', slug: 'commands/sandbox' },
					],
				},
				{
					label: 'Guides',
					items: [
						{ label: 'Uploading Datasets', slug: 'guides/uploading' },
						{ label: 'BIDS Validation', slug: 'guides/validation' },
						{ label: 'Downloading Data', slug: 'guides/downloading' },
						{ label: 'Versioning', slug: 'guides/versioning' },
						{ label: 'Publishing', slug: 'guides/publishing' },
					],
				},
				{
					label: 'Reference',
					items: [
						{ label: 'Configuration', slug: 'reference/configuration' },
						{ label: 'Environment Variables', slug: 'reference/environment' },
						{ label: 'API', slug: 'reference/api' },
						{ label: 'Data API', slug: 'reference/data-api' },
					],
				},
				{
					label: 'Development',
					items: [
						{ label: 'Setup', slug: 'development/setup' },
						{ label: 'Zenodo Testing', slug: 'development/zenodo-testing' },
					],
				},
				{
					label: 'Admin',
					badge: { text: 'gated', variant: 'caution' },
					items: [
						{ label: 'Admin Commands', slug: 'admin/commands' },
						{ label: 'GitHub App Setup', slug: 'admin/github-app-setup' },
						{ label: 'Operations', items: [{ autogenerate: { directory: 'admin/operations' } }] },
						{ label: 'Disaster Recovery', items: [{ autogenerate: { directory: 'admin/disaster-recovery' } }] },
					],
				},
			],
		}),
	],
});
