import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DATA_PATH = path.join(ROOT, "data.txt");
const OUT_PATH = path.join(ROOT, "index.html");

function normalizeText(s) {
  return String(s ?? "")
    // common control chars observed in copy/paste digests
    .replace(/\u000b/g, "\n")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstDateLike(s) {
  const m = String(s).match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return m?.[1] || null;
}

function classifySource(url) {
  const u = String(url).toLowerCase();
  if (u.includes("x.com/") || u.includes("twitter.com/")) return { label: "Twitter / X", topic: "X" };
  if (u.includes("youtu.be") || u.includes("youtube.com/")) return { label: "YouTube", topic: "Podcast" };
  return { label: "Link", topic: "News" };
}

function microlinkImg(url) {
  const enc = encodeURIComponent(url);
  return `https://api.microlink.io?url=${enc}&embed=image.url`;
}

function avatarUrl(author, url) {
  // If it looks like an X/Twitter handle exists in URL, use that; otherwise fall back to author string.
  const u = String(url);
  const m = u.match(/x\.com\/([^/]+)\//i) || u.match(/twitter\.com\/([^/]+)\//i);
  const handle = m?.[1];
  const key = (handle || author || "x").trim();
  return `https://unavatar.io/x/${encodeURIComponent(key)}`;
}

function splitBilingual(lines) {
  // Heuristic: treat lines containing CJK as zh candidates, otherwise en.
  const zh = [];
  const en = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (/[一-龥]/.test(t)) zh.push(t);
    else en.push(t);
  }
  return { zh: zh.join(" "), en: en.join(" ") };
}

function parseItems(text) {
  const blocks = text.split(/\n{2,}/g).map((b) => b.trim()).filter(Boolean);

  // Header block: usually first 1-3 blocks, but we only need date/title.
  const header = blocks[0] || "";
  const date = firstDateLike(header) || firstDateLike(text) || new Date().toISOString().slice(0, 10);

  const items = [];
  let currentAuthor = null;

  for (const block of blocks.slice(1)) {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // Section headers like "🐦 X / Twitter" or "🎙️ 播客 Podcast"
    if (lines.length === 1 && !/^https?:\/\//i.test(lines[0]) && lines[0].length <= 40) {
      // could be author name too; we decide author if next blocks look like content.
      currentAuthor = lines[0];
      continue;
    }

    // Find URLs in the block.
    const urls = lines.filter((l) => /^https?:\/\//i.test(l));
    if (urls.length === 0) {
      // Sometimes content block without URL; keep as continuation by skipping.
      continue;
    }

    const url = urls[0];
    const contentLines = lines.filter((l) => l !== url);

    // Try author from currentAuthor, otherwise infer from a "Name（...）" prefix on first line.
    let author = currentAuthor;
    if (!author) {
      const maybe = contentLines[0] || "";
      const m = maybe.match(/^(.+?)(（.+）|\(.+\))$/);
      if (m) author = m[1].trim();
    }
    if (!author) author = "Unknown";

    const { zh, en } = splitBilingual(contentLines);
    const { label, topic } = classifySource(url);

    items.push({
      author,
      zh: zh || en || "",
      en: en || "",
      url,
      sourceLabel: label,
      topic,
    });
  }

  return { date, items };
}

function buildHtml({ date, items }) {
  const title = `Ai Builders Digest · ${date}`;

  const listHtml = items
    .map((it) => {
      const cover = microlinkImg(it.url);
      const avatar = avatarUrl(it.author, it.url);
      const zh = escapeHtml(it.zh);
      const en = escapeHtml(it.en).toUpperCase();
      const author = escapeHtml(it.author);
      const source = escapeHtml(it.sourceLabel);
      const topic = escapeHtml(it.topic);
      const href = escapeHtml(it.url);

      return `
      <a class="list-item" href="${href}" target="_blank" rel="noopener noreferrer">
        <div class="item-cover">
          <img src="${cover}" alt="preview" loading="lazy" onerror="handleImgError(this)">
        </div>
        <div class="item-content">
          <div class="jump-arrow">&rarr;</div>
          <div class="top-content">
            <div class="item-title-zh">${zh}</div>
            <div class="item-desc-en">${en}</div>
          </div>
          <div class="meta-row">
            <img class="avatar-img" src="${avatar}" alt="${author}" onerror="this.style.display='none'">
            <span>${author}</span><span>·</span><span>${source}</span><span>·</span><span>${topic}</span>
          </div>
        </div>
      </a>`;
    })
    .join("\n");

  // Reuse the same deterministic fallback-cover JS from the current index.html style.
  // Keep it inline to stay self-contained for GitHub Pages.
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg-primary:    #F4F4F4;
      --bg-card:       transparent;
      --text-primary:  #111111;
      --text-secondary:#555555;
      --border-color:  #111111;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      -webkit-font-smoothing: antialiased;
    }
    .page-wrapper { max-width: 900px; margin: 0 auto; padding: 60px 20px; }
    .main-header {
      display: flex; justify-content: space-between; align-items: flex-end;
      padding-bottom: 24px; border-bottom: 1px solid var(--border-color);
    }
    .header-title {
      font-size: calc(32px + 2vw); font-weight: 800; line-height: 0.9;
      letter-spacing: -1px; white-space: nowrap;
    }
    .header-date-badge {
      border: 1px solid var(--border-color); border-radius: 20px;
      padding: 6px 16px; font-size: 11px; font-weight: 700;
      text-transform: uppercase; white-space: nowrap;
    }
    .list-container { border-bottom: 1px solid var(--border-color); }
    .list-item {
      display: flex; align-items: flex-start; gap: 4%;
      padding: 32px 0; border-top: 1px solid var(--border-color);
      cursor: pointer; position: relative; text-decoration: none;
      color: inherit; background: var(--bg-card);
    }
    .item-cover { width: 38%; flex-shrink: 0; background: var(--bg-primary); aspect-ratio: 4 / 3; overflow: hidden; }
    .item-cover img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
    .item-cover img.is-fallback { object-fit: contain; object-position: center; }
    .item-content { flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between; position: relative; padding-right: 40px; }
    .jump-arrow { position: absolute; top: 0; right: 0; font-size: 24px; line-height: 1; font-family: Arial, sans-serif; }
    .item-title-zh { font-size: calc(18px + 0.8vw); font-weight: 700; line-height: 1.3; margin-bottom: 12px; }
    .item-desc-en { font-size: calc(12px + 0.2vw); font-weight: 500; color: var(--text-secondary); line-height: 1.4; text-transform: uppercase; }
    .meta-row {
      display: flex; align-items: center; gap: 10px;
      font-size: 11px; font-weight: 800; letter-spacing: 0.5px;
      margin-top: 24px; flex-wrap: wrap;
    }
    .meta-row .avatar-img { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
    @media (max-width: 600px) {
      .page-wrapper { padding: 36px 16px; }
      .item-cover { width: 35%; }
      .item-content { padding-right: 28px; }
      .item-title-zh { font-size: calc(15px + 0.8vw); }
      .item-desc-en { font-size: 11px; }
    }
    @media (max-width: 380px) { .item-cover { width: 32%; } }
  </style>
  <script>
  (function(){
    var PAL=[{bg:"#F4F4F4",tx:"#111",ac:"#111",s1:"#111",s2:"#F4F4F4"}];
    function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
    function trunc(s,n){s=String(s||"");return s.length>n?s.slice(0,n-1)+"…":s;}
    function H(s){s=String(s||"");var h=0;for(var i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))>>>0;}return h;}
    function tagIcon(tg){
      var t=String(tg||"").toLowerCase().replace(/[·•]/g," ").replace(/\\s+/g," ").trim();
      if(t.indexOf("security")>=0||t.indexOf("safety")>=0)return "shield";
      if(t.indexOf("podcast")>=0||t.indexOf("youtube")>=0)return "mic";
      if(t.indexOf("openai")>=0||t.indexOf("anthropic")>=0||t.indexOf("ai agents")>=0)return "bolt";
      return "star";
    }
    function icon(name,x,y,sz,fill){
      var p="";
      if(name==="shield")p="M12 2l7 4v6c0 5-3 9-7 12C8 21 5 17 5 12V6l7-4z";
      else if(name==="mic")p="M12 14a3 3 0 003-3V6a3 3 0 00-6 0v5a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2z";
      else if(name==="bolt")p="M13 2L6 13h5l-1 9 8-11h-5z";
      else p="M12 17.3l-6.18 3.7 1.64-7.03L2 9.24l7.19-.61L12 2l2.81 6.63 7.19.61-5.46 4.73L18.18 21z";
      return '<path d="'+p+'" transform="translate('+x+','+y+') scale('+(sz/24)+')" fill="'+fill+'"/>';
    }
    function t0(n,tg,c,ex,ic){
      return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">'
      +'<rect width="400" height="300" fill="'+c.bg+'"/>'
      +'<rect x="24" y="24" width="352" height="252" fill="#FFF" opacity="0.9" stroke="'+c.ac+'" stroke-width="1"/>'
      +icon(ic,40,44,22,"#777")
      +'<text x="70" y="60" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-size="10" font-weight="800" fill="#666" letter-spacing="2">'+esc(tg)+'</text>'
      +'<text x="40" y="120" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-size="22" font-weight="800" fill="'+c.tx+'">'+esc(String(n).toUpperCase())+'</text>'
      +'<text x="40" y="150" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-size="12" font-weight="500" fill="#666">'+esc(ex)+'</text>'
      +'</svg>';
    }
    var TPL=[t0];
    var _idx=0;
    window.handleImgError=function(img){
      img.onerror=null;
      img.classList.add("is-fallback");
      var li=img.closest(".list-item"); if(!li) return;
      var spans=li.querySelectorAll(".meta-row span"),parts=[];
      for(var i=0;i<spans.length;i++){var t=spans[i].textContent.trim(); if(t!=="·"&&t!=="•") parts.push(t);}
      var n=parts[0]||"AI", tg=parts[parts.length-1]||"NEWS";
      var titleEl=li.querySelector(".item-title-zh");
      var ex=titleEl?trunc(titleEl.textContent.trim(),18):"";
      var ic=tagIcon(tg);
      var ci=_idx++, si=0;
      img.src="data:image/svg+xml,"+encodeURIComponent(TPL[0](n,tg,PAL[si],ex,ic));
    };
  })();
  </script>
</head>
<body>
  <div class="page-wrapper">
    <header class="main-header">
      <div class="header-title">Ai Builders Digest</div>
      <div class="header-date-badge">${escapeHtml(date)}</div>
    </header>
    <div class="list-container">
${listHtml}
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  const normalized = normalizeText(raw);
  const parsed = parseItems(normalized);
  const html = buildHtml(parsed);
  await fs.writeFile(OUT_PATH, html, "utf8");
  console.log(`OK: wrote ${path.relative(ROOT, OUT_PATH)} with ${parsed.items.length} items (${parsed.date})`);
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});

