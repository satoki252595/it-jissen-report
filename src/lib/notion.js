import { matchDomain } from '../config/domains.js';

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dedent(input) {
  const text = String(input).replace(/^\n/, '').replace(/\s+$/, '');
  const lines = text.split('\n');
  let min = Infinity;
  for (const line of lines) {
    if (!line.trim()) continue;
    const indent = line.match(/^[ \t]*/)[0].length;
    min = Math.min(min, indent);
  }
  if (!Number.isFinite(min) || min === 0) return text;
  return lines.map((line) => (line.trim() ? line.slice(min) : '')).join('\n');
}

function parseAttrs(source) {
  const attrs = {};
  for (const match of source.matchAll(/([:\w-]+)="([^"]*)"/g)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function inlineToHtml(source) {
  let html = escapeHtml(source.trim());
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>');
  return html;
}

function captionFor(header) {
  if (!header || header.length === 0) return '<caption>表</caption>';
  const joined = header.join('');
  if (joined.includes('トピック') && joined.includes('領域')) return '<caption>トピック一覧</caption>';
  const label = header.map((cell) => cell.trim()).filter(Boolean).slice(0, 4).join('、');
  return `<caption>${escapeHtml(label || '表')}</caption>`;
}

export function transformTable(html) {
  const hasHeader = /header-row\s*=\s*"true"/.test(html);
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((match) =>
    [...match[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1].trim()),
  );
  if (rows.length === 0) return html;
  const header = hasHeader ? rows[0] : null;
  const body = hasHeader ? rows.slice(1) : rows;
  const thead = header
    ? `<thead><tr>${header.map((cell) => `<th scope="col">${inlineToHtml(cell)}</th>`).join('')}</tr></thead>`
    : '';
  const tbody = `<tbody>${body
    .map((row) => `<tr>${row.map((cell) => `<td>${inlineToHtml(cell)}</td>`).join('')}</tr>`)
    .join('')}</tbody>`;
  return `<div class="table-wrap"><table>${captionFor(header)}${thead}${tbody}</table></div>`;
}

function quote(inner) {
  return dedent(inner)
    .trim()
    .split('\n')
    .map((line) => (line.trim() ? `> ${line}` : '>'))
    .join('\n');
}

export function preprocessNotion(source) {
  const fences = [];
  let text = source.replace(/^[ \t]*<table_of_contents\s*\/?\s*>[ \t]*$/gm, '');
  text = text.replace(/^[ \t]*```[^\n]*\n[\s\S]*?^[ \t]*```[ \t]*$/gm, (block) => {
    const token = `\n\nNOTIONFENCE${fences.length}END\n\n`;
    fences.push(dedent(block).trim());
    return token;
  });

  const restore = (value) => value.replace(/NOTIONFENCE(\d+)END/g, (_, id) => fences[Number(id)]);
  const prepareInner = (value) =>
    fixBrokenBold(restore(value)).replace(/<table\b[\s\S]*?<\/table>/g, (table) =>
      transformTable(table).replace(/\s*\n\s*/g, ''),
    );

  text = fixBrokenBold(text);

  text = text.replace(/<callout\b([^>]*)>([\s\S]*?)<\/callout>/g, (_, attrSource, inner) => {
    const attrs = parseAttrs(attrSource);
    const kind = calloutKind(attrs.color);
    const icon = encodeURIComponent(attrs.icon || '');
    return `\n\n> [!callout:${kind}:${icon}]\n>\n${quote(prepareInner(inner))}\n\n`;
  });

  text = text.replace(/<details\b[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g, (_, summary, inner) => {
    const label = summary.replace(/<[^>]+>/g, '').trim();
    const kind = label.includes('出典') ? 'sources' : 'notes';
    return `\n\n> [!details:${kind}] ${label}\n>\n${quote(prepareInner(inner))}\n\n`;
  });

  text = text.replace(/<table\b[^>]*>[\s\S]*?<\/table>/g, (table) => {
    if (table.includes('scope="col"')) return table;
    return `\n\n${transformTable(table).replace(/\s*\n\s*/g, '')}\n\n`;
  });

  text = text.replace(/NOTIONFENCE(\d+)END/g, (_, id) => `\n\n${fences[Number(id)]}\n\n`);
  return text;
}

function fixBrokenBold(value) {
  return value.replace(/\*\*`([^`]+)`\*\*\*\*([^*]+?)\*\*/g, '<strong><code>$1</code>$2</strong>');
}

function calloutKind(color) {
  if (color === 'yellow_bg') return 'highlight';
  if (color === 'green_bg') return 'business';
  if (color === 'blue_bg') return 'info';
  return 'note';
}

function markerOf(node) {
  if (node.type !== 'blockquote') return null;
  const first = node.children[0];
  if (!first || first.type !== 'paragraph') return null;
  const text = first.children
    .filter((child) => child.type === 'text')
    .map((child) => child.value)
    .join('')
    .trim();
  const match = text.match(/^\[!(callout|details):([^\]]+)\](?:\s+([\s\S]*))?$/);
  if (!match) return null;
  return { kind: match[1], value: match[2], label: (match[3] || '').trim(), node: first };
}

function transformBlockquote(node) {
  const marker = markerOf(node);
  if (!marker) return node;
  const children = node.children.slice(1);
  if (marker.kind === 'callout') {
    const [kind, iconValue = ''] = marker.value.split(':');
    const icon = decodeURIComponent(iconValue);
    if (icon) {
      children.unshift({
        type: 'paragraph',
        data: {
          hName: 'span',
          hProperties: { className: ['callout-icon'], ariaHidden: 'true' },
        },
        children: [{ type: 'text', value: icon }],
      });
    }
    return { type: 'notionCallout', data: { kind: kind || 'note' }, children };
  }
  const summary = {
    type: 'paragraph',
    data: { hName: 'summary' },
    children: [{ type: 'text', value: marker.label || '詳細' }],
  };
  return {
    type: 'notionDetails',
    data: { kind: marker.value },
    children: [summary, ...children],
  };
}

function decorateHeading(node) {
  const raw = node.children
    .filter((child) => child.type === 'text')
    .map((child) => child.value)
    .join('');
  for (const child of node.children) {
    if (child.type !== 'text') continue;
    child.value = child.value.replace(/\s*\{(?:color|domain)="[^"]+"\}\s*/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
  }
  node.children = node.children.filter((child) => child.type !== 'text' || child.value.trim() !== '');
  const domain = node.depth === 2 ? matchDomain(raw) : null;
  if (domain) {
    node.data = node.data || {};
    const current = node.data.hProperties?.className || [];
    node.data.hProperties = {
      ...(node.data.hProperties || {}),
      className: [...current, 'domain', `domain-${domain.slug}`],
      'data-domain': domain.slug,
    };
  }
  if (node.depth >= 4) {
    node.data = node.data || {};
    const current = node.data.hProperties?.className || [];
    node.data.hName = 'p';
    node.data.hProperties = {
      ...(node.data.hProperties || {}),
      className: ['subhead', ...current.filter((name) => name !== 'subhead')],
    };
  }
}

function transformTree(tree) {
  if (!tree || !tree.children) return;
  const next = [];
  for (const child of tree.children) {
    if (child.type === 'heading') {
      decorateHeading(child);
      if (child.depth === 1) continue;
    }
    const current = child.type === 'blockquote' ? transformBlockquote(child) : child;
    transformTree(current);
    next.push(current);
  }
  tree.children = next;
}

function textOf(node) {
  if (!node) return '';
  if (node.type === 'text') return node.value;
  return (node.children || []).map(textOf).join('');
}

function hasSubstance(node) {
  if (!node || node.type === 'thematicBreak') return false;
  if (node.type === 'paragraph') return textOf(node).trim().length > 0;
  return true;
}

function omitEmptyDomainSections(children) {
  const result = [];
  let index = 0;
  while (index < children.length) {
    const node = children[index];
    const domainHeading = node.type === 'heading' && node.depth === 2 && node.data?.hProperties?.['data-domain'];
    if (!domainHeading) {
      result.push(node);
      index += 1;
      continue;
    }
    let end = index + 1;
    const section = [];
    while (end < children.length) {
      const next = children[end];
      if (next.type === 'heading' && next.depth === 2) break;
      section.push(next);
      end += 1;
    }
    if (section.some(hasSubstance)) result.push(node, ...section);
    index = end;
  }
  return result;
}

export function remarkNotion() {
  return (tree) => {
    transformTree(tree);
    const notes = [];
    tree.children = tree.children.filter((child) => {
      if (child.type === 'blockquote' && textOf(child).includes('Notion')) {
        notes.push(child);
        return false;
      }
      return true;
    });
    tree.children = omitEmptyDomainSections(tree.children);
    tree.children.push(...notes);
  };
}

export function notionHandlers() {
  return {
    notionCallout(state, node) {
      const kind = node.data?.kind || 'note';
      return {
        type: 'element',
        tagName: 'aside',
        properties: { className: ['callout', `callout-${kind}`] },
        children: state.all(node),
      };
    },
    notionDetails(state, node) {
      const kind = node.data?.kind || 'notes';
      return {
        type: 'element',
        tagName: 'details',
        properties: { className: ['fold', `fold-${kind}`] },
        children: state.all(node),
      };
    },
  };
}

export function normalizeSource(source) {
  return source.replace(/^[ \t]*<table_of_contents\s*\/?\s*>[ \t]*$/gm, '');
}
