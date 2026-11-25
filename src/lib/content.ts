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
    me: 'Về mình',
    about: 'Về ChiloLab',
    switch: 'English',
    homeTitle: 'Nguyễn Tấn Phát, BA/QC và người làm phần mềm',
    title:
      'Chào bạn, mình là Phát. Mình kiểm thử phần mềm, và tự làm app của riêng mình.',
    intro:
      'Mình đang làm BA/QC ở WeebPal và tốt nghiệp ngành Công nghệ thông tin ở HUFLIT. Ở đây có hai app Windows mình tự viết và tự phát hành: một chú mèo sống ngay trên desktop của bạn, và một công cụ giúp kiểm tra website.',
    metaDescription:
      'Portfolio của Nguyễn Tấn Phát, BA/QC tại WeebPal, tốt nghiệp Công nghệ thông tin tại HUFLIT. Kinh nghiệm, kỹ năng và hai ứng dụng Windows tự làm: Pet Desktop và PageSpeed-Auth-Auditor.',
    explore: 'Xem dự án',
    aboutCta: 'Về mình',
    hello: 'Meo, chào bạn!',
    stack: 'Công nghệ',
    skillsHeading: 'Mình làm việc với',
    portraitAlt:
      'Nguyễn Tấn Phát mặc áo khoác xám, đứng trước một bức tường treo ảnh.',
    portraitCaption: 'Phát, người đứng sau ChiloLab',
    selected:
      'Dự án nào cũng có trang riêng, lịch sử phiên bản và chỗ để bạn góp ý.',
    detail: 'Xem dự án',
    back: 'Tất cả dự án',
    aboutText:
      'ChiloLab là góc nhỏ để mình thử ý tưởng. Ý tưởng nào làm được thì mình biến thành app chạy thật, phát hành từng bản và sửa dần theo góp ý của mọi người. Bạn có thể tải Pet Desktop về chơi, xem mỗi bản mới có gì, hoặc đăng nhập để bình luận và báo lỗi.',
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
    title:
      'Hi, I’m Phát. I test software for a living, and build my own apps on the side.',
    intro:
      'I’m a BA/QC at WeebPal and an Information Technology graduate from HUFLIT. Here you’ll find two Windows apps I wrote and release myself: a cat that lives right on your desktop, and a tool for checking websites.',
    metaDescription:
      'Portfolio of Nguyễn Tấn Phát, BA/QC at WeebPal and Information Technology graduate of HUFLIT. Experience, skills and two self-made Windows apps: Pet Desktop and PageSpeed-Auth-Auditor.',
    explore: 'See my projects',
    aboutCta: 'About me',
    hello: 'Meow, hello!',
    stack: 'Built with',
    skillsHeading: 'What I work with',
    portraitAlt:
      'Nguyễn Tấn Phát in a grey jacket, standing in front of a wall of framed photos.',
    portraitCaption: 'Phát, the person behind ChiloLab',
    selected:
      'Each project has its own page, a version history and a place for your feedback.',
    detail: 'Explore project',
    back: 'All projects',
    aboutText:
      'ChiloLab is my little corner for trying out ideas. The ones that work become real apps, released version by version and improved from what people tell me. Download Pet Desktop to play, see what’s new in each version, or sign in to comment and report bugs.',
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
