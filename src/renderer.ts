import { Algorithm, Token } from './parser';

function renderToken(token: Token): string {
  const escaped = token.value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  switch (token.type) {
    case 'keyword':
      return `<span class="token-keyword">${escaped}</span>`;
    case 'variable':
      return `<span class="token-variable">${escaped}</span>`;
    case 'operator':
      return `<span class="token-operator">${escaped}</span>`;
    case 'number':
      return `<span class="token-number">${escaped}</span>`;
    case 'type':
      return `<span class="token-type">${escaped}</span>`;
    case 'comment':
      return `<span class="token-comment">${escaped}</span>`;
    default:
      return escaped;
  }
}

export function renderAlgorithm(algo: Algorithm): string {
  let html = '<div class="algorithm">';

  html += '<div class="algo-header">';
  if (algo.number) {
    html += `<span class="algo-number">${algo.number}</span> `;
  }
  html += `<span class="algo-label">Algoritmus</span> `;
  html += `<span class="algo-title">${algo.title}</span>`;
  html += '</div>';

  if (algo.inputs) {
    html += `<div class="algo-io"><span class="token-keyword">Bemenet:</span> ${renderIOLine(algo.inputs)}</div>`;
  }
  if (algo.outputs) {
    html += `<div class="algo-io"><span class="token-keyword">Kimenet:</span> ${renderIOLine(algo.outputs)}</div>`;
  }

  html += '<div class="algo-body">';
  for (const line of algo.lines) {
    const indent = '&nbsp;&nbsp;&nbsp;&nbsp;'.repeat(line.indent);
    const tokenHtml = line.tokens.map(renderToken).join('');

    html += `<div class="algo-line">`;
    html += `<span class="line-number">${line.lineNumber}:</span>`;
    html += `<span class="line-content">${indent}${tokenHtml}</span>`;
    html += `</div>`;
  }
  html += '</div>';

  html += '</div>';
  return html;
}

function renderIOLine(text: string): string {
  const TYPE_WORDS = new Set(['egész', 'valós', 'logikai', 'karakter', 'szöveg', 'tömb', 'T']);
  const LABEL_WORDS = new Set(['Bemenet', 'Kimenet', 'mérete']);

  return text.replace(
    /[a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_][a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_0-9]*|[^a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_]+/g,
    (match) => {
      const escaped = match.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (TYPE_WORDS.has(match)) {
        return `<span class="token-type">${escaped}</span>`;
      }
      if (LABEL_WORDS.has(match)) {
        return escaped;
      }
      if (/^[a-zA-ZáéíóöőúüűÁÉÍÓÖŐÚÜŰ_]/.test(match)) {
        return `<span class="token-variable">${escaped}</span>`;
      }
      return escaped;
    }
  );
}
