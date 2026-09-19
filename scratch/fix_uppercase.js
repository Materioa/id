const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.svelte')) results.push(file);
    }
  });
  return results;
}

const files = walk('d:/v4/v5/materio id/apps/admin/src/routes/(dashboard)');
let changed = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  content = content.replace(/\buppercase\b/g, '');
  content = content.replace(/\btracking-wider\b/g, '');
  content = content.replace(/\btracking-widest\b/g, '');
  
  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changed++;
    console.log('Updated', file);
  }
});
console.log('Total files changed:', changed);
