import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATA_PATH = path.join(ROOT, "data.txt");
const OUT_PATH = path.join(ROOT, "index.html");
const SITE_URL_PATH = path.join(ROOT, "site-url.txt");

const PREVIEW_FALLBACKS_PATH = path.join(ROOT, "preview-fallbacks.html");

const OG_CARD_FILENAME = "og-card.svg";

/** 链接预览（og:title）与页面顶栏主标题；副标题为日期，见 og:description */
const DIGEST_DISPLAY_TITLE = "AI Builders 日报";

/** 从 preview-fallbacks.html 解析画廊卡片（Microlink 失败时随机版式来源）。 */
function parsePreviewFallbackLibrary(html) {
  const re =
    /<div class="card"><img src="data:image\/svg\+xml,([^"]+)"[^>]*><p>#\d+\s+(.+?)\s*•\s*(.+?)\s+\[(\w+)\]<\/p><\/div>/g;
  const out = [];
  let m;
  const s = String(html);
  while ((m = re.exec(s))) {
    const authorRaw = m[2].trim().replace(/\s+/g, " ");
    const topicRaw = m[3].trim().replace(/\s+/g, " ");
    out.push({
      e: m[1],
      a: authorRaw.toUpperCase(),
      t: topicRaw.toUpperCase(),
    });
  }
  return out;
}

function loadDigestFallbackLibrary() {
  try {
    const raw = readFileSync(PREVIEW_FALLBACKS_PATH, "utf8");
    return parsePreviewFallbackLibrary(raw);
  } catch {
    return [];
  }
}

function normalizeText(s) {
  return String(s ?? "")
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

function isPodcastUrl(url) {
  const u = String(url).toLowerCase();
  return u.includes("youtu.be") || u.includes("youtube.com/");
}

/** Section row like "🐦 X / Twitter" — not an author name. */
function isDigestSectionLine(line) {
  const t = String(line).trim();
  if (t.length > 72) return false;
  if (/^[🐦🎙️]/.test(t)) return true;
  if (/X\s*\/\s*Twitter/i.test(t)) return true;
  if (/播客|PODCAST/i.test(t)) return true;
  return false;
}

function digestStats(items) {
  let x = 0;
  let podcast = 0;
  let news = 0;
  for (const it of items) {
    if (it.topic === "X") x += 1;
    else if (it.topic === "Podcast") podcast += 1;
    else news += 1;
  }
  return { x, podcast, news, total: items.length };
}

function assignPodcastSlugs(items) {
  let n = 0;
  return items.map((it) => {
    if (it.kind !== "podcast") return it;
    n += 1;
    return { ...it, podcastSlug: `podcast-${n}.html` };
  });
}

function buildShareDescription(stats, date) {
  if (stats.total === 0) {
    return `${date} · ${DIGEST_DISPLAY_TITLE} · 本期暂无条目`;
  }
  const bits = [];
  if (stats.x) bits.push(`推文 ${stats.x}`);
  if (stats.podcast) bits.push(`播客/视频 ${stats.podcast}`);
  if (stats.news) bits.push(`资讯 ${stats.news}`);
  const typeLine = bits.length ? bits.join("，") : "";
  return `共 ${stats.total} 条精选${typeLine ? ` · ${typeLine}` : ""} · ${date}`;
}

async function resolveCanonicalPageUrl() {
  const fromEnv = String(process.env.AI_REPORT_SITE_URL || "").trim();
  if (fromEnv) {
    const base = fromEnv.replace(/\/+$/, "");
    return `${base}/`;
  }
  try {
    const raw = await fs.readFile(SITE_URL_PATH, "utf8");
    const line = raw.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
    if (line) {
      const base = line.replace(/\/+$/, "");
      return `${base}/`;
    }
  } catch {
    /* optional file */
  }
  return "";
}

function buildSocialMetaTags({ pageTitle, shareDescription, metaDescription, canonicalUrl, ogImageUrl }) {
  const esc = escapeHtml;
  const metaDesc = metaDescription != null && String(metaDescription).trim() !== "" ? metaDescription : shareDescription;
  const lines = [
    `<meta name="description" content="${esc(metaDesc)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${esc(pageTitle)}" />`,
    `<meta property="og:description" content="${esc(shareDescription)}" />`,
    `<meta name="twitter:card" content="${ogImageUrl ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${esc(pageTitle)}" />`,
    `<meta name="twitter:description" content="${esc(shareDescription)}" />`,
  ];
  if (canonicalUrl) {
    lines.push(`<link rel="canonical" href="${esc(canonicalUrl)}" />`);
    lines.push(`<meta property="og:url" content="${esc(canonicalUrl)}" />`);
  }
  if (ogImageUrl) {
    lines.push(`<meta property="og:image" content="${esc(ogImageUrl)}" />`);
    lines.push(`<meta name="twitter:image" content="${esc(ogImageUrl)}" />`);
  }
  return lines.join("\n  ");
}

function buildOgCardSvg({ date, stats }) {
  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const title = esc(DIGEST_DISPLAY_TITLE);
  const dateLine = esc(`更新时间：${date}`);
  const line1 = esc(`共 ${stats.total} 条精选`);
  const line2 = esc(`推文 ${stats.x} · 播客/视频 ${stats.podcast}`);

  // 1200x630 is the common "large" social card aspect; many scrapers accept SVG.
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F4F4F4"/>
      <stop offset="100%" stop-color="#FFFFFF"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1a7f37"/>
      <stop offset="100%" stop-color="#0f5f26"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="80" y="78" width="1040" height="474" rx="28" fill="#fff" opacity="0.96"/>
  <rect x="80" y="78" width="1040" height="12" rx="10" fill="url(#accent)"/>

  <text x="120" y="210" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="64" font-weight="800" fill="#000">${title}</text>
  <text x="120" y="280" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="28" font-weight="600" fill="rgba(0,0,0,0.45)">${dateLine}</text>

  <text x="120" y="360" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="34" font-weight="800" fill="#111">${line1}</text>
  <text x="120" y="430" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="26" font-weight="700" fill="rgba(17,17,17,0.55)">${line2}</text>

  <text x="120" y="520" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="20" font-weight="700" fill="rgba(0,0,0,0.35)">AI-Report-Builder</text>
</svg>`;
}

function microlinkImg(url) {
  const enc = encodeURIComponent(url);
  return `https://api.microlink.io?url=${enc}&embed=image.url`;
}

/**
 * 构建期用 FxTwitter 解析 X 推文配图 URL（pbs.twimg.com 等）。无附图时不使用作者头像作封面（避免与 meta 行头像重复），
 * 退回 Microlink；Microlink 失败或 429 时由浏览器 onerror 进入兜底 SVG 画廊。
 */
async function resolveTweetCoverUrl(pageUrl) {
  const m = String(pageUrl).match(/(?:twitter|x)\.com\/([^/?#]+)\/status\/(\d+)/i);
  if (!m) return microlinkImg(pageUrl);
  const handle = m[1];
  const id = m[2];
  const api = `https://api.fxtwitter.com/${encodeURIComponent(handle)}/status/${encodeURIComponent(id)}`;
  try {
    const r = await fetch(api, {
      headers: { Accept: "application/json", "User-Agent": "AI-Report-Builder/1.0" },
    });
    if (!r.ok) return microlinkImg(pageUrl);
    const j = await r.json();
    const tw = j?.tweet;
    if (!tw) return microlinkImg(pageUrl);
    const ph = tw.media?.photos?.[0]?.url;
    if (ph) return ph;
    const v = tw.media?.videos?.[0];
    if (v) {
      if (v.thumbnail_url) return v.thumbnail_url;
      if (v.url) return v.url;
    }
  } catch {
    /* ignore */
  }
  return microlinkImg(pageUrl);
}

/** 顺序请求 + 短间隔，降低第三方 API 限流风险。 */
async function enrichItemsWithTweetCovers(items) {
  const out = [];
  for (const it of items) {
    if (it.kind !== "tweet") {
      out.push(it);
      continue;
    }
    const coverUrl = await resolveTweetCoverUrl(it.url);
    out.push({ ...it, coverUrl });
    await new Promise((r) => setTimeout(r, 80));
  }
  return out;
}

function avatarUrl(author, url) {
  const u = String(url);
  const m = u.match(/x\.com\/([^/]+)\//i) || u.match(/twitter\.com\/([^/]+)\//i);
  const handle = m?.[1];
  const key = (handle || author || "x").trim();
  return `https://unavatar.io/x/${encodeURIComponent(key)}`;
}

function hasCjk(s) {
  return /[一-龥]/.test(String(s));
}

/** Extract 【tag】 … until next line starting with 【 or end. */
function extractBracketSection(fullText, tagPattern) {
  const re = new RegExp(`【\\s*(?:${tagPattern})\\s*】\\s*([^]*?)(?=\\n【|$)`, "i");
  const m = String(fullText).match(re);
  return m ? m[1].trim().replace(/\n{3,}/g, "\n\n") : "";
}

function splitBilingual(lines) {
  const zh = [];
  const en = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (hasCjk(t)) zh.push(t);
    else en.push(t);
  }
  return { zh: zh.join(" "), en: en.join(" ") };
}

/** Leading lines with no CJK (typical tweet original before translations). */
function leadingLatinBlock(lines) {
  const parts = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (hasCjk(t)) break;
    parts.push(t);
  }
  return parts.join(" ").trim();
}

/** Remove "Name（Role） " prefix often prepended by digests (full-width parens only). */
function stripAttributionPrefix(en) {
  const t = String(en).trim();
  const m = t.match(/^(.{0,120}?）)\s+([\s\S]+)$/);
  if (m && m[1].includes("（") && m[2].length > 0) return m[2].trim();
  return t;
}

function stripAuthorLead(en, author) {
  const a = String(author || "").trim();
  if (!a || !en) return en;
  const esc = a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(en)
    .replace(new RegExp(`^${esc}\\s+`, "i"), "")
    .trim();
}

/** First CJK-heavy line as fallback “summary” when no 【中文摘要】. */
function firstCjkLine(lines) {
  for (const line of lines) {
    const t = line.trim();
    if (t && hasCjk(t)) return t;
  }
  return "";
}

function secondCjkLineAfter(lines, firstCjk) {
  const want = String(firstCjk || "").trim();
  const cjk = lines.map((l) => l.trim()).filter((t) => t && hasCjk(t));
  if (cjk.length < 2) return "";
  if (want && cjk[0] === want) return cjk[1];
  return cjk[1] || "";
}

function langForSnippet(s) {
  if (!String(s).trim()) return "en";
  const t = s.replace(/\s/g, "");
  const cjk = (t.match(/[一-龥]/g) || []).length;
  return cjk >= t.length * 0.2 ? "zh-CN" : "en";
}

/**
 * Tweet: zh = 摘要；original = 推文原文（可为中文或英文，与平台一致，不做改写）。
 */
function parseTweetContent(fullBlockText, contentLines, authorHint = "") {
  const text = String(fullBlockText);
  let zh =
    extractBracketSection(text, "中文摘要|要点|摘要") ||
    extractBracketSection(text, "ZH|zh");
  let original =
    extractBracketSection(text, "推文原文") ||
    extractBracketSection(text, "英文原文|EN|en") ||
    extractBracketSection(text, "原文");

  const lines = contentLines.map((l) => l.trim()).filter(Boolean);
  if (!original) original = leadingLatinBlock(lines);
  original = stripAttributionPrefix(original);
  original = stripAuthorLead(original, authorHint);
  if (!zh) zh = firstCjkLine(lines);
  if (!original) original = secondCjkLineAfter(lines, zh);

  if (!zh && original) zh = original;
  if (!original && zh) original = "";

  return { zh: zh.trim(), original: original.trim() };
}

function sliceAfterHeaders(src, startLabel, endLabels) {
  const startRe = new RegExp(`${startLabel}\\s*`, "m");
  const sm = src.match(startRe);
  if (!sm) return "";
  const i0 = sm.index + sm[0].length;
  let end = src.length;
  for (const lab of endLabels) {
    const re = new RegExp(`\\n\\s*${lab}`, "m");
    const m = src.slice(i0).match(re);
    if (m) end = Math.min(end, i0 + m.index);
  }
  return src.slice(i0, end).trim();
}

function parsePodcastBlock(rawBlock, contentLines, author) {
  const text = String(rawBlock).trim();
  let title = (author || "").trim();
  let thesis = "";
  let insights = "";
  let highlights = "";
  let teaserZh = "";
  let teaserEn = "";

  const deep = /一、\s*深度总结/.test(text) && /二、\s*完整中文逐字稿/.test(text);

  if (deep) {
    const head = text.split(/一、\s*深度总结/)[0].trim();
    const hl = head.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const pick = hl.find(
      (l) => l.length > 4 && !/^[🎙️🐦]/.test(l) && !/^PODCASTS?$/i.test(l) && !/^🎙️/.test(l),
    );
    if (pick) title = pick;
    else if (hl.length) title = hl[hl.length - 1];

    thesis = sliceAfterHeaders(text, "核心论点", ["关键洞察", "最值得关注的信号", "二、\\s*完整中文逐字稿"]);
    insights = sliceAfterHeaders(text, "关键洞察", ["最值得关注的信号", "二、\\s*完整中文逐字稿"]);
    highlights = sliceAfterHeaders(text, "最值得关注的信号", ["二、\\s*完整中文逐字稿"]);

    teaserZh = thesis ? thesis.slice(0, 160) + (thesis.length > 160 ? "…" : "") : title;
    teaserEn = leadingLatinBlock(contentLines) || "";
  } else {
    const headline = (contentLines[0] || "").trim();
    const bodyLines = contentLines.length > 1 ? contentLines.slice(1) : contentLines;
    title = headline || title;
    const { zh, en } = splitBilingual(bodyLines);
    teaserZh = firstCjkLine(bodyLines) || zh || title;
    teaserEn = leadingLatinBlock(bodyLines) || en || "";
    thesis = zh || teaserZh;
  }

  return { title, thesis, insights, highlights, teaserZh, teaserEn };
}

function formatInsightsHtml(raw) {
  const t = String(raw).trim();
  if (!t) return "";
  const bullets = t
    .split(/(?:\n|^)\s*[●•·]\s*/g)
    .map((s) => s.trim())
    .filter(Boolean);
  if (bullets.length > 1) {
    return `<ul class="pc-bullets">${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`;
  }
  return `<div class="pc-body">${escapeHtml(t).replace(/\n/g, "<br />")}</div>`;
}

function buildPodcastSectionBlock(title, bodyHtml) {
  if (!bodyHtml || !String(bodyHtml).trim()) return "";
  return `<section class="pd-block">
    <h2 class="pd-block__title">${escapeHtml(title)}</h2>
    <div class="pd-block__body">${bodyHtml}</div>
  </section>`;
}

function buildPodcastDetailInnerHtml(it, { date, ytHref }) {
  const title = escapeHtml(it.podcastTitle || it.author);
  const nameEsc = escapeHtml(it.author);
  const thesisHtml = it.thesis ? `<div class="pd-prose">${escapeHtml(it.thesis).replace(/\n/g, "<br />")}</div>` : "";
  let insightsInner = "";
  if (it.insights) {
    const bullets = String(it.insights)
      .split(/(?:\n|^)\s*[●•·]\s*/g)
      .map((s) => s.trim())
      .filter(Boolean);
    insightsInner =
      bullets.length > 1
        ? `<ul class="pd-ul">${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>`
        : `<div class="pd-prose">${escapeHtml(it.insights).replace(/\n/g, "<br />")}</div>`;
  }
  const highlightsHtml = it.highlights
    ? `<div class="pd-prose">${escapeHtml(it.highlights).replace(/\n/g, "<br />")}</div>`
    : "";

  const blocks = [
    buildPodcastSectionBlock("核心论点", thesisHtml),
    buildPodcastSectionBlock("关键洞察", insightsInner),
    buildPodcastSectionBlock("最值得关注的信号", highlightsHtml),
  ]
    .filter(Boolean)
    .join("\n");

  return `
    <h1 class="pd-hero-title">${title}</h1>
    <div class="pd-source-row">
      <div>
        <span class="pd-source-k">来源</span>
        <span class="pd-source-name"> ${nameEsc}</span>
      </div>
      <a class="pd-jump" href="${escapeHtml(ytHref)}" target="_blank" rel="noopener noreferrer">跳转链接 <span aria-hidden="true">→</span></a>
    </div>
    ${blocks}
    <p class="pd-date">${escapeHtml(date)}</p>`;
}

function buildPodcastDetailHtml(it, { date, ytHref }) {
  const inner = buildPodcastDetailInnerHtml(it, { date, ytHref });
  const pageTitle = `${it.podcastTitle || it.author} · ${DIGEST_DISPLAY_TITLE}`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(pageTitle)}</title>
  <style>
    :root {
      --bg: #f4f4f4;
      --fg: #111;
      --muted: #555;
      --line: #111;
      --card: #fff;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--fg);
      -webkit-font-smoothing: antialiased;
      line-height: 1.5;
    }
    .pd-wrap { max-width: 720px; margin: 0 auto; padding: 0 20px 48px; }
    .pd-topbar {
      position: sticky;
      top: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 0;
      margin: 0 -20px;
      padding-left: 20px;
      padding-right: 20px;
      background: var(--bg);
      border-bottom: 1px solid var(--line);
      margin-bottom: 28px;
    }
    .pd-brand { font-size: 14px; font-weight: 800; letter-spacing: -0.02em; }
    .pd-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      font-size: 22px;
      line-height: 1;
      text-decoration: none;
      color: var(--fg);
      border-radius: 8px;
      transition: background 0.15s;
    }
    .pd-close:hover { background: rgba(0,0,0,0.06); }
    .pd-hero-title { font-size: clamp(1.35rem, 4vw, 1.75rem); font-weight: 800; letter-spacing: -0.03em; margin-bottom: 20px; }
    .pd-source-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 32px;
      padding-bottom: 20px;
      border-bottom: 1px solid #ddd;
    }
    .pd-source-k { font-weight: 800; font-size: 13px; }
    .pd-source-name { font-size: 14px; color: var(--muted); }
    .pd-jump {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      color: var(--fg);
      white-space: nowrap;
    }
    .pd-jump:hover { text-decoration: underline; }
    .pd-block { margin-bottom: 0; margin-top: 36px; }
    .pd-block:first-of-type { margin-top: 0; }
    .pd-block__title {
      font-size: calc(18px + 0.8vw);
      font-weight: 700;
      line-height: 1.35;
      letter-spacing: -0.02em;
      margin-bottom: 10px;
      color: var(--fg);
    }
    .pd-block__body { padding-left: 0; }
    .pd-prose, .pd-ul {
      font-size: calc(12px + 0.2vw);
      font-weight: 500;
      line-height: 1.45;
      color: var(--fg);
    }
    .pd-ul { margin: 0; padding-left: 1.15em; }
    .pd-ul li { margin-bottom: 8px; }
    .pd-date { font-size: 12px; color: var(--muted); margin-top: 8px; }
  </style>
</head>
<body>
  <div class="pd-wrap">
    <header class="pd-topbar">
      <span class="pd-brand">${escapeHtml(DIGEST_DISPLAY_TITLE)}</span>
      <a class="pd-close" href="index.html" aria-label="返回列表">×</a>
    </header>
    ${inner}
  </div>
</body>
</html>`;
}

/** 多条播客：与推文列表同一套 list-item / item-cover / meta-row，仅链接指向站内 podcast-N.html。 */
function buildPodcastListRow(it) {
  const cover = escapeHtml(it.coverUrl || microlinkImg(it.url));
  const avatar = avatarUrl(it.author, it.url);
  const zhRaw = String(it.thesis || it.teaserZh || it.podcastTitle || "").trim();
  const zh = escapeHtml(zhRaw);
  const origRaw = String(it.teaserEn || "").trim();
  const orig = escapeHtml(origRaw);
  const origLang = langForSnippet(origRaw);
  const author = escapeHtml(it.author);
  const source = escapeHtml(it.sourceLabel);
  const topic = escapeHtml(it.topic);
  const slug = it.podcastSlug || "#";
  const href = escapeHtml(slug);

  return `
      <a class="list-item list-item--tweet" href="${href}">
        <div class="item-cover">
          <img src="${cover}" alt="preview" loading="lazy" onerror="handleImgError(this)">
        </div>
        <div class="item-content">
          <div class="jump-arrow" aria-hidden="true">&rarr;</div>
          <div class="top-content">
            <div class="item-title-zh">${zh}</div>
            <div class="item-desc-en item-desc-original" lang="${origLang}">${orig}</div>
          </div>
          <div class="meta-row">
            <img class="avatar-img" src="${avatar}" alt="${author}" onerror="this.style.display='none'">
            <span>${author}</span><span>·</span><span>${source}</span><span>·</span><span>${topic}</span>
          </div>
        </div>
      </a>`;
}

function parseItems(text) {
  const blocks = text.split(/\n{2,}/g).map((b) => b.trim()).filter(Boolean);

  const header = blocks[0] || "";
  const date = firstDateLike(header) || firstDateLike(text) || new Date().toISOString().slice(0, 10);

  const items = [];
  let currentAuthor = null;

  for (const block of blocks.slice(1)) {
    const rawBlock = block;
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    if (lines.length === 1 && lines[0].startsWith("（") && lines[0].endsWith("）")) continue;

    if (lines.length === 1 && !/^https?:\/\//i.test(lines[0])) {
      if (isDigestSectionLine(lines[0])) continue;
      if (lines[0].length <= 40) {
        currentAuthor = lines[0];
      }
      continue;
    }

    const urls = lines.filter((l) => /^https?:\/\//i.test(l));
    if (urls.length === 0) continue;

    const url = urls[0];
    let contentLines = lines.filter((l) => !urls.includes(l));

    let author = currentAuthor;
    if (!author) {
      const maybe = contentLines[0] || "";
      const m = maybe.match(/^(.+?)(（.+）|\(.+\))$/);
      if (m) author = m[1].trim();
    }

    if (contentLines.length >= 2) {
      const head = contentLines[0];
      const h = head.trim();
      if (
        h.length > 0 &&
        h.length <= 52 &&
        !/^https?:/i.test(h) &&
        !hasCjk(h) &&
        !h.includes("：") &&
        !h.includes(":")
      ) {
        author = h;
        contentLines = contentLines.slice(1);
      }
    }

    if (!author) author = "Unknown";

    const { label, topic } = classifySource(url);
    const isPodcast = isPodcastUrl(url);

    if (isPodcast) {
      const headLine = (contentLines[0] || "").trim();
      let showName = author;
      if (headLine && (/[：:]/.test(headLine) || headLine.length > 8)) {
        const parts = headLine.split(/[：:]/);
        if (parts.length >= 2 && parts[0].trim().length <= 40) showName = parts[0].trim();
      }
      const pod = parsePodcastBlock(rawBlock, contentLines, headLine || author);
      items.push({
        kind: "podcast",
        author: showName,
        url,
        sourceLabel: label,
        topic,
        podcastTitle: pod.title || headLine || showName,
        thesis: pod.thesis,
        insights: pod.insights,
        highlights: pod.highlights,
        teaserZh: pod.teaserZh || pod.title,
        teaserEn: pod.teaserEn,
      });
    } else {
      const { zh, original } = parseTweetContent(rawBlock, contentLines, author);
      items.push({
        kind: "tweet",
        author,
        zh,
        original,
        url,
        sourceLabel: label,
        topic,
      });
    }
  }

  return { date, items };
}

function buildTweetRow(it) {
  const cover = escapeHtml(it.coverUrl || microlinkImg(it.url));
  const avatar = avatarUrl(it.author, it.url);
  const zh = escapeHtml(it.zh);
  const orig = escapeHtml(it.original || "");
  const origLang = langForSnippet(it.original || "");
  const author = escapeHtml(it.author);
  const source = escapeHtml(it.sourceLabel);
  const topic = escapeHtml(it.topic);
  const href = escapeHtml(it.url);

  return `
      <a class="list-item list-item--tweet" href="${href}" target="_blank" rel="noopener noreferrer">
        <div class="item-cover">
          <img src="${cover}" alt="preview" loading="lazy" onerror="handleImgError(this)">
        </div>
        <div class="item-content">
          <div class="jump-arrow" aria-hidden="true">&rarr;</div>
          <div class="top-content">
            <div class="item-title-zh">${zh}</div>
            <div class="item-desc-en item-desc-original" lang="${origLang}">${orig}</div>
          </div>
          <div class="meta-row">
            <img class="avatar-img" src="${avatar}" alt="${author}" onerror="this.style.display='none'">
            <span>${author}</span><span>·</span><span>${source}</span><span>·</span><span>${topic}</span>
          </div>
        </div>
      </a>`;
}

function buildHtml({ date, items }, canonicalPageUrl = "") {
  const fallbackLib = loadDigestFallbackLibrary();
  const title = `${DIGEST_DISPLAY_TITLE} · ${date}`;
  const stats = digestStats(items);
  const shareStatsLine = buildShareDescription(stats, date);
  /** 链接卡片：主标题 + 日期副标题（微信/Telegram 等读 og:title / og:description） */
  const ogShareDescription = date;
  // Important: many link-preview bots do not execute JS and/or block microlink/unavatar.
  // Using a local generated SVG makes previews consistent.
  const ogImageUrl = OG_CARD_FILENAME;
  const socialMeta = buildSocialMetaTags({
    pageTitle: DIGEST_DISPLAY_TITLE,
    shareDescription: ogShareDescription,
    metaDescription: shareStatsLine,
    canonicalUrl: canonicalPageUrl,
    ogImageUrl,
  });

  const tweets = items.filter((it) => it.kind === "tweet");
  const podcasts = items.filter((it) => it.kind === "podcast");
  const tweetsHtml = tweets.map((it) => buildTweetRow(it)).join("\n");

  let podcastsPanelHtml = "";
  if (podcasts.length === 0) {
    podcastsPanelHtml = `<p class="digest-empty">本期暂无播客条目。</p>`;
  } else if (podcasts.length === 1) {
    const p0 = podcasts[0];
    podcastsPanelHtml = `<div class="pd-wrap pd-wrap--embed">${buildPodcastDetailInnerHtml(p0, { date, ytHref: p0.url })}</div>`;
  } else {
    podcastsPanelHtml = podcasts.map((it) => buildPodcastListRow(it)).join("\n");
  }

  const navTweetLabel = `推文${stats.x}`;
  const navPodLabel = `播客${stats.podcast}`;
  const podDisabled = stats.podcast === 0;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  ${socialMeta}
  <style>
    :root {
      --bg-primary:    #F4F4F4;
      --bg-card:       transparent;
      --text-primary:  #111111;
      --text-secondary:#555555;
      --border-color:  #111111;
      --card-bg:       #FFFFFF;
      --accent:        #1a7f37;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      -webkit-font-smoothing: antialiased;
    }
    .page-wrapper { max-width: 900px; margin: 0 auto; padding: 0 20px 60px; }
    .site-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #fff;
      border-top: 1px solid var(--border-color);
      transition: box-shadow 0.2s ease;
    }
    .site-header.is-scrolled {
      box-shadow: 0 6px 16px rgba(17, 17, 17, 0.06);
    }
    .site-header__top {
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px 18px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 28px;
      transition: padding 0.28s ease;
    }
    .site-header.is-scrolled .site-header__top {
      padding: 12px 20px 14px;
      align-items: center;
    }
    .site-header__left { flex: 1; min-width: 0; }
    .header-title {
      font-size: 28px;
      font-weight: 800;
      line-height: 1.05;
      letter-spacing: -0.03em;
      color: #000;
    }
    .header-subtitle {
      font-size: 16px;
      font-weight: 500;
      line-height: 1.3;
      color: rgba(0, 0, 0, 0.4);
      margin-top: 8px;
      letter-spacing: 0;
    }
    .digest-nav {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 28px;
      padding: 0 0 2px;
      margin-bottom: 2px;
    }
    .digest-nav__btn {
      font-family: inherit;
      font-size: 24px;
      font-weight: 500;
      letter-spacing: 0;
      text-transform: none;
      background: none;
      border: none;
      padding: 4px 0;
      cursor: pointer;
      color: rgba(0, 0, 0, 0.4);
      transition: color 0.15s;
    }
    .digest-nav__btn:hover:not(:disabled) { color: rgba(0, 0, 0, 0.55); }
    .digest-nav__btn.is-active { color: #000; font-weight: 700; }
    .digest-nav__btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .header-rule {
      width: 100vw;
      margin-left: calc(50% - 50vw);
      height: 1px;
      background: var(--border-color);
      border: 0;
      padding: 0;
    }
    .list-container .list-item:first-child { border-top: none; }
    .list-item {
      display: flex; align-items: flex-start; gap: 4%;
      min-width: 0;
      padding: 32px 0; border-top: 1px solid var(--border-color);
      cursor: pointer; position: relative; text-decoration: none;
      color: inherit; background: var(--bg-card);
    }
    .digest-view { display: none; }
    .digest-view.is-active { display: block; }
    #view-tweets.list-container,
    #view-podcasts.list-container { padding-top: 36px; }
    .digest-empty { padding: 48px 0; text-align: center; color: var(--text-secondary); font-size: 15px; }
    .pd-wrap--embed {
      max-width: 720px;
      margin: 0 auto;
      padding: 32px 0 48px;
    }
    .pd-hero-title { font-size: clamp(1.35rem, 4vw, 1.75rem); font-weight: 800; letter-spacing: -0.03em; margin-bottom: 20px; }
    .pd-source-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 28px;
      padding-bottom: 18px;
      border-bottom: 1px solid #ccc;
    }
    .pd-source-k { font-weight: 800; font-size: 13px; }
    .pd-source-name { font-size: 14px; color: var(--text-secondary); }
    .pd-jump {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      color: var(--text-primary);
      white-space: nowrap;
    }
    .pd-jump:hover { text-decoration: underline; }
    .pd-block { margin-bottom: 0; margin-top: 36px; }
    .pd-block:first-of-type { margin-top: 0; }
    .pd-block__title {
      font-size: calc(18px + 0.8vw);
      font-weight: 700;
      line-height: 1.35;
      letter-spacing: -0.02em;
      margin-bottom: 10px;
      color: var(--text-primary);
    }
    .pd-block__body { padding-left: 0; }
    .pd-prose, .pd-ul {
      font-size: calc(12px + 0.2vw);
      font-weight: 500;
      line-height: 1.45;
      color: var(--text-primary);
    }
    .pd-ul { margin: 0; padding-left: 1.15em; }
    .pd-ul li { margin-bottom: 8px; }
    .pd-date { font-size: 12px; color: var(--text-secondary); margin-top: 16px; }
    .item-cover {
      flex: 0 0 38%;
      min-width: 0;
      max-width: 38%;
      background: var(--bg-primary);
      aspect-ratio: 4 / 3;
      overflow: hidden;
    }
    .item-cover img {
      width: 100%;
      height: 100%;
      max-width: 100%;
      min-width: 0;
      object-fit: cover;
      object-position: top center;
      display: block;
    }
    /* 根 svg 已写死 width/height=viewBox；cover 铺满列表缩略区，与 preview-fallbacks 全宽观感一致 */
    .item-cover img.is-fallback { object-fit: cover; object-position: center; }
    .item-content {
      flex: 1 1 0;
      min-width: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      padding-right: 40px;
    }
    .jump-arrow { position: absolute; top: 0; right: 0; font-size: 24px; line-height: 1; font-family: Arial, sans-serif; }
    .item-title-zh {
      font-size: calc(18px + 0.8vw); font-weight: 700; line-height: 1.35; margin-bottom: 10px;
      display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
    }
    .item-desc-en {
      font-size: calc(12px + 0.2vw); font-weight: 500; color: var(--text-secondary); line-height: 1.45;
      display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
      text-transform: none;
      letter-spacing: 0;
    }
    .item-desc-original { color: #333; }
    .meta-row {
      display: flex; align-items: center; gap: 10px;
      font-size: 11px; font-weight: 800; letter-spacing: 0.5px;
      margin-top: 24px; flex-wrap: wrap;
    }
    .meta-row .avatar-img { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
    @media (max-width: 600px) {
      .page-wrapper { padding: 0 16px 48px; }
      .site-header__top {
        flex-direction: column;
        align-items: stretch;
        padding: 32px 16px 16px;
        gap: 18px;
      }
      .site-header.is-scrolled .site-header__top { padding: 10px 16px 12px; align-items: stretch; }
      .digest-nav { justify-content: flex-start; gap: 22px; margin-bottom: 0; }
      .digest-nav__btn { font-size: 24px; }
      .item-cover { flex: 0 0 35%; max-width: 35%; }
      .item-content { padding-right: 28px; }
      .item-title-zh { font-size: calc(15px + 0.8vw); }
      .item-desc-en { font-size: 11px; }
    }
    @media (max-width: 380px) { .item-cover { flex: 0 0 32%; max-width: 32%; } }
  </style>
  ${fallbackLib.length ? `<script type="application/json" id="digest-fallback-lib">${JSON.stringify(fallbackLib).replace(/</g, "\\u003c")}</script>` : ""}
  <script>
  (function(){
    var PAL=[{bg:"#F4F4F4",tx:"#111",ac:"#111",s1:"#111",s2:"#F4F4F4"}];
    var LIB=[];
    try{var _je=document.getElementById("digest-fallback-lib");if(_je)LIB=JSON.parse(_je.textContent);}catch(_e){LIB=[];}
    function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
    function trunc(s,n){s=String(s||"");return s.length>n?s.slice(0,n-1)+"…":s;}
    /** 画廊大标题区：去掉尾部「（职务）」避免 52px 下超长触发 textLength 叠字。 */
    function stripAuthorDisplay(s){
      return String(s||"").trim().replace(/（[^）]*）\\s*$/,"").replace(/\\([^)]*\\)\\s*$/,"").trim();
    }
    function hashStr(s){
      var h=2166136261>>>0,k=String(s||"");
      for(var i=0;i<k.length;i++)h=Math.imul(h^k.charCodeAt(i),16777619)>>>0;
      return h;
    }
    function fallbackBg(n,tg){
      var BGS=["F5F0EB","E8EDF2","EDE8E4","EEF4EA","F2EBF5","EAF4F2","F0EBF4","E6F0EC"];
      return "#"+BGS[hashStr(String(n)+"|"+String(tg))%BGS.length];
    }
    function tagIcon(tg){
      var t=String(tg||"").toLowerCase().replace(/[·•]/g," ").replace(/\\s+/g," ").trim();
      if(t.indexOf("security")>=0||t.indexOf("safety")>=0)return "shield";
      if(t.indexOf("podcast")>=0||t.indexOf("youtube")>=0||t.indexOf("materials")>=0)return "mic";
      if(t.indexOf("openai")>=0||t.indexOf("anthropic")>=0||t.indexOf("ai agents")>=0)return "bolt";
      if(t.indexOf("culture")>=0||t.indexOf("every")>=0||t.indexOf("productivity")>=0)return "chat";
      if(t.indexOf("code")>=0||t.indexOf("github")>=0||t.indexOf("dev")>=0)return "code";
      if(t.indexOf("robot")>=0||t.indexOf("openclaw")>=0)return "gear";
      if(t.indexOf("product")>=0||t.indexOf("combinator")>=0||t.indexOf("vercel")>=0||t.indexOf("linear")>=0||t.indexOf("replit")>=0||t.indexOf("box")>=0||t.indexOf("google")>=0)return "rocket";
      return "star";
    }
    function icon(name,x,y,sz,fill){
      var sc=(sz/24).toFixed(6);
      var g='transform="translate('+x+','+y+') scale('+sc+')"';
      if(name==="code"){
        return '<g '+g+' fill="none" stroke="'+fill+'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 5 2 12 8 19"/><path d="M16 5 22 12 16 19"/></g>';
      }
      if(name==="chat"){
        return '<g '+g+'><path d="M4 3h16v9H11l-5 5.5V12H4V3z" fill="'+fill+'"/></g>';
      }
      if(name==="rocket"){
        return '<g '+g+'><path d="M12 2.5C9.2 7.8 8.5 11.2 8.5 14.5h7c0-3.3-.7-6.7-3.5-12z" fill="'+fill+'"/></g>';
      }
      if(name==="gear"){
        return '<g '+g+' fill="none" stroke="'+fill+'" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4M1 12h2m18 0h2M4.2 19.8l1.4-1.4M18.4 5.8l1.4-1.4"/></g>';
      }
      var p="";
      if(name==="shield")p="M12 2l7 4v6c0 5-3 9-7 12C8 21 5 17 5 12V6l7-4z";
      else if(name==="mic")p="M12 14a3 3 0 003-3V6a3 3 0 00-6 0v5a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 0014 0h-2z";
      else if(name==="bolt")p="M13 2L6 13h5l-1 9 8-11h-5z";
      else p="M12 17.3l-6.18 3.7 1.64-7.03L2 9.24l7.19-.61L12 2l2.81 6.63 7.19.61-5.46 4.73L18.18 21z";
      return '<path d="'+p+'" transform="translate('+x+','+y+') scale('+sc+')" fill="'+fill+'"/>';
    }
    /** Microlink 失败时内联 SVG：内容裁剪在框内，标题截断，底色随作者+主题变化以便区分条目。 */
    function t0(n,tg,c,ex,ic){
      var bg=fallbackBg(n,tg);
      var name=esc(trunc(String(stripAuthorDisplay(n)||"").toUpperCase(),26));
      var topic=esc(trunc(String(tg).toUpperCase(),18));
      var line=esc(trunc(String(ex||""),44));
      return '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet">'
      +'<defs><clipPath id="fbc"><rect x="10" y="10" width="380" height="280"/></clipPath></defs>'
      +'<rect width="400" height="300" fill="'+bg+'"/>'
      +'<g clip-path="url(#fbc)">'
      +'<rect x="10" y="10" width="380" height="280" fill="none" stroke="#222" stroke-width="1"/>'
      +'<text x="200" y="40" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-size="17" font-weight="800" fill="#111" text-anchor="middle" textLength="360" lengthAdjust="spacing">'+name+'</text>'
      +'<text x="200" y="58" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-size="10" font-weight="500" fill="#111" text-anchor="middle" opacity="0.55" textLength="360" lengthAdjust="spacing">'+line+'</text>'
      +icon(ic,178,118,40,"#E63946")
      +'<circle cx="80" cy="182" r="22" fill="none" stroke="#F4A261" stroke-width="2.5"/>'
      +'<polygon points="315,118 338,158 292,158" fill="none" stroke="#2A9D8F" stroke-width="2.5"/>'
      +'<text x="22" y="276" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-size="9" font-weight="700" fill="#111" letter-spacing="1.2" textLength="200" lengthAdjust="spacing">'+topic+'</text>'
      +'<text x="378" y="276" font-family="Helvetica Neue,Helvetica,Arial,sans-serif" font-size="9" font-weight="700" fill="#111" text-anchor="end" letter-spacing="1.2">X.COM</text>'
      +'</g></svg>';
    }
    var TPL=[t0];
    function normKey(s){
      return String(s||"").replace(/[·•]/g," ").replace(/\\s+/g," ").trim().toUpperCase();
    }
    function setSvgText(el,s){
      var ts=el.querySelectorAll("tspan");
      if(ts.length){ ts[0].textContent=s; for(var k=1;k<ts.length;k++){ ts[k].textContent=""; } }
      else el.textContent=s;
    }
    function isFooterGlyph(el,t){
      var y=parseFloat(el.getAttribute("y")||"0");
      if(y>262||y<26) return true;
      var u=String(t||"").trim().toUpperCase();
      if(u==="X.COM"||u==="AI BUILDERS"||u==="AI BUILDERS DIGEST") return true;
      if(/^TWITTER/.test(u)) return true;
      if(/^\\d{4}$/.test(String(t||"").trim())) return true;
      return false;
    }
    function pickExcerptEl(texts,nameU,tgU){
      var best=null,bestScore=-1,i,el,t,u,fs,op;
      for(i=0;i<texts.length;i++){
        el=texts[i];
        t=el.textContent.replace(/\\s+/g," ").trim();
        if(!t) continue;
        u=normKey(t);
        if(u===normKey(nameU)||u===normKey(tgU)) continue;
        fs=parseFloat(el.getAttribute("font-size")||"99");
        op=parseFloat(el.getAttribute("opacity")||"1");
        if(fs>13||fs<8) continue;
        var opMuted=(op>=0.42&&op<=0.66);
        var opDefaultLong=(op>=0.94&&t.length>22);
        if(!opMuted&&!opDefaultLong) continue;
        if(isFooterGlyph(el,t)) continue;
        var score=t.length*20-Math.abs(op-0.47)*3;
        if(score>bestScore){ bestScore=score; best=el; }
      }
      return best;
    }
    /** 估算 text 在 SVG 用户单位下的宽度，用于避免对短标题滥用 textLength+spacingAndGlyphs（会把整字拉扁拉宽）。 */
    function approxTextWidth(t,fs){
      var w=0,i,c;
      t=String(t||"");
      for(i=0;i<t.length;i++){
        c=t.charCodeAt(i);
        w+=(c>=0x2e80)?fs*0.96:fs*0.52;
      }
      return w;
    }
    function fitSvgText(el){
      var t=el.textContent.replace(/\\s+/g," ").trim();
      if(!t||isFooterGlyph(el,t)) return;
      var fs=parseFloat(el.getAttribute("font-size")||"0");
      if(fs<6) return;
      var x=parseFloat(el.getAttribute("x")||"0");
      var ta=el.getAttribute("text-anchor")||"start";
      var vb=400,m=18,maxW;
      if(ta==="middle") maxW=Math.min(2*Math.min(x,vb-x)-2*m,368);
      else if(ta==="end") maxW=Math.min(Math.max(x-m,120),368);
      else maxW=Math.min(vb-x-m,368);
      maxW=Math.max(120,Math.min(372,maxW));
      var aw=approxTextWidth(t,fs);
      el.removeAttribute("textLength");
      el.removeAttribute("lengthAdjust");
      if(aw<=maxW) return;
      var ell="…",s=t;
      while(s.length>1&&approxTextWidth(s+ell,fs)>maxW) s=s.slice(0,-1);
      if(approxTextWidth(s+ell,fs)>maxW) s="";
      setSvgText(el,s+ell);
    }
    /** 仅替换与模版占位完全一致的 svg:text 节点，避免整串 split 误伤 COGNITION 等词；仅过长文案才用 textLength 收紧。 */
    function applyGalleryCard(card,n,tg,raw){
      var dec=decodeURIComponent(card.e);
      if(card.a&&dec.indexOf(card.a)<0) return "";
      var nameU=String(stripAuthorDisplay(n)||"").trim().replace(/\\s+/g," ").toUpperCase();
      var tgU=String(tg||"").trim().replace(/\\s+/g," ").toUpperCase();
      var excerpt=trunc(raw||"",56);
      var doc=(new DOMParser()).parseFromString(dec,"image/svg+xml");
      if(doc.querySelector("parsererror")||!doc.documentElement||doc.documentElement.localName!=="svg") return "";
      var texts=doc.querySelectorAll("text");
      var ak=normKey(card.a), tk=normKey(card.t);
      /** 这些版式的首行「占位作者名」实为模版标题（如 MOSCOW LIST），不应换成当前条目作者。 */
      var keepLayoutTitle={"MOSCOW LIST":1,"SWATCH CARD":1,"YARD SALE":1,"ALTURA":1,"LUME TEAM":1};
      var i,el,t,matchedA=false;
      for(i=0;i<texts.length;i++){
        el=texts[i];
        t=normKey(el.textContent);
        if(card.a&&t===ak){
          if(!keepLayoutTitle[ak]) setSvgText(el,nameU);
          matchedA=true;
        }
      }
      if(card.a&&!matchedA) return "";
      for(i=0;i<texts.length;i++){
        el=texts[i];
        t=normKey(el.textContent);
        if(card.t&&t===tk) setSvgText(el,tgU);
      }
      var exEl=pickExcerptEl(texts,nameU,tgU);
      if(exEl) setSvgText(exEl,excerpt);
      for(i=0;i<texts.length;i++) fitSvgText(texts[i]);
      var rootSvg=doc.documentElement;
      if(rootSvg&&rootSvg.localName==="svg"){
        var vb=(rootSvg.getAttribute("viewBox")||"").trim().split(/\\s+/),sw=400,sh=300;
        if(vb.length===4){ sw=parseFloat(vb[2])||sw; sh=parseFloat(vb[3])||sh; }
        rootSvg.setAttribute("width",String(sw));
        rootSvg.setAttribute("height",String(sh));
        if(!rootSvg.getAttribute("preserveAspectRatio")) rootSvg.setAttribute("preserveAspectRatio","xMidYMid meet");
      }
      var out=(new XMLSerializer()).serializeToString(doc.documentElement);
      return out.indexOf("<svg")===0?out:"";
    }
    /* 列表封面：src 为 Microlink 远程图，仅加载失败时 onerror 进入此逻辑，再依次尝试画廊模版与 t0。 */
    window.handleImgError=function(img){
      img.onerror=null;
      img.classList.add("is-fallback");
      var li=img.closest(".list-item"); if(!li) return;
      var spans=li.querySelectorAll(".meta-row span"),parts=[];
      for(var i=0;i<spans.length;i++){var t=spans[i].textContent.trim(); if(t!=="·"&&t!=="•") parts.push(t);}
      var n=parts[0]||"AI", tg=parts[parts.length-1]||"NEWS";
      var descEl=li.querySelector(".item-desc-en");
      var titleEl=li.querySelector(".item-title-zh");
      var raw=(descEl&&descEl.textContent.trim())?descEl.textContent.trim():(titleEl?titleEl.textContent.trim():"");
      var ex=trunc(raw,48);
      var ic=tagIcon(tg);
      if(LIB&&LIB.length){
        var base=hashStr(n+"|"+tg)+hashStr(raw);
        for(var k=0;k<LIB.length;k++){
          var c=LIB[(base+k)%LIB.length];
          try{
            var svg=applyGalleryCard(c,n,tg,raw);
            if(svg&&svg.indexOf("<svg")>=0){
              img.src="data:image/svg+xml,"+encodeURIComponent(svg);
              return;
            }
          }catch(_err){}
        }
      }
      img.src="data:image/svg+xml,"+encodeURIComponent(TPL[0](n,tg,PAL[0],ex,ic));
    };
  })();
  </script>
</head>
<body>
  <header class="site-header" id="site-header" role="banner">
    <div class="site-header__top">
      <div class="site-header__left">
        <div class="header-title">${escapeHtml(DIGEST_DISPLAY_TITLE)}</div>
        <div class="header-subtitle">更新时间：${escapeHtml(date)}</div>
      </div>
      <nav class="digest-nav" aria-label="内容切换">
        <button type="button" class="digest-nav__btn is-active" data-view="tweets" id="nav-tweets">${escapeHtml(navTweetLabel)}</button>
        <button type="button" class="digest-nav__btn" data-view="podcasts" id="nav-podcasts"${podDisabled ? " disabled" : ""}>${escapeHtml(navPodLabel)}</button>
      </nav>
    </div>
    <div class="header-rule" role="presentation"></div>
  </header>
  <div class="page-wrapper">
    <div id="view-tweets" class="digest-view is-active list-container" data-digest-view="tweets">
${tweetsHtml}
    </div>
    <div id="view-podcasts" class="digest-view list-container" data-digest-view="podcasts">
${podcastsPanelHtml}
    </div>
  </div>
  <script>
  (function(){
    var el=document.getElementById("site-header");
    if(el){
      function tick(){
        var y=window.scrollY||document.documentElement.scrollTop;
        el.classList.toggle("is-scrolled",y>6);
      }
      window.addEventListener("scroll",tick,{passive:true});
      tick();
    }
    var vT=document.getElementById("view-tweets");
    var vP=document.getElementById("view-podcasts");
    var bT=document.getElementById("nav-tweets");
    var bP=document.getElementById("nav-podcasts");
    function show(which){
      if(which==="podcasts"&&bP&&bP.disabled) which="tweets";
      if(vT) vT.classList.toggle("is-active",which==="tweets");
      if(vP) vP.classList.toggle("is-active",which==="podcasts");
      if(bT) bT.classList.toggle("is-active",which==="tweets");
      if(bP) bP.classList.toggle("is-active",which==="podcasts");
      var h=which==="podcasts"?"#podcasts":"";
      if(location.hash!==h) history.replaceState(null,"",location.pathname+location.search+h);
    }
    function fromHash(){
      return location.hash==="#podcasts"?"podcasts":"tweets";
    }
    if(bT) bT.addEventListener("click",function(){ show("tweets"); });
    if(bP) bP.addEventListener("click",function(){ show("podcasts"); });
    window.addEventListener("hashchange",function(){ show(fromHash()); });
    show(fromHash());
  })();
  </script>
</body>
</html>`;
}

async function main() {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  const normalized = normalizeText(raw);
  const parsed = parseItems(normalized);
  let items = assignPodcastSlugs(parsed.items);
  const canonicalPageUrl = await resolveCanonicalPageUrl();
  const podcastItems = items.filter((it) => it.kind === "podcast");

  console.log("Resolving X preview images (FxTwitter)…");
  items = await enrichItemsWithTweetCovers(items);

  const statsForOg = digestStats(items);
  const ogSvg = buildOgCardSvg({ date: parsed.date, stats: statsForOg });
  await fs.writeFile(path.join(ROOT, OG_CARD_FILENAME), ogSvg, "utf8");

  const html = buildHtml({ date: parsed.date, items }, canonicalPageUrl);
  await fs.writeFile(OUT_PATH, html, "utf8");

  for (const f of await fs.readdir(ROOT)) {
    if (/^podcast-\d+\.html$/i.test(f)) {
      await fs.unlink(path.join(ROOT, f));
    }
  }

  const writes = [];
  for (const it of podcastItems) {
    if (it.podcastSlug) {
      const detail = buildPodcastDetailHtml(it, { date: parsed.date, ytHref: it.url });
      writes.push(fs.writeFile(path.join(ROOT, it.podcastSlug), detail, "utf8"));
    }
  }
  await Promise.all(writes);
  console.log(
    `OK: wrote ${path.relative(ROOT, OUT_PATH)} + ${writes.length} podcast page(s), ${items.length} items (${parsed.date})`,
  );
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
