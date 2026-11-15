import { getCollection } from 'astro:content';
export type Locale = 'vi' | 'en';
export const locales: Locale[] = ['vi', 'en'];
export function pathFor(locale: Locale, slug = '') {
  const base = locale === 'en' ? '/en' : '';
  return slug ? `${base}/${slug}` : base || '/';
}
// Keep CMS/loading decisions here, outside page templates.
export async function listProjects(locale: Locale) {
  const all = await getCollection('projects');
  const published = all.filter(({ data }) => !data.draft);
  for (const { data } of published) {
    for (const translation of locales) {
      const matches = published.filter(
        ({ data: candidate }) =>
          candidate.slug === data.slug && candidate.locale === translation,
      );
      if (matches.length !== 1)
        throw new Error(
          `Project ${data.slug} must have exactly one published ${translation} translation.`,
        );
    }
  }
  const entries = published.filter(({ data }) => data.locale === locale);
  return entries.sort((a, b) => a.data.order - b.data.order);
}
export const copy = {
  vi: {
    projects: 'Dự án',
    about: 'Về ChiloLab',
    switch: 'English',
    title: 'Những ý tưởng có chỗ để lớn lên.',
    intro:
      'ChiloLab là nơi tôi giới thiệu những dự án mình xây dựng, từ công cụ đến những người bạn nhỏ trên desktop.',
    explore: 'Khám phá dự án',
    selected: 'Hai dự án đầu tiên',
    detail: 'Xem dự án',
    back: 'Tất cả dự án',
    aboutText:
      'Tôi là Nguyễn Tấn Phát. ChiloLab là không gian để tôi ghi lại quá trình làm sản phẩm, chia sẻ những gì đã xây và tiếp tục thử nghiệm.',
    note: 'Thông tin bản phát hành và đường dẫn chính thức được ghi trong phần giới thiệu bên cạnh.',
    preview: 'Minh họa ý tưởng, không phải ảnh sản phẩm',
    footer: 'Được xây từ những ý tưởng nhỏ.',
    demo: 'Dùng thử',
    repo: 'Xem mã nguồn',
    download: 'Tải xuống',
  },
  en: {
    projects: 'Projects',
    about: 'About ChiloLab',
    switch: 'Tiếng Việt',
    title: 'A place for ideas to grow.',
    intro:
      'ChiloLab is where I share the projects I build, from practical tools to little desktop companions.',
    explore: 'Explore projects',
    selected: 'The first two projects',
    detail: 'Explore project',
    back: 'All projects',
    aboutText:
      'I’m Nguyễn Tấn Phát. ChiloLab is my space to document making products, share what I build, and keep experimenting.',
    note: 'Release information and official links are listed in the project introduction alongside this panel.',
    preview: 'Concept illustration, not a product screenshot',
    footer: 'Built from small ideas.',
    demo: 'Try it',
    repo: 'Source code',
    download: 'Download',
  },
} as const;
