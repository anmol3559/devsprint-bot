// src/generators/cardImageGen.js
const sharp = require('sharp');
const { uploadToCloudinary } = require('../services/imageService');

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Strip markdown code fences (```cpp ... ```) that Gemini sometimes returns.
 */
function stripCodeFences(raw) {
  let code = String(raw || '').trim();
  // Remove a leading fence line like ```cpp or ```c++
  code = code.replace(/^```[a-zA-Z+#]*\s*\n?/, '');
  // Remove a trailing fence line like ```
  code = code.replace(/\n?```\s*$/, '');
  // Also catch bare trailing ``` on its own
  code = code.replace(/```\s*$/, '');
  return code.trim();
}

/**
 * Tokenize a single C++ line into [text, colorClass] chunks for syntax highlighting.
 * Returns an array of { text, color } segments.
 */
function tokenizeLine(line) {
  const segments = [];
  const isKeyword = /^(int|void|return|if|else|for|while|class|struct|public|private|protected|vector|string|unordered_map|unordered_set|set|map|array|bool|true|false|true|nullptr|const|auto|new|delete|using|namespace|long|short|char|float|double|size_t|true)$/.test;

  // Token patterns in priority order. We walk the line once and classify.
  const patterns = [
    { re: /\/\/.*$/, cls: 'comment' },          // line comment
    { re: /"[^"]*"/, cls: 'string' },          // string literal
    { re: /\b(int|void|return|if|else|for|while|class|struct|public|private|protected|vector|string|unordered_map|unordered_set|set|map|bool|true|false|nullptr|const|auto|new|delete|using|namespace|long|char|float|double|size_t)\b/, cls: 'keyword' },
    { re: /\b\d+\b/, cls: 'number' },          // numbers
    { re: /\b([a-zA-Z_]\w*)\s*\(/, cls: 'func' }, // function calls
    { re: /[{}[\]();,.<>+\-*/&|!?:~]/, cls: 'op' }, // operators/punctuation
  ];

  let idx = 0;
  while (idx < line.length) {
    // Whitespace
    if (/\s/.test(line[idx])) {
      let ws = 1;
      while (idx + ws < line.length && /\s/.test(line[idx + ws])) ws++;
      segments.push({ text: line.slice(idx, idx + ws), cls: null });
      idx += ws;
      continue;
    }

    let matched = false;
    for (const p of patterns) {
      // Anchor the regex at current index
      const anchored = new RegExp(p.re.source, p.re.flags.replace('g', ''));
      anchored.lastIndex = idx;
      // For simplicity test at position
      const m = line.slice(idx).match(p.re);
      if (m && m.index === 0) {
        const token = m[0];
        if (token) {
          segments.push({ text: token, cls: p.cls });
          idx += token.length;
          matched = true;
        }
        break;
      }
    }
    if (!matched) {
      // Fallback: consume one identifier char
      const idMatch = line.slice(idx).match(/^[A-Za-z_]\w*/);
      if (idMatch) {
        segments.push({ text: idMatch[0], cls: 'ident' });
        idx += idMatch[0].length;
      } else {
        segments.push({ text: line[idx], cls: 'op' });
        idx += 1;
      }
    }
  }
  return segments;
}

const COLORS = {
  keyword: '#89ddff',
  string: '#a6e3a1',
  comment: '#6272a4',
  number: '#ffb86c',
  func: '#e6a8f5',
  op: '#f289b2',
  ident: '#f8fafc',
};

function colorClass(cls) {
  return cls ? COLORS[cls] : COLORS.ident;
}

/**
 * Build SVG markup for a syntax-highlighted code line with proper indentation.
 */
function renderLine(line, y) {
  const segments = tokenizeLine(line);
  const xBase = 90;
  let x = xBase;
  const parts = [];
  for (const seg of segments) {
    const text = escapeXml(seg.text);
    if (text === '') continue;
    parts.push(`<tspan x="${x}" fill="${colorClass(seg.cls)}">${text}</tspan>`);
    // Advance x by estimated width (monospace 18px ~ 11px per char)
    x += seg.text.length * 11;
  }
  // Render as one <text> with multiple tspans, aligned at y
  return `<text y="${y}" font-family="'Courier New', monospace" font-size="18">${parts.join('') || ' '}</text>`;
}

/**
 * Generate a clean, well-structured code card image.
 * @param {string} codeSnippet - raw C++ code (may include markdown fences)
 * @param {string} title - card header
 */
async function generateLocalCodeCard(codeSnippet, title) {
  const cleanCode = stripCodeFences(codeSnippet);
  let codeLines = cleanCode.split(/\r?\n/).filter((l) => l.length > 0);

  // Cap lines so the card stays readable
  const maxLines = 28;
  if (codeLines.length > maxLines) {
    codeLines = codeLines.slice(0, maxLines - 1);
    codeLines.push('...');
  }

  const lineHeight = 30;
  const startY = 200;
  const codeSvg = codeLines
    .map((line, i) => renderLine(line, startY + i * lineHeight))
    .join('\n      ');

  const height = startY + codeLines.length * lineHeight + 160;
  const totalHeight = Math.max(1080, height);

  const svg = `
    <svg width="1080" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="1080" height="${totalHeight}" fill="#0f172a"/>
      <rect x="38" y="38" width="1004" height="${totalHeight - 76}" rx="18" fill="#1e293b" stroke="#334155" stroke-width="2"/>
      <!-- Window dots -->
      <circle cx="78" cy="84" r="9" fill="#fb7185"/>
      <circle cx="112" cy="84" r="9" fill="#facc15"/>
      <circle cx="146" cy="84" r="9" fill="#4ade80"/>
      <!-- Title -->
      <text x="78" y="140" fill="#67e8f9" font-family="sans-serif" font-size="26" font-weight="bold">${escapeXml(title)}</text>
      <!-- Divider -->
      <line x1="78" y1="165" x2="1002" y2="165" stroke="#334155" stroke-width="1"/>
      <!-- Code -->
      ${codeSvg}
      <!-- Footer -->
      <text x="78" y="${totalHeight - 55}" fill="#94a3b8" font-family="sans-serif" font-size="18">DevSprint  •  Learn. Build. Scale.</text>
    </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function uploadBuffer(buffer) {
  const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;
  return uploadToCloudinary(base64Image);
}

async function generateCodeCardImage(codeSnippet, title = 'DevSprint DSA Tip') {
  console.log('[Image Generator] Generating local syntax-highlighted code card');
  const localPng = await generateLocalCodeCard(codeSnippet, title);
  const publicUrl = await uploadBuffer(localPng);
  console.log('[Image Generator] Local public URL ready:', publicUrl);
  return publicUrl;
}

module.exports = { generateCodeCardImage, stripCodeFences };
