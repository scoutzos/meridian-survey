import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const inputPath = path.join(cwd, "VA_QA_Testing_Instructions.md");
const outputDir = path.join(cwd, "outputs", "va-qa-testing");
const outputPath = path.join(outputDir, "Meridian_VA_QA_Testing_Instructions.html");
const logoPath = path.join(cwd, "public", "logos", "meridian-collective-transparent.svg");

const markdown = fs.readFileSync(inputPath, "utf8");
const logo = fs.existsSync(logoPath) ? fs.readFileSync(logoPath, "utf8") : "";
const today = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "long",
  day: "numeric",
  year: "numeric",
}).format(new Date());

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function inlineMarkdown(value) {
  let html = escapeHtml(value);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`([^`]+?)`/g, "<span class=\"inline-code\">$1</span>");
  return html;
}

function closeList(state, html) {
  if (!state.listType) return;
  html.push(`</${state.listType}>`);
  state.listType = null;
}

function renderMarkdown(source) {
  const lines = source.split(/\r?\n/);
  const html = [];
  const state = { listType: null, sectionOpen: false, inCode: false, codeLines: [] };
  let skippedTitle = false;

  function flushCode() {
    if (!state.inCode) return;
    html.push(`<div class="script-box"><pre>${escapeHtml(state.codeLines.join("\n"))}</pre></div>`);
    state.inCode = false;
    state.codeLines = [];
  }

  function openSection(title) {
    closeList(state, html);
    if (state.sectionOpen) html.push("</section>");
    html.push(`<section class="section"><h2>${inlineMarkdown(title)}</h2>`);
    state.sectionOpen = true;
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, "");

    if (line.startsWith("```")) {
      if (state.inCode) {
        flushCode();
      } else {
        closeList(state, html);
        state.inCode = true;
        state.codeLines = [];
      }
      continue;
    }

    if (state.inCode) {
      state.codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList(state, html);
      continue;
    }

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      if (!skippedTitle && h1[1].trim() === "VA QA Testing Instructions") {
        skippedTitle = true;
        continue;
      }
      closeList(state, html);
      html.push(`<h1>${inlineMarkdown(h1[1])}</h1>`);
      continue;
    }

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      openSection(h2[1]);
      continue;
    }

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      closeList(state, html);
      html.push(`<h3>${inlineMarkdown(h3[1])}</h3>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      if (state.listType !== "ol") {
        closeList(state, html);
        html.push("<ol>");
        state.listType = "ol";
      }
      html.push(`<li>${inlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    const unordered = line.match(/^\s*-\s+(.+)$/);
    if (unordered) {
      if (state.listType !== "ul") {
        closeList(state, html);
        html.push("<ul>");
        state.listType = "ul";
      }
      html.push(`<li>${inlineMarkdown(unordered[1])}</li>`);
      continue;
    }

    closeList(state, html);
    const paragraphClass = /^(Pass check|Expected reply tracking|Optional voicemail test):?$/.test(line.trim())
      ? " class=\"check-heading\""
      : "";
    html.push(`<p${paragraphClass}>${inlineMarkdown(line)}</p>`);
  }

  flushCode();
  closeList(state, html);
  if (state.sectionOpen) html.push("</section>");
  return html.join("\n");
}

const content = renderMarkdown(markdown);

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Meridian VA QA Testing Instructions</title>
  <style>
    :root {
      --obsidian: #14110D;
      --bone: #EDE6D6;
      --brass: #C9A878;
      --brass-deep: #A88859;
      --fog: #D6CDB7;
      --ink: #1A1A1A;
      --surface: #F7F1E4;
      --muted: #6B6B68;
      --display: "Cormorant Garamond", "EB Garamond", "Playfair Display", Georgia, serif;
      --body: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    }

    @page {
      size: Letter;
      margin: 0.55in 0.58in 0.62in;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      background: var(--bone);
      color: var(--ink);
      font-family: var(--body);
      font-size: 10.7pt;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .cover {
      min-height: 9.86in;
      margin: -0.55in -0.58in -0.62in;
      padding: 0.74in 0.72in;
      background: var(--obsidian);
      color: var(--bone);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
      position: relative;
      overflow: hidden;
    }

    .cover::before {
      content: "";
      position: absolute;
      inset: 0.34in;
      border: 1px solid rgba(201, 168, 120, 0.34);
      pointer-events: none;
    }

    .cover-mark {
      width: 2.15in;
      margin-left: -0.18in;
    }

    .cover-kicker,
    .eyebrow {
      margin: 0 0 0.16in;
      color: var(--brass);
      font-size: 8.4pt;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .cover h1 {
      max-width: 6.2in;
      margin: 0;
      color: var(--bone);
      font-family: var(--display);
      font-size: 46pt;
      font-weight: 300;
      line-height: 0.95;
      letter-spacing: -0.018em;
    }

    .cover-subtitle {
      max-width: 5.55in;
      margin-top: 0.28in;
      color: rgba(237, 230, 214, 0.84);
      font-size: 12.6pt;
      line-height: 1.5;
    }

    .cover-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.12in;
      margin-top: 0.44in;
      max-width: 6.55in;
    }

    .cover-card {
      border: 1px solid rgba(201, 168, 120, 0.35);
      background: rgba(237, 230, 214, 0.055);
      padding: 0.14in;
      min-height: 0.95in;
    }

    .cover-card strong {
      display: block;
      color: var(--bone);
      font-size: 14pt;
      margin-bottom: 0.04in;
    }

    .cover-card span {
      color: rgba(237, 230, 214, 0.72);
      font-size: 8.8pt;
      line-height: 1.35;
    }

    .cover-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 0.3in;
      color: rgba(237, 230, 214, 0.74);
      font-size: 9pt;
      position: relative;
      z-index: 1;
    }

    .document-header {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: end;
      gap: 0.2in;
      border-bottom: 1px solid var(--fog);
      padding-bottom: 0.16in;
      margin-bottom: 0.25in;
    }

    .document-header strong {
      display: block;
      font-family: var(--display);
      font-size: 24pt;
      font-weight: 400;
      line-height: 1;
      color: var(--obsidian);
    }

    .document-header span {
      color: var(--muted);
      font-size: 8.7pt;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .quick-reference {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.1in;
      margin: 0 0 0.24in;
    }

    .quick-card {
      border: 1px solid var(--fog);
      background: var(--surface);
      padding: 0.13in;
      min-height: 0.76in;
    }

    .quick-card span {
      display: block;
      margin-bottom: 0.04in;
      color: var(--brass-deep);
      font-size: 7.6pt;
      font-weight: 800;
      letter-spacing: 0.13em;
      text-transform: uppercase;
    }

    .quick-card strong {
      display: block;
      color: var(--obsidian);
      font-size: 10.4pt;
      line-height: 1.28;
    }

    .safety-band {
      margin: 0 0 0.28in;
      border-left: 0.07in solid var(--brass);
      background: rgba(20, 17, 13, 0.06);
      padding: 0.14in 0.18in;
      color: var(--obsidian);
      font-size: 10pt;
      line-height: 1.45;
    }

    .section {
      page-break-inside: avoid;
      margin: 0 0 0.22in;
      padding-bottom: 0.08in;
      border-bottom: 1px solid rgba(214, 205, 183, 0.74);
    }

    .section:nth-of-type(n+5) {
      page-break-inside: auto;
    }

    h1, h2, h3, p, ul, ol, pre { margin-top: 0; }

    h2 {
      margin: 0 0 0.11in;
      color: var(--obsidian);
      font-family: var(--display);
      font-size: 22pt;
      font-weight: 400;
      line-height: 1.05;
      letter-spacing: -0.012em;
    }

    h3 {
      margin: 0.15in 0 0.06in;
      color: var(--obsidian);
      font-size: 10pt;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    p {
      margin: 0 0 0.08in;
    }

    ul, ol {
      margin: 0 0 0.1in 0.2in;
      padding-left: 0.12in;
    }

    li {
      margin: 0 0 0.035in;
      padding-left: 0.02in;
    }

    li::marker {
      color: var(--brass-deep);
      font-weight: 800;
    }

    strong {
      color: var(--obsidian);
      font-weight: 800;
    }

    .inline-code {
      display: inline-block;
      padding: 0.01in 0.04in;
      border: 1px solid rgba(201, 168, 120, 0.42);
      background: rgba(255, 252, 245, 0.72);
      color: var(--obsidian);
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 8.6pt;
      white-space: nowrap;
    }

    .script-box {
      margin: 0.08in 0 0.13in;
      border: 1px solid rgba(201, 168, 120, 0.58);
      background: #fffaf0;
      page-break-inside: avoid;
    }

    .script-box pre {
      margin: 0;
      padding: 0.12in 0.14in;
      color: var(--obsidian);
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
      font-size: 8.7pt;
      line-height: 1.42;
      white-space: pre-wrap;
    }

    .check-heading {
      margin-top: 0.11in;
      color: var(--brass-deep);
      font-size: 8pt;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .footer-note {
      margin-top: 0.24in;
      padding-top: 0.12in;
      border-top: 1px solid var(--fog);
      color: var(--muted);
      font-size: 8.2pt;
      text-align: center;
    }

    @media print {
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
  <section class="cover">
    <div>
      <div class="cover-mark">${logo}</div>
      <p class="cover-kicker">VA Desk QA Runbook</p>
      <h1>Testing Instructions</h1>
      <p class="cover-subtitle">A controlled first-day workflow test for list upload, bulk SMS, inbound replies, calls, assigned tasks, time clock, and daily brief submission.</p>
      <div class="cover-grid">
        <div class="cover-card"><strong>5</strong><span>QA property records using member phone numbers only.</span></div>
        <div class="cover-card"><strong>SMS</strong><span>Bulk send plus inbound reply matching.</span></div>
        <div class="cover-card"><strong>Brief</strong><span>Clock in, work tasks, submit daily brief, clock out.</span></div>
      </div>
    </div>
    <div class="cover-footer">
      <span>Prepared for Sophie / VA</span>
      <span>${today}</span>
    </div>
  </section>

  <header class="document-header">
    <div>
      <span>Meridian Collective</span>
      <strong>VA QA Testing Instructions</strong>
    </div>
    <div class="eyebrow">Controlled Test</div>
  </header>

  <section class="quick-reference">
    <div class="quick-card"><span>File</span><strong>VA_QA_5_Property_Bulk_SMS_Test.csv</strong></div>
    <div class="quick-card"><span>Audience</span><strong>Exactly 5 QA records</strong></div>
    <div class="quick-card"><span>Reply Format</span><strong>RECEIVED - [name]</strong></div>
    <div class="quick-card"><span>Stop If</span><strong>Any real seller number appears</strong></div>
  </section>

  <section class="safety-band">
    Use this only for the controlled Meridian VA workflow test. Do not upload, text, or call real seller lists during this run.
  </section>

  ${content}

  <p class="footer-note">Meridian Collective · VA QA Runbook · Use with the QA CSV and results workbook only.</p>
</body>
</html>
`;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, html);
console.log(outputPath);
