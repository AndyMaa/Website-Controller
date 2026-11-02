/* Keep live controls in place while background observations update their text. */
function nodeKey(node) {
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  if (node.id) return `id:${node.id}`;
  for (const attr of ['data-site', 'data-event']) if (node.hasAttribute(attr)) return `${attr}:${node.getAttribute(attr)}`;
  if (node.hasAttribute('data-action')) return ['data-action', 'data-id', 'data-page', 'data-command', 'data-key', 'data-filter', 'data-index', 'data-event-id'].map(attr => node.getAttribute(attr) || '').join('|');
  return '';
}
function sameKind(a, b) {
  return a.nodeType === b.nodeType && (a.nodeType !== Node.ELEMENT_NODE || a.tagName === b.tagName && a.namespaceURI === b.namespaceURI && nodeKey(a) === nodeKey(b));
}
function patchNode(current, next) {
  if (current.nodeType !== Node.ELEMENT_NODE) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return;
  }
  const editing = current === document.activeElement && current.matches('input,textarea,select');
  for (const attr of [...current.attributes]) if (!next.hasAttribute(attr.name) && !(editing && attr.name === 'value')) current.removeAttribute(attr.name);
  for (const attr of next.attributes) if (!(editing && attr.name === 'value') && current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
  if (current instanceof HTMLTextAreaElement) {
    if (!editing && current.value !== next.value) current.value = next.value;
    return;
  }
  if (current instanceof HTMLInputElement) {
    if (!editing && current.value !== next.value) current.value = next.value;
    current.checked = next.checked;
    return;
  }
  if (editing && current instanceof HTMLSelectElement) return;
  patchChildren(current, next);
  if (current instanceof HTMLSelectElement && current.value !== next.value) current.value = next.value;
}
function patchChildren(target, source) {
  const keyed = new Map([...target.childNodes].map(node => [nodeKey(node), node]).filter(([key]) => key));
  let cursor = target.firstChild;
  for (const next of [...source.childNodes]) {
    const key = nodeKey(next);
    let current = key ? keyed.get(key) : cursor;
    if (current && sameKind(current, next)) {
      if (current !== cursor) target.insertBefore(current, cursor);
      patchNode(current, next);
    } else {
      current = next.cloneNode(true);
      target.insertBefore(current, cursor);
    }
    cursor = current.nextSibling;
  }
  while (cursor) { const stale = cursor; cursor = cursor.nextSibling; stale.remove(); }
}
function updateHTML(target, html) {
  if (target.__lastHTML === html) return;
  const template = document.createElement('template'); template.innerHTML = html;
  patchChildren(target, template.content);
  target.__lastHTML = html;
}
