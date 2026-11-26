// Editor layout and page-like previews for Sveltia CMS (loaded by boot.js
// once the CMS script has run).
//
// - The entry editor shows the form alone, full width like a page. A
//   "Xem trước" button next to Save swaps the form for a full-width preview
//   that uses the public site's stylesheet, with the unsaved changes; the
//   same button ("Quay lại sửa") returns to the form.
// - Projects, version notes and the privacy policy get preview templates
//   built from the same classes as the public pages (src/components).
//
// Sveltia has no API for toolbar buttons, so the button is added next to
// its Save button; if a CMS upgrade changes that markup, the button simply
// does not appear and the CMS keeps its own side-by-side preview.

const CMS = window.CMS;
const h = CMS.React.createElement;
const ui = document.documentElement.lang === 'en' ? 'en' : 'vi';
const text = {
  vi: {
    preview: 'Xem trước',
    back: 'Quay lại sửa',
    note: 'Bản xem trước, chưa lưu',
    status: {
      released: 'Đã phát hành',
      preview: 'Bản xem trước',
      development: 'Đang phát triển',
    },
  },
  en: {
    preview: 'Preview',
    back: 'Back to editing',
    note: 'Preview, not saved yet',
    status: {
      released: 'Released',
      preview: 'Preview',
      development: 'In development',
    },
  },
}[ui];

// ---------- Layout: form alone, or preview alone ----------

const style = document.createElement('style');
style.textContent = `
  .content-editor .content-area > .resizable-pane-group > .resizable-pane:first-of-type {
    flex: 1 1 100% !important;
  }
  .content-editor .content-area > .resizable-pane-group > :not(.resizable-pane),
  .content-editor .content-area > .resizable-pane-group > .resizable-pane:not(:first-of-type) {
    display: none !important;
  }
  html.cms-preview .content-editor .content-area > .resizable-pane-group > .resizable-pane:first-of-type {
    display: none !important;
  }
  html.cms-preview .content-editor .content-area > .resizable-pane-group > .resizable-pane:last-of-type {
    display: block !important;
    flex: 1 1 100% !important;
  }
  .content-editor .content-area > .resizable-pane-group > .resizable-pane:first-of-type > * {
    max-width: 920px;
    margin-inline: auto;
  }
  .content-editor .content-area > .swap-button { display: none !important; }
  .chilolab-preview-button { margin-inline-end: 8px; }
`;
document.head.append(style);

function setPreview(on) {
  document.documentElement.classList.toggle('cms-preview', on);
  for (const button of document.querySelectorAll('.chilolab-preview-button'))
    button.querySelector('.label-text').textContent = on
      ? text.back
      : text.preview;
}

function addButton() {
  const editor = document.querySelector('.content-editor');
  if (!editor) {
    // Left the editor: the next entry opens on the form.
    if (document.documentElement.classList.contains('cms-preview'))
      setPreview(false);
    return;
  }
  if (editor.querySelector('.chilolab-preview-button')) return;
  const panes = editor.querySelectorAll(
    '.content-area > .resizable-pane-group > .resizable-pane',
  );
  const save = [...editor.querySelectorAll('[role="toolbar"] button')].find(
    (button) =>
      button.dataset.label === 'Save' || button.textContent.trim() === 'Save',
  );
  // No preview pane (turned off in the ⋮ menu) or no Save button: keep
  // Sveltia's own layout instead of hiding anything.
  if (!save || panes.length < 2) {
    style.disabled = true;
    return;
  }
  style.disabled = false;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = [...save.classList]
    .filter((name) => name !== 'primary')
    .concat('secondary', 'chilolab-preview-button')
    .join(' ');
  const label = document.createElement('span');
  label.className = 'label-text';
  button.append(label);
  button.addEventListener('click', () =>
    setPreview(!document.documentElement.classList.contains('cms-preview')),
  );
  save.before(button);
  setPreview(false);
}

new MutationObserver(addButton).observe(document.body, {
  childList: true,
  subtree: true,
});

// ---------- Previews that look like the public pages ----------

// The site's stylesheet has a hashed name; read it from the homepage.
fetch('/', { credentials: 'same-origin' })
  .then((response) => response.text())
  .then((html) => {
    for (const [, href] of html.matchAll(
      /<link rel="stylesheet" href="(\/_astro\/[^"]+\.css)"/g,
    ))
      CMS.registerPreviewStyle(href);
  })
  .catch(() => {});

const value = (entry, ...path) => {
  const found = entry.getIn(['data', ...path]);
  return found && typeof found.toJS === 'function' ? found.toJS() : found;
};

const header = () =>
  h(
    'header',
    { className: 'header wrap' },
    h('span', { className: 'brand' }, 'ChiloLab'),
    h('span', { className: 'version-status' }, text.note),
  );

const page = (...children) =>
  h(
    'div',
    { className: 'chilolab-preview' },
    header(),
    h('main', null, ...children),
  );

function ProjectPreview({ entry, widgetFor, getAsset }) {
  const preview = value(entry, 'preview');
  const gallery = value(entry, 'gallery') ?? [];
  const install = value(entry, 'install') ?? [];
  const image = preview?.image
    ? getAsset(preview.image)?.toString()
    : undefined;
  return page(
    h(
      'div',
      { className: 'project-detail wrap' },
      h(
        'header',
        { className: 'detail-heading' },
        h('h1', null, value(entry, 'title')),
        h('p', { className: 'lead' }, value(entry, 'description')),
      ),
      value(entry, 'downloadNote') &&
        h(
          'section',
          { className: 'download-panel' },
          h(
            'p',
            { className: 'download-note' },
            h('span', null, value(entry, 'downloadNote')),
          ),
        ),
      image &&
        h(
          'figure',
          { className: 'project-video' },
          h(
            'div',
            { className: 'window' },
            h('img', {
              src: image,
              alt: preview.alt ?? '',
              style: { width: '100%', display: 'block' },
            }),
          ),
          preview.caption && h('figcaption', null, preview.caption),
        ),
      gallery.length > 0 &&
        h(
          'section',
          { className: 'project-gallery' },
          h(
            'ul',
            null,
            ...gallery.map((shot) =>
              h(
                'li',
                null,
                h('img', {
                  src: getAsset(shot.image)?.toString(),
                  alt: shot.alt ?? '',
                }),
              ),
            ),
          ),
        ),
      install.length > 0 &&
        h(
          'section',
          { className: 'install' },
          h(
            'ol',
            { className: 'steps install-steps' },
            ...install.map((step, index) =>
              h(
                'li',
                null,
                h('h3', null, `${index + 1}. ${step.title ?? ''}`),
                h('p', null, step.text ?? ''),
              ),
            ),
          ),
        ),
      h(
        'div',
        { className: 'detail-body' },
        h('article', { className: 'prose' }, widgetFor('body')),
      ),
    ),
  );
}

function VersionPreview({ entry, widgetFor }) {
  return page(
    h(
      'div',
      { className: 'wrap version-page' },
      h(
        'header',
        { className: 'detail-heading' },
        h(
          'div',
          { className: 'version-meta' },
          h(
            'span',
            { className: 'version-status' },
            text.status[value(entry, 'status')] ?? value(entry, 'status'),
          ),
          value(entry, 'releasedAt') &&
            h('span', null, String(value(entry, 'releasedAt'))),
        ),
        h('h1', null, `v${value(entry, 'version') ?? ''}`),
        h('p', { className: 'version-title' }, value(entry, 'title')),
        h('p', { className: 'lead' }, value(entry, 'summary')),
      ),
      h('article', { className: 'prose version-article' }, widgetFor('body')),
    ),
  );
}

function PrivacyPreview({ entry, widgetFor }) {
  return page(
    h(
      'article',
      { className: 'wrap prose privacy-page' },
      h('h1', null, value(entry, 'title')),
      value(entry, 'lead') &&
        h('p', { className: 'lead' }, value(entry, 'lead')),
      widgetFor('body'),
    ),
  );
}

// The About page's main parts: hero, experience, skills and contact. The
// live page also follows the section order set under Interface text.
function ProfilePreview({ entry, getAsset }) {
  const facts = value(entry, 'facts') ?? [];
  const duties = value(entry, 'duties') ?? [];
  const skills = value(entry, 'skills') ?? [];
  const portrait = value(entry, 'portrait');
  return page(
    h(
      'div',
      { className: 'desk' },
      h(
        'section',
        { className: 'about-hero wrap' },
        h(
          'div',
          { className: 'about-hero-copy' },
          h('h1', null, value(entry, 'heading')),
          h('p', { className: 'lead' }, value(entry, 'lead')),
          h(
            'ul',
            { className: 'fact-list' },
            ...facts.map((fact) => h('li', null, fact.text)),
          ),
        ),
        portrait &&
          h('img', {
            src: getAsset(portrait)?.toString(),
            alt: '',
            style: { width: '240px', borderRadius: '50%' },
          }),
      ),
    ),
    h(
      'section',
      { className: 'about-block wrap' },
      h('h2', null, value(entry, 'experienceTitle')),
      h(
        'div',
        { className: 'job' },
        h('strong', null, value(entry, 'role')),
        ` · ${value(entry, 'company') ?? ''} · ${value(entry, 'jobPeriod') ?? ''}`,
        h('ul', null, ...duties.map((duty) => h('li', null, duty))),
      ),
    ),
    h(
      'section',
      { className: 'about-block wrap' },
      h('h2', null, value(entry, 'skillsTitle')),
      h('p', null, value(entry, 'skillsIntro')),
      ...skills.map((group) =>
        h(
          'div',
          null,
          h('h3', null, group.name),
          h(
            'ul',
            null,
            ...(group.items ?? []).map((item) => h('li', null, item)),
          ),
        ),
      ),
    ),
    h(
      'section',
      { className: 'contact wrap' },
      h('h2', null, value(entry, 'contactTitle')),
      h('p', null, value(entry, 'contactText')),
    ),
  );
}

// Interface text: the header menu, the homepage copy and the footer.
function UiPreview({ entry }) {
  const site = value(entry, 'site') ?? {};
  const menu = value(entry, 'menu') ?? {};
  const year = String(new Date().getFullYear());
  return h(
    'div',
    { className: 'chilolab-preview' },
    h(
      'header',
      { className: 'header wrap' },
      h('span', { className: 'brand' }, site.brand),
      h(
        'nav',
        null,
        ...(menu.header ?? []).map((link) =>
          h('a', { href: '#', key: link.href }, link.label),
        ),
        h('a', { className: 'language', href: '#' }, site.switch),
      ),
    ),
    h(
      'main',
      null,
      h(
        'section',
        { className: 'desk' },
        h(
          'div',
          { className: 'hero home-hero wrap' },
          h(
            'div',
            { className: 'hero-copy' },
            h('span', { className: 'version-status' }, text.note),
            h('h1', null, site.title),
            h('p', { className: 'lead' }, site.intro),
          ),
        ),
      ),
      h(
        'section',
        { className: 'projects wrap' },
        h(
          'div',
          { className: 'section-heading' },
          h('h2', null, site.projects),
          h('p', null, site.selected),
        ),
      ),
      h(
        'section',
        { className: 'about wrap' },
        h('h2', null, site.about),
        h('p', null, site.aboutText),
      ),
    ),
    h(
      'footer',
      { className: 'footer' },
      h(
        'div',
        { className: 'wrap footer-grid' },
        h(
          'div',
          { className: 'footer-brand' },
          h('span', { className: 'brand' }, site.brand),
          h('p', null, site.footer),
        ),
        h(
          'nav',
          null,
          h('p', { className: 'footer-title' }, menu.projectsTitle),
        ),
        ...(menu.footer ?? []).map((column) =>
          h(
            'nav',
            null,
            h('p', { className: 'footer-title' }, column.title),
            h(
              'ul',
              null,
              ...(column.links ?? []).map((link) =>
                h('li', null, h('a', { href: '#' }, link.label)),
              ),
            ),
          ),
        ),
      ),
      h(
        'div',
        { className: 'wrap footer-bottom' },
        h('span', null, (site.copyright ?? '').replace('{year}', year)),
      ),
    ),
  );
}

for (const locale of ['vi', 'en']) {
  CMS.registerPreviewTemplate(`profile_${locale}`, ProfilePreview);
  CMS.registerPreviewTemplate(`ui_${locale}`, UiPreview);
  CMS.registerPreviewTemplate(`projects_${locale}`, ProjectPreview);
  CMS.registerPreviewTemplate(`pet_versions_${locale}`, VersionPreview);
  CMS.registerPreviewTemplate(`auditor_versions_${locale}`, VersionPreview);
  CMS.registerPreviewTemplate(`privacy_site_${locale}`, PrivacyPreview);
  CMS.registerPreviewTemplate(`privacy_app_${locale}`, PrivacyPreview);
}
