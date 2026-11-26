import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

const projects = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/projects',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      locale: z.enum(['vi', 'en']),
      description: z.string(),
      kind: z.enum(['pet', 'auditor']),
      order: z.number(),
      // Technologies shown as tags on the homepage and About page.
      stack: z.array(z.string().min(1)).default([]),
      draft: z.boolean().default(false),
      preview: z
        .object({
          image: image(),
          alt: z.string().min(1),
          caption: z.string().min(1).optional(),
        })
        .optional(),
      video: z
        .string()
        .regex(/^\/media\/[a-z0-9-]+\.mp4$/)
        .optional(),
      // One short line under the Download button (e.g. SmartScreen).
      downloadNote: z.string().min(1).optional(),
      // Install guide shown as icon cards; **bold** marks button names.
      install: z
        .array(
          z.object({
            icon: z.enum([
              'download',
              'archive',
              'shield',
              'cat',
              'folder',
              'sparkle',
              'history',
              'message',
              'user',
              'login',
              'image',
            ]),
            title: z.string().min(1),
            text: z.string().min(1),
          }),
        )
        .default([]),
      // What the video is: length, sound, which build. Shown under it.
      videoCaption: z.string().min(1).optional(),
      // Real app captures, shown as a grid under the video.
      gallery: z
        .array(z.object({ image: image(), alt: z.string().min(1) }))
        .default([]),
      demoUrl: z.url({ protocol: /^https?$/ }).optional(),
      repoUrl: z.url({ protocol: /^https?$/ }).optional(),
      downloadUrl: z.url({ protocol: /^https?$/ }).optional(),
      // Version shown in the download panel; empty = newest release.
      featuredVersion: z
        .string()
        .regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/)
        .optional(),
    }),
});

const versions = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/versions',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z
    .object({
      project: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      version: z.string().regex(/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/),
      locale: z.enum(['vi', 'en']),
      title: z.string().min(1),
      summary: z.string().min(1),
      status: z.enum(['released', 'preview', 'development']),
      order: z.number().int().nonnegative(),
      draft: z.boolean().default(false),
      // The CMS writes unquoted YAML dates, which the parser turns into Date.
      releasedAt: z.preprocess(
        (value) =>
          value instanceof Date ? value.toISOString().slice(0, 10) : value,
        z.iso.date().optional(),
      ),
      sourceUrl: z.url({ protocol: /^https?$/ }).optional(),
      downloadUrl: z.url({ protocol: /^https?$/ }).optional(),
      portableUrl: z.url({ protocol: /^https?$/ }).optional(),
    })
    .superRefine((data, ctx) => {
      if (
        data.status !== 'released' &&
        (data.releasedAt || data.downloadUrl || data.portableUrl)
      )
        ctx.addIssue({
          code: 'custom',
          message:
            'Only released versions may have a release date or download URL.',
        });
    }),
});

// Icons the CMS may pick for About-page items (names from Icon.astro).
const icon = z.enum([
  'briefcase',
  'graduation',
  'testing',
  'code',
  'phone',
  'database',
  'braces',
  'terminal',
  'chip',
  'globe',
  'award',
  'download',
  'archive',
  'history',
  'message',
  'shield',
  'user',
  'folder',
  'sparkle',
  'branch',
  'cat',
  'image',
  'mail',
  'login',
  'network',
]);
const line = z.string().min(1);

// The About page and the homepage teaser, one YAML file per locale
// (src/content/profile/<locale>.yml), edited in the CMS.
const profile = defineCollection({
  loader: glob({
    pattern: '*.yml',
    base: './src/content/profile',
    generateId: ({ entry }) => entry.replace(/\.yml$/, ''),
  }),
  schema: z.object({
    locale: z.enum(['vi', 'en']),
    pageTitle: line,
    metaDescription: line,
    heading: line,
    lead: line,
    teaser: line,
    readMore: line,
    facts: z.array(z.object({ icon, text: line })).min(1),
    emailMe: line,
    seeProjects: line,
    github: line,
    petAlt: line,
    experienceTitle: line,
    role: line,
    company: line,
    jobPeriod: line,
    current: line,
    duties: z.array(line).default([]),
    educationTitle: line,
    education: line,
    educationPeriod: line,
    howTitle: line,
    howIntro: line,
    steps: z.array(z.object({ icon, title: line, text: line })).default([]),
    skillsTitle: line,
    skillsIntro: line,
    skills: z
      .array(z.object({ icon, name: line, items: z.array(line).min(1) }))
      .default([]),
    journeyTitle: line,
    journeyKinds: z.object({ study: line, work: line, release: line }),
    journey: z
      .array(
        z.object({
          kind: z.enum(['study', 'work']),
          year: z.number().int().min(1990).max(2100),
          // YYYY-MM or YYYY-MM-DD when the month is known. The CMS may
          // write an unquoted date, which the parser turns into Date.
          date: z.preprocess(
            (value) =>
              value instanceof Date ? value.toISOString().slice(0, 10) : value,
            z
              .string()
              .regex(/^\d{4}-\d{2}(?:-\d{2})?$/)
              .optional(),
          ),
          label: line.optional(),
          title: line,
          text: line.optional(),
        }),
      )
      .default([]),
    releaseTitle: line,
    releaseCount: line,
    coursesTitle: line,
    courses: z.array(line).default([]),
    coursesNote: line,
    builtTitle: line,
    builtIntro: line,
    languagesTitle: line,
    english: line,
    // TOEIC: leave empty until the owner has the real certificate. Must be
    // the same in both languages (checked in src/lib/content.ts).
    toeicScore: z.number().int().min(10).max(990).optional(),
    toeicYear: z.number().int().min(2000).max(2100).optional(),
    toeicLabel: line,
    toeicAlt: line,
    toeicOpen: line,
    contactTitle: line,
    contactText: line,
  }),
});

// Interface text: homepage, menu, footer, comments, feedback and sign-in
// (src/content/ui/<locale>.yml), edited in the CMS. Every key is required, so
// a missing label fails the build instead of showing an empty button.
const ui = defineCollection({
  loader: glob({
    pattern: '*.yml',
    base: './src/content/ui',
    generateId: ({ entry }) => entry.replace(/.yml$/, ''),
  }),
  schema: z.object({
    locale: z.enum(['vi', 'en']),
    site: z.object({
      projects: line,
      me: line,
      about: line,
      switch: line,
      homeTitle: line,
      title: line,
      intro: line,
      metaDescription: line,
      explore: line,
      aboutCta: line,
      hello: line,
      stack: line,
      skillsHeading: line,
      portraitAlt: line,
      selected: line,
      detail: line,
      back: line,
      aboutText: line,
      preview: line,
      footer: line,
      footerLinks: z.object({
        projects: line,
        download: line,
        versions: line,
        feedback: line,
        privacy: line,
        account: line,
      }),
      demo: line,
      repo: line,
      download: line,
    }),
    comments: z.object({
      heading: line,
      introProject: line,
      introVersion: line,
      loading: line,
      empty: line,
      loadFailed: line,
      signIn: line,
      signedInAs: line,
      placeholder: line,
      replyPlaceholder: line,
      post: line,
      cancel: line,
      save: line,
      reply: line,
      edit: line,
      remove: line,
      confirmRemove: line,
      edited: line,
      held: line,
      deleted: line,
      removed: line,
      formerUser: line,
      showReplies: line,
      hideReplies: line,
      previous: line,
      next: line,
      pageOf: line,
      pagination: line,
      count: line,
      sending: line,
      failed: line,
      rateLimited: line,
      closed: line,
      tooLong: line,
      hourlyLimit: line,
      heldNotice: line,
      versionLabel: line,
      projectLabel: line,
      authorBadge: line,
      heldOther: line,
      approve: line,
      removeOther: line,
      confirmRemoveOther: line,
      reason_profanity: line,
      reason_insult: line,
      reason_hate: line,
      reason_sexual: line,
      reason_threat: line,
      reason_spam: line,
      reason_link: line,
    }),
    feedback: z.object({
      title: line,
      intro: line,
      publicNote: line,
      kind: line,
      kinds: z.object({
        bug: line,
        idea: line,
        other: line,
      }),
      summary: line,
      summaryHint: line,
      message: line,
      messageHintBug: line,
      messageHintIdea: line,
      version: line,
      versionUnknown: line,
      os: line,
      osHint: line,
      contact: line,
      contactHint: line,
      send: line,
      sending: line,
      sent: line,
      verifying: line,
      failed: line,
      rateLimited: line,
      closed: line,
      noscript: line,
    }),
    user: z.object({
      loginTitle: line,
      loginHeading: line,
      loginIntro: line,
      google: line,
      or: line,
      emailLabel: line,
      emailPlaceholder: line,
      sendCode: line,
      codeSent: line,
      codeLabel: line,
      verify: line,
      changeEmail: line,
      resend: line,
      sending: line,
      verifying: line,
      emailErrors: z.object({
        invalid_email: line,
        invalid_code: line,
        too_many_attempts: line,
        rate_limited: line,
        verification_failed: line,
        unavailable: line,
        mail_failed: line,
        registration_closed: line,
        blocked: line,
      }),
      newAccount: line,
      agree: line,
      privacy: line,
      unavailable: line,
      errors: z.object({
        cancelled: line,
        expired: line,
        google: line,
        unavailable: line,
        registration_closed: line,
        blocked: line,
      }),
      accountTitle: line,
      signedInAs: line,
      displayName: line,
      displayNameHint: line,
      save: line,
      saved: line,
      signOut: line,
      adminLink: line,
      deleteTitle: line,
      deleteIntro: line,
      deleteButton: line,
      deleteConfirm: line,
      deleted: line,
      failed: line,
    }),
    updates: z.object({
      projectLink: line,
      title: line,
      intro: line,
      note: line,
      saved: line,
      failed: line,
      unsubscribeTitle: line,
      unsubscribeIntro: line,
      unsubscribeButton: line,
      unsubscribed: line,
      unsubscribeInvalid: line,
      manage: line,
    }),
    downloads: z.object({
      count: line,
      source: line,
    }),
  }),
});

// The privacy policy (/privacy), edited in the CMS: per locale a site part
// (title, intro, date) and an app part shown under #desktop-pet, the section
// the app's EULA points to. src/content/privacy/<locale>/<part>.md.
const privacy = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/privacy',
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z
    .object({
      locale: z.enum(['vi', 'en']),
      part: z.enum(['site', 'app']),
      title: line,
      description: line.optional(),
      lead: line.optional(),
      updatedLabel: line.optional(),
      updated: z.preprocess(
        (value) =>
          value instanceof Date ? value.toISOString().slice(0, 10) : value,
        z.iso.date().optional(),
      ),
    })
    .superRefine((data, ctx) => {
      if (
        data.part === 'site' &&
        !(data.description && data.lead && data.updatedLabel && data.updated)
      )
        ctx.addIssue({
          code: 'custom',
          message:
            'The site part needs description, lead, updatedLabel and updated.',
        });
    }),
});

export const collections = { projects, versions, profile, ui, privacy };
