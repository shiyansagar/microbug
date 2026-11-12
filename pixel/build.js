// Bundles src/*.js into src/shell.html -> dist/microburg.html (the page that gets published)
// and dist/test.html (the same page inside the wrapper the publisher adds, for opening locally).
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, 'src'), dist = path.join(__dirname, 'dist');
const js = fs.readdirSync(src).filter(f => f.endsWith('.js')).sort()
  .map(f => (f === '00_util.js' ? '' : '\n// ===== ' + f + ' =====\n') + fs.readFileSync(path.join(src, f), 'utf8')).join('');
const page = fs.readFileSync(path.join(src, 'shell.html'), 'utf8').replace('/*__JS__*/', () => js);
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'microburg.html'), page);
const wrapped = '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%}[hidden]{display:none!important}</style></head><body>' + page + '</body></html>';
fs.writeFileSync(path.join(dist, 'test.html'), wrapped);
fs.writeFileSync(path.join(__dirname, 'index.html'), wrapped);   // GitHub Pages serves this
console.log('built', (page.length / 1024).toFixed(1) + ' KB');
