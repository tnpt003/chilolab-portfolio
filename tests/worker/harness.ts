// Test harness for the Worker (worker/): a real SQLite database built from
// migrations/ behind a small D1-compatible wrapper, fake bindings, and a
// stubbed global fetch so no test ever reaches Resend, Turnstile or GitHub.
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../../worker/index.ts';
import { sha256 } from '../../worker/env.ts';

export const SITE = 'https://chilolab.com';
const migrations = new URL('../../migrations/', import.meta.url);

type Value = string | number | bigint | null | Uint8Array;

// Node strips types but does not transform them, so no parameter properties.
class Statement {
  db: DatabaseSync;
  sql: string;
  params: Value[];
  constructor(db: DatabaseSync, sql: string, params: Value[] = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...params: unknown[]) {
    for (const value of params)
      if (value === undefined)
        throw new Error(`D1: undefined bound in ${this.sql}`);
    return new Statement(
      this.db,
      this.sql,
      params.map((value) =>
        typeof value === 'boolean' ? Number(value) : (value as Value),
      ),
    );
  }
  async first<T>(column?: string): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params) as
      Record<string, unknown> | undefined;
    if (!row) return null;
    return (column ? row[column] : { ...row }) as T;
  }
  async all<T>() {
    const results = this.db
      .prepare(this.sql)
      .all(...this.params)
      .map((row) => ({ ...row })) as T[];
    return { results, success: true, meta: {} };
  }
  async run() {
    const info = this.db.prepare(this.sql).run(...this.params);
    return {
      success: true,
      meta: {
        changes: Number(info.changes),
        last_row_id: Number(info.lastInsertRowid),
      },
    };
  }
  async raw() {
    return this.db
      .prepare(this.sql)
      .all(...this.params)
      .map((row) => Object.values(row));
  }
}

export function database() {
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync(migrations)
    .filter((f) => f.endsWith('.sql'))
    .sort())
    db.exec(readFileSync(new URL(file, migrations), 'utf8'));
  db.exec('PRAGMA foreign_keys = ON');
  const d1 = {
    prepare: (sql: string) => new Statement(db, sql),
    async batch(statements: Statement[]) {
      db.exec('BEGIN');
      try {
        const results = [];
        // D1 gives every result rows and meta.changes; reads and RETURNING
        // need all(), plain writes need run() for the change count.
        for (const statement of statements)
          results.push(
            /^\s*(SELECT|WITH)\b|\bRETURNING\b/i.test(statement.sql)
              ? await statement.all()
              : { results: [], ...(await statement.run()) },
          );
        db.exec('COMMIT');
        return results;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    async exec(sql: string) {
      db.exec(sql);
      return { count: 0, duration: 0 };
    },
  };
  return { db, d1 };
}

/** What the build writes to dist/ (src/pages/allowlist.json.ts, releases.json.ts). */
export const allowlist = {
  projects: ['pet-desktop', 'pagespeed-auth-auditor'],
  versions: { 'pet-desktop': ['1.5.2'], 'pagespeed-auth-auditor': ['1.2.2'] },
  downloads: { 'pet-desktop': { '1.5.2': ['setup', 'portable'] } },
};
const copy = (title: string) => ({ title, path: '/pet-desktop' });
export const releases = {
  'pet-desktop': {
    vi: copy('Pet Desktop'),
    en: copy('Pet Desktop'),
    releases: [{ version: '1.5.2', vi: copy('1.5.2'), en: copy('1.5.2') }],
  },
};

export type Sent = { url: string; body: unknown };

/** In-memory R2 bucket with the calls the Worker makes. */
export function bucket() {
  const objects = new Map<
    string,
    { bytes: Uint8Array; uploaded: Date; httpMetadata?: unknown }
  >();
  return {
    objects,
    async put(
      key: string,
      value: ArrayBuffer | Uint8Array,
      options: { httpMetadata?: unknown } = {},
    ) {
      objects.set(key, {
        bytes: new Uint8Array(value),
        uploaded: new Date(),
        httpMetadata: options.httpMetadata,
      });
    },
    async get(key: string) {
      const object = objects.get(key);
      return object
        ? { body: new Blob([object.bytes]).stream(), ...object }
        : null;
    },
    async delete(keys: string | string[]) {
      for (const key of [keys].flat()) objects.delete(key);
    },
    async list({ prefix = '' } = {}) {
      return {
        objects: [...objects]
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, object]) => ({ key, uploaded: object.uploaded })),
      };
    },
  };
}

/** An unsigned ID token, as Google's token endpoint would return it. */
export const idToken = (claims: Record<string, unknown>) =>
  ['{"alg":"none"}', JSON.stringify(claims)]
    .map((part) => Buffer.from(part).toString('base64url'))
    .join('.') + '.sig';

export function setup(options: { env?: Record<string, unknown> } = {}) {
  const { db, d1 } = database();
  const outbound: Sent[] = [];
  let resendOk = true;
  /** What Google's token endpoint answers (null: an HTTP error). */
  let google: Record<string, unknown> | null = null;
  const fetchStub = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    let body: unknown = init?.body;
    if (typeof body === 'string') body = JSON.parse(body);
    if (body instanceof FormData || body instanceof URLSearchParams)
      body = Object.fromEntries(body);
    outbound.push({ url, body });
    if (url.startsWith('https://challenges.cloudflare.com/'))
      return Response.json({
        success: (body as Record<string, string>).response === 'human',
      });
    if (url.startsWith('https://api.resend.com/'))
      return resendOk
        ? Response.json({ id: 'test' })
        : new Response('quota', { status: 429 });
    if (url === 'https://oauth2.googleapis.com/token')
      return google
        ? Response.json(google)
        : new Response('bad code', { status: 400 });
    if (url.startsWith('https://api.github.com/'))
      return new Response('offline in tests', { status: 503 });
    throw new Error(`Unexpected outbound fetch in a test: ${url}`);
  };
  globalThis.fetch = fetchStub as typeof fetch;
  // Workers Cache API (worker/github.ts); always a miss here.
  (globalThis as Record<string, unknown>).caches = {
    default: { match: async () => undefined, put: async () => {} },
  };

  const env = {
    DB: d1,
    ASSETS: {
      async fetch(input: RequestInfo | URL) {
        const path = new URL(input instanceof Request ? input.url : input)
          .pathname;
        if (path === '/allowlist.json') return Response.json(allowlist);
        if (path === '/releases.json') return Response.json(releases);
        return new Response(`asset ${path}`, { status: 200 });
      },
    },
    AI: {
      async run() {
        throw new Error('Workers AI is not available in tests');
      },
    },
    WRITE_LIMIT: { limit: async () => ({ success: true }) },
    MAIL_FROM: 'ChiloLab <no-reply@chilolab.com>',
    RESEND_API_KEY: 'test-resend',
    TURNSTILE_SECRET: 'test-turnstile',
    CMS_GITHUB_TOKEN: 'github-token-secret',
    ...options.env,
  };

  // The Worker logs expected failures (GitHub offline, AI missing); keep
  // them out of the test output but available to assertions.
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => void logged.push(args);

  const waiting: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (promise: Promise<unknown>) => void waiting.push(promise),
    passThroughOnException() {},
    props: {},
  };

  async function call(
    path: string,
    init: {
      method?: string;
      cookie?: string;
      body?: unknown;
      /** Sent as a form (URLSearchParams) or multipart (FormData) body. */
      form?: FormData | URLSearchParams;
      origin?: string | null;
      headers?: Record<string, string>;
      host?: string;
    } = {},
  ) {
    const method =
      init.method ??
      (init.body === undefined && init.form === undefined ? 'GET' : 'POST');
    const base = init.host ?? SITE;
    const headers = new Headers(init.headers);
    if (init.cookie) headers.set('Cookie', init.cookie);
    // Browsers send Origin on same-site POSTs; null leaves it out.
    if (method !== 'GET' && init.origin !== null)
      headers.set('Origin', init.origin ?? base);
    let body: BodyInit | undefined = init.form;
    if (init.body !== undefined) {
      body = JSON.stringify(init.body);
      headers.set('Content-Type', 'application/json');
    }
    const response = await worker.fetch(
      new Request(new URL(path, base), {
        method,
        headers,
        body,
        redirect: 'manual',
      }),
      env as never,
      ctx as never,
    );
    await Promise.all(waiting.splice(0));
    return response;
  }

  function addUser(email: string, role: 'member' | 'owner' = 'member') {
    const row = db
      .prepare(
        'INSERT INTO users (email, display_name, role) VALUES (?, ?, ?) RETURNING id',
      )
      .get(email, email.split('@')[0], role) as { id: number };
    return row.id;
  }

  /** A session row as createSession writes it; returns the Cookie header. */
  async function session(
    userId: number,
    { ageDays = 0, expiresInDays = 7 } = {},
  ) {
    const token = `token-${userId}-${Math.random().toString(36).slice(2)}`;
    const at = (days: number) =>
      new Date(Date.now() + days * 86400_000)
        .toISOString()
        .replace(/\.\d+Z$/, 'Z');
    db.prepare(
      'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
    ).run(await sha256(token), userId, at(-ageDays), at(expiresInDays));
    return `__Host-chilolab_session=${token}`;
  }

  return {
    db,
    env,
    ctx,
    outbound,
    logged,
    call,
    addUser,
    session,
    failResend: () => void (resendOk = false),
    googleAnswers: (answer: Record<string, unknown> | null) =>
      void (google = answer),
    resendMails: () =>
      outbound.filter((sent) => sent.url.startsWith('https://api.resend.com/')),
  };
}

/** The session cookie a response sets, as a Cookie header. */
export function sessionCookie(response: Response) {
  const set = response.headers
    .getSetCookie()
    .find((c) => c.startsWith('__Host-chilolab_session='));
  return set?.split(';')[0];
}
