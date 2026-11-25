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
          caption: z.string().min(1),
        })
        .optional(),
      video: z
        .string()
        .regex(/^\/media\/[a-z0-9-]+\.mp4$/)
        .optional(),
      // One short line under the Download button (e.g. SmartScreen).
      downloadNote: z.string().min(1).optional(),
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

export const collections = { projects, versions };
