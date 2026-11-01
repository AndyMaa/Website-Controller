const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const directory = path.resolve(process.argv[2] || 'dist');
const files = fs.readdirSync(directory).filter(name => /\.(exe|dmg|zip)$/.test(name)).sort();
if (!files.length) throw new Error('No release artifacts found');
const lines = files.map(name => `${createHash('sha256').update(fs.readFileSync(path.join(directory, name))).digest('hex')}  ${name}`);
fs.writeFileSync(path.join(directory, 'SHA256SUMS.txt'), lines.join('\n') + '\n');
console.log(`Checksums written for ${files.length} release files.`);
