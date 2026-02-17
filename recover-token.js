
const fs = require('fs');
const path = require('path');

function findTokenInFile(filename) {
    try {
        const filePath = path.join(process.cwd(), 'db', filename);
        if (!fs.existsSync(filePath)) return;

        const content = fs.readFileSync(filePath, 'utf8'); // Try utf8 first (might be binary mixed)
        const matches = content.match(/EAA[A-Za-z0-9]+/g);

        if (matches && matches.length > 0) {
            console.log(`Found possible tokens in ${filename}:`);
            matches.forEach(m => {
                if (m.length > 50) console.log(m); // Filter short garbage strings
            });
        } else {
            // Try reading as binary buffer and converting to string
            const buffer = fs.readFileSync(filePath);
            const str = buffer.toString('binary');
            const binaryMatches = str.match(/EAA[A-Za-z0-9]+/g);
            if (binaryMatches && binaryMatches.length > 0) {
                console.log(`Found possible tokens in ${filename} (binary search):`);
                binaryMatches.forEach(m => {
                    if (m.length > 50) console.log(m);
                });
            }
        }
    } catch (e) {
        console.error(`Error reading ${filename}:`, e.message);
    }
}

console.log('Searching for tokens...');
findTokenInFile('instabot.db');
findTokenInFile('instabot.db-wal');
