const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('lab.db');

db.all("SELECT * FROM doctors", [], (err, rows) => {
    if (err) {
        throw err;
    }
    console.log(JSON.stringify(rows));
});

db.close();