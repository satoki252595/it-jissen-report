import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractHeadings, renderMarkdown } from './render-report.js';
import { domains, matchDomain } from '../config/domains.js';

export { domains as DOMAINS };

const reportsDir = fileURLToPath(new URL('../../content/reports/', import.meta.url));

let cache;

export function formatDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(`${iso}T12:00:00+09:00`);
  const weekday = new Intl.DateTimeFormat('ja-JP', {
    weekday: 'short',
    timeZone: 'Asia/Tokyo',
  }).format(date);
  return {
    iso,
    year,
    month,
    day,
    label: `${year}年${month}月${day}日`,
    short: `${month}月${day}日`,
    weekday,
  };
}

export function extractHighlights(raw) {
  const match = raw.match(/<callout\b[^>]*color="yellow_bg"[^>]*>([\s\S]*?)<\/callout>/);
  if (!match) return [];
  return [...match[1].matchAll(/^\s*[-*]\s+(.+)$/gm)].map((item) =>
    item[1]
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .trim(),
  );
}

export function extractDomains(raw) {
  const source = raw.replace(/```[\s\S]*?```/g, '');
  const found = new Set();
  for (const match of source.matchAll(/^##\s+(.+)$/gm)) {
    const domain = matchDomain(match[1]);
    if (domain) found.add(domain.slug);
  }
  return domains.filter((domain) => found.has(domain.slug));
}

export function readingMinutes(raw) {
  const text = raw
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[#>*_[\]()`|-]/g, '');
  const chars = [...text.replace(/\s+/g, '')].length;
  return Math.max(1, Math.round(chars / 500));
}

export function plainDescription(highlights, title) {
  const text = highlights.slice(0, 3).join(' ');
  const source = text || title;
  if (source.length <= 150) return source;
  return `${source.slice(0, 149)}…`;
}

export async function getReports() {
  if (cache) return cache;
  const files = readdirSync(reportsDir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}\.md$/.test(name))
    .sort();
  const reports = [];
  for (const file of files) {
    const date = file.slice(0, 10);
    const raw = readFileSync(join(reportsDir, file), 'utf8');
    const formatted = formatDate(date);
    const highlights = extractHighlights(raw);
    const domains = extractDomains(raw);
    const minutes = readingMinutes(raw);
    const title = `IT実践レポート ${formatted.label}`;
    const html = await renderMarkdown(raw);
    reports.push({
      date,
      ...formatted,
      title,
      description: plainDescription(highlights, title),
      highlights,
      domains,
      minutes,
      html,
      headings: extractHeadings(html),
    });
  }
  reports.forEach((report, index) => {
    report.number = index + 1;
  });
  cache = reports;
  return reports;
}

export function neighbors(reports, date) {
  const index = reports.findIndex((report) => report.date === date);
  return {
    prev: index > 0 ? reports[index - 1] : null,
    next: index >= 0 && index < reports.length - 1 ? reports[index + 1] : null,
  };
}

export function relatedReports(reports, report) {
  const slugs = new Set(report.domains.map((domain) => domain.slug));
  return reports
    .filter((item) => item.date !== report.date)
    .map((item) => ({
      item,
      score: item.domains.reduce((sum, domain) => sum + (slugs.has(domain.slug) ? 1 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score || b.item.date.localeCompare(a.item.date))
    .slice(0, 3)
    .map((entry) => entry.item);
}

export function monthCalendars(reports) {
  const byDate = new Map(reports.map((report) => [report.date, report]));
  const keys = [];
  for (const report of reports) {
    const key = `${report.year}-${report.month}`;
    if (!keys.includes(key)) keys.push(key);
  }
  return keys.reverse().map((key) => {
    const [year, month] = key.split('-').map(Number);
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lead = tokyoWeekday(`${year}-${String(month).padStart(2, '0')}-01`);
    const cells = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= days; day += 1) {
      const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({ day, iso, report: byDate.get(iso) || null });
    }
    return { year, month, label: `${year}年${month}月`, cells };
  });
}

function tokyoWeekday(iso) {
  const name = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(`${iso}T12:00:00+09:00`));
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name);
}

export function hrefFor(base, report) {
  return `${base}reports/${report.date}/`;
}
