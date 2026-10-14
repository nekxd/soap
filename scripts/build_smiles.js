const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const iniPath = path.join(rootDir, 'smiles', '_define.ini');
const smilesDir = path.join(rootDir, 'smiles');
const outPath = path.join(rootDir, 'assets', 'js', 'smiles_data.js');

const lines = fs.readFileSync(iniPath, 'utf8').split(/\r?\n/).filter(Boolean);
const files = fs.readdirSync(smilesDir).filter(f => f.endsWith('.gif')).sort();

const aliases = {
  'ae.gif': [':P', ':-p', ':p'],
  'ag.gif': [':D', ':-d', ':d'],
  'af.gif': ['8)'],
  'aj.gif': [':*'],
  'ah.gif': [':['],
  'ai.gif': [':-O', ':O', '=-o', ':-o', ':o'],
  'am.gif': [':@', '>:-o'],
  'ay.gif': ['(y)', '*thumbs up*'],
  'az.gif': ['*drink*'],
  'ba.gif': ['(heart)', '(h)', '*in love*'],
  'bj.gif': ['*rofl*', '*lol*'],
  'bo.gif': ['*dance*'],
  'bi.gif': ['(clap)', '*bravo*'],
  'bf.gif': ['*ok*']
};

const smilesList = [];
for (let i = 0; i < files.length && i < lines.length; i++) {
  const file = files[i];
  const codes = lines[i].split(',').map(s => s.trim()).filter(Boolean);
  if (aliases[file]) {
    aliases[file].forEach(extra => {
      if (!codes.includes(extra)) codes.push(extra);
    });
  }
  if (codes.length > 0) {
    smilesList.push({ file, codes, primary: codes[0] });
  }
}

const jsContent = '/* Auto-generated from smiles/_define.ini: 281 animated Kolobok smilies */\n' +
  '(function(root) {\n' +
  '  var smiles = ' + JSON.stringify(smilesList) + ';\n' +
  '  if (typeof module !== "undefined" && module.exports) {\n' +
  '    module.exports = smiles;\n' +
  '  }\n' +
  '  root.SOAP_SMILES = smiles;\n' +
  '})(typeof window !== "undefined" ? window : global);\n';

fs.writeFileSync(outPath, jsContent, 'utf8');
console.log('Successfully generated ' + smilesList.length + ' smiles with aliases into ' + outPath);
