/* PyScratch – app logic */
const $ = s => document.querySelector(s);
const DB = 'pyscratch.db', SESSION = 'pyscratch.session';
const readDb = () => JSON.parse(localStorage.getItem(DB) || '{"users":{},"projects":{}}');
const writeDb = d => localStorage.setItem(DB, JSON.stringify(d));
const user = () => localStorage.getItem(SESSION);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const setStatus = t => { $('#pyStatus').textContent = t; };
const setErr = t => { $('#pyerr').textContent = t; };
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- Blocks (Scratch-style colours) ---------- */
const C = { motion: '#4C97FF', looks: '#9966FF', sound: '#CF63CF', events: '#FFBF00', control: '#FFAB19', sensing: '#5CB1D6', operators: '#59C059', variables: '#FF8C1A', lists: '#FF661A', myblocks: '#FF6680' };
const nf = (name, value) => ({ type: 'field_number', name, value });
const BLOCKS = [
  { type: 'move', message0: 'move %1 steps', args0: [nf('N', 10)], previousStatement: null, nextStatement: null, colour: C.motion },
  { type: 'turn', message0: 'turn ↻ %1 degrees', args0: [nf('D', 15)], previousStatement: null, nextStatement: null, colour: C.motion },
  { type: 'goto', message0: 'go to x: %1 y: %2', args0: [nf('X', 0), nf('Y', 0)], previousStatement: null, nextStatement: null, colour: C.motion },
  { type: 'say', message0: 'say %1', args0: [{ type: 'field_input', name: 'T', text: 'Hello!' }], previousStatement: null, nextStatement: null, colour: C.looks },
  { type: 'flag', message0: 'when green flag clicked', nextStatement: null, colour: C.events },
  { type: 'wait', message0: 'wait %1 seconds', args0: [nf('S', 1)], previousStatement: null, nextStatement: null, colour: C.control },
  { type: 'forever', message0: 'forever %1', args0: [{ type: 'input_statement', name: 'DO' }], previousStatement: null, colour: C.control },
  { type: 'repeat', message0: 'repeat %1 %2', args0: [nf('N', 10), { type: 'input_statement', name: 'DO' }], previousStatement: null, nextStatement: null, colour: C.control },
  { type: 'if', message0: 'if %1 then %2', args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }, { type: 'input_statement', name: 'DO' }], previousStatement: null, nextStatement: null, colour: C.control },
  { type: 'on_edge', message0: 'touching edge?', output: 'Boolean', colour: C.sensing },
  { type: 'var_set', message0: 'set %1 to %2', args0: [{ type: 'field_input', name: 'VAR', text: 'score' }, nf('VAL', 0)], previousStatement: null, nextStatement: null, colour: C.variables },
  { type: 'var_change', message0: 'change %1 by %2', args0: [{ type: 'field_input', name: 'VAR', text: 'score' }, nf('VAL', 1)], previousStatement: null, nextStatement: null, colour: C.variables },
];
(Blockly.common?.defineBlocksWithJsonArray || Blockly.defineBlocksWithJsonArray)(BLOCKS);

const cat = (name, colour, types) => ({ kind: 'category', name, colour, contents: types.map(t => ({ kind: 'block', type: t })) });
const TOOLBOX = { kind: 'categoryToolbox', contents: [
  cat('Motion', C.motion, ['move', 'turn', 'goto']),
  cat('Looks', C.looks, ['say']),
  cat('Sound', C.sound, []),
  cat('Events', C.events, ['flag']),
  cat('Control', C.control, ['wait', 'forever', 'repeat', 'if']),
  cat('Sensing', C.sensing, ['on_edge']),
  cat('Operators', C.operators, []),
  cat('Variables', C.variables, ['var_set', 'var_change']),
  cat('Lists', C.lists, []),
  cat('My Blocks', C.myblocks, []),
] };

const ws = Blockly.inject('blockly', {
  toolbox: TOOLBOX, trashcan: true, renderer: 'geras',
  zoom: { controls: true, wheel: true, startScale: 0.9 },
  grid: { spacing: 20, length: 3, colour: '#dde3ee', snap: true },
});

/* ---------- Python code generator (blocks -> real Python) ---------- */
function genCode() {
  const pad = i => '    '.repeat(i);
  const nv = x => { const n = Number(x); return Number.isFinite(n) ? String(n) : '0'; };
  const vname = s => (String(s).trim().replace(/\W/g, '_').replace(/^(\d)/, '_$1')) || 'var';
  const all = new Set();
  const cond = b => (b && b.type === 'on_edge') ? 'on_edge()' : 'False';
  const stmts = (first, ind, vars) => { const out = []; for (let b = first; b; b = b.getNextBlock()) out.push(...stmt(b, ind, vars)); return out; };
  const stmt = (b, ind, vars) => {
    const f = n => b.getFieldValue(n), p = pad(ind);
    const body = () => { const r = stmts(b.getInputTargetBlock('DO'), ind + 1, vars); return r.length ? r : [pad(ind + 1) + 'pass']; };
    switch (b.type) {
      case 'move': return [`${p}move(${nv(f('N'))})`];
      case 'turn': return [`${p}turn(${nv(f('D'))})`];
      case 'goto': return [`${p}goto(${nv(f('X'))}, ${nv(f('Y'))})`];
      case 'say': return [`${p}say(${JSON.stringify(f('T'))})`];
      case 'wait': return [`${p}await wait(${nv(f('S'))})`];
      case 'forever': return [`${p}while True:`, ...body(), `${pad(ind + 1)}await tick()`];
      case 'repeat': return [`${p}for _ in range(${nv(f('N'))}):`, ...body(), `${pad(ind + 1)}await tick()`];
      case 'if': return [`${p}if ${cond(b.getInputTargetBlock('COND'))}:`, ...body()];
      case 'var_set': case 'var_change': {
        const v = vname(f('VAR')); vars.add(v);
        return [`${p}${v} ${b.type === 'var_set' ? '=' : '+='} ${nv(f('VAL'))}`];
      }
      default: return [];
    }
  };
  const hats = ws.getTopBlocks(true).filter(b => b.type === 'flag');
  if (!hats.length) return '# Drag a "when green flag clicked" block to begin.';
  const fns = [], names = [];
  hats.forEach((h, i) => {
    const vars = new Set();
    const body = stmts(h.getNextBlock(), 1, vars);
    vars.forEach(v => all.add(v));
    const name = `script_${i + 1}`;
    names.push(`${name}()`);
    fns.push([`async def ${name}():`,
      ...(vars.size ? [pad(1) + 'global ' + [...vars].join(', ')] : []),
      ...(body.length ? body : [pad(1) + 'pass'])].join('\n'));
  });
  return ['import asyncio', 'from pyscratch import *', '',
    ...[...all].map(v => `${v} = 0`), ...(all.size ? [''] : []),
    fns.join('\n\n'), '',
    `await asyncio.gather(${names.join(', ')})`].join('\n');
}

/* ---------- Sprites and stage ---------- */
const W = 480, H = 360, XMAX = 235, YMAX = 175, T = Math.PI * 2;
const g = $('#stage').getContext('2d');
const clampX = v => Math.max(-XMAX, Math.min(XMAX, v));
const clampY = v => Math.max(-YMAX, Math.min(YMAX, v));
const norm = a => ((a + 180) % 360 + 360) % 360 - 180;
const S = () => sprites[cur];
const EMPTY_XML = '<xml xmlns="https://developers.google.com/blockly/xml"></xml>';
const DEFAULT_XML = `<xml xmlns="https://developers.google.com/blockly/xml">
<block type="flag" x="30" y="30"><next>
<block type="goto"><field name="X">0</field><field name="Y">0</field><next>
<block type="say"><field name="T">Hello from PyScratch!</field><next>
<block type="forever"><statement name="DO">
<block type="move"><field name="N">10</field><next>
<block type="if"><value name="COND"><block type="on_edge"></block></value><statement name="DO"><block type="turn"><field name="D">180</field></block></statement></block>
</next></block>
</statement></block>
</next></block>
</next></block>
</next></block>
</xml>`;
const newSprite = (name, xml = EMPTY_XML) => ({ name, x: 0, y: 0, size: 100, dir: 90, show: true, say: '', xml });

// Functions the Python runtime calls (see pyscratch.py)
Object.assign(window, {
  PY_STOP: false,
  spriteMove(n) { const s = S(), r = s.dir * Math.PI / 180; s.x = clampX(s.x + n * Math.sin(r)); s.y = clampY(s.y + n * Math.cos(r)); redraw(); },
  spriteTurn(d) { S().dir = norm(S().dir + d); redraw(); },
  spriteGoto(x, y) { S().x = clampX(x); S().y = clampY(y); redraw(); },
  spriteSay(t) { S().say = t; redraw(); },
  spriteOnEdge() { const s = S(); return Math.abs(s.x) >= XMAX || Math.abs(s.y) >= YMAX; },
});

function cloud(x, y, s) {
  g.beginPath(); g.arc(x, y, 18 * s, 0, T); g.arc(x + 22 * s, y - 10 * s, 24 * s, 0, T); g.arc(x + 46 * s, y, 18 * s, 0, T); g.fill();
}
function drawStage() {
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#6CC8F7'); sky.addColorStop(1, '#BFEBFF');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  g.fillStyle = '#fff'; cloud(70, 70, 1); cloud(360, 60, 1.2);
  g.fillStyle = '#6FD96A';
  g.beginPath(); g.moveTo(0, 250); g.quadraticCurveTo(110, 170, 230, 250); g.quadraticCurveTo(360, 300, 480, 225); g.lineTo(W, H); g.lineTo(0, H); g.fill();
  g.fillStyle = '#4CC24A';
  g.beginPath(); g.moveTo(0, 300); g.quadraticCurveTo(160, 240, 300, 300); g.quadraticCurveTo(400, 320, 480, 285); g.lineTo(W, H); g.lineTo(0, H); g.fill();
}
function drawCat(s) {
  const px = W / 2 + s.x, py = H / 2 - s.y, k = s.size / 100 * 0.9;
  g.save(); g.translate(px, py); g.rotate((s.dir - 90) * Math.PI / 180); g.scale(k, k);
  g.fillStyle = '#FFAB19'; g.strokeStyle = '#C77A00'; g.lineWidth = 2;
  g.strokeStyle = '#FFAB19'; g.lineWidth = 8; g.lineCap = 'round';
  g.beginPath(); g.moveTo(30, 10); g.quadraticCurveTo(60, -10, 50, -40); g.stroke();
  g.strokeStyle = '#C77A00'; g.lineWidth = 2;
  g.beginPath(); g.ellipse(0, 20, 34, 26, 0, 0, T); g.fill(); g.stroke();
  g.beginPath(); g.arc(0, -14, 30, 0, T); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-26, -30); g.lineTo(-26, -56); g.lineTo(-6, -38); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(26, -30); g.lineTo(26, -56); g.lineTo(6, -38); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, -6, 20, 16, 0, 0, T); g.fill();
  g.strokeStyle = '#333'; g.fillStyle = '#fff';
  g.beginPath(); g.arc(-10, -14, 8, 0, T); g.fill(); g.stroke();
  g.beginPath(); g.arc(10, -14, 8, 0, T); g.fill(); g.stroke();
  g.fillStyle = '#333'; g.beginPath(); g.arc(-9, -13, 4, 0, T); g.fill(); g.beginPath(); g.arc(11, -13, 4, 0, T); g.fill();
  g.fillStyle = '#F26B8A'; g.beginPath(); g.ellipse(0, -2, 3, 2, 0, 0, T); g.fill();
  g.beginPath(); g.arc(0, 2, 8, 0, Math.PI); g.stroke();
  g.restore();
  if (s.say) {
    g.font = 'bold 16px Segoe UI, Arial, sans-serif';
    const w = g.measureText(s.say).width + 20;
    const bx = Math.min(Math.max(px - w / 2, 8), W - 8 - w), by = Math.max(py - 110, 8);
    g.fillStyle = '#fff'; g.strokeStyle = '#B5BED0'; g.lineWidth = 2;
    g.beginPath(); g.roundRect(bx, by, w, 34, 12); g.fill(); g.stroke();
    g.fillStyle = '#575E75'; g.fillText(s.say, bx + 10, by + 23);
  }
}
function redraw() {
  drawStage();
  sprites.forEach(s => { if (s.show) drawCat(s); });
  updatePanel();
}
const setIf = (sel, v) => { const el = $(sel); if (document.activeElement !== el) el.value = v; };
function updatePanel() {
  const s = S();
  setIf('#sName', s.name); setIf('#sX', Math.round(s.x)); setIf('#sY', Math.round(s.y));
  setIf('#sSize', Math.round(s.size)); setIf('#sDir', Math.round(s.dir));
}
const edits = {
  '#sName': v => S().name = v.trim() || 'Sprite',
  '#sX': v => S().x = clampX(+v || 0),
  '#sY': v => S().y = clampY(+v || 0),
  '#sSize': v => S().size = Math.max(5, +v || 100),
  '#sDir': v => S().dir = norm(+v || 0),
};
for (const [sel, fn] of Object.entries(edits)) {
  $(sel).addEventListener('change', e => { fn(e.target.value); renderSprites(); redraw(); });
}

/* ---------- Sprite list and per-sprite code ---------- */
let sprites = [], cur = 0, projId = null, projName = 'My Project', loading = false;
function renderSprites() {
  $('#sprites').innerHTML = sprites.map((s, i) =>
    `<button class="spr${i === cur ? ' on' : ''}" data-i="${i}"><span class="ic">🐱</span>${esc(s.name)}` +
    (i === cur && sprites.length > 1 ? '<span class="del" data-del="1">×</span>' : '') + '</button>'
  ).join('') + '<button class="spr add" id="addSpr">+</button>';
}
$('#sprites').onclick = e => {
  if (e.target.id === 'addSpr') return addSprite();
  if (e.target.dataset.del) return removeSprite();
  const b = e.target.closest('[data-i]');
  if (b) selectSprite(+b.dataset.i);
};
function saveXml() { S().xml = Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(ws)); }
function loadXml() {
  loading = true; ws.clear();
  if (S().xml) Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(S().xml), ws);
  loading = false; refresh();
}
function selectSprite(i) { if (i === cur) return; saveXml(); cur = i; loadXml(); renderSprites(); redraw(); }
function addSprite() { saveXml(); sprites.push(newSprite('Sprite' + (sprites.length + 1))); cur = sprites.length - 1; loadXml(); renderSprites(); redraw(); }
function removeSprite() { if (sprites.length < 2) return; sprites.splice(cur, 1); cur = Math.max(0, cur - 1); loadXml(); renderSprites(); redraw(); }
function refresh() { $('#pycode').textContent = genCode(); }
ws.addChangeListener(e => { if (!e.isUiEvent && !loading) refresh(); });

/* ---------- Python runtime (Pyodide) ---------- */
let pyPromise = null;
function loadPy() {
  if (!pyPromise) pyPromise = (async () => {
    setStatus('Loading Python…');
    const py = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/' });
    py.FS.writeFile('/home/pyodide/pyscratch.py', await (await fetch('pyscratch.py')).text());
    py.runPython("import sys; sys.path.insert(0, '/home/pyodide')");
    setStatus('Python ready');
    return py;
  })().catch(err => { pyPromise = null; setStatus('Python failed to load'); throw err; });
  return pyPromise;
}
async function stopRun() {
  window.PY_STOP = true;
  await sleep(160);            // give running tasks time to see the flag
  window.PY_STOP = false;
}
async function runProject() {
  const code = genCode();
  await stopRun();
  if (!code.includes('gather')) return setErr('Add a "when green flag clicked" block first.');
  setErr('');
  try {
    const py = await loadPy();
    await py.runPythonAsync(code);
  } catch (e) {
    const m = String((e && e.message) || e);
    if (!m.includes('Stopped')) setErr(m.trim().split('\n').pop());
  }
}
$('#run').onclick = $('#green').onclick = runProject;
$('#stop').onclick = async () => { await stopRun(); sprites.forEach(s => s.say = ''); redraw(); };

/* ---------- Projects ---------- */
function snapshot() { saveXml(); return { name: projName, sprites: JSON.parse(JSON.stringify(sprites)) }; }
function applyProject(p, id) {
  projName = p.name; projId = id; sprites = p.sprites; cur = 0;
  $('#projName').value = projName;
  loadXml(); renderSprites(); redraw();
}
function newProject() { applyProject({ name: 'My Project', sprites: [newSprite('Sprite1')] }, null); }
function saveProject(publish) {
  const u = user();
  if (!u) return openAccount(publish ? 'Log in to publish to the Community.' : 'Log in to save your project.');
  const d = readDb();
  const owned = projId && d.projects[projId] && d.projects[projId].owner === u;
  const id = owned ? projId : uid();
  d.projects[id] = { ...snapshot(), id, owner: u, updated: Date.now(), published: publish || (owned && !!d.projects[id].published) };
  writeDb(d); projId = id;
  toast(publish ? 'Published to Community!' : 'Project saved');
}
function exportProject() {
  const blob = new Blob([JSON.stringify({ pyscratch: 1, ...snapshot() }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (projName || 'project').replace(/\W+/g, '_') + '.pyscratch.json';
  a.click();
}
async function importProject(e) {
  const f = e.target.files[0]; if (!f) return;
  try {
    const p = JSON.parse(await f.text());
    if (!Array.isArray(p.sprites)) throw new Error('bad');
    applyProject({ name: p.name || 'Imported', sprites: p.sprites }, null);
    closeModal(); toast('Project imported');
  } catch { alert('That file is not a PyScratch project.'); }
}
$('#save').onclick = () => saveProject(false);
$('#publish').onclick = () => saveProject(true);
$('#export').onclick = exportProject;
$('#projName').oninput = e => { projName = e.target.value || 'My Project'; };

/* ---------- Modals: projects, community, account, help ---------- */
function modal(title, html, bind) {
  $('#mTitle').textContent = title; $('#mBody').innerHTML = html;
  $('#modal').classList.remove('hidden');
  if (bind) bind($('#mBody'));
}
function closeModal() { $('#modal').classList.add('hidden'); }
$('#mClose').onclick = closeModal;
$('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };

function openProjects() {
  const u = user();
  if (!u) return openAccount('Log in to see your saved projects.');
  const list = Object.values(readDb().projects).filter(p => p.owner === u).sort((a, b) => b.updated - a.updated);
  const rows = list.map(p => `<div class="item"><b>${esc(p.name)}</b> <small>${p.published ? '· public' : ''}</small>
    <div class="row"><button data-open="${p.id}">Open</button><button data-pub="${p.id}">${p.published ? 'Unpublish' : 'Publish'}</button>
    <button data-ren="${p.id}">Rename</button><button data-del="${p.id}">Delete</button></div></div>`).join('')
    || '<p class="note">No saved projects yet. Press Save Project.</p>';
  modal('My Projects', `<div class="row"><button id="pNew">New project</button><button id="pExp">Export</button>
    <label class="btnlike">Import<input type="file" id="pImp" accept=".json" hidden></label></div>${rows}`, root => {
    root.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      const d = readDb();
      if (b.id === 'pNew') { newProject(); closeModal(); }
      else if (b.id === 'pExp') exportProject();
      else if (b.dataset.open) { const p = d.projects[b.dataset.open]; applyProject({ name: p.name, sprites: p.sprites }, p.id); closeModal(); }
      else if (b.dataset.pub) { const p = d.projects[b.dataset.pub]; p.published = !p.published; writeDb(d); openProjects(); }
      else if (b.dataset.ren) {
        const n = prompt('New name', d.projects[b.dataset.ren].name);
        if (n) { d.projects[b.dataset.ren].name = n; writeDb(d); if (projId === b.dataset.ren) { projName = n; $('#projName').value = n; } openProjects(); }
      }
      else if (b.dataset.del) {
        if (confirm('Delete this project?')) { delete d.projects[b.dataset.del]; writeDb(d); if (projId === b.dataset.del) projId = null; openProjects(); }
      }
    };
    root.querySelector('#pImp').onchange = importProject;
  });
}
function openCommunity() {
  const list = Object.values(readDb().projects).filter(p => p.published).sort((a, b) => b.updated - a.updated);
  modal('Community', list.map(p => `<div class="item"><b>${esc(p.name)}</b> <small>by ${esc(p.owner)}</small>
    <div class="row"><button data-copy="${p.id}">Open a copy</button></div></div>`).join('')
    || '<p class="note">Nothing published yet. Log in, build something and press Publish.</p>', root => {
    root.onclick = e => {
      const b = e.target.closest('[data-copy]'); if (!b) return;
      const p = readDb().projects[b.dataset.copy];
      applyProject({ name: p.name + ' (copy)', sprites: p.sprites }, null);
      closeModal(); toast('Copy opened. Log in and Save to keep it.');
    };
  });
}
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('ps1:' + s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function openAccount(note = '') {
  const u = user();
  if (u) {
    return modal('Account', `<p>Logged in as <b>${esc(u)}</b></p><button id="logout">Log out</button>`, root => {
      root.querySelector('#logout').onclick = () => { localStorage.removeItem(SESSION); projId = null; updateAvatar(); closeModal(); };
    });
  }
  modal('Log in or sign up', `<p class="note">${esc(note)}</p>
    <div class="row"><input id="uName" placeholder="Username" maxlength="20" autocomplete="username"></div>
    <div class="row"><input id="uPass" type="password" placeholder="Password (6+ characters)" autocomplete="current-password"></div>
    <div class="row"><button id="doLogin">Log in</button><button id="doSignup" class="primary">Sign up</button></div>
    <div class="row"><button disabled>Continue with Google</button><button disabled>Continue with Apple</button></div>
    <p class="note">Google, Apple and email sign-in need a free auth service. See the README.</p>`, root => {
    const val = () => [root.querySelector('#uName').value.trim(), root.querySelector('#uPass').value];
    root.querySelector('#doSignup').onclick = async () => {
      const [n, p] = val();
      if (!/^[\w.-]{3,20}$/.test(n) || p.length < 6) return alert('Username: 3–20 letters, numbers, . _ -  Password: 6+ characters.');
      const d = readDb();
      if (d.users[n]) return alert('That username is taken.');
      d.users[n] = { hash: await sha(p) }; writeDb(d); login(n);
    };
    root.querySelector('#doLogin').onclick = async () => {
      const [n, p] = val(), d = readDb();
      if (!d.users[n] || d.users[n].hash !== await sha(p)) return alert('Wrong username or password.');
      login(n);
    };
  });
}
function login(n) { localStorage.setItem(SESSION, n); updateAvatar(); closeModal(); toast('Welcome, ' + n + '!'); }
function updateAvatar() { const u = user(); $('#btnAccount').textContent = u ? u[0].toUpperCase() : '?'; }
function openHelp() {
  modal('How PyScratch works', `
    <p>Drag blocks from the left into the workspace and attach them under <b>when green flag clicked</b>.
    The Python code below the workspace updates as you build.</p>
    <p>Press the green flag (or Run) to execute that Python in your browser. Stop ends it.</p>
    <p>You can run and export without an account. Log in to Save or Publish to the Community.</p>
    <p>Use the sprite panel to move, size and rotate your character. Add more sprites with +.</p>`);
}
$('#navHome').onclick = () => { if (confirm('Start a new blank project? Unsaved changes will be lost.')) newProject(); };
$('#navProjects').onclick = openProjects;
$('#navCommunity').onclick = openCommunity;
$('#navHelp').onclick = openHelp;
$('#navSites').onclick = () => { location.href = 'builder.html'; };
$('#btnAccount').onclick = () => openAccount();
$('#pyToggle').onclick = () => {
  const p = document.querySelector('.pypanel');
  p.classList.toggle('collapsed');
  $('#pyToggle').textContent = p.classList.contains('collapsed') ? 'Expand' : 'Collapse';
};

/* ---------- Start ---------- */
applyProject({ name: 'My Project', sprites: [newSprite('Sprite1', DEFAULT_XML)] }, null);
updateAvatar();
setStatus('Python loads on first Run');
window.addEventListener('resize', () => Blockly.svgResize?.(ws));
