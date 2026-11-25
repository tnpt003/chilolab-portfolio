import { json } from './env';

// Public download counts from GitHub Releases, shown on project pages.
// Only installer files count (Setup.exe and Portable.zip in every release);
// the .nupkg / RELEASES files fetched by the in-app updater are left out.
// Unauthenticated GitHub API (60 requests per hour per IP), so responses are
// cached for a minute, and the last good answer is kept for a week as a
// fallback when GitHub refuses or is down.

const sources: Record<string, { repo: string; files: Record<string, string> }> =
  {
    'pet-desktop': {
      repo: 'tnpt003/Pet-Computer',
      files: {
        setup: 'PetComputer-win-Setup.exe',
        portable: 'PetComputer-win-Portable.zip',
      },
    },
  };

export type Stats = {
  project: string;
  total: number;
  files: Record<string, number>;
  checkedAt: string;
};

const FRESH = 60;
const STALE = 7 * 86400;

async function fromGitHub(project: string): Promise<Stats> {
  const source = sources[project]!;
  const files = Object.fromEntries(
    Object.keys(source.files).map((key) => [key, 0]),
  );
  for (let page = 1; page <= 5; page++) {
    const response = await fetch(
      `https://api.github.com/repos/${source.repo}/releases?per_page=100&page=${page}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'chilolab-download-stats',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );
    if (!response.ok) throw new Error(`GitHub HTTP ${response.status}`);
    const releases = (await response.json()) as {
      draft: boolean;
      assets: { name: string; download_count: number }[];
    }[];
    for (const release of releases) {
      if (release.draft) continue;
      for (const asset of release.assets)
        for (const [key, name] of Object.entries(source.files))
          if (asset.name === name) files[key]! += asset.download_count;
    }
    if (releases.length < 100) break;
  }
  return {
    project,
    total: Object.values(files).reduce((sum, n) => sum + n, 0),
    files,
    checkedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  };
}

export const statsProjects = Object.keys(sources);

/** Cached counts for a project; null when GitHub never answered. */
export async function getStats(
  project: string,
  ctx: ExecutionContext,
): Promise<(Stats & { stale?: boolean }) | null> {
  if (!sources[project]) return null;
  const cache = caches.default;
  const key = (suffix: string) =>
    new Request(`https://cache.chilolab.invalid/downloads/${project}${suffix}`);
  const cached = await cache.match(key(''));
  if (cached) return (await cached.json()) as Stats;
  try {
    const stats = await fromGitHub(project);
    const store = (suffix: string, seconds: number) =>
      cache.put(
        key(suffix),
        new Response(JSON.stringify(stats), {
          headers: { 'Cache-Control': `max-age=${seconds}` },
        }),
      );
    ctx.waitUntil(Promise.all([store('', FRESH), store('/last', STALE)]));
    return stats;
  } catch (error) {
    console.error('download stats', error);
    const last = await cache.match(key('/last'));
    return last ? { ...((await last.json()) as Stats), stale: true } : null;
  }
}

/** GET /api/downloads/stats?project=pet-desktop */
export async function downloadStats(request: Request, ctx: ExecutionContext) {
  const project = new URL(request.url).searchParams.get('project') ?? '';
  if (!sources[project]) return json({ error: 'unknown_project' }, 404);
  const stats = await getStats(project, ctx);
  if (!stats) return json({ error: 'unavailable' }, 503);
  return json(stats, 200, {
    'Cache-Control': `public, max-age=${FRESH}`,
  });
}
