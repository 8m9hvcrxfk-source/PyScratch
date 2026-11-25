/* PyScratch website builder */
const $ = s => document.querySelector(s);
const CFG = window.PYSCRATCH_CONFIG || {};
const SESSION = 'pyscratch.session', SITES = 'pyscratch.sites';
const XML_NS = 'https://developers.google.com/blockly/xml';
const user = () => localStorage.getItem(SESSION);
const readSites = () => JSON.parse(localStorage.getItem(SITES) || '{}');
const writeSites = d => localStorage.setItem(SITES, JSON.stringify(d));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let siteId = new URLSearchParams(location.search).get('site');
let siteName = 'My Website';
let loading = false;

/* ---------- Blocks: each one is a piece of the web page ---------- */
const C = { page: '#4C97FF', text: '#9966FF', media: '#59C059', links: '#FFAB19', layout: '#FF8C1A' };
const stack = (type, message0, args0, colour) => ({ type, message0, args0, previousStatement: null, nextStatement: null, colour });
const BLOCKS = [
  stack('page_title', 'page title %1', [{ type: 'field_input', name: 'T', text: 'My Website' }], C.page),
  stack('page_bg', 'background colour %1', [{ type: 'field_input', name: 'C', text: '#ffffff' }], C.page),
  stack('heading', 'heading %1', [{ type: 'field_input', name: 'T', text: 'Welcome!' }], C.text),
  stack('paragraph', 'paragraph %1', [{ type: 'field_input', name: 'T', text: 'Write something here.' }], C.text),
  stack('image', 'image from web address %1', [{ type: 'field_input', name: 'U', text: 'https://picsum.photos/600/300' }], C.media),
  stack('button', 'button %1 links to %2', [{ type: 'field_input', name: 'T', text: 'Click me' }, { type: 'field_input', name: 'U', text: 'https://example.com' }], C.links),
  stack('banner', 'coloured banner %1', [{ type: 'field_input', name: 'C', text: '#FFC929' }], C.layout),
  stack('space', 'space %1 px', [{ type: 'field_number', name: 'H', value: 24 }], C.layout),
];
(Blockly.common?.defineBlocksWithJsonArray || Blockly.defineBlocksWithJsonArray)(BLOCKS);

const cat = (name, colour, types) => ({ kind: 'category', name, colour, contents: types.map(t => ({ kind: 'block', type: t })) });
const TOOLBOX = { kind: 'categoryToolbox', contents: [
  cat('Page', C.page, ['page_title', 'page_bg']),
  cat('Text', C.text, ['heading', 'paragraph']),
  cat('Media', C.media, ['image']),
  cat('Links', C.links, ['button']),
  cat('Layout', C.layout, ['banner', 'space']),
] };

const ws = Blockly.inject('blockly', {
  toolbox: TOOLBOX, trashcan: true,
  zoom: { controls: true, wheel: true, startScale: 0.9 },
  grid: { spacing: 20, length: 3, colour: '#dde3ee', snap: true },
});

const DEFAULT_XML = `<xml xmlns="${XML_NS}">
<block type="page_title" x="30" y="30"><field name="T">My Website</field><next>
<block type="heading"><field name="T">Welcome!</field><next>
<block type="paragraph"><field name="T">This is my first web page, built with blocks.</field><next>
<block type="button"><field name="T">Click me</field><field name="U">https://example.com</field></block>
</next></block>
</next></block>
</next></block>
</xml>`;

/* ---------- HTML generator: blocks -> a standalone web page ---------- */
function genSite() {
  let title = 'My Website', bg = '#ffffff';
  const body = [];
  const safeUrl = u => (/^(https?:|#|\/)/i.test(String(u).trim()) ? String(u).trim() : '#');
  const safeColour = c => (/^#[0-9a-f]{3,8}$/i.test(String(c).trim()) ? String(c).trim() : '#ffffff');
  for (const top of ws.getTopBlocks(true)) {
    for (let b = top; b; b = b.getNextBlock()) {
      const f = n => b.getFieldValue(n) ?? '';
      switch (b.type) {
        case 'page_title': title = f('T'); break;
        case 'page_bg': bg = safeColour(f('C')); break;
        case 'heading': body.push(`<h1>${esc(f('T'))}</h1>`); break;
        case 'paragraph': body.push(`<p>${esc(f('T'))}</p>`); break;
        case 'image': body.push(`<img src="${esc(safeUrl(f('U')))}" alt="">`); break;
        case 'button': body.push(`<p><a class="btn" href="${esc(safeUrl(f('U')))}">${esc(f('T'))}</a></p>`); break;
        case 'banner': body.push(`<div class="banner" style="background:${safeColour(f('C'))}"></div>`); break;
        case 'space': body.push(`<div style="height:${Math.max(0, Math.min(400, +f('H') || 0))}px"></div>`); break;
      }
    }
  }
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>
body{margin:0;padding:24px;font-family:"Segoe UI",Helvetica,Arial,sans-serif;background:${bg};color:#2F2F3A;line-height:1.5}
h1{font-size:2.2rem;margin:.4em 0}
img{max-width:100%;border-radius:14px;display:block;margin:12px 0}
.btn{display:inline-block;background:#7F4FE0;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700}
.banner{height:80px;border-radius:14px;margin:12px 0}
</style></head>
<body>
${body.join('\n')}
<p style="font-size:12px;opacity:.6">Made with PyScratch</p>
</body></html>`;
}

/* ---------- Workspace and preview ---------- */
function refresh() { $('#preview').srcdoc = genSite(); }
function load(xml) {
  loading = true; ws.clear();
  if (xml) Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(xml), ws);
  loading = false; refresh();
}
ws.addChangeListener(e => { if (!e.isUiEvent && !loading) refresh(); });

const saved = siteId ? readSites()[siteId] : null;
if (saved) { siteName = saved.name; load(saved.xml); } else { siteId = null; load(DEFAULT_XML); }
$('#siteName').value = siteName;
$('#siteName').oninput = e => { siteName = e.target.value || 'My Website'; };
$('#btnAccount').textContent = user() ? user()[0].toUpperCase() : '?';
window.addEventListener('resize', () => Blockly.svgResize?.(ws));

/* ---------- Save, download, publish ---------- */
const currentXml = () => Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws));

$('#save').onclick = () => {
  const u = user();
  if (!u) return alert('Log in on the Editor page first (Account button), then come back.');
  const d = readSites();
  const owned = siteId && d[siteId] && d[siteId].owner === u;
  const id = owned ? siteId : uid();
  d[id] = { ...(owned ? d[id] : {}), id, owner: u, name: siteName, xml: currentXml(), updated: Date.now() };
  writeSites(d); siteId = id;
  history.replaceState(null, '', '?site=' + id);
  alert('Website saved.');
};

$('#download').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([genSite()], { type: 'text/html' }));
  a.download = (siteName || 'site').replace(/\W+/g, '_') + '.html';
  a.click();
};

$('#publish').onclick = async () => {
  const u = user();
  if (!u) return alert('Log in first (Account button on the Editor page).');
  if (!CFG.supabaseUrl || !CFG.supabaseKey)
    return alert('Publishing needs a free Supabase project. Follow "Turn on publishing" in the README, then paste the two keys into config.js.');
  const id = siteId || uid();
  try {
    const r = await fetch(`${CFG.supabaseUrl}/rest/v1/sites?on_conflict=id`, {
      method: 'POST',
      headers: {
        apikey: CFG.supabaseKey, Authorization: 'Bearer ' + CFG.supabaseKey,
        'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify([{ id, owner: u, title: siteName, html: genSite(), updated: new Date().toISOString() }]),
    });
    if (!r.ok) throw new Error(r.status + ' ' + await r.text());
  } catch (err) { return alert('Publish failed: ' + err.message); }

  const d = readSites();
  d[id] = { ...(d[id] || {}), id, owner: u, name: siteName, xml: currentXml(), published: true, updated: Date.now() };
  writeSites(d); siteId = id;
  history.replaceState(null, '', '?site=' + id);
  const link = new URL('site.html?id=' + id, location.href).href;
  $('#linkbox').hidden = false;
  $('#linkbox').innerHTML = `Published! Share this link: <a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a>`;
};
