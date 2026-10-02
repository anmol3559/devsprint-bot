// src/generators/cardImageGen.js
const axios = require('axios');
const sharp = require('sharp');
const { uploadToCloudinary } = require('../services/imageService');

const CARBON_API_URL = 'https://carbonara.solopov.dev/api/cook';
const FALLBACK_API_URLS = [
  'https://carbonara.vercel.app/api/cook',
  'https://carbon.now.sh/api/cook'
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrapCode(code, maxChars = 52) {
  const lines = [];
  for (const sourceLine of String(code).split(/\r?\n/)) {
    if (sourceLine.length <= maxChars) {
      lines.push(sourceLine);
      continue;
    }
    for (let i = 0; i < sourceLine.length; i += maxChars) {
      lines.push(sourceLine.slice(i, i + maxChars));
    }
  }
  // Limit total lines to fit nicely on 1080x1080
  const maxLines = 36;
  return lines.length > maxLines ? lines.slice(0, maxLines - 1) : lines;
}

// Syntax highlighting colors for C++ (Dracula theme approximation)
function getColoredCode(codeLines) {
  return codeLines.map((line) => {
    let coloredLine = escapeXml(line);

    // Keywords
    coloredLine = coloredLine.replace(
      /\b(int|void|return|if|else|for|while|class|public|private|vector|string|bool|true|false|nullptr)\b/g,
      '<tspan fill="#89ddff">keyword</tspan>'
    );

    // Strings
    coloredLine = coloredLine.replace(
      /("[^"]*")/g,
      '<tspan fill="#a6e3a1">string</tspan>'
    );

    // Comments
    coloredLine = coloredLine.replace(
      /(\/\/[^\n]*)/g,
      '<tspan fill="#6272a4">comment</tspan>'
    );

    // Numbers
    coloredLine = coloredLine.replace(
      /\b(\d+)\b/g,
      '<tspan fill="#ffb86c">number</tspan>'
    );

    // Operators
    coloredLine = coloredLine.replace(
      /[{}\[\]();<>=+\-*&|!^?.:]/g,
      '<tspan fill="#f289b2">op</tspan>'
    );

    // Restore actual content (replace placeholder text)
    coloredLine = coloredLine
      .replace('<tspan fill="#89ddff">keyword</tspan>', '$&'.replace('keyword', '${m}'))
      .replace('<tspan fill="#a6e3a1">string</tspan>', '$&'.replace('string', '${m}'))
      .replace('<tspan fill="#6272a4">comment</tspan>', '$&'.replace('comment', '${m}'))
      .replace('<tspan fill="#ffb86c">number</tspan>', '$&'.replace('number', '${m}'))
      .replace('<tspan fill="#f289b2">op</tspan>', '$&'.replace('op', '${m}'));

    // Simple replacement without regex complexity
    const result = [];
    let idx = 0;
    while (idx < coloredLine.length) {
      if (coloredLine.startsWith('<tspan', idx)) {
        const endTag = coloredLine.indexOf('</tspan>', idx);
        if (endTag !== -1) {
          result.push(coloredLine.substring(idx, endTag + 8));
          idx = endTag + 8;
          continue;
        }
      }
      result.push(coloredLine[idx]);
      idx++;
    }
    return result.join('');
  });
}

async function generateLocalCodeCard(codeSnippet, title) {
  const codeLines = wrapCode(codeSnippet);
  const lineHeight = 22;
  const startY = 155;
  const codeText = codeLines.map((line, index) => {
    const y = startY + index * lineHeight;
    return `<text x="78" y="${y}" fill="#f8fafc" font-family="monospace" font-size="18">${escapeXml(line) || ' '}</text>`;
  }).join('');

  const svg = `
    <svg width="1080" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1080" height="1080" fill="#0f172a"/>
      <rect x="38" y="38" width="1004" height="1004" rx="18" fill="#1e293b" stroke="#334155" stroke-width="2"/>
      <circle cx="76" cy="82" r="9" fill="#fb7185"/>
      <circle cx="108" cy="82" r="9" fill="#facc15"/>
      <circle cx="140" cy="82" r="9" fill="#4ade80"/>
      <text x="78" y="126" fill="#67e8f9" font-family="sans-serif" font-size="22" font-weight="bold">${escapeXml(title)}</text>
      ${codeText}
      <text x="78" y="1010" fill="#94a3b8" font-family="sans-serif" font-size="18">DevSprint • Learn. Build. Scale.</text>
    </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function uploadBuffer(buffer) {
  const base64Image = `data:image/png;base64,${buffer.toString('base64')}`;
  return uploadToCloudinary(base64Image);
}

// Set to false to use local Sharp generation (faster, no external dependencies)
const USE_EXTERNAL_CARBON = process.env.USE_CARBON_API === 'true';

async function generateCodeCardImage(codeSnippet, title = 'DevSprint DSA Tip') {
  // Prefer local generation first for reliability
  if (!USE_EXTERNAL_CARBON) {
    console.log('[Image Generator] Using local Sharp generator');
    const localPng = await generateLocalCodeCard(codeSnippet, title);
    const publicUrl = await uploadBuffer(localPng);
    console.log('[Image Generator] Local public URL ready:', publicUrl);
    return publicUrl;
  }

  // Optional: Try external Carbon APIs if explicitly enabled
  const payload = {
    code: `// ${title}\n\n${codeSnippet}`,
    backgroundColor: '#0f172a',
    theme: 'dracula',
    language: 'cpp',
    dropShadow: true,
    windowControls: true,
    paddingVertical: '40px',
    paddingHorizontal: '40px',
  };

  for (const endpoint of [CARBON_API_URL, ...FALLBACK_API_URLS]) {
    try {
      console.log(`[Image Generator] Trying endpoint: ${endpoint}`);
      const response = await axios.post(endpoint, payload, {
        responseType: 'arraybuffer',
        timeout: 5000, // Reduced timeout
      });
      const publicUrl = await uploadBuffer(Buffer.from(response.data));
      console.log('[Image Generator] Public URL ready:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.log(`[Image Generator] Endpoint ${endpoint} failed: ${error.message}`);
    }
  }

  // Fall back to local generation
  console.log('[Image Generator] External endpoints unavailable; using local Sharp fallback.');
  const localPng = await generateLocalCodeCard(codeSnippet, title);
  const publicUrl = await uploadBuffer(localPng);
  console.log('[Image Generator] Local fallback URL ready:', publicUrl);
  return publicUrl;
}

module.exports = { generateCodeCardImage };
