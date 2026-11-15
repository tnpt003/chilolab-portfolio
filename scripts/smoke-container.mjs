import assert from 'node:assert/strict';
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8080';
const expected = process.env.EXPECTED_RELEASE;
const health = await fetch(`${base}/healthz`, {
  signal: AbortSignal.timeout(5000),
});
assert.equal(health.status, 200, 'health endpoint must succeed');
const { release } = await health.json();
if (expected) assert.equal(release, expected, 'wrong deployed release');
for (const route of [
  '/',
  '/en',
  '/pet-desktop',
  '/pagespeed-auth-auditor',
  '/pet-desktop/versions/1.5.0',
  '/en/pagespeed-auth-auditor/versions/1.2.0',
]) {
  const response = await fetch(`${base}${route}`, {
    signal: AbortSignal.timeout(5000),
  });
  assert.equal(response.status, 200, route);
  assert.match(
    await response.text(),
    /<h1[ >]/,
    `${route}: expected a rendered page`,
  );
}
const missing = await fetch(`${base}/missing-lab-page`, {
  signal: AbortSignal.timeout(5000),
});
assert.equal(
  missing.status,
  404,
  'unknown routes must not silently return the homepage',
);
const redirect = await fetch(`${base}/PageSpeed-Auth-Auditor`, {
  redirect: 'manual',
  signal: AbortSignal.timeout(5000),
});
assert.equal(redirect.status, 301);
assert.equal(redirect.headers.get('location'), '/pagespeed-auth-auditor');
console.log(
  `Container smoke passed: release=${release}; health, routes, real 404 and 301 verified.`,
);
