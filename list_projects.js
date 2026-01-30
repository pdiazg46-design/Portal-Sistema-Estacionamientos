const fs = require('fs');
const data = JSON.parse(fs.readFileSync('all_projects.json', 'utf8'));
data.projects.forEach(p => console.log(`- ${p.name}`));
