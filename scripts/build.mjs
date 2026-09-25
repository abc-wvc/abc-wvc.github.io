// Builds the showcase into dist/. It checks every students/<handle>/profile.json and writes one
// static page: no scripts run in visitors' browsers. Every piece of student text is escaped, every
// link must be https, and anything that looks private (a G number, an email, a phone number) stops
// the build. Run: node scripts/build.mjs        Check only: node scripts/build.mjs --check
import { readdir, readFile, writeFile, mkdir, copyFile, lstat, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = 'https://github.com/abc-wvc/abc-wvc.github.io';
export const SITE = 'https://abc-wvc.pages.dev';

export const LIMITS = {
  name: 40, major: 60, about: 280, title: 60, summary: 200, url: 300,
  projects: 6, tags: 5, tag: 20, profileBytes: 20 * 1024, imageBytes: 500 * 1024,
};
const HANDLE = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/;
const GITHUB_USER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const IMAGE_NAME = /^[a-z0-9][a-z0-9._-]{0,60}\.(png|jpe?g|webp)$/i;
const TAG = /^[a-z0-9][a-z0-9 +#.-]*$/i;
// Invisible, control and text-reversing characters: nothing a person needs, and they can hide text.
const UNSAFE_RANGES = [
  [0x0, 0x1f], [0x7f, 0x9f], [0xad, 0xad], [0x200b, 0x200f], [0x2028, 0x202e], [0x2060, 0x2064], [0x2066, 0x2069], [0xfeff, 0xfeff],
];
// Written as numbers on purpose: some editors turn escaped characters into real ones, which breaks a regex.
function hasUnsafe(value) {
  for (const ch of value) {
    const c = ch.codePointAt(0);
    if (UNSAFE_RANGES.some(([a, b]) => c >= a && c <= b)) return true;
  }
  return false;
}
// Never published: school ids, emails, phone numbers. Officers check for anything else in review.
const PRIVATE = [
  [/\bG\s*-?\s*\d{8}\b/i, 'a G number'],
  [/[^\s@<>()]+@[^\s@<>()]+\.[a-z]{2,}/i, 'an email address'],
  [/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/, 'a phone number'],
];
const PROFILE_KEYS = ['name', 'major', 'about', 'github', 'projects'];
const PROJECT_KEYS = ['title', 'summary', 'link', 'code', 'image', 'tags'];

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function text(where, value, max, errors, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) errors.push(`${where} is missing.`);
    return undefined;
  }
  if (typeof value !== 'string') {
    errors.push(`${where} must be text in quotes.`);
    return undefined;
  }
  const v = value.trim().replace(/\s+/g, ' ');
  if (!v) {
    if (required) errors.push(`${where} is empty.`);
    return undefined;
  }
  if (v.length > max) errors.push(`${where} is ${v.length} characters; the most is ${max}.`);
  if (hasUnsafe(v)) errors.push(`${where} has an invisible or control character. Retype it.`);
  for (const [pattern, kind] of PRIVATE) {
    if (pattern.test(v)) errors.push(`${where} looks like it has ${kind}. Nothing private goes on the showcase.`);
  }
  return v;
}

function link(where, value, errors) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.length > LIMITS.url) {
    errors.push(`${where} must be a link of at most ${LIMITS.url} characters.`);
    return undefined;
  }
  let u;
  try {
    u = new URL(value.trim());
  } catch {
    errors.push(`${where} is not a full link (it should start with https://).`);
    return undefined;
  }
  if (u.protocol !== 'https:') errors.push(`${where} must start with https://.`);
  if (u.username || u.password) errors.push(`${where} must not contain a user name or password.`);
  for (const [pattern, kind] of PRIVATE) {
    if (pattern.test(decodeURIComponent(u.href))) errors.push(`${where} looks like it has ${kind}.`);
  }
  return u.href;
}

function onlyKeys(where, obj, allowed, errors) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) errors.push(`${where} has a field the showcase does not use: "${key}". Remove it.`);
  }
}

// images: the names of the files in students/<handle>/images that passed the file checks.
export function validateProfile(handle, raw, images = new Set()) {
  const errors = [];
  const at = `students/${handle}/profile.json`;
  if (!HANDLE.test(handle)) {
    errors.push(`The folder name "${handle}" must be lowercase letters, numbers and dashes (like ada-l).`);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: [...errors, `${at} must be one { ... } object.`] };
  }
  onlyKeys(at, raw, PROFILE_KEYS, errors);
  const value = {
    handle,
    name: text(`${at}: name`, raw.name, LIMITS.name, errors, { required: true }),
    major: text(`${at}: major`, raw.major, LIMITS.major, errors),
    about: text(`${at}: about`, raw.about, LIMITS.about, errors),
    github: undefined,
    projects: [],
  };
  if (raw.github !== undefined && raw.github !== '') {
    if (typeof raw.github === 'string' && GITHUB_USER.test(raw.github.trim().replace(/^@/, ''))) value.github = raw.github.trim().replace(/^@/, '');
    else errors.push(`${at}: github must be your GitHub username, like ada-lovelace.`);
  }
  if (!Array.isArray(raw.projects) || raw.projects.length === 0) {
    errors.push(`${at}: projects must list at least one project.`);
  } else if (raw.projects.length > LIMITS.projects) {
    errors.push(`${at}: projects lists ${raw.projects.length}; the most is ${LIMITS.projects}.`);
  } else {
    raw.projects.forEach((p, i) => {
      const where = `${at}: project ${i + 1}`;
      if (!p || typeof p !== 'object' || Array.isArray(p)) {
        errors.push(`${where} must be one { ... } object.`);
        return;
      }
      onlyKeys(where, p, PROJECT_KEYS, errors);
      const project = {
        title: text(`${where} title`, p.title, LIMITS.title, errors, { required: true }),
        summary: text(`${where} summary`, p.summary, LIMITS.summary, errors),
        link: link(`${where} link`, p.link, errors),
        code: link(`${where} code`, p.code, errors),
        image: undefined,
        tags: [],
      };
      if (p.image !== undefined && p.image !== '') {
        if (typeof p.image !== 'string' || !IMAGE_NAME.test(p.image)) {
          errors.push(`${where} image must be a file name like screenshot.png (PNG, JPG or WebP).`);
        } else if (!images.has(p.image)) {
          errors.push(`${where} image "${p.image}" is not in students/${handle}/images/. Add it there, or remove the image line.`);
        } else {
          project.image = p.image;
        }
      }
      if (p.tags !== undefined) {
        if (!Array.isArray(p.tags) || p.tags.length > LIMITS.tags) {
          errors.push(`${where} tags must be a list of at most ${LIMITS.tags}.`);
        } else {
          for (const t of p.tags) {
            if (typeof t !== 'string' || !TAG.test(t.trim()) || t.trim().length > LIMITS.tag) {
              errors.push(`${where} tag "${t}" must be a short word or two (letters, numbers, + # . -).`);
            } else {
              project.tags.push(t.trim().toLowerCase());
            }
          }
        }
      }
      value.projects.push(project);
    });
  }
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

// The first bytes of each allowed image type, so a renamed file of another kind is refused.
function looksLikeImage(bytes) {
  const b = bytes;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const jpg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const webp = b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP';
  return png || jpg || webp;
}

export async function readStudents(root = ROOT) {
  const dir = join(root, 'students');
  const students = [];
  const errors = [];
  for (const entry of (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.') || entry.name === 'README.md') continue;
    const folder = join(dir, entry.name);
    const info = await lstat(folder);
    if (!info.isDirectory() || info.isSymbolicLink()) {
      errors.push(`students/${entry.name} must be a folder.`);
      continue;
    }
    const images = new Set();
    const before = errors.length; // a folder with any problem is left out, not half-published
    const imageDir = join(folder, 'images');
    let imageEntries = [];
    try {
      imageEntries = await readdir(imageDir, { withFileTypes: true });
    } catch { /* no images folder is fine */ }
    for (const img of imageEntries) {
      if (img.name.startsWith('.')) continue;
      const path = join(imageDir, img.name);
      const st = await lstat(path);
      if (!st.isFile() || st.isSymbolicLink() || !IMAGE_NAME.test(img.name)) {
        errors.push(`students/${entry.name}/images/${img.name} must be a PNG, JPG or WebP file with a simple name.`);
      } else if (st.size > LIMITS.imageBytes) {
        errors.push(`students/${entry.name}/images/${img.name} is ${Math.ceil(st.size / 1024)} KB; the most is ${LIMITS.imageBytes / 1024} KB.`);
      } else if (!looksLikeImage(await readFile(path))) {
        errors.push(`students/${entry.name}/images/${img.name} is not really a PNG, JPG or WebP image.`);
      } else {
        images.add(img.name);
      }
    }
    const profilePath = join(folder, 'profile.json');
    let raw;
    try {
      const st = await lstat(profilePath);
      if (!st.isFile() || st.isSymbolicLink()) throw new Error('not a file');
      if (st.size > LIMITS.profileBytes) {
        errors.push(`students/${entry.name}/profile.json is too big (the most is ${LIMITS.profileBytes / 1024} KB).`);
        continue;
      }
      raw = JSON.parse(await readFile(profilePath, 'utf8'));
    } catch (e) {
      errors.push(e instanceof SyntaxError
        ? `students/${entry.name}/profile.json is not valid JSON: ${e.message}`
        : `students/${entry.name}/profile.json is missing. Copy the one in students/_template.`);
      continue;
    }
    const v = validateProfile(entry.name, raw, images);
    if (!v.ok) errors.push(...v.errors);
    else if (errors.length === before) students.push(v.value);
  }
  students.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
  return { students, errors };
}

export function validateClub(raw) {
  const errors = [];
  const items = Array.isArray(raw) ? raw : [];
  if (!items.length) errors.push('club.json must list the club projects.');
  const value = items.map((p, i) => ({
    title: text(`club.json project ${i + 1} title`, p && p.title, LIMITS.title, errors, { required: true }),
    summary: text(`club.json project ${i + 1} summary`, p && p.summary, LIMITS.summary, errors),
    link: link(`club.json project ${i + 1} link`, p && p.link, errors),
  }));
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

function card(s) {
  const e = escapeHtml;
  const meta = [s.major ? e(s.major) : '', s.github ? `<a href="https://github.com/${e(s.github)}">@${e(s.github)}</a>` : '']
    .filter(Boolean).join(' <span aria-hidden="true">&middot;</span> ');
  const projects = s.projects.map((p) => {
    const title = p.link ? `<a href="${e(p.link)}">${e(p.title)}</a>` : e(p.title);
    return `<li class="project">${p.image ? `<img src="students/${e(s.handle)}/images/${e(p.image)}" alt="${e(p.title)}" loading="lazy">` : ''}
          <h4>${title}</h4>${p.summary ? `\n          <p>${e(p.summary)}</p>` : ''}${p.tags.length ? `\n          <p class="tags">${p.tags.map((t) => `<span>${e(t)}</span>`).join('')}</p>` : ''}${p.code ? `\n          <p class="code"><a href="${e(p.code)}">Code</a></p>` : ''}
        </li>`;
  }).join('\n        ');
  return `<article class="student" id="${e(s.handle)}">
      <h3>${e(s.name)}</h3>${meta ? `\n      <p class="meta">${meta}</p>` : ''}${s.about ? `\n      <p class="about">${e(s.about)}</p>` : ''}
      <ul class="projects">
        ${projects}
      </ul>
      <p class="folder"><a href="${REPO}/tree/main/students/${e(s.handle)}">${e(s.name.split(' ')[0])}'s folder on GitHub</a></p>
    </article>`;
}

export function renderPage(students, club) {
  const e = escapeHtml;
  const clubTiles = club.map((p) => `<a class="tile" href="${e(p.link)}"><span class="tile-title">${e(p.title)}</span>${p.summary ? `<span class="tile-body">${e(p.summary)}</span>` : ''}</a>`).join('\n        ');
  const members = students.length
    ? `<div class="students">\n    ${students.map(card).join('\n    ')}\n    </div>`
    : `<div class="empty">
        <h3>No member projects yet</h3>
        <p>Be the first: add a folder with your name and what you built. It takes about ten minutes on github.com, no install needed.</p>
        <p><a class="btn primary" href="${REPO}#add-your-project">Add your project</a></p>
      </div>`;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'">
  <meta name="referrer" content="no-referrer">
  <title>Member projects | AI Builders Club</title>
  <meta name="description" content="What members of the AI Builders Club at West Valley College are building.">
  <meta property="og:title" content="Member projects | AI Builders Club">
  <meta property="og:description" content="What members of the AI Builders Club at West Valley College are building.">
  <meta property="og:image" content="https://abc-wvc.github.io/og.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="color-scheme" content="dark light">
  <link rel="icon" href="favicon-32.png" sizes="32x32" type="image/png">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="site-header">
    <a class="brand" href="${SITE}"><img src="emblem-64.png" alt="" width="32" height="32"><span class="wordmark">AI Builders Club</span></a>
    <nav class="tabs" aria-label="Club"><a href="${SITE}">Club website</a><a href="${SITE}/join">Join</a></nav>
  </header>
  <main>
    <section class="hero">
      <p class="kicker">West Valley College</p>
      <h1>Member projects</h1>
      <p class="lede">What members of the AI Builders Club are building. Every folder here was added by the student who made it.</p>
      <p class="cta"><a class="btn primary" href="${REPO}#add-your-project">Add your project</a> <a class="btn" href="${SITE}/join">Join the club</a></p>
    </section>

    <section aria-labelledby="h-members">
      <h2 id="h-members">Members</h2>
      ${members}
    </section>

    <section aria-labelledby="h-club">
      <h2 id="h-club">Built by the club</h2>
      <div class="tiles">
        ${clubTiles}
      </div>
    </section>
  </main>
  <footer class="site-footer">
    <p><a href="${SITE}">Club website</a> <a href="https://linktr.ee/abc.wvc.club">Linktree</a> <a href="https://discord.gg/h99K887zd4">Discord</a> <a href="https://www.instagram.com/abc.wvc/">Instagram</a> <a href="https://www.tiktok.com/@abc.wvc">TikTok</a> <a href="https://www.youtube.com/@abc-wvc">YouTube</a> <a href="${REPO}">This page on GitHub</a></p>
    <p>AI Builders Club, a registered student club at West Valley College. Each student owns what is in their folder.</p>
  </footer>
</body>
</html>
`;
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const { students, errors } = await readStudents();
  const clubCheck = validateClub(JSON.parse(await readFile(join(ROOT, 'club.json'), 'utf8')));
  if (!clubCheck.ok) errors.push(...clubCheck.errors);
  if (errors.length) {
    console.error(`The showcase has ${errors.length} problem${errors.length === 1 ? '' : 's'} to fix:\n`);
    for (const m of errors) console.error(`- ${m}`);
    process.exit(1);
  }
  console.log(`Checked ${students.length} student folder${students.length === 1 ? '' : 's'}: all good.`);
  if (checkOnly) return;
  const dist = join(ROOT, 'dist');
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  await writeFile(join(dist, 'index.html'), renderPage(students, clubCheck.value));
  await writeFile(join(dist, 'students.json'), JSON.stringify(students, null, 2) + '\n');
  for (const f of await readdir(join(ROOT, 'site'))) await copyFile(join(ROOT, 'site', f), join(dist, f));
  for (const s of students) {
    for (const p of s.projects) {
      if (!p.image) continue;
      await mkdir(join(dist, 'students', s.handle, 'images'), { recursive: true });
      await copyFile(join(ROOT, 'students', s.handle, 'images', p.image), join(dist, 'students', s.handle, 'images', p.image));
    }
  }
  console.log(`Built dist/ with ${students.length} student${students.length === 1 ? '' : 's'}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
