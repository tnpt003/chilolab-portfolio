import type { ImageMetadata } from 'astro';
import type { IconName } from '../components/Icon.astro';
import type { Locale } from './content';

// Owner profile for /about (and the short homepage teaser). Only confirmed
// facts: client and contact names stay off the public site (NDA), and the
// Athena entries are course completions, not Cisco/LPI vendor certifications.
// Confirmed by the owner 2026-11-18: HUFLIT, Information Technology, 2026;
// BA/QC at WeebPal since 08/2025; the contact email below may be public.

// TOEIC: fill in once the certificate is at hand. The image is optional;
// drop it at src/assets/certificates/toeic.(jpg|jpeg|png|webp) after blurring
// the date of birth, ID number and portrait (see that folder's README).
export const toeic: { score?: number; year?: number } = {};

const toeicFiles = import.meta.glob<{ default: ImageMetadata }>(
  '../assets/certificates/toeic.{jpg,jpeg,png,webp}',
  { eager: true },
);
export const toeicImage = Object.values(toeicFiles)[0]?.default;

export const githubUrl = 'https://github.com/tnpt003';
export const email = 'contact@chilolab.com';
export const athenaUrl = 'https://athena.edu.vn/';

export type JourneyKind = 'study' | 'work' | 'release';
export const journeyIcons: Record<JourneyKind, IconName> = {
  study: 'graduation',
  work: 'briefcase',
  release: 'download',
};
export interface JourneyEntry {
  kind: JourneyKind;
  year: number;
  date?: string; // ISO (YYYY-MM or YYYY-MM-DD) when the month is known
  label?: string;
  title: string;
  text?: string;
  href?: string;
}

interface Fact {
  icon: IconName;
  text: string;
}
interface SkillGroup {
  icon: IconName;
  name: string;
  items: string[];
}
interface Step {
  icon: IconName;
  title: string;
  text: string;
}

interface Profile {
  pageTitle: string;
  metaDescription: string;
  heading: string;
  lead: string;
  teaser: string;
  readMore: string;
  facts: Fact[];
  emailMe: string;
  seeProjects: string;
  github: string;
  portraitCaption: string;
  petAlt: string;
  petCaption: string;
  experienceTitle: string;
  role: string;
  company: string;
  jobPeriod: string;
  current: string;
  duties: string[];
  educationTitle: string;
  education: string;
  educationPeriod: string;
  howTitle: string;
  howIntro: string;
  steps: Step[];
  skillsTitle: string;
  skillsIntro: string;
  skills: SkillGroup[];
  journeyTitle: string;
  journeyKinds: Record<JourneyKind, string>;
  journey: JourneyEntry[];
  releaseTitle: string;
  releaseCount: string;
  coursesTitle: string;
  courses: string[];
  coursesNote: string;
  builtTitle: string;
  builtIntro: string;
  languagesTitle: string;
  english: string;
  toeicLabel: string;
  toeicAlt: string;
  toeicOpen: string;
  contactTitle: string;
  contactText: string;
}

export const profile: Record<Locale, Profile> = {
  vi: {
    pageTitle: 'Về mình',
    metaDescription:
      'Nguyễn Tấn Phát: BA/QC tại WeebPal từ 08/2025, tốt nghiệp Công nghệ thông tin tại HUFLIT, tự làm và phát hành phần mềm Windows tại ChiloLab. Kinh nghiệm, kỹ năng, hành trình và liên hệ.',
    heading:
      'Mình là Phát. Mình làm BA/QC, và thích tự làm những phần mềm nhỏ.',
    lead: 'Mình học Công nghệ thông tin ở HUFLIT. Trong giờ làm, mình là BA/QC: trao đổi với khách hàng nước ngoài cho tới khi yêu cầu thật rõ, rồi kiểm thử sản phẩm trước khi bàn giao. Ngoài giờ, mình tự viết, phát hành và sửa dần các app bạn thấy trên trang này.',
    teaser:
      'Mình đang làm BA/QC ở WeebPal và tốt nghiệp ngành Công nghệ thông tin ở HUFLIT. Kinh nghiệm, kỹ năng và chặng đường của mình nằm ở trang riêng.',
    readMore: 'Tìm hiểu thêm về mình',
    facts: [
      { icon: 'briefcase', text: 'BA/QC tại WeebPal' },
      { icon: 'graduation', text: 'Tốt nghiệp CNTT, HUFLIT' },
      { icon: 'globe', text: 'Làm việc bằng tiếng Anh' },
    ],
    emailMe: 'Gửi email cho mình',
    seeProjects: 'Xem các dự án',
    github: 'GitHub',
    portraitCaption: 'Nguyễn Tấn Phát',
    petAlt:
      'Chú mèo đội mũ phù thủy của Pet Desktop ngồi ở mép dưới màn hình Windows, cạnh một con slime xanh.',
    petCaption: 'Pet Desktop trên máy mình, ảnh chụp thật',
    experienceTitle: 'Kinh nghiệm',
    role: 'BA/QC',
    company: 'WeebPal',
    jobPeriod: '08/2025 – nay',
    current: 'Hiện tại',
    duties: [
      'Làm việc trực tiếp bằng tiếng Anh với khách hàng và agency nước ngoài để làm rõ yêu cầu, xác nhận phạm vi và báo lỗi.',
      'Tham gia dự án website cho agency nước ngoài và dự án cho doanh nghiệp Nhật Bản trong các mảng sản xuất, đào tạo trực tuyến (LMS) và chuyển đổi số.',
      'Viết tài liệu yêu cầu và test case, kiểm thử chức năng và API, theo dõi lỗi đến khi đóng.',
    ],
    educationTitle: 'Học vấn',
    education:
      'Ngành Công nghệ thông tin, Trường Đại học Ngoại ngữ – Tin học TP.HCM (HUFLIT)',
    educationPeriod: 'Tốt nghiệp 2026',
    howTitle: 'Mình làm việc thế nào',
    howIntro: 'Một yêu cầu thường qua tay mình theo bốn bước.',
    steps: [
      {
        icon: 'message',
        title: 'Làm rõ yêu cầu',
        text: 'Hỏi lại khách hàng tới khi phạm vi thật rõ, rồi ghi lại những gì hai bên đã chốt.',
      },
      {
        icon: 'testing',
        title: 'Viết tài liệu và test case',
        text: 'Biến yêu cầu thành tài liệu và các trường hợp kiểm thử cụ thể.',
      },
      {
        icon: 'code',
        title: 'Kiểm thử',
        text: 'Kiểm thử chức năng và API trên bản build thật, ghi rõ từng bước để tái hiện lỗi.',
      },
      {
        icon: 'history',
        title: 'Theo dõi đến khi đóng',
        text: 'Theo từng lỗi tới khi được sửa và kiểm tra lại xong, rồi mới bàn giao.',
      },
    ],
    skillsTitle: 'Kỹ năng',
    skillsIntro:
      'Những thứ mình đã dùng trong công việc, đồ án ở trường và các app của mình.',
    skills: [
      {
        icon: 'testing',
        name: 'Kiểm thử',
        items: [
          'Kiểm thử API thanh toán MoMo, VNPay',
          'Unit test với NUnit, báo cáo Excel',
          'Tự làm công cụ QA website',
        ],
      },
      {
        icon: 'code',
        name: 'Web',
        items: [
          'ASP.NET MVC',
          'Entity Framework',
          'Java web',
          'Drupal',
          'PHP',
          'Tích hợp API',
        ],
      },
      {
        icon: 'phone',
        name: 'Ứng dụng',
        items: ['C#/WPF', 'Electron', 'Flutter', 'Android Studio'],
      },
      {
        icon: 'database',
        name: 'Cơ sở dữ liệu',
        items: ['SQL Server', 'MongoDB', 'Firebase Realtime Database'],
      },
      {
        icon: 'braces',
        name: 'Ngôn ngữ lập trình',
        items: ['C#', 'Java', 'PHP', 'Python'],
      },
      {
        icon: 'terminal',
        name: 'Hệ thống & công cụ',
        items: ['Linux', 'Mạng máy tính', 'Git', 'GitHub', 'GitLab'],
      },
      {
        icon: 'chip',
        name: 'IoT',
        items: ['Arduino', 'ESP32', 'ThingSpeak', 'Firebase'],
      },
    ],
    journeyTitle: 'Nhật ký của mình',
    journeyKinds: { study: 'Học', work: 'Công việc', release: 'Phát hành' },
    journey: [
      {
        kind: 'work',
        year: 2025,
        date: '2025-08',
        label: '08/2025',
        title: 'Bắt đầu làm BA/QC tại WeebPal',
        text: 'Làm việc bằng tiếng Anh với khách hàng nước ngoài, trong đó có doanh nghiệp Nhật Bản.',
      },
      {
        kind: 'study',
        year: 2026,
        title: 'Tốt nghiệp ngành Công nghệ thông tin, HUFLIT',
      },
    ],
    releaseTitle: 'Phát hành Pet Desktop {version}: {title}',
    releaseCount: '{count} bản Pet Desktop đã đăng ghi chú trên ChiloLab.',
    coursesTitle: 'Khóa học',
    courses: [
      'Quản trị mạng cơ bản (ACBN)',
      'Quản trị mạng Cisco (chương trình CCNA)',
      'Quản trị mã nguồn mở Linux Master',
    ],
    coursesNote: 'Chứng nhận hoàn thành khóa học do Trung tâm Athena cấp.',
    builtTitle: 'Mình tự làm',
    builtIntro:
      'Hai app mình tự viết từ đầu, đang phát hành và sửa dần theo góp ý ở đây.',
    languagesTitle: 'Ngoại ngữ',
    english:
      'Tiếng Anh: mình dùng hằng ngày khi làm việc với khách hàng nước ngoài.',
    toeicLabel: 'TOEIC',
    toeicAlt:
      'Ảnh chứng chỉ TOEIC của Nguyễn Tấn Phát, đã che thông tin cá nhân',
    toeicOpen: 'Xem ảnh chứng chỉ cỡ lớn',
    contactTitle: 'Nói chuyện với mình',
    contactText:
      'Muốn trao đổi công việc, hỏi về một dự án hay góp ý cho app? Cứ gửi email cho mình nhé, thư nào mình cũng đọc.',
  },
  en: {
    pageTitle: 'About me',
    metaDescription:
      'Nguyễn Tấn Phát: BA/QC at WeebPal since August 2025, Information Technology graduate of HUFLIT, and maker of the Windows software released on ChiloLab. Experience, skills, journey and contact.',
    heading: 'Hi, I’m Phát. I work as a BA/QC, and I love building small apps.',
    lead: 'I studied Information Technology at HUFLIT. At work I’m a BA/QC: I talk with overseas clients until the requirements are clear, then test the product before it’s handed over. After hours I write, release and keep improving the apps you see here.',
    teaser:
      'I’m a BA/QC at WeebPal and an Information Technology graduate from HUFLIT. My experience, skills and the road so far have their own page.',
    readMore: 'More about me',
    facts: [
      { icon: 'briefcase', text: 'BA/QC at WeebPal' },
      { icon: 'graduation', text: 'IT graduate, HUFLIT' },
      { icon: 'globe', text: 'Works in English' },
    ],
    emailMe: 'Email me',
    seeProjects: 'See my projects',
    github: 'GitHub',
    portraitCaption: 'Nguyễn Tấn Phát',
    petAlt:
      'The Pet Desktop cat in a wizard hat sitting on the bottom edge of a Windows screen, next to a green slime.',
    petCaption: 'Pet Desktop on my screen, an actual capture',
    experienceTitle: 'Experience',
    role: 'BA/QC',
    company: 'WeebPal',
    jobPeriod: 'Aug 2025 – present',
    current: 'Current',
    duties: [
      'Work directly in English with overseas clients and agencies to clarify requirements, confirm scope and report defects.',
      'Contribute to website projects for overseas agencies and to projects for Japanese companies in manufacturing, online learning (LMS) and digital transformation.',
      'Write requirement documents and test cases, test features and APIs, and follow defects through to closure.',
    ],
    educationTitle: 'Education',
    education:
      'Information Technology, Ho Chi Minh City University of Foreign Languages – Information Technology (HUFLIT)',
    educationPeriod: 'Graduated 2026',
    howTitle: 'How I work',
    howIntro: 'Here’s how a requirement usually goes through my hands.',
    steps: [
      {
        icon: 'message',
        title: 'Clarify the requirement',
        text: 'Ask the client until the scope is clear, and write down what we agreed.',
      },
      {
        icon: 'testing',
        title: 'Write documents and test cases',
        text: 'Turn the requirement into documentation and concrete test cases.',
      },
      {
        icon: 'code',
        title: 'Test',
        text: 'Test features and APIs on real builds and record how to reproduce each defect.',
      },
      {
        icon: 'history',
        title: 'Follow through to closure',
        text: 'Stay on each defect until it is fixed and retested, then hand over.',
      },
    ],
    skillsTitle: 'Skills',
    skillsIntro: 'Things I’ve used at work, at university and in my own apps.',
    skills: [
      {
        icon: 'testing',
        name: 'Testing',
        items: [
          'Tested the MoMo and VNPay payment APIs',
          'NUnit unit tests, Excel reports',
          'Built my own website QA tool',
        ],
      },
      {
        icon: 'code',
        name: 'Web',
        items: [
          'ASP.NET MVC',
          'Entity Framework',
          'Java web',
          'Drupal',
          'PHP',
          'API integration',
        ],
      },
      {
        icon: 'phone',
        name: 'Apps',
        items: ['C#/WPF', 'Electron', 'Flutter', 'Android Studio'],
      },
      {
        icon: 'database',
        name: 'Databases',
        items: ['SQL Server', 'MongoDB', 'Firebase Realtime Database'],
      },
      {
        icon: 'braces',
        name: 'Languages',
        items: ['C#', 'Java', 'PHP', 'Python'],
      },
      {
        icon: 'terminal',
        name: 'Systems & tools',
        items: ['Linux', 'Networking', 'Git', 'GitHub', 'GitLab'],
      },
      {
        icon: 'chip',
        name: 'IoT',
        items: ['Arduino', 'ESP32', 'ThingSpeak', 'Firebase'],
      },
    ],
    journeyTitle: 'My journal',
    journeyKinds: { study: 'Study', work: 'Work', release: 'Release' },
    journey: [
      {
        kind: 'work',
        year: 2025,
        date: '2025-08',
        label: 'Aug 2025',
        title: 'Started as a BA/QC at WeebPal',
        text: 'Working in English with overseas clients, including Japanese companies.',
      },
      {
        kind: 'study',
        year: 2026,
        title: 'Graduated in Information Technology, HUFLIT',
      },
    ],
    releaseTitle: 'Released Pet Desktop {version}: {title}',
    releaseCount: '{count} Pet Desktop releases have notes on ChiloLab.',
    coursesTitle: 'Courses',
    courses: [
      'Basic Network Administration (ACBN)',
      'Cisco Network Administration (CCNA programme)',
      'Linux Master open-source administration',
    ],
    coursesNote:
      'Course completion certificates from the Athena training center.',
    builtTitle: 'Things I built',
    builtIntro:
      'Two apps I wrote from scratch, released here and improved with your feedback.',
    languagesTitle: 'Languages',
    english: 'English: I use it every day working with overseas clients.',
    toeicLabel: 'TOEIC',
    toeicAlt:
      'Nguyễn Tấn Phát’s TOEIC certificate, with personal details blurred',
    toeicOpen: 'Open the full-size certificate',
    contactTitle: 'Let’s talk',
    contactText:
      'Want to talk about work, ask about a project or share feedback on the apps? Drop me an email; I read every one.',
  },
};
