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
    me: 'Về tôi',
    about: 'Về ChiloLab',
    switch: 'English',
    homeTitle: 'Nguyễn Tấn Phát, BA/QC và người làm phần mềm',
    title:
      'Tôi là Phát. Tôi kiểm thử phần mềm cho khách hàng, và tự làm phần mềm của mình.',
    intro:
      'Tôi làm BA/QC tại WeebPal và tốt nghiệp Công nghệ thông tin tại HUFLIT. Ở đây có hai ứng dụng Windows tôi tự viết và phát hành: một chú mèo sống trên desktop, và một công cụ QA website.',
    metaDescription:
      'Portfolio của Nguyễn Tấn Phát, BA/QC tại WeebPal, tốt nghiệp Công nghệ thông tin tại HUFLIT. Kinh nghiệm, kỹ năng và hai ứng dụng Windows tự làm: Pet Desktop và PageSpeed-Auth-Auditor.',
    explore: 'Xem dự án',
    aboutCta: 'Về tôi',
    hello: 'Meo, chào bạn!',
    stack: 'Công nghệ',
    skillsHeading: 'Tôi làm việc với',
    portraitAlt:
      'Nguyễn Tấn Phát mặc áo khoác xám, đứng trước một bức tường treo ảnh.',
    portraitCaption: 'Nguyễn Tấn Phát, người làm ChiloLab',
    selected: 'Mỗi dự án có trang riêng, lịch sử phiên bản và chỗ để góp ý.',
    detail: 'Xem dự án',
    back: 'Tất cả dự án',
    aboutText:
      'ChiloLab là phòng thí nghiệm nhỏ của tôi, Nguyễn Tấn Phát. Mỗi ý tưởng ở đây được làm thành một ứng dụng chạy thật, phát hành theo từng phiên bản và sửa tiếp dựa trên góp ý của người dùng. Bạn có thể tải Pet Desktop, đọc ghi chú thay đổi, hoặc đăng nhập để bình luận và báo lỗi.',
    preview: 'Minh họa ý tưởng, không phải ảnh sản phẩm',
    footer: 'Ý tưởng nhỏ, phát hành thật, sửa theo góp ý.',
    footerLinks: {
      projects: 'Dự án',
      download: 'Tải xuống',
      versions: 'Các phiên bản',
      feedback: 'Góp ý & báo lỗi',
      privacy: 'Quyền riêng tư',
      account: 'Đăng nhập / tài khoản',
    },
    demo: 'Dùng thử',
    repo: 'Xem mã nguồn',
    download: 'Tải xuống',
  },
  en: {
    projects: 'Projects',
    me: 'About me',
    about: 'About ChiloLab',
    switch: 'Tiếng Việt',
    homeTitle: 'Nguyễn Tấn Phát, BA/QC and software maker',
    title: 'I’m Phát. I test software for clients, and build my own.',
    intro:
      'I work as a BA/QC at WeebPal and graduated in Information Technology from HUFLIT. Here are two Windows apps I wrote and release myself: a cat that lives on your desktop, and a website QA tool.',
    metaDescription:
      'Portfolio of Nguyễn Tấn Phát, BA/QC at WeebPal and Information Technology graduate of HUFLIT. Experience, skills and two self-made Windows apps: Pet Desktop and PageSpeed-Auth-Auditor.',
    explore: 'See my projects',
    aboutCta: 'About me',
    hello: 'Meow, hello!',
    stack: 'Built with',
    skillsHeading: 'What I work with',
    portraitAlt:
      'Nguyễn Tấn Phát in a grey jacket, standing in front of a wall of framed photos.',
    portraitCaption: 'Nguyễn Tấn Phát, who makes ChiloLab',
    selected:
      'Each one has its own page, version history and a place for feedback.',
    detail: 'Explore project',
    back: 'All projects',
    aboutText:
      'ChiloLab is my small lab: I’m Nguyễn Tấn Phát, and every idea here becomes an app that actually runs, ships in versions and keeps improving from what users tell me. You can download Pet Desktop, read the change notes, or sign in to comment and report bugs.',
    preview: 'Concept illustration, not a product screenshot',
    footer: 'Small ideas, real releases, shaped by feedback.',
    footerLinks: {
      projects: 'Projects',
      download: 'Download',
      versions: 'All versions',
      feedback: 'Feedback & bug reports',
      privacy: 'Privacy',
      account: 'Sign in / account',
    },
    demo: 'Try it',
    repo: 'Source code',
    download: 'Download',
  },
} as const;
