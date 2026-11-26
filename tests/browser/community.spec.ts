// Visitor flows that talk to the Worker: comments, feedback, sign-in, the
// account and unsubscribe pages, the owner bar, plus the 404 and privacy
// pages they link to. `astro preview` serves only the static build, so the
// Worker API (/api/*) and Cloudflare Turnstile are mocked per test with
// page.route; the Worker itself is covered by tests/worker.
import { test, expect, type Page, type Request } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

type Reply = { status?: number; json?: unknown };
type Handler = Reply | ((request: Request) => Reply);

/**
 * Answers /api/* from a "METHOD /path" table (query string ignored) and
 * records every call. Anything not in the table gets a 404, as the Worker does.
 */
async function mockApi(page: Page, table: Record<string, Handler>) {
  const calls: { method: string; path: string; request: Request }[] = [];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const key = `${request.method()} ${url.pathname}`;
    calls.push({ method: request.method(), path: url.pathname, request });
    const handler = table[key];
    const reply =
      typeof handler === 'function'
        ? handler(request)
        : (handler ?? { status: 404, json: { error: 'not_found' } });
    await route.fulfill({
      status: reply.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(reply.json ?? {}),
    });
  });
  return calls;
}

/**
 * Turnstile that passes at once. Like the real widget, it hands out a fresh
 * token after reset(); window.__tokens counts the tokens issued.
 */
async function mockTurnstile(page: Page) {
  await page.route('https://challenges.cloudflare.com/**', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `window.__tokens = 0;
      window.turnstile = {
        render(el, options) {
          window.__widget = options;
          setTimeout(() => { options.callback('test-token'); window.__tokens++; });
          return 'widget';
        },
        reset() {
          const options = window.__widget;
          if (options) setTimeout(() => { options.callback('test-token'); window.__tokens++; });
        },
      };`,
    }),
  );
}

/** Waits until Turnstile has issued at least `count` tokens. */
const tokens = (page: Page, count = 1) =>
  page.waitForFunction(
    (n) => ((window as unknown as { __tokens?: number }).__tokens ?? 0) >= n,
    count,
  );

const signedOut = { user: null, providers: { google: true, email: true } };
const member = {
  user: { displayName: 'Mai', email: 'mai@example.com', owner: false },
  providers: { google: true, email: true },
};
const owner = {
  user: { displayName: 'Phát', email: 'owner@example.com', owner: true },
  pending: { held: 2, feedback: 1 },
  providers: { google: true, email: true },
};
const comment = (extra: Record<string, unknown> = {}) => ({
  id: 1,
  author: 'Lan',
  owner: false,
  mine: false,
  reason: null,
  state: 'published',
  body: 'Con mèo dễ thương quá',
  version: '1.5.0',
  createdAt: '2026-11-20T08:00:00Z',
  editedAt: null,
  replies: [],
  ...extra,
});
const page1 = (comments: unknown[], extra: Record<string, unknown> = {}) => ({
  page: 1,
  pages: 1,
  total: comments.length,
  signedIn: false,
  moderator: false,
  open: true,
  maxLength: 2000,
  comments,
  ...extra,
});
const axe = (page: Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze()
    .then((result) => result.violations);

// ---------- pages ----------

test('unknown pages get the bilingual 404 with a real 404 status', async ({
  page,
}) => {
  const response = await page.goto('/khong-co-trang-nay');
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('Trang này chưa có ở đây.');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    /noindex/,
  );
  await expect(
    page.getByRole('link', { name: 'Về trang chủ' }),
  ).toHaveAttribute('href', '/');
  await expect(
    page.getByRole('link', { name: 'Home in English' }),
  ).toHaveAttribute('href', '/en');
  expect(await axe(page)).toEqual([]);
});

test('/privacy#desktop-pet, which the Pet Desktop EULA links to, lands on the app section', async ({
  page,
}) => {
  for (const path of ['/privacy', '/en/privacy']) {
    await page.goto(`${path}#desktop-pet`);
    const target = page.locator('#desktop-pet');
    await expect(target).toHaveCount(1);
    await expect(target).toBeInViewport();
    expect(await target.evaluate((node) => node.tagName)).toBe('H2');
  }
});

// ---------- comments ----------

test('comments: signed-out visitors read comments and get a sign-in link back to them', async ({
  page,
}) => {
  await mockApi(page, {
    'GET /api/me': { json: signedOut },
    'GET /api/comments': { json: page1([comment()]) },
  });
  await page.goto('/pet-desktop/versions/1.5.0');
  const section = page.locator('#comments');
  await expect(section.locator('.comment-body')).toHaveText(
    'Con mèo dễ thương quá',
  );
  await expect(section.locator('textarea')).toHaveCount(0);
  const signIn = section.getByRole('link', { name: 'Đăng nhập để bình luận' });
  await expect(signIn).toHaveAttribute(
    'href',
    '/user/login?return=%2Fpet-desktop%2Fversions%2F1.5.0%23comments',
  );
  await expect(section.getByRole('button', { name: 'Trả lời' })).toHaveCount(0);
});

test('comments: a signed-in member posts, and a held comment says so', async ({
  page,
}) => {
  let posted: Record<string, unknown> | undefined;
  await mockApi(page, {
    'GET /api/me': { json: member },
    'GET /api/comments': () => ({
      json: page1(
        posted
          ? [
              comment({
                id: 2,
                author: 'Mai',
                mine: true,
                state: 'held',
                body: posted.body,
              }),
            ]
          : [],
        { signedIn: true },
      ),
    }),
    'POST /api/comments': (request) => {
      posted = request.postDataJSON();
      return {
        status: 201,
        json: { comment: comment({ id: 2, state: 'held', mine: true }) },
      };
    },
  });
  await page.goto('/pet-desktop/versions/1.5.0');
  const section = page.locator('#comments');
  await expect(section.locator('.comment-as')).toContainText('Mai');
  await section.getByRole('textbox').fill('Bản này chạy mượt');
  await section.getByRole('button', { name: 'Gửi' }).click();
  await expect(section.locator('.form-status')).toHaveText(
    'Bình luận đang được giữ lại để xem xét và sẽ hiện sau khi được duyệt.',
  );
  expect(posted).toEqual({
    project: 'pet-desktop',
    version: '1.5.0',
    body: 'Bản này chạy mượt',
    locale: 'vi',
  });
  await expect(section.locator('.comment-held')).toHaveText(
    'Đang chờ duyệt — chỉ bạn thấy bình luận này.',
  );
  await expect(section.getByRole('textbox')).toHaveValue('');
});

test('comments: server refusals are explained, not swallowed', async ({
  page,
}) => {
  await mockApi(page, {
    'GET /api/me': { json: member },
    'GET /api/comments': { json: page1([], { signedIn: true }) },
    'POST /api/comments': { status: 429, json: { error: 'hourly_limit' } },
  });
  await page.goto('/pet-desktop/versions/1.5.0');
  const section = page.locator('#comments');
  await section.getByRole('textbox').fill('Thêm một bình luận');
  await section.getByRole('button', { name: 'Gửi' }).click();
  await expect(section.locator('.form-status')).toHaveText(
    'Bạn đã bình luận nhiều trong giờ qua, vui lòng quay lại sau.',
  );
});

test('comments: closed comments show a notice instead of the form', async ({
  page,
}) => {
  await mockApi(page, {
    'GET /api/me': { json: member },
    'GET /api/comments': { json: page1([comment()], { open: false }) },
  });
  await page.goto('/pet-desktop/versions/1.5.0');
  const section = page.locator('#comments');
  await expect(section.locator('.comment-as')).toHaveText(
    'Bình luận mới đang tạm đóng.',
  );
  await expect(section.getByRole('textbox')).toHaveCount(0);
  await expect(section.getByRole('button', { name: 'Trả lời' })).toHaveCount(0);
});

test('comments: when the API is down the page says so', async ({ page }) => {
  await mockApi(page, {
    'GET /api/me': { status: 500 },
    'GET /api/comments': { status: 500, json: { error: 'server_error' } },
  });
  await page.goto('/pet-desktop/versions/1.5.0');
  await expect(page.locator('#comments [data-state]')).toHaveText(
    'Chưa tải được bình luận. Vui lòng thử lại sau.',
  );
});

test('comments: the owner sees held comments with approve and remove', async ({
  page,
}) => {
  const calls = await mockApi(page, {
    'GET /api/me': { json: owner },
    'GET /api/comments': {
      json: page1(
        [comment({ state: 'held', reason: 'words', body: 'Nội dung bị giữ' })],
        { moderator: true, signedIn: true },
      ),
    },
    'POST /api/comments/1/approve': { json: { status: 'published' } },
  });
  await page.goto('/pet-desktop/versions/1.5.0');
  const section = page.locator('#comments');
  await expect(section.locator('.comment-held')).toContainText(
    'Đang bị giữ chờ duyệt',
  );
  await expect(section.getByRole('button', { name: 'Gỡ' })).toBeVisible();
  await section.getByRole('button', { name: 'Duyệt' }).click();
  await expect
    .poll(() => calls.some((call) => call.path === '/api/comments/1/approve'))
    .toBe(true);
});

// ---------- feedback ----------

async function fillFeedback(page: Page) {
  await page.getByLabel('Tiêu đề ngắn').fill('Mèo đứng yên');
  await page
    .getByLabel('Chi tiết')
    .fill('Sau khi mở máy lại thì mèo không đi nữa.');
  await page
    .getByLabel('Phiên bản Windows (không bắt buộc)')
    .fill('Windows 11');
}

test('feedback: sends JSON with the Turnstile token, then clears the form', async ({
  page,
}) => {
  await mockTurnstile(page);
  let sent: Record<string, unknown> | undefined;
  await mockApi(page, {
    'POST /api/feedback': (request) => {
      sent = request.postDataJSON();
      return { status: 201, json: { status: 'received' } };
    },
  });
  await page.goto('/pet-desktop/feedback');
  await fillFeedback(page);
  await tokens(page);
  await page.getByRole('button', { name: 'Gửi' }).click();
  await expect(page.locator('[data-status]')).toHaveText(
    'Cảm ơn bạn! Mình đã nhận được rồi nhé.',
  );
  expect(sent).toMatchObject({
    project: 'pet-desktop',
    locale: 'vi',
    kind: 'bug',
    summary: 'Mèo đứng yên',
    os: 'Windows 11',
    token: 'test-token',
  });
  expect(sent).not.toHaveProperty('screenshot');
  await expect(page.getByLabel('Tiêu đề ngắn')).toHaveValue('');
});

test('feedback: a screenshot goes as multipart', async ({ page }) => {
  await mockTurnstile(page);
  let type = '';
  let body = '';
  await mockApi(page, {
    'POST /api/feedback': (request) => {
      type = request.headers()['content-type'] ?? '';
      body = request.postDataBuffer()?.toString('latin1') ?? '';
      return { status: 201, json: { status: 'received' } };
    },
  });
  await page.goto('/pet-desktop/feedback');
  await fillFeedback(page);
  await tokens(page);
  await page.getByLabel('Ảnh chụp màn hình (không bắt buộc)').setInputFiles({
    name: 'shot.png',
    mimeType: 'image/png',
    buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  });
  await page.getByRole('button', { name: 'Gửi' }).click();
  await expect(page.locator('[data-status]')).toHaveText(
    'Cảm ơn bạn! Mình đã nhận được rồi nhé.',
  );
  expect(type).toMatch(/^multipart\/form-data/);
  expect(body).toContain('name="data"');
  expect(body).toContain('name="screenshot"; filename="shot.png"');
});

test('feedback: oversized or non-image files are stopped before sending', async ({
  page,
}) => {
  await mockTurnstile(page);
  const calls = await mockApi(page, {});
  await page.goto('/pet-desktop/feedback');
  await fillFeedback(page);
  await tokens(page);
  const file = page.getByLabel('Ảnh chụp màn hình (không bắt buộc)');
  const status = page.locator('[data-status]');

  await file.setInputFiles({
    name: 'big.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(3 * 1024 * 1024 + 1),
  });
  await page.getByRole('button', { name: 'Gửi' }).click();
  await expect(status).toHaveText(
    'Ảnh lớn hơn 3 MB. Hãy chọn ảnh nhỏ hơn hoặc cắt bớt.',
  );

  await file.setInputFiles({
    name: 'anim.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('GIF89a'),
  });
  await page.getByRole('button', { name: 'Gửi' }).click();
  await expect(status).toHaveText('Chỉ nhận ảnh PNG, JPEG hoặc WebP.');
  expect(calls.filter((call) => call.path === '/api/feedback')).toEqual([]);
});

test('feedback: a closed form and the rate limit are explained', async ({
  page,
}) => {
  await mockTurnstile(page);
  let answer: Reply = { status: 403, json: { error: 'closed' } };
  await mockApi(page, { 'POST /api/feedback': () => answer });
  await page.goto('/pet-desktop/feedback');
  await fillFeedback(page);
  await tokens(page);
  const status = page.locator('[data-status]');
  await page.getByRole('button', { name: 'Gửi' }).click();
  await expect(status).toHaveText(
    'Form góp ý đang tạm đóng. Vui lòng quay lại sau.',
  );
  answer = { status: 429, json: { error: 'rate_limited' } };
  // Each try spends the token; send again once the fresh one arrives.
  await tokens(page, 2);
  await page.getByRole('button', { name: 'Gửi' }).click();
  await expect(status).toHaveText(
    'Bạn gửi hơi nhanh, đợi một phút rồi thử lại.',
  );
  // Nothing typed is lost after a refusal.
  await expect(page.getByLabel('Tiêu đề ngắn')).toHaveValue('Mèo đứng yên');
});

// ---------- sign-in, account, unsubscribe ----------

test('login: errors from the Google callback are shown', async ({ page }) => {
  await mockApi(page, { 'GET /api/me': { json: signedOut } });
  await page.goto('/user/login?error=blocked');
  await expect(page.locator('[data-error]')).toHaveText(
    'Tài khoản này đã bị khóa.',
  );
  await page.goto('/en/user/login?error=cancelled');
  await expect(page.locator('[data-error]')).not.toBeEmpty();
});

test('login: the Google button keeps a same-site return path and drops others', async ({
  page,
}) => {
  await mockApi(page, { 'GET /api/me': { json: signedOut } });
  const google = page.locator('[data-google]');
  await page.goto('/user/login?return=%2Fpet-desktop%23comments');
  await expect(google).toHaveAttribute(
    'href',
    '/api/auth/google?locale=vi&return=%2Fpet-desktop%23comments',
  );
  for (const target of ['//evil.example', 'https://evil.example']) {
    await page.goto(`/user/login?return=${encodeURIComponent(target)}`);
    await expect(google).toHaveAttribute(
      'href',
      '/api/auth/google?locale=vi&return=%2Fuser%2Faccount',
    );
  }
});

test('login: the email code flow signs in and returns to the page', async ({
  page,
}) => {
  await mockTurnstile(page);
  const bodies: Record<string, unknown>[] = [];
  await mockApi(page, {
    'GET /api/me': { json: signedOut },
    'POST /api/auth/email/start': (request) => {
      bodies.push(request.postDataJSON());
      return { json: { status: 'sent' } };
    },
    'POST /api/auth/email/verify': (request) => {
      const body = request.postDataJSON();
      bodies.push(body);
      return body.code === '123456'
        ? { json: { status: 'signed_in', return: '/pet-desktop' } }
        : { status: 400, json: { error: 'invalid_code' } };
    },
  });
  await page.goto('/user/login?return=%2Fpet-desktop');
  await page.getByLabel('Email').fill('mai@example.com');
  await tokens(page);
  await page.getByRole('button', { name: 'Gửi mã đăng nhập' }).click();
  await expect(page.locator('[data-code-sent]')).toHaveText(
    'Đã gửi mã 6 số tới mai@example.com. Kiểm tra cả hộp thư Spam.',
  );
  await expect(page.getByLabel('Mã 6 số')).toBeFocused();

  await page.getByLabel('Mã 6 số').fill('000000');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.locator('[data-email-status]')).toHaveText(
    'Mã không đúng hoặc đã hết hạn.',
  );

  await page.getByLabel('Mã 6 số').fill('123456');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/pet-desktop$/);
  expect(bodies[0]).toEqual({
    email: 'mai@example.com',
    locale: 'vi',
    token: 'test-token',
  });
  expect(bodies.at(-1)).toEqual({
    email: 'mai@example.com',
    code: '123456',
    return: '/pet-desktop',
  });
});

test('login: an account already signed in goes straight on', async ({
  page,
}) => {
  await mockApi(page, { 'GET /api/me': { json: member } });
  await page.goto('/user/login');
  await expect(page).toHaveURL(/\/user\/account$/);
});

test('account: signed-out visitors are sent to sign in, and back', async ({
  page,
}) => {
  await mockApi(page, { 'GET /api/me': { json: signedOut } });
  await page.goto('/user/account#updates');
  await expect(page).toHaveURL(
    /\/user\/login\?return=%2Fuser%2Faccount%23updates$/,
  );
});

test('account: shows the member, saves new version emails, hides the admin link', async ({
  page,
}) => {
  const saved: Record<string, unknown>[] = [];
  await mockApi(page, {
    'GET /api/me': { json: member },
    'GET /api/subscriptions': { json: { projects: [] } },
    'PUT /api/subscriptions': (request) => {
      saved.push(request.postDataJSON());
      return { json: { subscribed: true } };
    },
  });
  await page.goto('/user/account');
  await expect(page.locator('[data-email]')).toHaveText('mai@example.com');
  await expect(page.getByLabel('Tên hiển thị')).toHaveValue('Mai');
  await expect(page.locator('[data-admin]')).toBeHidden();
  await page.getByRole('checkbox', { name: 'Pet Desktop' }).check();
  await expect(page.locator('[data-updates-status]')).toHaveText(
    'Đã lưu lựa chọn.',
  );
  expect(saved).toEqual([
    { project: 'pet-desktop', subscribed: true, locale: 'vi' },
  ]);
  expect(await axe(page)).toEqual([]);
});

test('account: a failed save puts the checkbox back', async ({ page }) => {
  await mockApi(page, {
    'GET /api/me': { json: member },
    'GET /api/subscriptions': { json: { projects: [] } },
    'PUT /api/subscriptions': { status: 500 },
  });
  await page.goto('/user/account');
  const box = page.getByRole('checkbox', { name: 'Pet Desktop' });
  await box.check({ force: true });
  await expect(page.locator('[data-updates-status]')).toHaveText(
    'Chưa lưu được, vui lòng thử lại.',
  );
  await expect(box).not.toBeChecked();
});

test('account: the owner gets the admin link', async ({ page }) => {
  await mockApi(page, {
    'GET /api/me': { json: owner },
    'GET /api/subscriptions': { json: { projects: [] } },
  });
  await page.goto('/user/account');
  await expect(
    page.getByRole('link', { name: 'Vào trang quản trị' }),
  ).toHaveAttribute('href', '/admin/manage');
});

test('unsubscribe: the token after # is posted once, never in the URL', async ({
  page,
}) => {
  const calls = await mockApi(page, {
    'GET /api/me': { json: signedOut },
    'POST /api/subscriptions/unsubscribe': {
      json: { status: 'unsubscribed', title: 'Pet Desktop' },
    },
  });
  await page.goto('/user/unsubscribe#unsub-token-0123456789');
  await page.getByRole('button', { name: 'Hủy nhận email' }).click();
  await expect(page.locator('[data-unsubscribe-status]')).toHaveText(
    'Đã hủy. Bạn sẽ không nhận email báo bản mới của Pet Desktop nữa.',
  );
  await expect(
    page.getByRole('button', { name: 'Hủy nhận email' }),
  ).toBeHidden();
  const post = calls.find((call) => call.method === 'POST')!;
  expect(post.request.postDataJSON()).toEqual({
    token: 'unsub-token-0123456789',
    locale: 'vi',
  });
  expect(
    calls.every((call) => !call.request.url().includes('unsub-token')),
  ).toBe(true);
});

test('unsubscribe: a missing or used token says so', async ({ page }) => {
  await mockApi(page, {
    'GET /api/me': { json: signedOut },
    'POST /api/subscriptions/unsubscribe': {
      status: 404,
      json: { error: 'not_found' },
    },
  });
  const status = page.locator('[data-unsubscribe-status]');
  await page.goto('/user/unsubscribe');
  await expect(status).toHaveText('Link hủy không đúng hoặc đã được dùng rồi.');
  await expect(
    page.getByRole('button', { name: 'Hủy nhận email' }),
  ).toBeHidden();

  // A new page load, as when the link is opened from an email.
  await page.goto('/');
  await page.goto('/user/unsubscribe#already-used-token-000000');
  await page.getByRole('button', { name: 'Hủy nhận email' }).click();
  await expect(status).toHaveText('Link hủy không đúng hoặc đã được dùng rồi.');
});

// ---------- owner bar ----------

test('owner bar: visitors never ask /api/me and never see it', async ({
  page,
}) => {
  const calls = await mockApi(page, {
    'GET /api/me': { json: owner },
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(calls.filter((call) => call.path === '/api/me')).toEqual([]);
  await expect(page.locator('[data-owner-bar]')).toBeHidden();
  await expect(page.locator('.edit-pin')).toHaveCount(0);
});

test('owner bar: the hint cookie alone shows nothing; the owner answer does', async ({
  page,
}) => {
  // Browsers refuse __Host- cookies over plain http, so the page reads the
  // hint cookie the owner's browser would hold on https://chilolab.com.
  await page.addInitScript(() =>
    Object.defineProperty(Document.prototype, 'cookie', {
      get: () => '__Host-chilolab_admin=1',
      set: () => {},
    }),
  );
  let answer: unknown = member;
  await mockApi(page, { 'GET /api/me': () => ({ json: answer }) });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-owner-bar]')).toBeHidden();
  await expect(page.locator('.edit-pin')).toHaveCount(0);

  answer = owner;
  await page.reload();
  const bar = page.locator('[data-owner-bar]');
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('2 bình luận chờ duyệt · 1 góp ý mới');
  await expect(page.locator('.edit-pin').first()).toBeVisible();
});
