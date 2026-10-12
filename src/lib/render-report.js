import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkCjkFriendly from 'remark-cjk-friendly';
import remarkRehype from 'remark-rehype';
import rehypeSlug from 'rehype-slug';
import rehypeStringify from 'rehype-stringify';
import { toText } from 'hast-util-to-text';
import { fromHtml } from 'hast-util-from-html';
import { createHighlighter } from 'shiki';
import { visit } from './visit.js';
import { notionHandlers, preprocessNotion, remarkNotion } from './notion.js';

const LANG_MAP = {
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  shellscript: 'bash',
  js: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  py: 'python',
  python: 'python',
  html: 'html',
  css: 'css',
  sql: 'sql',
  yaml: 'yaml',
  yml: 'yaml',
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  text: 'plaintext',
  plaintext: 'plaintext',
  txt: 'plaintext',
};

const LANG_LABEL = {
  bash: 'bash',
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  html: 'html',
  css: 'css',
  sql: 'sql',
  yaml: 'yaml',
  json: 'json',
  markdown: 'markdown',
  plaintext: 'text',
};

let highlighterPromise;

export function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'github-dark-dimmed'],
      langs: ['bash', 'javascript', 'typescript', 'python', 'html', 'css', 'sql', 'yaml', 'json', 'markdown', 'plaintext'],
    });
  }
  return highlighterPromise;
}

function rehypeHighlight(highlighter) {
  const loaded = new Set(highlighter.getLoadedLanguages());
  return function highlightPlugin() {
    return (tree) => {
    const blocks = [];
    visit(tree, (node) => {
      if (node.type === 'element' && node.tagName === 'pre') blocks.push(node);
    });
    for (const node of blocks) {
      const code = (node.children || []).find((child) => child.type === 'element' && child.tagName === 'code');
      if (!code) continue;
      const className = code.properties?.className || [];
      const classes = Array.isArray(className) ? className : [className];
      const langClass = classes.map(String).find((name) => name.startsWith('language-'));
      const requested = langClass ? langClass.slice('language-'.length) : '';
      const mapped = LANG_MAP[requested] || 'plaintext';
      const lang = loaded.has(mapped) ? mapped : 'plaintext';
      const text = toText(code).replace(/\n$/, '');
      const highlighted = highlighter.codeToHtml(text, {
        lang,
        themes: { light: 'github-light', dark: 'github-dark-dimmed' },
        defaultColor: false,
      });
      const parsed = fromHtml(highlighted, { fragment: true });
      const pre = (parsed.children || []).find((child) => child.type === 'element' && child.tagName === 'pre');
      if (!pre) continue;
      pre.properties = pre.properties || {};
      delete pre.properties.style;
      pre.properties.className = ['shiki'];
      const label = LANG_LABEL[lang] || requested || 'text';
      node.tagName = 'div';
      node.properties = { className: ['code-block'] };
      node.children = [
        {
          type: 'element',
          tagName: 'div',
          properties: { className: ['code-bar'] },
          children: [
            {
              type: 'element',
              tagName: 'span',
              properties: { className: ['code-lang'] },
              children: [{ type: 'text', value: label }],
            },
            {
              type: 'element',
              tagName: 'button',
              properties: { type: 'button', className: ['code-copy'], dataCopy: 'true' },
              children: [{ type: 'text', value: 'コピー' }],
            },
          ],
        },
        pre,
      ];
    }
    };
  };
}

function rehypeLinks() {
  return (tree) => {
    visit(tree, (node) => {
      if (node.type !== 'element' || node.tagName !== 'a') return;
      const href = String(node.properties?.href || '');
      if (/^https?:\/\//.test(href)) {
        node.properties.rel = 'noreferrer';
      }
    });
  };
}

export async function renderMarkdown(source) {
  const highlighter = await getHighlighter();
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkCjkFriendly)
    .use(remarkNotion)
    .use(remarkRehype, { allowDangerousHtml: true, handlers: notionHandlers() })
    .use(rehypeSlug)
    .use(rehypeHighlight(highlighter))
    .use(rehypeLinks)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(preprocessNotion(source));
  return String(file);
}

export function extractHeadings(html) {
  const headings = [];
  const pattern = /<h([23])\b([^>]*)>([\s\S]*?)<\/h\1>/g;
  for (const match of html.matchAll(pattern)) {
    const attrs = match[2];
    const idMatch = attrs.match(/\sid="([^"]+)"/);
    if (!idMatch) continue;
    const text = decodeHtml(match[3].replace(/<[^>]+>/g, '')).trim();
    headings.push({ depth: Number(match[1]), id: idMatch[1], text });
  }
  return headings;
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
