import { getSetting } from './lib/db.js';
import fs from 'fs';

const accessToken = getSetting('instagram_access_token');
const lines = [];

// Try without from field (from might require special permission)
try {
    const res = await fetch(`https://graph.instagram.com/v21.0/18192458359351969/comments?fields=id,text,timestamp&limit=5&access_token=${accessToken}`);
    const data = await res.json();
    lines.push('=== Comments (no from field) ===');
    lines.push(JSON.stringify(data, null, 2));
} catch (e) { lines.push('Error: ' + e.message); }

// Try with just text
try {
    const res = await fetch(`https://graph.instagram.com/v21.0/17918162124032565/comments?fields=id,text&limit=3&access_token=${accessToken}`);
    const data = await res.json();
    lines.push('\n=== Comments DN4S (just id,text) ===');
    lines.push(JSON.stringify(data, null, 2));
} catch (e) { lines.push('Error: ' + e.message); }

// Try without any fields
try {
    const res = await fetch(`https://graph.instagram.com/v21.0/17918162124032565/comments?access_token=${accessToken}`);
    const data = await res.json();
    lines.push('\n=== Comments DN4S (no fields) ===');
    lines.push(JSON.stringify(data, null, 2));
} catch (e) { lines.push('Error: ' + e.message); }

// Try with IG Business API endpoint too
try {
    const res = await fetch(`https://graph.instagram.com/v21.0/17918162124032565/comments?fields=id,text,username&access_token=${accessToken}`);
    const data = await res.json();
    lines.push('\n=== Comments (username field) ===');
    lines.push(JSON.stringify(data, null, 2));
} catch (e) { lines.push('Error: ' + e.message); }

fs.writeFileSync('test-result.txt', lines.join('\n'), 'utf8');
console.log('Done');
