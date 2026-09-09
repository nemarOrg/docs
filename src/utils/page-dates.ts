/**
 * Git-derived "created" date for a docs page, plus the shallow-clone guard
 * shared by the LastUpdated override.
 *
 * Mirrors the conventions in `@astrojs/starlight/utils/git.ts`: `git log`
 * scoped to the file's own directory via `cwd`, timestamps read with
 * `--format=%ct` and converted with `new Date(timestamp * 1000)`. Starlight
 * already derives "last updated" from the newest commit
 * (`Astro.locals.starlightRoute.lastUpdated`); this module only adds the
 * "created" half, which Starlight has no equivalent for.
 */
import { basename, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

// Module-level caches. A plain `.ts` module is a genuine ES module singleton
// across the whole build, so these survive every page render without
// re-spawning git for a file (or a repository check) more than once.
let shallowRepoCache: boolean | undefined;
let shallowRepoWarned = false;
const createdDateCache = new Map<string, Date | undefined>();

/**
 * Whether the local git checkout is shallow (`git clone --depth N`).
 *
 * In a shallow clone every file's first and last commit collapse onto the
 * graft boundary commit, so both dates would be silently wrong rather than
 * missing. Checked once per build and cached; warns exactly once when true.
 */
export function isRepositoryShallow(): boolean {
	if (shallowRepoCache !== undefined) return shallowRepoCache;

	try {
		const result = spawnSync('git', ['rev-parse', '--is-shallow-repository'], {
			encoding: 'utf-8',
		});
		shallowRepoCache = !result.error && result.stdout.trim() === 'true';
	} catch {
		shallowRepoCache = false;
	}

	if (shallowRepoCache && !shallowRepoWarned) {
		shallowRepoWarned = true;
		console.warn(
			'This is a shallow git clone, so git-derived page dates (created and last-updated) are hidden until the build fetches full history.'
		);
	}

	return shallowRepoCache;
}

/**
 * The date a docs page was first added to git history, following renames.
 *
 * Returns `undefined` (and logs once) on any git failure other than the
 * shallow-clone case, which callers should check separately with
 * `isRepositoryShallow()` before ever calling this function.
 */
export function getCreatedDate(filePath: string): Date | undefined {
	if (createdDateCache.has(filePath)) return createdDateCache.get(filePath);

	let date: Date | undefined;
	try {
		const result = spawnSync(
			'git',
			['log', '--diff-filter=A', '--follow', '--format=%ct', '--', basename(filePath)],
			{ cwd: dirname(filePath), encoding: 'utf-8' }
		);
		if (result.error) throw result.error;

		// `--follow` prints one line per add across renames, newest first;
		// the last line is the oldest, i.e. the original add commit.
		const lines = result.stdout.trim().split('\n').filter(Boolean);
		const oldest = lines.at(-1);
		if (oldest === undefined) throw new Error(`no add commit found for "${filePath}"`);

		const timestamp = Number(oldest);
		if (!Number.isFinite(timestamp)) throw new Error(`unparseable timestamp for "${filePath}"`);

		date = new Date(timestamp * 1000);
	} catch (error) {
		console.warn(`Failed to determine the created date for "${filePath}":`, error);
		date = undefined;
	}

	createdDateCache.set(filePath, date);
	return date;
}
