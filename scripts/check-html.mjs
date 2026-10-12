import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getReports } from '../src/lib/reports.js';

const errors = [];

function fail(message) {
  errors.push(message);
}

const reports = await getReports();
if (reports.length < 13) fail(`expected at least 13 reports, got ${reports.length}`);

for (const report of reports) {
  const html = report.html;
  const label = report.date;
  if (html.includes('<callout') || html.includes('</callout>')) fail(`${label}: raw callout`);
  if (html.includes('table_of_contents')) fail(`${label}: raw table of contents`);
  if (html.includes('{color=')) fail(`${label}: raw color attribute`);
  const badHeading = html.match(/<h(?:1|4|5|6)\b/i);
  if (badHeading) fail(`${label}: unexpected heading ${badHeading[0]}`);
  if (!html.includes('class="callout')) fail(`${label}: missing callout`);
  if (!html.includes('<details')) fail(`${label}: missing details`);
  if (!html.includes('<table')) fail(`${label}: missing table`);
  if (!html.includes('scope="col"')) fail(`${label}: missing th scope`);
  if (!html.includes('<caption>')) fail(`${label}: missing caption`);
  if (html.includes('<script')) fail(`${label}: script leaked into report html`);
  const visible = html.replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code[\s\S]*?<\/code>/g, '');
  if (visible.includes('**')) fail(`${label}: unparsed bold`);
  if (report.highlights.length < 1) fail(`${label}: no highlights`);
  if (report.headings.length < 4) fail(`${label}: too few headings (${report.headings.length})`);
}

const dist = 'dist';
const pages = [
  'index.html',
  '404.html',
  'rss.xml',
  'domains/index.html',
  'domains/ai/index.html',
  'search/index.html',
  ...reports.map((report) => `reports/${report.date}/index.html`),
];

for (const page of pages) {
  const file = join(dist, page);
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    fail(`missing ${page}`);
    continue;
  }
  if (page.endsWith('.html')) {
    const h1 = text.match(/<h1\b/g) || [];
    if (h1.length !== 1) fail(`${page}: expected 1 h1, found ${h1.length}`);
    if (text.includes('<callout') || text.includes('{color=') || text.includes('table_of_contents')) {
      fail(`${page}: raw notion markup`);
    }
    if (!text.includes('lang="ja"')) fail(`${page}: missing lang`);
    if (!text.includes('og:title')) fail(`${page}: missing og:title`);
  }
}

const jsFiles = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const file = join(dir, name);
    if (statSync(file).isDirectory()) walk(file);
    else if (name.endsWith('.js')) jsFiles.push(file);
  }
}
walk(dist);
let jsBytes = 0;
for (const file of jsFiles) jsBytes += statSync(file).size;
const home = readFileSync(join(dist, 'index.html'), 'utf8');
for (const script of home.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)) {
  jsBytes += Buffer.byteLength(script[1]);
}
if (jsBytes > 50 * 1024) fail(`JS is ${jsBytes} bytes, over 50KB`);

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`ok: ${reports.length} reports, JS ${jsBytes} bytes`);
