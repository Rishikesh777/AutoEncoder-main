const fs = require('fs');

try {
    fs.writeFileSync('debug_output.txt', 'Started\n');

    fs.appendFileSync('debug_output.txt', 'Require express...\n');
    require('express');
    fs.appendFileSync('debug_output.txt', 'Express OK\n');

    fs.appendFileSync('debug_output.txt', 'Require mongoose...\n');
    require('mongoose');
    fs.appendFileSync('debug_output.txt', 'Mongoose OK\n');

    fs.appendFileSync('debug_output.txt', 'Require dotenv...\n');
    require('dotenv').config();
    fs.appendFileSync('debug_output.txt', 'Dotenv OK\n');

    fs.appendFileSync('debug_output.txt', 'Require cors...\n');
    require('cors');
    fs.appendFileSync('debug_output.txt', 'Cors OK\n');

    fs.appendFileSync('debug_output.txt', 'Require bcryptjs...\n');
    require('bcryptjs');
    fs.appendFileSync('debug_output.txt', 'Bcryptjs OK\n');

    fs.appendFileSync('debug_output.txt', 'Require jsonwebtoken...\n');
    require('jsonwebtoken');
    fs.appendFileSync('debug_output.txt', 'Jsonwebtoken OK\n');

    fs.appendFileSync('debug_output.txt', 'All imports OK. Creating server on 5002...\n');

    const express = require('express');
    const app = express();

    app.get('/', (req, res) => res.send('Debug server running'));

    app.listen(5002, () => {
        fs.appendFileSync('debug_output.txt', 'Server listening on 5002\n');
    });

} catch (e) {
    fs.appendFileSync('debug_output.txt', 'ERROR: ' + e + '\n');
}
