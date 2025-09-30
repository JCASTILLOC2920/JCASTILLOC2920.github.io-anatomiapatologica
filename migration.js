const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('lab.db');

async function migrateDoctors() {
    console.log('Starting doctor migration...');

    const doctors = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM doctors', [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });

    const cleanedDoctors = [];
    const existingDoctors = new Set();

    for (const doctor of doctors) {
        let nombreCompleto = doctor.nombreCompleto.toUpperCase();
        if (!nombreCompleto.startsWith('DR.') && !nombreCompleto.startsWith('DRA.')) {
            nombreCompleto = 'DR. ' + nombreCompleto;
        }

        if (existingDoctors.has(nombreCompleto)) {
            continue;
        }

        existingDoctors.add(nombreCompleto);

        let especialidad = doctor.especialidad;
        if (!especialidad) {
            // Placeholder for web search
            console.log(`Searching for specialty of ${nombreCompleto}...`);
            // especialidad = await webSearchForSpecialty(nombreCompleto);
        }

        cleanedDoctors.push({
            id: doctor.id,
            nombreCompleto,
            especialidad,
            clinica: doctor.clinica
        });
    }

    console.log('Cleaned doctors:', cleanedDoctors);

    await new Promise((resolve, reject) => {
        db.run('DELETE FROM doctors', [], (err) => {
            if (err) {
                reject(err);
            } else {
                console.log('Doctors table cleared.');
                resolve();
            }
        });
    });

    const insertSql = 'INSERT INTO doctors (id, nombreCompleto, especialidad, clinica) VALUES (?,?,?,?)';
    for (const doctor of cleanedDoctors) {
        await new Promise((resolve, reject) => {
            db.run(insertSql, [doctor.id, doctor.nombreCompleto, doctor.especialidad, doctor.clinica], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    console.log('Doctor migration finished.');

    db.close();
}

migrateDoctors();