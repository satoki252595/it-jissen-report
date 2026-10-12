import { getReports, hrefFor } from '../lib/reports.js';

export async function GET({ site }) {
  const reports = await getReports();
  const base = import.meta.env.BASE_URL;
  const origin = site?.href.replace(/\/$/, '') || 'https://satoki252595.github.io';
  const channel = `${origin}${base}`;
  const latest = reports[reports.length - 1];
  const items = [...reports].reverse().map((report) => {
    const link = new URL(hrefFor(base, report), `${origin}/`).href;
    const body = report.highlights.map((item) => `<li>${escapeXml(item)}</li>`).join('');
    return `<item>
      <title>${escapeXml(report.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${new Date(`${report.date}T07:00:00+09:00`).toUTCString()}</pubDate>
      <description>${escapeXml(report.description)}</description>
      <content:encoded><![CDATA[<ul>${body}</ul>${report.html.replace(/]]>/g, ']]]]><![CDATA[>')}]]></content:encoded>
    </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>IT実践レポート</title>
    <link>${channel}</link>
    <description>AIからネットワークまで、11の領域の動きを現場の判断に使える形で毎日まとめる日刊。</description>
    <language>ja</language>
    <lastBuildDate>${new Date(`${latest.date}T07:00:00+09:00`).toUTCString()}</lastBuildDate>
    <atom:link href="${channel}rss.xml" rel="self" type="application/rss+xml" />
    ${items.join('\n')}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
