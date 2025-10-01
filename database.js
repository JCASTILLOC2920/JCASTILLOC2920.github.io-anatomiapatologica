const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
require('dotenv').config();

const DBSOURCE = process.env.DB_PATH || "lab.db";

const db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        // Cannot open database
        console.error(err.message);
        throw err;
    }
    console.log('Connected to the SQLite database.');

    db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT NOT NULL
        )`, (err) => {
            if (err) {
                console.error("Error ensuring users table: ", err.message);
                return;
            }
            // Add default users
            const users = [
                { 
                    user: process.env.DEFAULT_ADMIN_USER || 'admin', 
                    pass: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', 
                    role: process.env.DEFAULT_ADMIN_ROLE || 'admin' 
                }
            ];
            const selectUserSql = "SELECT * FROM users WHERE username = ?";
            const insertUserSql = 'INSERT INTO users (username, password, role) VALUES (?,?,?)';

            users.forEach(u => {
                db.get(selectUserSql, [u.user], (err, row) => {
                    if (err) {
                        console.error("Error checking user: ", err.message);
                        return;
                    }
                    if (!row) {
                        const salt = bcrypt.genSaltSync(10);
                        const hashedPassword = bcrypt.hashSync(u.pass, salt);
                        db.run(insertUserSql, [u.user, hashedPassword, u.role], (err) => {
                            if (err) {
                                console.error(`Error creating default user '${u.user}': `, err.message);
                            }
                        });
                    }
                });
            });

            // Delete old default users if they exist
            db.run('DELETE FROM users WHERE username = ?', ['admin'], (err) => {
                if (err) {
                    console.error("Error deleting admin user: ", err.message);
                }
            });
            db.run('DELETE FROM users WHERE username = ?', ['viewer'], (err) => {
                if (err) {
                    console.error("Error deleting viewer user: ", err.message);
                }
            });
        });

        // Doctors table
        db.run(`CREATE TABLE IF NOT EXISTS doctors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombreCompleto TEXT,
            especialidad TEXT,
            clinica TEXT
        )`);

        // Templates table
        db.run(`CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            tipo TEXT NOT NULL,
            especialidad TEXT,
            contenido TEXT,
            diagnostico TEXT
        )`);

        // Patients table
        db.run(`CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            service_type TEXT,
            attention_code TEXT UNIQUE,
            dni TEXT,
            age INTEGER,
            last_name TEXT,
            first_name TEXT,
            phone TEXT,
            gender TEXT,
            contact_family TEXT,
            contact_phone TEXT,
            requesting_doctor TEXT,
            study_reason TEXT,
            clinic TEXT,
            registration_date TEXT,
            delivery_date TEXT,
            is_signed INTEGER DEFAULT 0
        )`);

        // Migrations
        const migrations = [
            'macro_description TEXT',
            'micro_description TEXT',
            'diagnosis TEXT',
            'photo1 TEXT',
            'photo2 TEXT',
            'pdf_path TEXT',
            'is_signed INTEGER DEFAULT 0'
        ];

        migrations.forEach(migration => {
            const columnName = migration.split(' ')[0];
            db.run(`ALTER TABLE patients ADD COLUMN ${migration}`, (err) => {
                if (err && !err.message.includes('duplicate column name')) {
                    console.error(`Error adding column ${columnName}: `, err.message);
                }
            });
        });
    });
});

module.exports = db;