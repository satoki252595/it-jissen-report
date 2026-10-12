import GithubSlugger from 'github-slugger';
import { domains, matchDomain, matchTopicDomain } from '../config/domains.js';

function plain(value) {
  return String(value)
    .replace(/<[^>]+>/g, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function topicKey(title) {
  return plain(title)
    .replace(/^\d+-\d+\s+/, '')
    .replace(/[：:・\s]/g, '')
    .toLowerCase();
}

export function displayTitle(title) {
  return plain(title).replace(/^\d+-\d+\s+/, '');
}

function headingIds(source) {
  const slugger = new GithubSlugger();
  const byDomain = new Map();
  let current = null;
  for (const line of source.split('\n')) {
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (!heading) continue;
    const depth = heading[1].length;
    const text = plain(heading[2].replace(/\s*\{(?:color|domain)="[^"]+"\}\s*/g, ' '));
    if (!text) continue;
    if (depth === 1) continue;
    const id = slugger.slug(text);
    if (depth === 2) {
      current = matchDomain(heading[2])?.slug || null;
      continue;
    }
    if (current) {
      if (!byDomain.has(current)) byDomain.set(current, []);
      byDomain.get(current).push({ text, id, key: topicKey(text) });
    }
  }
  return byDomain;
}

function anchorFor(headings, title) {
  if (!headings) return '';
  const key = topicKey(title);
  if (!key) return '';
  const hit = headings.find((heading) => heading.key.includes(key) || key.includes(heading.key));
  return hit ? `#${hit.id}` : '';
}

export function extractTopics(raw) {
  const source = raw.replace(/```[\s\S]*?```/g, '');
  const headings = headingIds(source);
  const topics = [];
  for (const table of source.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)) {
    const rows = [...table[0].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) =>
      [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]),
    );
    if (rows.length < 2) continue;
    const header = rows[0].map(plain);
    const domainIndex = header.findIndex((cell) => cell.includes('領域'));
    const topicIndex = header.findIndex((cell) => cell.includes('トピック'));
    if (domainIndex < 0 || topicIndex < 0) continue;
    const blurbIndex = header.findIndex((cell) => cell.includes('ひとこと'));
    for (const row of rows.slice(1)) {
      const domain = matchTopicDomain(row[domainIndex] || '');
      const title = displayTitle(row[topicIndex] || '');
      if (!domain || !title) continue;
      topics.push({
        slug: domain.slug,
        title,
        blurb: blurbIndex >= 0 ? plain(row[blurbIndex] || '') : '',
        key: topicKey(title),
        hash: anchorFor(headings.get(domain.slug), title),
      });
    }
    break;
  }
  return topics;
}

export function homeBoard(reports) {
  const latest = reports[reports.length - 1];
  const seen = new Set();
  const grouped = new Map(domains.map((domain) => [domain.slug, []]));
  for (const report of [...reports].reverse()) {
    for (const topic of report.topics) {
      if (seen.has(topic.key)) continue;
      seen.add(topic.key);
      grouped.get(topic.slug)?.push({ ...topic, report });
    }
  }
  return domains.map((domain) => {
    const items = grouped.get(domain.slug) || [];
    const today = items.filter((item) => item.report.date === latest.date);
    const past = items.filter((item) => item.report.date !== latest.date);
    return {
      domain,
      count: reports.reduce((sum, report) => sum + report.topics.filter((topic) => topic.slug === domain.slug).length, 0),
      today,
      recent: today.length > 0 ? [] : past.slice(0, 3),
    };
  });
}

export function domainHistory(reports, slug) {
  const groups = [];
  for (const report of [...reports].reverse()) {
    const topics = report.topics.filter((topic) => topic.slug === slug);
    if (topics.length > 0) groups.push({ report, topics });
  }
  return groups;
}
