console.log("Starting debug...");
try {
    console.log("Importing dotenv...");
    require('dotenv').config();
    console.log("Dotenv imported. MONGO_URI length:", process.env.MONGO_URI ? process.env.MONGO_URI.length : 0);

    console.log("Importing express...");
    const express = require('express');
    console.log("Express imported.");

    console.log("Importing mongoose...");
    const mongoose = require('mongoose');
    console.log("Mongoose imported.");

    console.log("Importing cors...");
    require('cors');
    console.log("Cors imported.");

    console.log("Importing bcryptjs...");
    require('bcryptjs');
    console.log("Bcryptjs imported.");

    console.log("Importing jsonwebtoken...");
    require('jsonwebtoken');
    console.log("Jsonwebtoken imported.");

    console.log("Imports done.");

    const app = express();
    console.log("Express app created.");

    const PORT = 5001;
    app.listen(PORT, () => console.log(`Debug server running on port ${PORT}`));

} catch (e) {
    console.error("Error:", e);
}
