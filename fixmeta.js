const fs = require('fs');
const R = 'README.md';
let rd = fs.readFileSync(R, 'utf8');
const before = rd;
// badge label: download-~1.5%20MB -> download-~1.3%20MB
rd = rd.replace(/download-~1\.5(%20| )MB/g, 'download-~1.3$1MB');
rd = rd.replace(/~1\.5 MB/g, '~1.3 MB');
fs.writeFileSync(R, rd);
console.log(before === rd ? 'BADGE UNCHANGED' : 'BADGE FIXED');
