const fs = require('fs');
let content = fs.readFileSync('projects.json', 'utf16le');
if (content.startsWith('\uFEFF')) content = content.slice(1);
const data = JSON.parse(content);
const names = data.projects.map(p => p.name);
fs.writeFileSync('project_names.txt', names.join('\n'));
console.log('Saved ' + names.length + ' projects.');
