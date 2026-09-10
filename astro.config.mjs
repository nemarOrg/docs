// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';

// https://astro.build/config
export default defineConfig({
	site: 'https://docs.nemar.org',
	integrations: [
		starlight({
			title: 'NEMAR',
			description: 'Documentation for the NEMAR ecosystem: the CLI, the platform APIs, and the data plane.',
			lastUpdated: true,
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
				Header: './src/components/Header.astro',
				LastUpdated: './src/components/LastUpdated.astro',
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
						{ label: 'Why NEMAR?', slug: 'why-nemar' },
						{ label: 'Mission and vision', slug: 'ecosystem/mission-and-vision' },
						{ label: 'Overview', link: '/ecosystem/' },
						{ label: 'CLI vs the web', slug: 'ecosystem/cli-vs-web' },
						{ label: 'Compute roadmap', slug: 'ecosystem/compute' },
					],
				},
				{
					label: 'Web App',
					items: [
						{ label: 'Getting Started', slug: 'web/getting-started' },
						{ label: 'Uploading a Dataset', slug: 'web/uploading' },
						{ label: 'Managing Your Datasets', slug: 'web/managing-datasets' },
						{ label: 'Linking to a Recording', slug: 'web/viewer-links' },
						{ label: 'Publication Review', slug: 'web/publication-review' },
						{ label: 'Account Settings', slug: 'web/account-settings' },
						{ label: 'Upload Access', slug: 'web/upload-access' },
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
								{ label: 'Collaboration & the Lifecycle', slug: 'cli/guides/collaboration' },
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
							label: 'Reference',
							items: [
								{ label: 'Configuration', slug: 'cli/reference/configuration' },
								{ label: 'Environment Variables', slug: 'cli/reference/environment' },
								{ label: 'Account Access', slug: 'cli/reference/account-access' },
								{ label: 'Debugging and Bug Reports', slug: 'cli/reference/debugging' },
							],
						},
					],
				},
				{
					label: 'Platform & APIs',
					items: [
						{ label: 'Overview', link: '/platform/' },
						{ label: 'Hosts and routes', slug: 'platform/hosts-and-routes' },
						{ label: 'Backend API', slug: 'platform/api' },
						{ label: 'Data API', slug: 'platform/data-api' },
						{
							label: 'Zarr and edge access',
							items: [
								{ label: 'Overview', slug: 'platform/zarr' },
								{ label: 'Mental model', slug: 'platform/zarr/mental-model' },
								{ label: 'Store Contract', slug: 'platform/zarr/store-contract' },
								{ label: 'Index Contract', slug: 'platform/zarr/index-contract' },
								{ label: 'Access and Hosting', slug: 'platform/zarr/access' },
								{ label: 'Cost Ladder and Recipes', slug: 'platform/zarr/cost-ladder' },
								{ label: 'Format Stability Policy', slug: 'platform/zarr/format-stability' },
							],
						},
						{ label: 'DOI and versioning', slug: 'platform/doi-and-versioning' },
						{ label: 'For agents and tools', slug: 'platform/for-agents' },
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
					label: 'Policies',
					items: [
						{ label: 'Overview', link: '/policies/' },
						{ label: 'Privacy Policy', slug: 'policies/privacy' },
						{ label: 'Data Contributor Terms', slug: 'policies/contributor-terms' },
						{ label: 'Dataset Submission Standards', slug: 'policies/submission-standards' },
						{ label: 'AI-Assisted Curation', slug: 'policies/ai-use' },
						{ label: 'GDPR Position Statement', slug: 'policies/gdpr' },
						{ label: 'Takedown Procedure', slug: 'policies/takedown' },
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
