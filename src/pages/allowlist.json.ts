import type { APIRoute } from 'astro';
import { listProjects } from '../lib/content';
import { listVersions } from '../lib/versions';

// Read by worker/index.ts so the API only accepts real projects and versions.
export const GET: APIRoute = async () => {
  const projects = await listProjects('vi');
  const downloads: Record<string, Record<string, string[]>> = {};
  for (const { data: project } of projects) {
    const files: Record<string, string[]> = {};
    for (const { data } of await listVersions('vi', project.slug)) {
      if (data.status !== 'released') continue;
      const kinds = [
        ...(data.downloadUrl ? ['setup'] : []),
        ...(data.portableUrl ? ['portable'] : []),
      ];
      if (kinds.length) files[data.version] = kinds;
    }
    downloads[project.slug] = files;
  }
  return new Response(
    JSON.stringify({
      projects: projects.map(({ data }) => data.slug),
      downloads,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
