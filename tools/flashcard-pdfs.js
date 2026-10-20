#!/usr/bin/env node
/* Builds the printable flashcard PDFs in assets/pdf/ from the site's own deck data.
 *
 *   npm i playwright      (once)
 *   node tools/flashcard-pdfs.js
 *
 * Layout: US Letter, 4 cards to every page (pages that run short get blank "your own card"
 * slots, so every sheet has the same 4). Each card is a strip with the question on the left
 * and the answer on the right: print single-sided, cut on the dashed lines, fold on the center
 * line. Pages are fixed boxes, so a card can never split across two pages. Text that is too
 * long for its card is shrunk step by step (never below a minimum size); the build fails if
 * anything still does not fit.
 */
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'assets', 'pdf');
const PER_PAGE = 4;
const MIN_Q = 7.5, MIN_A = 7;            // smallest text sizes the fitter may use (pt)
const SPLIT_BELOW = 9;                 // a card that needs smaller text than this is split into "(1 of 2)" cards

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
/* Keep statute numbers such as "C.R.S. §10-11-102(8)" or "CRS 13-56-103" on one line. */
const keepCites = h => String(h).replace(/(?:(?:C\.R\.S\.|CRS|USC|§)\s?)?§?\b\d+(?:-\d+)+(?:\([\w.]+\))*/g, m => `<span class="nw">${m}</span>`);

function serve(extra){
  return new Promise(res=>{
    const types = { '.html':'text/html; charset=utf-8', '.woff2':'font/woff2', '.js':'text/javascript', '.css':'text/css' };
    const srv = http.createServer((req, rsp)=>{
      const u = decodeURIComponent(req.url.split('?')[0]);
      if(extra[u] !== undefined){ rsp.writeHead(200, { 'Content-Type':'text/html; charset=utf-8' }); rsp.end(extra[u]); return; }
      const f = path.join(ROOT, u === '/' ? 'index.html' : u);
      if(!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){ rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rsp);
    }).listen(0, '127.0.0.1', ()=> res(srv));
  });
}

const CSS = `
@font-face{ font-family:'Inter'; font-weight:400; src:url(/tools/fonts/inter-latin-400-normal.woff2) format('woff2'); }
@font-face{ font-family:'Inter'; font-weight:600; src:url(/tools/fonts/inter-latin-600-normal.woff2) format('woff2'); }
@font-face{ font-family:'Inter'; font-weight:700; src:url(/tools/fonts/inter-latin-700-normal.woff2) format('woff2'); }
@page{ size:8.5in 11in; margin:0; }
*{ box-sizing:border-box; }
html,body{ margin:0; padding:0; }
body{ font-family:'Inter', 'DejaVu Sans', Arial, sans-serif; color:#161a2b; -webkit-print-color-adjust:exact; print-color-adjust:exact; font-feature-settings:"cv05","cv11"; }
.sheet{ width:8.5in; height:11in; padding:.42in .5in .4in; display:flex; flex-direction:column; overflow:hidden; break-after:page; page-break-after:always; }
.sheet:last-child{ break-after:auto; page-break-after:auto; }
.head{ flex:0 0 auto; display:flex; justify-content:space-between; align-items:flex-end; padding-bottom:6pt; border-bottom:1.25pt solid #1b2a4a; }
.head .t{ font-size:11pt; font-weight:600; color:#1b2a4a; letter-spacing:-.01em; }
.head .t span{ color:#8a5a12; font-weight:600; font-size:7.5pt; letter-spacing:.14em; text-transform:uppercase; margin-right:6pt; }
.head .pg{ font-size:8pt; color:#6b7284; }
.cards{ flex:1 1 auto; min-height:0; display:grid; grid-template-rows:repeat(${PER_PAGE}, minmax(0, 1fr)); margin:10pt 0 8pt; border-bottom:.75pt dashed #8f96a3; }
.card{ display:grid; grid-template-columns:1fr 1fr; min-height:0; border:.75pt dashed #8f96a3; border-bottom:0; }
.half{ min-height:0; display:flex; flex-direction:column; padding:9pt 13pt 10pt; overflow:hidden; }
.half.a{ border-left:.75pt dotted #b8bdc7; }
.lab{ flex:0 0 auto; display:flex; justify-content:space-between; gap:6pt; font-size:6pt; font-weight:600; letter-spacing:.13em; text-transform:uppercase; color:#8f96a3; margin-bottom:5pt; white-space:nowrap; }
.lab .x{ color:#8a5a12; }
.box{ flex:1 1 auto; min-height:0; display:flex; flex-direction:column; justify-content:center; overflow:hidden; }
.in{ line-height:1.32; }
.q .in{ font-weight:600; letter-spacing:-.005em; }
.short .in{ text-align:center; font-weight:600; letter-spacing:-.015em; line-height:1.22; }
ol.ch{ margin:.45em 0 0; padding-left:1.45em; font-weight:400; }
ol.ch li{ margin:.12em 0; }
.ans{ font-weight:600; }
.ctip{ margin-top:.45em; }
.crule{ margin-top:.45em; font-size:.86em; color:#5b6274; }
.blank .lab{ color:#c3c7cf; }
.nw{ white-space:nowrap; }
.foot{ flex:0 0 auto; display:flex; justify-content:space-between; font-size:7pt; color:#8f96a3; }
`;

const plain = h => String(h).replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/gi, ' ').trim();
function cardHtml(c, i, area){
  const isShort = c.kind !== 'exam' && !c.choices;          // a term: centered, large
  const shortA = plain(c.b).length <= 30;                   // a one-line answer such as "1 year"

  const q = `<div class="in">${keepCites(esc(c.f))}${c.choices ? `<ol class="ch" type="A">${c.choices.map(x=> `<li>${esc(x)}</li>`).join('')}</ol>` : ''}</div>`;
  return `<div class="card">
    <div class="half q${isShort ? ' short' : ''}"><div class="lab"><span>${esc(area)} · ${i}</span>${c.kind === 'exam' ? '<span class="x">Exam-style</span>' : ''}</div><div class="box" data-fit="q" data-id="${c.id}" data-start="${isShort ? 15 : 10.5}">${q}</div></div>
    <div class="half a${shortA ? ' short' : ''}"><div class="lab"><span>Answer · ${i}</span></div><div class="box" data-fit="a" data-id="${c.id}" data-start="${shortA ? 15 : 10}">${'<div class="in">' + keepCites(c.b) + '</div>'}</div></div>
  </div>`;
}
const blankHtml = () => `<div class="card blank"><div class="half q"><div class="lab"><span>Your own card</span></div><div class="box"></div></div><div class="half a"><div class="lab"><span>Answer</span></div><div class="box"></div></div></div>`;

/* sections: [{ title, kicker, label, cards:[{f,b,choices,kind}] }]; each section starts on a new page */
function docHtml(docTitle, sections){
  const pages = [];
  sections.forEach(s=>{
    for(let i = 0; i < s.cards.length; i += PER_PAGE){
      const chunk = s.cards.slice(i, i + PER_PAGE);
      const slots = chunk.map((c, k)=> cardHtml(c, i + k + 1, s.label));
      while(slots.length < PER_PAGE) slots.push(blankHtml());
      pages.push({ s, html: slots.join('') });
    }
  });
  const total = pages.length;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(docTitle)}</title><style>${CSS}</style></head><body>` +
    pages.map((pg, n)=> `<section class="sheet">
      <div class="head"><div class="t"><span>${esc(pg.s.kicker)}</span>${esc(pg.s.title)}</div><div class="pg">Page ${n + 1} of ${total}</div></div>
      <div class="cards">${pg.html}</div>
      <div class="foot"><span>Print single-sided. Cut on the dashed lines, then fold each card on the center line.</span><span>Colorado Title Insurance Exam Prep</span></div>
    </section>`).join('') + `</body></html>`;
}

/* Shrinks each card's text until it fits its box; returns the sizes used and anything that still overflows. */
function fitAll({ minQ, minA }){
  const sizes = [], over = [];
  document.querySelectorAll('.box[data-fit]').forEach(box=>{
    const inner = box.firstElementChild, min = box.dataset.fit === 'q' ? minQ : minA;
    let size = parseFloat(box.dataset.start);
    box.style.fontSize = size + 'pt';
    while(inner.scrollHeight > box.clientHeight + .5 && size > min){ size = Math.round((size - .25) * 100) / 100; box.style.fontSize = size + 'pt'; if(size < 8.5) inner.style.lineHeight = '1.25'; }
    sizes.push({ k: box.dataset.fit, id: box.dataset.id, size });
    if(inner.scrollHeight > box.clientHeight + .5) over.push(inner.textContent.slice(0, 80));
  });
  return { sizes, over };
}

/* Splits a plain-text answer into n parts of similar length, at numbered items "(1) ... (2) ..."
   when it has them, otherwise at sentence breaks. Returns null when it cannot be split. */
function splitText(text, n){
  let units = text.split(/(?=\(\d+\)\s)/).map(x=> x.trim()).filter(Boolean);
  if(units.length < n) units = text.split(/(?<=\.)\s+(?=[A-Z(])|(?<=;)\s+/).map(x=> x.trim()).filter(Boolean);
  if(units.length < n) return null;
  const total = units.reduce((a, u)=> a + u.length, 0), parts = [];
  let cur = [], len = 0;
  units.forEach((u, i)=>{
    cur.push(u); len += u.length;
    const left = units.length - i - 1, need = n - parts.length - 1;
    if(need > 0 && (len >= total / n || left === need)){ parts.push(cur.join(' ')); cur = []; len = 0; }
  });
  if(cur.length) parts.push(cur.join(' '));
  if(parts.length !== n) return null;
  /* a list cut mid-way: "...;" ends one card and the next picks up with "…" */
  return parts.map((t, i)=> (i > 0 && !/^\(\d+\)/.test(t) ? '… ' : '') + (i < n - 1 ? t.replace(/;$/, ' …') : t));
}
function expand(cards, splits){
  const out = [];
  cards.forEach(c=>{
    const n = splits[c.id] || 1;
    const plainB = c.b.replace(/^<div>|<\/div>$/g, '');
    const parts = n > 1 && !/<[a-z]/i.test(plainB) ? splitText(plainB, n) : null;
    if(!parts){ out.push(c); return; }
    parts.forEach((t, k)=> out.push(Object.assign({}, c, { id: c.id + '.' + (k + 1), f: `${c.f} (${k + 1} of ${n})`, b: '<div>' + esc(t) + '</div>' })));
  });
  return out;
}

(async()=>{
  fs.mkdirSync(OUT, { recursive: true });
  const docs = {};
  const srv = await serve(docs);
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const page = await browser.newPage();
  await page.goto(base + '/'); await page.waitForTimeout(500);
  const data = await page.evaluate(()=>({
    areas: CATS.map(c=>({ key:c.key, num:areaNumber(c.key), short:AREA_SHORT[c.key],
      cards: deckFor(c.key, 'all').map((x, i)=>({ id:c.key + i, f:x.f, b:x.b, choices:x.choices || null, kind:x.kind })) })),
    handout: GK_DECKS.map(d=>({ key:d.key, name:d.name, cards:d.cards.map((x, i)=>({ id:d.key + i, f:x.f, b:'<div>' + x.b + '</div>', choices:null, kind:'base' })) }))
  }));
  const area = a => ({ kicker:`Area ${a.num} · Flashcards`, title:`${a.num}. ${a.short}`, label:a.short, cards:a.cards });
  const jobs = data.areas.map(a=>({ file:`flashcards-${a.key}.pdf`, title:`Flashcards: ${a.num}. ${a.short}`, sections:[area(a)] }));
  jobs.push({ file:'flashcards-colaw-handout.pdf', title:'Flashcards: Colorado law class handout',
    sections: data.handout.map(d=>({ kicker:'Class handout · Flashcards', title:d.name, label:d.name, cards:d.cards })) });
  jobs.push({ file:'flashcards-all.pdf', title:'Flashcards: all 7 content areas', sections: data.areas.map(area) });
  const report = [], manifest = {};
  let failed = false;
  for(const j of jobs){
    const route = '/__print/' + j.file.replace('.pdf', '.html');
    const p = await browser.newPage();
    const splits = {};
    let fit, sections;
    for(let round = 0; round < 4; round++){            // split any card that would need tiny text, then lay out again
      sections = j.sections.map(s=> Object.assign({}, s, { cards: expand(s.cards, splits) }));
      docs[route] = docHtml(j.title, sections);
      await p.goto(base + route); await p.evaluate(()=> document.fonts.ready);
      fit = await p.evaluate(fitAll, { minQ: MIN_Q, minA: MIN_A });
      const small = [...new Set(fit.sizes.filter(x=> x.size < SPLIT_BELOW).map(x=> x.id.split('.')[0]))];
      if(!small.length) break;
      let changed = false;
      small.forEach(id=>{ const src = j.sections.flatMap(s=> s.cards).find(c=> c.id === id); if(src && splitText(src.b.replace(/^<div>|<\/div>$/g, ''), (splits[id] || 1) + 1)){ splits[id] = (splits[id] || 1) + 1; changed = true; } });
      if(!changed) break;
    }
    const pages = await p.evaluate(()=> document.querySelectorAll('.sheet').length);
    const cards = sections.reduce((n, s)=> n + s.cards.length, 0);
    manifest[j.file] = { title: j.title, cards, pages, split: Object.keys(splits).length };
    const smallest = Math.min(...fit.sizes.map(s=> s.size));
    const shrunk = fit.sizes.filter(s=> s.size < 9).length;
    report.push(`${j.file}: ${cards} cards, ${pages} pages, smallest text ${smallest}pt, ${shrunk} sides under 9pt, ${Object.keys(splits).length} long cards split, ${fit.over.length} overflowing`);
    if(fit.over.length){ failed = true; fit.over.forEach(t=> report.push('   does not fit: ' + t)); }
    if(process.env.VERBOSE) fit.sizes.filter(x=> x.size < 9).forEach(x=> report.push(`   ${x.k} ${x.id} at ${x.size}pt`));
    await p.pdf({ path: path.join(OUT, j.file), width:'8.5in', height:'11in', printBackground:true, preferCSSPageSize:true });
    await p.close();
  }
  await browser.close(); srv.close();
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(report.join('\n'));
  if(failed){ console.error('Some cards do not fit. Shorten them or lower the minimum size.'); process.exit(1); }
})();
