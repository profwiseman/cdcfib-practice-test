// Tiny helper to dump MATHS entries from script.js
// This script attempts to load script.js and print the MATHS entries as JSON.
try {
	const path = require('path');
	const file = path.resolve(__dirname, 'script.js');
	// Require the file as text then evaluate to extract the fullQuestionsData variable safely
	const fs = require('fs');
	const content = fs.readFileSync(file, 'utf8');
	const marker = 'const fullQuestionsData =';
	const idx = content.indexOf(marker);
	if (idx === -1) {
		console.error('Could not find fullQuestionsData in script.js');
		process.exit(2);
	}
	// Extract from marker to closing bracket followed by semicolon
	const sub = content.slice(idx + marker.length);
	// Find the end of the array by locating the sequence '\n];' after the marker
	const endIdx = sub.lastIndexOf('\n];');
	if (endIdx === -1) {
		console.error('Could not find end of fullQuestionsData array');
		process.exit(3);
	}
	const arrText = sub.slice(0, endIdx + 2); // include closing ]
	const wrapped = '(function(){return ' + arrText + '})()';
	// Evaluate in a safe Function
	const data = new Function(wrapped)();
	if (!Array.isArray(data)) {
		console.error('Parsed data is not an array');
		process.exit(4);
	}
	const maths = data.filter(q => String(q.subject || '').toUpperCase().includes('MATH'));
	console.log('Found', maths.length, 'MATHS entries');
	console.log(JSON.stringify(maths, null, 2));
} catch (err) {
	console.error('Error running dump:', err && err.stack || err);
	process.exit(1);
}
