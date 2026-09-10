import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

// This endpoint is a no-regret addition, not a claimed findability win: the
// research behind it found no evidence llms.txt is actually consumed, and an
// on-the-record denial from Google that it feeds their systems. It costs one
// generated file, so it ships anyway. See nemarOrg/nemar-cli's
// .context/research-agent-findability.md.
//
// Generated from the real `docs` content collection (not hand-maintained) so
// it cannot silently drift from the pages that actually exist -- a stale
// hand-written index would be worse than no index at all.
export const prerender = true;

const SECTION_ORDER = ['why-nemar', 'ecosystem', 'web', 'cli', 'platform', 'develop', 'policies'];

const SECTION_TITLES: Record<string, string> = {
	'why-nemar': 'Why NEMAR',
	ecosystem: 'The Ecosystem',
	web: 'Web App',
	cli: 'CLI',
	platform: 'Platform & APIs',
	develop: 'Develop',
	policies: 'Policies',
};

export const GET: APIRoute = async ({ site }) => {
	// Admin content is gated by an admin-only NEMAR session (see AGENTS.md), and
	// this file is served from /llms.txt, outside that gate. So the filter is the
	// only thing keeping the gated pages out of a public index, which is why
	// `scripts/check-admin-gating.ts --built` fails the build if one appears here.
	const entries = await getCollection(
		'docs',
		(entry) => entry.id !== 'admin' && !entry.id.startsWith('admin/'),
	);

	const base = (site?.toString() ?? 'https://docs.nemar.org/').replace(/\/$/, '');

	// Astro's default id generator strips a trailing "/index" from a nested
	// entry (src/content/docs/cli/index.md -> id "cli"), but the regex it uses
	// requires a leading slash, so the site root (src/content/docs/index.mdx)
	// is the one file that keeps the literal id "index" rather than "". It
	// still routes to "/", not "/index/" -- Starlight special-cases it the
	// same way. Handle it explicitly rather than let it fall into a section.
	const home = entries.find((entry) => entry.id === 'index');
	const title = home?.data.title ?? 'NEMAR';
	const summary = home?.data.description ?? 'Documentation for the NEMAR ecosystem.';

	const bySection = new Map<string, typeof entries>();
	for (const entry of entries) {
		if (entry.id === 'index') continue;
		const top = entry.id.split('/')[0] ?? entry.id;
		const bucket = bySection.get(top) ?? [];
		bucket.push(entry);
		bySection.set(top, bucket);
	}

	// Sections not in SECTION_ORDER (a future top-level directory added without
	// updating this list) still get emitted, alphabetically, after the known ones,
	// so the file degrades gracefully instead of silently dropping content.
	const orderedKeys = [
		...SECTION_ORDER.filter((key) => bySection.has(key)),
		...[...bySection.keys()].filter((key) => !SECTION_ORDER.includes(key)).sort(),
	];

	let body = `# ${title}\n\n> ${summary}\n\n`;

	for (const key of orderedKeys) {
		const items = bySection.get(key);
		if (!items || items.length === 0) continue;
		items.sort((a, b) => a.id.localeCompare(b.id));

		body += `## ${SECTION_TITLES[key] ?? key}\n\n`;
		for (const item of items) {
			const url = `${base}/${item.id}/`;
			const label = item.data.title ?? item.id;
			const note = item.data.description ? `: ${item.data.description}` : '';
			body += `- [${label}](${url})${note}\n`;
		}
		body += '\n';
	}

	return new Response(body.trimEnd() + '\n', {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
};
