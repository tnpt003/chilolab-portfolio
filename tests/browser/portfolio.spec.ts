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
      const image = page.locator('.product-screenshot');
      await image.scrollIntoViewIfNeeded();
      await expect(image).toBeVisible();
      expect(
        await image.evaluate(
          (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
        ),
      ).toBe(true);
      await expect(page.locator('video')).toHaveAttribute('controls', '');
      await expect(page.locator('video')).not.toHaveAttribute('autoplay');
      const media = await page.request.get('/media/pet-intro.mp4', {
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
  await expect(
    panel.getByRole('link', { name: 'Tải bộ cài cho Windows' }),
  ).toHaveAttribute('href', /\/releases\/download\/v1\.5\.0\/[^/]+Setup\.exe$/);
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
  await expect(
    page.getByRole('link', { name: 'Tải phiên bản này', exact: true }),
  ).toHaveAttribute('href', /\/download\/v1\.5\.0\//);
  await page.getByRole('link', { name: 'English', exact: true }).click();
  await expect(page).toHaveURL(/\/en\/pet-desktop\/versions\/1\.5\.0$/);
  await expect(page.locator('.version-status')).toHaveText('Released');
  await page.getByRole('link', { name: 'Tiếng Việt', exact: true }).click();
  await expect(page).toHaveURL(/\/pet-desktop\/versions\/1\.5\.0$/);
  await page.goto('/pagespeed-auth-auditor/versions/1.2.0');
  await expect(page.locator('.version-status')).toHaveText('Đang phát triển');
  await expect(page.locator('time')).toHaveCount(0);
});
