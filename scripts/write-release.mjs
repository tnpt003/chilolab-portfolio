import { writeFile } from 'node:fs/promises';
const release = process.env.RELEASE_ID || 'local';
if (!/^[a-zA-Z0-9._-]{1,80}$/.test(release))
  throw new Error('Invalid RELEASE_ID');
await writeFile(
  new URL('../dist/release.json', import.meta.url),
  JSON.stringify({ release }) + '\n',
);
