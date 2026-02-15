const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'js', 'index.js');

fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error reading file:', err);
        return;
    }

    const cleaned = data.replace(/^\s*console\.(log|error|warn|info|debug)\(.*?\);\s*$/gm, '');

    fs.writeFile(filePath, cleaned, 'utf8', err => {
        if (err) {
            console.error('Error writing file:', err);
            return;
        }
        console.log('All console logs removed from js/index.js');
    });
});