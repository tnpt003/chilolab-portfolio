import type { APIRoute } from 'astro';
import { listProjects } from '../lib/content';
import { listVersions } from '../lib/versions';

// Read by worker/index.ts so the API only accepts real projects, versions
// and download files.
export const GET: APIRoute = async () => {
  const projects = await listProjects('vi');
  const versions: Record<string, string[]> = {};
  const downloads: Record<string, Record<string, string[]>> = {};
  for (const { data: project } of projects) {
    const entries = await listVersions('vi', project.slug);
    versions[project.slug] = entries.map(({ data }) => data.version);
    const files: Record<string, string[]> = {};
    for (const { data } of entries) {
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
      versions,
      downloads,
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
