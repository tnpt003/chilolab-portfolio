// Turns a weekly D1 backup (worker/maintenance.ts) into SQL for wrangler.
//   node scripts/restore-backup.mjs chilolab-2026-11-29.json.gz > restore.sql
//   npx wrangler d1 execute chilolab --local --file restore.sql   (try first)
//   npx wrangler d1 execute chilolab --remote --file restore.sql
// Run it against a database with every migration applied. It replaces the
// rows of each backed-up table; sessions and sign-in codes are not in backups,
// so everyone signs in again. The SQL holds visitor emails: never commit it.
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/restore-backup.mjs <backup.json.gz>');
  process.exit(1);
}
const raw = await readFile(file);
const backup = JSON.parse(
  (file.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8'),
);
if (backup.format !== 'chilolab-d1-backup' || backup.version !== 1)
  throw new Error('Not a ChiloLab D1 backup (format/version).');

// Parents before children, so foreign keys hold while inserting.
const first = ['users'];
const names = Object.keys(backup.tables).sort(
  (a, b) =>
    (first.includes(b) ? 1 : 0) - (first.includes(a) ? 1 : 0) ||
    a.localeCompare(b),
);
const ident = (name) => {
  if (!/^\w+$/.test(name)) throw new Error(`Unsafe name: ${name}`);
  return `"${name}"`;
};
const value = (v) =>
  v === null || v === undefined
    ? 'NULL'
    : typeof v === 'number'
      ? String(v)
      : typeof v === 'boolean'
        ? v
          ? '1'
          : '0'
        : `'${String(v).replaceAll("'", "''")}'`;

const out = [
  `-- Restore of ${backup.createdAt}`,
  'PRAGMA defer_foreign_keys = on;',
];
// Children are cleared first, parents last.
for (const name of [...names].reverse())
  if (name !== 'd1_migrations') out.push(`DELETE FROM ${ident(name)};`);
for (const name of names) {
  if (name === 'd1_migrations') continue;
  for (const row of backup.tables[name]) {
    const columns = Object.keys(row);
    out.push(
      `INSERT INTO ${ident(name)} (${columns.map(ident).join(', ')}) VALUES (${columns.map((c) => value(row[c])).join(', ')});`,
    );
  }
}
process.stdout.write(out.join('\n') + '\n');
console.error(
  `${names.length} tables, ${names.reduce((n, t) => n + backup.tables[t].length, 0)} rows from ${backup.createdAt}`,
);
