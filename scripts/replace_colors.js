const fs = require('fs');
const path = require('path');

const replacements = {
    '#788c15': '#c05a1e', // Fern border -> rust border
    '#e5eacd': '#f3d9ca', // Sprout tint -> rust tint
    '#4a5c00': '#8a3e11', // Darker forest CTA
    '#4c5616': '#8a3e11', // Button hover
    '#3e4811': '#6c300d', // Button active
    '#667c0a': '#b55112', // Luminous olive hover
    '#728b0b': '#c55814', // Luminous olive hover 2
    '#484b3f': '#543b2f', // Input border focus
    '#dde3be': '#f7e3d6', // Focus ring soft
    '#252e12': '#452009', // Deep sprout tint
    '#4a5c18': '#8a3e11', // Dark border hover
    '#2e3a17': '#5e2a0b', // Dark border active
    '#b2c248': '#e18b5b', // Olive press -> rust press
    '#5b6f00': '#a34914'  // Original Forest CTA (just in case)
};

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('.svelte-kit')) { 
            results = results.concat(walk(file));
        } else if (!stat.isDirectory()) {
            results.push(file);
        }
    });
    return results;
}

let files = walk('d:/v4/v5/materio id/apps');
files = files.concat(walk('d:/v4/v5/materio id/packages'));

files.forEach(file => {
    if (file.endsWith('.svelte') || file.endsWith('.ts') || file.endsWith('.css')) {
        let content = fs.readFileSync(file, 'utf8');
        let modified = false;
        for (const [oldHex, newHex] of Object.entries(replacements)) {
            // we'll replace globally
            if (content.includes(oldHex)) {
                content = content.split(oldHex).join(newHex);
                modified = true;
            }
        }
        if (modified) {
            fs.writeFileSync(file, content, 'utf8');
            console.log('Modified ' + file);
        }
    }
});
