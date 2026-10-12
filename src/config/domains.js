/**
 * 領域の定義。フィルタ、領域ページ、タグの色はここだけを見る。
 * 新しい領域は、この配列の末尾に1件足す。
 *
 * 号の見出しは、次のどれかで領域になる。
 * - 先頭付近の絵文字（emoji）
 * - {domain="slug"}
 * - {color="slug"}
 * - 従来の4領域だけ、Notion の色（legacyColor）
 *
 * 見出しだけで中身がない領域は、号のページには出さない。
 * 本文中の単語では領域を判定しない。既存号のセキュリティや設計の記述はそのまま残る。
 */
export const domains = [
  {
    slug: 'ai',
    emoji: '🤖',
    label: 'AI',
    name: 'AI・LLM・エージェント',
    legacyColor: 'purple',
    light: { bg: '#eceaf6', fg: '#32285a' },
    dark: { bg: '#2a2640', fg: '#d9d4f0' },
  },
  {
    slug: 'web',
    emoji: '🌐',
    label: 'Web',
    name: 'Web・フルスタック',
    legacyColor: 'blue',
    light: { bg: '#e7eef8', fg: '#1e3358' },
    dark: { bg: '#1d2838', fg: '#d5e2f5' },
  },
  {
    slug: 'cloud',
    emoji: '☁️',
    label: 'クラウド',
    name: 'クラウド・インフラ・DevOps',
    topicAliases: ['Cloud'],
    legacyColor: 'orange',
    light: { bg: '#f8efe6', fg: '#5a3414' },
    dark: { bg: '#3a2c22', fg: '#f3e2d2' },
  },
  {
    slug: 'data',
    emoji: '📊',
    label: 'データ',
    name: 'データ・スタートアップ・トレンド',
    topicAliases: ['トレンド', 'Data'],
    legacyColor: 'green',
    light: { bg: '#e7f3ec', fg: '#1a4330' },
    dark: { bg: '#1c3328', fg: '#d5f0e2' },
  },
  {
    slug: 'security',
    emoji: '🛡️',
    label: 'セキュリティ',
    name: 'セキュリティ',
    legacyColor: null,
    light: { bg: '#f3e6e6', fg: '#4e1f24' },
    dark: { bg: '#3d2428', fg: '#f6dadd' },
  },
  {
    slug: 'architecture',
    emoji: '🏛️',
    label: '設計',
    name: 'アーキテクチャ・設計',
    legacyColor: null,
    light: { bg: '#eeeae4', fg: '#3a342e' },
    dark: { bg: '#322e2a', fg: '#ebe4dc' },
  },
  {
    slug: 'language',
    emoji: '🧩',
    label: '言語',
    name: '言語・ランタイム・OSS',
    legacyColor: null,
    light: { bg: '#e4f0ee', fg: '#143833' },
    dark: { bg: '#1a3330', fg: '#d7f3ec' },
  },
  {
    slug: 'db',
    emoji: '🗄️',
    label: 'DB',
    name: 'DB・データ基盤',
    legacyColor: null,
    light: { bg: '#e8e9f4', fg: '#262c52' },
    dark: { bg: '#282a3d', fg: '#dce0f6' },
  },
  {
    slug: 'process',
    emoji: '🛠️',
    label: '開発',
    name: '開発プロセス・チーム',
    legacyColor: null,
    light: { bg: '#f5efe2', fg: '#433414' },
    dark: { bg: '#342c1c', fg: '#f3e7cf' },
  },
  {
    slug: 'mobile',
    emoji: '📱',
    label: 'モバイル',
    name: 'モバイル・フロント端末',
    legacyColor: null,
    light: { bg: '#f3e8ee', fg: '#4c2238' },
    dark: { bg: '#35242c', fg: '#f6dce8' },
  },
  {
    slug: 'network',
    emoji: '📡',
    label: 'ネットワーク',
    name: 'ネットワーク',
    legacyColor: null,
    light: { bg: '#e4f0f4', fg: '#163642' },
    dark: { bg: '#1a313a', fg: '#d7eef6' },
  },
];

const bySlug = new Map(domains.map((domain) => [domain.slug, domain]));
const byKey = new Map();
for (const domain of domains) {
  byKey.set(domain.slug, domain);
  if (domain.legacyColor) byKey.set(domain.legacyColor, domain);
}

function plainCell(value) {
  return String(value)
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchTopicDomain(cell) {
  const text = plainCell(cell);
  if (!text) return null;
  for (const domain of domains) {
    if (text.includes(domain.emoji)) return domain;
  }
  const bare = text.replace(/\s+/g, '').toLowerCase();
  for (const domain of domains) {
    const names = [domain.label, ...(domain.topicAliases || [])];
    if (names.some((name) => name.replace(/\s+/g, '').toLowerCase() === bare)) return domain;
  }
  return null;
}

export function matchDomain(heading) {
  const text = String(heading);
  const explicit = text.match(/\{domain="([a-z0-9-]+)"\}/);
  if (explicit) return bySlug.get(explicit[1]) || null;
  for (const domain of domains) {
    if (text.includes(domain.emoji)) return domain;
  }
  const color = text.match(/\{color="([^"]+)"\}/);
  if (color) return byKey.get(color[1]) || null;
  return null;
}

export function domainTagCss() {
  const vars = (pick) => domains.map((domain) => `--domain-${domain.slug}-bg:${pick(domain).bg};--domain-${domain.slug}-fg:${pick(domain).fg}`).join(';');
  const rules = domains
    .map(
      (domain) =>
        `.tag.tag-${domain.slug}{background:var(--domain-${domain.slug}-bg);color:var(--domain-${domain.slug}-fg);border-color:transparent}`,
    )
    .join('');
  const light = vars((domain) => domain.light);
  const dark = vars((domain) => domain.dark);
  return `:root{${light}}${rules}@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){${dark}}}:root[data-theme="dark"]{${dark}}`;
}
