import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const routes = [
  '/',
  '/en',
  '/pet-desktop',
  '/en/pet-desktop',
  '/pagespeed-auth-auditor',
  '/en/pagespeed-auth-auditor',
  '/pet-desktop/versions',
  '/en/pet-desktop/versions',
  '/pet-desktop/versions/1.5.0',
  '/en/pet-desktop/versions/1.5.0',
  '/pagespeed-auth-auditor/versions',
  '/en/pagespeed-auth-auditor/versions',
  '/pagespeed-auth-auditor/versions/1.2.0',
  '/en/pagespeed-auth-auditor/versions/1.2.0',
  '/pagespeed-auth-auditor/versions/1.2.2',
  '/en/pagespeed-auth-auditor/versions/1.2.2',
  '/pet-desktop/feedback',
  '/en/pet-desktop/feedback',
  '/user/login',
  '/en/user/login',
  '/user/unsubscribe',
  '/en/user/unsubscribe',
  '/privacy',
  '/en/privacy',
];

for (const route of routes) {
  test(`${route}: layout, accessibility and media`, async ({
    page,
  }, testInfo) => {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute(
      'lang',
      route.startsWith('/en') ? 'en' : 'vi',
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    if (route.endsWith('/pet-desktop')) {
      // The screenshot is shown once, as the video poster.
      await expect(page.locator('.product-screenshot')).toHaveCount(0);
      const poster = await page.locator('video').getAttribute('poster');
      expect(poster).toMatch(/\.webp$/);
      expect((await page.request.get(poster!)).status()).toBe(200);
      await expect(page.locator('video')).toHaveAttribute('controls', '');
      await expect(page.locator('video')).not.toHaveAttribute('autoplay');
      const media = await page.request.get('/media/pet-promo.mp4', {
        headers: { Range: 'bytes=0-99' },
      });
      expect([200, 206]).toContain(media.status());
      await page
        .locator('video')
        .evaluate((video: HTMLVideoElement) => video.play());
      await expect
        .poll(() =>
          page
            .locator('video')
            .evaluate((video: HTMLVideoElement) => video.currentTime),
        )
        .toBeGreaterThan(0);
      await page
        .locator('video')
        .evaluate((video: HTMLVideoElement) => video.pause());
      // Gallery pictures open in a dialog; arrows move, Escape closes.
      const lightbox = page.locator('dialog.lightbox');
      await page.locator('.project-gallery a').first().click();
      await expect(lightbox).toBeVisible();
      await expect(page.locator('.lightbox-count')).toHaveText('1 / 6');
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('.lightbox-count')).toHaveText('2 / 6');
      const open = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(open.violations).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(lightbox).toBeHidden();
    }
    if (
      route === '/' ||
      route === '/pet-desktop' ||
      route === '/pet-desktop/versions/1.5.0'
    ) {
      await page.screenshot({
        path: testInfo.outputPath('page.png'),
        fullPage: true,
      });
    }
  });
}

test('language switch preserves the project', async ({ page }) => {
  await page.goto('/pet-desktop');
  await page.getByRole('link', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/pet-desktop$/);
  await page.getByRole('link', { name: 'Tiếng Việt', exact: true }).click();
  await expect(page).toHaveURL(/\/pet-desktop$/);
});

test('version history navigation preserves version and release status', async ({
  page,
}) => {
  await page.goto('/pet-desktop');
  const panel = page.locator('.download-panel');
  await expect(panel.getByRole('heading', { name: 'Tải xuống' })).toBeVisible();
  // The button always fetches the newest GitHub release.
  await expect(
    panel.getByRole('link', {
      name: 'Tải Pet Desktop bản mới nhất cho Windows',
    }),
  ).toHaveAttribute(
    'href',
    /\/releases\/latest\/download\/PetComputer-win-Setup\.exe$/,
  );
  await page
    .locator('.version-section')
    .getByRole('link', { name: 'Tất cả phiên bản' })
    .click();
  await expect(page).toHaveURL(/\/pet-desktop\/versions$/);
  await page
    .getByRole('link', { name: 'Slime phản công', exact: true })
    .click();
  await expect(page).toHaveURL(/\/versions\/1\.5\.0$/);
  await expect(page.locator('.version-status')).toHaveText('Đã phát hành');
  await expect(page.locator('.version-notice')).toHaveCount(0);
  // Binaries before 1.5.2 are no longer published, so no download here.
  await expect(
    page.getByRole('link', { name: 'Tải phiên bản này', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('link', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/pet-desktop\/versions\/1\.5\.0$/);
  await expect(page.locator('.version-status')).toHaveText('Released');
  await page.getByRole('link', { name: 'Tiếng Việt', exact: true }).click();
  await expect(page).toHaveURL(/\/pet-desktop\/versions\/1\.5\.0$/);
  await page.goto('/pagespeed-auth-auditor/versions/1.2.0');
  await expect(page.locator('.version-status')).toHaveText('Đang phát triển');
  await expect(page.locator('time')).toHaveCount(0);
});

test('auditor download panel points at the newest public release', async ({
  page,
}) => {
  await page.goto('/pagespeed-auth-auditor');
  const panel = page.locator('.download-panel');
  await expect(panel.locator('.download-release strong')).toHaveText('v1.2.2');
  // Version-free file names keep the latest/download links valid.
  await expect(
    panel.getByRole('link', {
      name: 'Tải PageSpeed-Auth-Auditor bản mới nhất cho Windows',
    }),
  ).toHaveAttribute(
    'href',
    /pagespeed-auth-auditor-releases\/releases\/latest\/download\/PageSpeed-Auth-Auditor-Setup-win\.exe$/,
  );
  await expect(
    panel.getByRole('link', { name: 'Bản Portable', exact: true }),
  ).toHaveAttribute(
    'href',
    /\/releases\/latest\/download\/PageSpeed-Auth-Auditor-Portable-win\.exe$/,
  );
  await page.goto('/pagespeed-auth-auditor/versions/1.2.2');
  await expect(page.locator('.version-status')).toHaveText('Đã phát hành');
});
