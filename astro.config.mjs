// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';
import mermaid from 'astro-mermaid';

// https://astro.build/config
export default defineConfig({
	site: 'https://docs.nemar.org',
	integrations: [
		mermaid({ theme: 'default', autoTheme: true }),
		starlight({
			title: 'NEMAR',
			description: 'Documentation for the NEMAR ecosystem: the CLI, the platform APIs, and the data plane.',
			logo: {
				light: './src/assets/nemar-logo-light.svg',
				dark: './src/assets/nemar-logo-dark.svg',
				alt: 'NEMAR',
				replacesTitle: true,
			},
			favicon: '/favicon.svg',
			customCss: ['./src/styles/custom.css'],
			components: {
				Footer: './src/components/Footer.astro',
			},
			plugins: [
				starlightLinksValidator({
					// In-page anchors in the migrated content are not yet audited; focus
					// the gate on whether links resolve to real pages. Resolving relative
					// links are allowed (the admin runbooks cross-link relatively).
					errorOnInvalidHashes: false,
					errorOnRelativeLinks: false,
				}),
			],
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/nemarOrg' },
			],
			sidebar: [
				{
					label: 'The Ecosystem',
					items: [
						{ label: 'Overview', link: '/ecosystem/' },
						{ label: 'CLI vs the web', slug: 'ecosystem/cli-vs-web' },
					],
				},
				{
					label: 'CLI',
					items: [
						{ label: 'Overview', link: '/cli/' },
						{
							label: 'Getting Started',
							items: [
								{ label: 'Installation', slug: 'cli/getting-started/installation' },
								{ label: 'Quick Start', slug: 'cli/getting-started/quickstart' },
								{ label: 'Authentication', slug: 'cli/getting-started/authentication' },
							],
						},
						{
							label: 'Guides',
							items: [
								{ label: 'Uploading Datasets', slug: 'cli/guides/uploading' },
								{ label: 'BIDS Validation', slug: 'cli/guides/validation' },
								{ label: 'Downloading Data', slug: 'cli/guides/downloading' },
								{ label: 'Versioning', slug: 'cli/guides/versioning' },
								{ label: 'Publishing', slug: 'cli/guides/publishing' },
							],
						},
						{
							label: 'Command Reference',
							items: [
								{ label: 'Overview', slug: 'cli/commands' },
								{ label: 'auth', slug: 'cli/commands/auth' },
								{ label: 'dataset', slug: 'cli/commands/dataset' },
								{ label: 'sandbox', slug: 'cli/commands/sandbox' },
							],
						},
						{
							label: 'Configuration',
							items: [
								{ label: 'Configuration', slug: 'cli/reference/configuration' },
								{ label: 'Environment Variables', slug: 'cli/reference/environment' },
							],
						},
					],
				},
				{
					label: 'Platform & APIs',
					items: [
						{ label: 'Overview', link: '/platform/' },
						{ label: 'Backend API', slug: 'platform/api' },
						{ label: 'Data API', slug: 'platform/data-api' },
					],
				},
				{
					label: 'Develop',
					items: [
						{ label: 'Setup', slug: 'develop/setup' },
						{ label: 'Zenodo Testing', slug: 'develop/zenodo-testing' },
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
