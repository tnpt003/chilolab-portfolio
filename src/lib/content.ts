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
    title: 'Tôi là Phát. Tôi làm phần mềm nhỏ cho Windows.',
    intro:
      'ChiloLab là nơi tôi để những gì mình đã làm: một chú mèo sống trên desktop và một công cụ kiểm tra website.',
    explore: 'Xem hai dự án',
    portraitAlt:
      'Nguyễn Tấn Phát mặc áo khoác xám, đứng trước một bức tường treo ảnh.',
    portraitCaption: 'Nguyễn Tấn Phát, người làm ChiloLab',
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
    title: 'I’m Phát. I make small software for Windows.',
    intro:
      'ChiloLab is where I keep what I’ve made: a cat that lives on your desktop and a tool for checking websites.',
    explore: 'See both projects',
    portraitAlt:
      'Nguyễn Tấn Phát in a grey jacket, standing in front of a wall of framed photos.',
    portraitCaption: 'Nguyễn Tấn Phát, who makes ChiloLab',
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
