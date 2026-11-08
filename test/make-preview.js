// Generează test/preview.html: interfața reală + API simulat. Deschide-l în Chrome.
const fs = require('fs');
const path = require('path');
let html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
html = html.replace(/<meta http-equiv="Content-Security-Policy"[\s\S]*?>/, '')
  .replace('<head>', '<head>\n  <base href="../src/renderer/">')
  .replace('<script src="i18n.js"></script>', '<script src="../../test/mock-api.js"></script>\n  <script src="i18n.js"></script>');
fs.writeFileSync(path.join(__dirname, 'preview.html'), html);
console.log('test/preview.html');
