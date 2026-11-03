// builder: assemble src/*.js into template.html -> index.html
// Gate: refuses to emit if the assembled inline script does not parse.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');

function parts() {
  return fs.readdirSync(SRC)
    .filter(f => f.endsWith('.js'))
    .sort()
    .map(f => ({ name: f, code: fs.readFileSync(path.join(SRC, f), 'utf8') }));
}

function build() {
  const list = parts();
  const body = list.map(p => `// ===== ${p.name} =====\n${p.code.trim()}\n`).join('\n');

  // gate 1: does it parse?
  try {
    new vm.Script(body, { filename: 'game.js' });
  } catch (e) {
    console.error('PARSE FAIL: ' + e.message);
    const m = /game\.js:(\d+)/.exec(e.stack || '');
    if (m) {
      const lines = body.split('\n');
      const n = parseInt(m[1], 10);
      for (let i = Math.max(0, n - 4); i < Math.min(lines.length, n + 3); i++) {
        console.error(String(i + 1).padStart(5) + ' | ' + lines[i]);
      }
    }
    process.exit(1);
  }

  // gate 2: no template literals with braces survived mangling, no stray markers
  const bad = [/`/, /__[A-Z_]+__/];
  for (const re of bad) {
    if (re.test(body)) {
      console.error('SUSPECT TOKEN in assembled script: ' + re);
      const lines = body.split('\n');
      lines.forEach((l, i) => { if (re.test(l)) console.error(String(i + 1).padStart(5) + ' | ' + l); });
      process.exit(1);
    }
  }

  const tpl = fs.readFileSync(path.join(ROOT, 'template.html'), 'utf8');
  if (!tpl.includes('/*__GAME__*/')) { console.error('template marker missing'); process.exit(1); }
  const out = tpl.replace('/*__GAME__*/', '\n' + body + '\n');
  const dest = path.join(ROOT, 'index.html');
  fs.writeFileSync(dest, out);
  console.log('built ' + dest + '  (' + Buffer.byteLength(out) + ' bytes, ' +
    list.length + ' parts: ' + list.map(p => p.name).join(' ') + ')');
}

build();
