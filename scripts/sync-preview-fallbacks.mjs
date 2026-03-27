import fs from 'node:fs';

const workspaceRoot = process.cwd();
const previewPath = `${workspaceRoot}/preview-fallbacks.html`;

function tagIcon(tg) {
  var t = String(tg)
    .toLowerCase()
    .replace(/[·•]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.indexOf('security') >= 0 || t.indexOf('safety') >= 0) return 'shield';
  if (t.indexOf('culture') >= 0 || t.indexOf('every') >= 0 || t.indexOf('productivity') >= 0) return 'chat';
  if (t.indexOf('openai') >= 0 || t.indexOf('anthropic') >= 0 || t === 'ai agents' || t.indexOf('ai agents') >= 0) return 'bolt';
  if (t.indexOf('code') >= 0 || t.indexOf('github') >= 0 || t.indexOf('dev') >= 0) return 'code';
  if (
    t.indexOf('product') >= 0 ||
    t.indexOf('combinator') >= 0 ||
    t.indexOf('vercel') >= 0 ||
    t.indexOf('linear') >= 0 ||
    t.indexOf('replit') >= 0 ||
    t.indexOf('box') >= 0 ||
    t.indexOf('google') >= 0
  )
    return 'rocket';
  if (t.indexOf('podcast') >= 0 || t.indexOf('materials') >= 0) return 'mic';
  if (t.indexOf('robot') >= 0 || t.indexOf('openclaw') >= 0) return 'gear';
  return 'star';
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const html = fs.readFileSync(previewPath, 'utf8');

// Cards are structured like:
// <div class="card"><img src="data:image/svg+xml,ENCODED"><p>#17 Matt Turck · AI Culture [bolt]</p></div>
const cardRe = /<div class="card"><img src="data:image\/svg\+xml,([^"]+)"><p>#(\d+)\s+(.+?)\s+·\s+(.+?)\s+\[([a-z]+)\]<\/p><\/div>/g;

let changed = false;
let match;
let out = html;

while ((match = cardRe.exec(html))) {
  const fullMatch = match[0];
  const svgEnc = match[1];
  const idx = match[2];
  const author = match[3].trim();
  const topic = match[4].trim();
  const iconOld = match[5].trim();

  const authorUpper = author.toUpperCase();
  const topicUpper = topic.toUpperCase();
  const iconNew = tagIcon(topic);

  let svg = decodeURIComponent(svgEnc);

  // Make the preview text consistent (case + separator).
  svg = svg.replace(new RegExp('>' + escapeRegExp(author) + '<'), '>' + authorUpper + '<');
  svg = svg.replace(new RegExp('>' + escapeRegExp(topic) + '<'), '>' + topicUpper + '<');

  // Fix AI Culture icon mismatch: old preview used bolt, new logic uses chat.
  if (iconOld === 'bolt' && iconNew === 'chat') {
    svg = svg.replace(
      'M13,2L6,13H11L10,22L18,11H13Z',
      'M4,4H20V16H12L7,21V16H4Z'
    );
  }

  const svgEncNew = encodeURIComponent(svg);

  const pNew = `#${idx} ${authorUpper}• ${topicUpper} [${iconNew}]`;
  const cardNew = fullMatch
    .replace(svgEnc, svgEncNew)
    .replace(/<p>[^<]*<\/p>/, `<p>${pNew}</p>`);

  out = out.replace(fullMatch, cardNew);
  changed = true;
}

if (changed) {
  fs.writeFileSync(previewPath, out, 'utf8');
  console.log('preview-fallbacks.html updated');
} else {
  console.log('no changes needed');
}

