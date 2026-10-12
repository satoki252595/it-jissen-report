export function visit(node, visitor) {
  if (!node || typeof node !== 'object') return;
  visitor(node);
  const children = node.children;
  if (!Array.isArray(children)) return;
  for (const child of children) visit(child, visitor);
}
