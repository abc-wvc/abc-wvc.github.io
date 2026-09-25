// Tests for scripts/build.mjs. Run: npm test   (node's built-in runner, no dependencies)
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateProfile, validateClub, readStudents, renderPage, escapeHtml, opensNewTab, LIMITS } from '../scripts/build.mjs';

const good = (over = {}, project = {}) => ({
  name: 'Ada L.',
  major: 'Computer Science',
  about: 'I like building small agents.',
  github: '@ada-l',
  projects: [{ title: 'Syllabus bot', summary: 'Answers questions about a class syllabus.', link: 'https://example.com/bot', code: 'https://github.com/ada-l/syllabus-bot', tags: ['Agents', 'python'], ...project }],
  ...over,
});
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);

test('a good profile passes and is tidied', () => {
  const r = validateProfile('ada-l', good());
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.value.github, 'ada-l', 'leading @ removed');
  assert.deepEqual(r.value.projects[0].tags, ['agents', 'python']);
  assert.equal(r.value.projects[0].link, 'https://example.com/bot');
});

test('required fields and unknown fields', () => {
  assert.equal(validateProfile('ada-l', good({ name: '  ' })).ok, false);
  assert.equal(validateProfile('ada-l', good({ projects: [] })).ok, false);
  const extra = validateProfile('ada-l', good({ email: 'x' }));
  assert.equal(extra.ok, false);
  assert.match(extra.errors.join(' '), /field the showcase does not use: "email"/);
  assert.equal(validateProfile('ada-l', good({}, { phone: '1' })).ok, false, 'unknown project field');
  assert.equal(validateProfile('ada-l', null).ok, false);
  assert.equal(validateProfile('ada-l', [good()]).ok, false);
});

test('nothing private gets through', () => {
  for (const [field, value, kind] of [
    ['about', 'My G number is G01234567', /G number/],
    ['about', 'g 0123 4567 is not caught but G-01234567 is', /G number/],
    ['about', 'mail me at ada@example.com', /email/],
    ['major', 'call 408-555-0123', /phone/],
  ]) {
    const r = validateProfile('ada-l', good({ [field]: value }));
    assert.equal(r.ok, false, value);
    assert.match(r.errors.join(' '), kind, value);
  }
  const inLink = validateProfile('ada-l', good({}, { link: 'https://example.com/?who=ada@example.com' }));
  assert.equal(inLink.ok, false, 'email hidden in a link');
});

test('links must be https and plain', () => {
  for (const link of ['http://example.com', 'javascript:alert(1)', 'example.com', 'https://user:pw@example.com', `https://example.com/${'a'.repeat(LIMITS.url)}`]) {
    assert.equal(validateProfile('ada-l', good({}, { link })).ok, false, link);
  }
});

test('folder names, sizes, tags and invisible characters', () => {
  assert.equal(validateProfile('Ada_L', good()).ok, false, 'folder name');
  assert.equal(validateProfile('-ada', good()).ok, false, 'folder name');
  assert.equal(validateProfile('ada-l', good({ name: 'x'.repeat(LIMITS.name + 1) })).ok, false);
  assert.equal(validateProfile('ada-l', good({ projects: Array(LIMITS.projects + 1).fill(good().projects[0]) })).ok, false);
  assert.equal(validateProfile('ada-l', good({}, { tags: ['a', 'b', 'c', 'd', 'e', 'f'] })).ok, false);
  assert.equal(validateProfile('ada-l', good({}, { tags: ['<script>'] })).ok, false);
  const hidden = 'Ada' + String.fromCodePoint(0x202e) + 'L';
  assert.equal(validateProfile('ada-l', good({ name: hidden })).ok, false, 'text-reversing character');
  assert.equal(validateProfile('ada-l', good({ github: 'not a user!' })).ok, false);
});

test('images must be in the folder and named simply', () => {
  assert.equal(validateProfile('ada-l', good({}, { image: 'shot.png' }), new Set()).ok, false, 'missing file');
  assert.equal(validateProfile('ada-l', good({}, { image: '../../evil.png' }), new Set(['../../evil.png'])).ok, false, 'path');
  assert.equal(validateProfile('ada-l', good({}, { image: 'shot.svg' }), new Set(['shot.svg'])).ok, false, 'svg');
  assert.equal(validateProfile('ada-l', good({}, { image: 'shot.png' }), new Set(['shot.png'])).ok, true);
});

test('the page escapes everything a student writes and runs no scripts', () => {
  const r = validateProfile('ada-l', good({ name: '<script>alert(1)</script> "Ada"' }, { title: '<img src=x onerror=alert(1)>' }));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const html = renderPage([r.value], validateClub([{ title: 'Club website', link: 'https://abc-wvc.pages.dev' }]).value);
  assert.doesNotMatch(html, /<script/i, 'no script tags at all');
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &quot;Ada&quot;/);
  assert.match(html, /Content-Security-Policy" content="default-src 'none'/);
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('links to other websites open in a new tab and say so; links on this site do not', () => {
  assert.equal(opensNewTab('https://github.com/abc-wvc'), true);
  assert.equal(opensNewTab('https://abc-wvc.pages.dev/join'), true);
  assert.equal(opensNewTab('https://f1l1y.github.io/abc-neural-demos/teach-it.html'), true, 'another github.io site');
  assert.equal(opensNewTab('https://abc-wvc.github.io/hop-bot/'), false);
  assert.equal(opensNewTab('./'), false);
  const r = validateProfile('ada-l', good({}, { link: 'https://abc-wvc.github.io/syllabus-bot/' }));
  const club = validateClub([{ title: 'Club website', summary: 'Who we are.', link: 'https://abc-wvc.pages.dev' }]).value;
  for (const html of [renderPage([r.value], club), renderPage([], club)]) {
    const links = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
    assert.ok(links.length >= 10, `found ${links.length} links`);
    let away = 0;
    for (const [, attrs, inner] of links) {
      const href = attrs.match(/href="([^"]*)"/)[1].replace(/&amp;/g, '&');
      if (opensNewTab(href)) {
        away += 1;
        assert.match(attrs, / target="_blank" rel="noopener noreferrer"/, href);
        assert.match(inner, /<svg class="ext"[^>]* aria-hidden="true"/, `${href} shows the arrow`);
        assert.match(inner, /<span class="sr-only"> \(opens in a new tab\)<\/span>/, `${href} has the hint`);
      } else {
        assert.doesNotMatch(attrs, /target=/, href);
        assert.doesNotMatch(inner, /opens in a new tab/, href);
      }
    }
    assert.ok(away >= 9, `${away} links open a new tab`);
  }
  const page = renderPage([r.value], club);
  assert.match(page, /<a href="https:\/\/abc-wvc\.github\.io\/syllabus-bot\/">Syllabus bot<\/a>/, 'a project on this site stays in the tab');
  assert.match(page, /<span>Add your <span class="nowrap">project<svg/, 'the button keeps its spaces and the arrow sticks to the last word');
});

test('no students yet shows the invitation', () => {
  const html = renderPage([], validateClub([{ title: 'Club website', link: 'https://abc-wvc.pages.dev' }]).value);
  assert.match(html, /No member projects yet/);
  assert.match(html.replace(/<[^>]+>/g, ''), /Add your project \(opens in a new tab\)/, 'read as text, without the tags');
});

test('reading folders: template skipped, tricks refused, real images accepted', async () => {
  const root = await mkdtemp(join(tmpdir(), 'showcase-'));
  try {
    const put = async (path, data) => {
      await mkdir(join(root, path, '..'), { recursive: true });
      await writeFile(join(root, path), data);
    };
    await put('students/_template/profile.json', '{ not even json');
    await put('students/ada-l/profile.json', JSON.stringify(good({}, { image: 'shot.png' })));
    await put('students/ada-l/images/shot.png', PNG);
    await put('students/fake/profile.json', JSON.stringify(good({}, { image: 'shot.png' })));
    await put('students/fake/images/shot.png', 'this is text, not a picture');
    await put('students/big/profile.json', JSON.stringify(good()));
    await put('students/big/images/huge.png', Buffer.concat([PNG, Buffer.alloc(LIMITS.imageBytes)]));
    await put('students/broken/profile.json', '{ "name": ');
    await mkdir(join(root, 'students/empty'), { recursive: true });
    await symlink(join(root, 'students/ada-l'), join(root, 'students/linked'));
    const { students, errors } = await readStudents(root);
    assert.deepEqual(students.map((s) => s.handle), ['ada-l']);
    const all = errors.join('\n');
    assert.match(all, /fake\/images\/shot\.png is not really/);
    assert.match(all, /big\/images\/huge\.png is \d+ KB/);
    assert.match(all, /broken\/profile\.json is not valid JSON/);
    assert.match(all, /empty\/profile\.json is missing/);
    assert.match(all, /students\/linked must be a folder/);
    assert.doesNotMatch(all, /students\/_template\/profile\.json/, "the template itself is never read");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('the club list is checked too', () => {
  assert.equal(validateClub([]).ok, false);
  assert.equal(validateClub([{ title: 'X', link: 'http://insecure.example' }]).ok, false);
  assert.equal(validateClub([{ title: 'X', link: 'https://ok.example' }]).ok, true);
});
