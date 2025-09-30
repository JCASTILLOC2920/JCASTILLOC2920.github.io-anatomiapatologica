const express = require('express');
const cors = require('cors');
const db = require('./database.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { verifyToken, isAdmin } = require('./authMiddleware.js');
const sharp = require('sharp');
const puppeteer = require('puppeteer');
const fs = require('fs');

// Create reports directory if it doesn't exist
const reportsDir = './reports';
if (!fs.existsSync(reportsDir)){
    fs.mkdirSync(reportsDir);
}

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(helmet());
const port = 3000;
const JWT_SECRET = 'your_jwt_secret_key'; // ¡Cambia esto por una clave secreta más segura!

// Rate limiter for login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Demasiados intentos de inicio de sesión desde esta IP, por favor intente de nuevo después de 15 minutos'
});

// Middleware
app.use(cors({
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('¡El servidor backend está funcionando!');
});

// --- RUTAS DE AUTENTICACIÓN ---

// Ruta de login (pública)
app.post('/api/login', loginLimiter, (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Faltan campos requeridos (username, password).' });
    }

    const sql = 'SELECT * FROM users WHERE username = ?';
    db.get(sql, [username], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Error en el servidor.' });
        }
        if (!user) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
        }

        const passwordIsValid = bcrypt.compareSync(password, user.password);
        if (!passwordIsValid) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
            expiresIn: 86400 // 24 horas
        });

        res.status(200).json({
            message: 'Login exitoso',
            token: token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role
            }
        });
    });
});


// --- RUTAS DE GESTIÓN DE USUARIOS (protegidas) ---

// Registrar un nuevo usuario (solo admin)
app.post('/api/register', [verifyToken, isAdmin], (req, res) => {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
        return res.status(400).json({ error: 'Faltan campos requeridos (username, password, role).' });
    }
    if (role !== 'admin' && role !== 'viewer') {
        return res.status(400).json({ error: 'El rol debe ser \'admin\' o \'viewer\'.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const sql = 'INSERT INTO users (username, password, role) VALUES (?,?,?)';
    db.run(sql, [username, hashedPassword, role], function(err) {
        if (err) {
            return res.status(400).json({ error: 'El nombre de usuario ya existe.' });
        }
        res.status(201).json({ message: 'Usuario creado exitosamente.', userId: this.lastID });
    });
});

// Obtener todos los usuarios (solo admin)
app.get('/api/users', [verifyToken, isAdmin], (req, res) => {
    const sql = "SELECT id, username, role FROM users";
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ users: rows });
    });
});

// Eliminar un usuario (solo admin)
app.delete('/api/users/:id', [verifyToken, isAdmin], (req, res) => {
    const { id } = req.params;
    // Prevenir que el admin se elimine a sí mismo
    if (req.user.id == id) {
        return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta de administrador.' });
    }

    const sql = 'DELETE FROM users WHERE id = ?';
    db.run(sql, id, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado.' });
        }
        res.status(200).json({ message: 'Usuario eliminado exitosamente.' });
    });
});

// --- RUTAS DE GESTIÓN DE MÉDICOS (protegidas) ---

// Obtener todos los médicos
app.get('/api/doctors', [verifyToken], (req, res) => {
    const sql = "SELECT * FROM doctors";
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ doctors: rows });
    });
});

// Crear un nuevo médico (solo admin)
app.post('/api/doctors', [verifyToken, isAdmin], (req, res) => {
    const { nombreCompleto, especialidad, clinica } = req.body;
    if (!nombreCompleto) {
        return res.status(400).json({ error: 'El campo nombreCompleto es requerido.' });
    }
    const sql = 'INSERT INTO doctors (nombreCompleto, especialidad, clinica) VALUES (?,?,?)';
    db.run(sql, [nombreCompleto, especialidad, clinica], function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.status(201).json({ message: 'Médico creado exitosamente.', doctorId: this.lastID });
    });
});

// Actualizar un médico (solo admin)
app.put('/api/doctors/:id', [verifyToken, isAdmin], (req, res) => {
    const { id } = req.params;
    const { nombreCompleto, especialidad, clinica } = req.body;
    if (!nombreCompleto) {
        return res.status(400).json({ error: 'El campo nombreCompleto es requerido.' });
    }
    const sql = 'UPDATE doctors SET nombreCompleto = ?, especialidad = ?, clinica = ? WHERE id = ?';
    db.run(sql, [nombreCompleto, especialidad, clinica, id], function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Médico no encontrado.' });
        }
        res.status(200).json({ message: 'Médico actualizado exitosamente.' });
    });
});

// Eliminar un médico (solo admin)
app.delete('/api/doctors/:id', [verifyToken, isAdmin], (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM doctors WHERE id = ?';
    db.run(sql, id, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Médico no encontrado.' });
        }
        res.status(200).json({ message: 'Médico eliminado exitosamente.' });
    });
});

// --- RUTAS DE GESTIÓN DE PLANTILLAS (protegidas) ---

// Obtener todas las plantillas
app.get('/api/templates', [verifyToken], (req, res) => {
    const sql = "SELECT * FROM templates";
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ templates: rows });
    });
});

// Crear una nueva plantilla (solo admin)
app.post('/api/templates', [verifyToken, isAdmin], (req, res) => {
    const { nombre, tipo, especialidad, contenido, diagnostico } = req.body;
    if (!nombre || !tipo) {
        return res.status(400).json({ error: 'Los campos nombre y tipo son requeridos.' });
    }
    const sql = 'INSERT INTO templates (nombre, tipo, especialidad, contenido, diagnostico) VALUES (?,?,?,?,?)';
    db.run(sql, [nombre, tipo, especialidad, contenido, diagnostico], function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        res.status(201).json({ message: 'Plantilla creada exitosamente.', templateId: this.lastID });
    });
});

// Actualizar una plantilla (solo admin)
app.put('/api/templates/:id', [verifyToken, isAdmin], (req, res) => {
    const { id } = req.params;
    const { nombre, tipo, especialidad, contenido, diagnostico } = req.body;
    if (!nombre || !tipo) {
        return res.status(400).json({ error: 'Los campos nombre y tipo son requeridos.' });
    }
    const sql = 'UPDATE templates SET nombre = ?, tipo = ?, especialidad = ?, contenido = ?, diagnostico = ? WHERE id = ?';
    db.run(sql, [nombre, tipo, especialidad, contenido, diagnostico, id], function(err) {
        if (err) {
            return res.status(400).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Plantilla no encontrada.' });
        }
        res.status(200).json({ message: 'Plantilla actualizada exitosamente.' });
    });
});

// Eliminar una plantilla (solo admin)
app.delete('/api/templates/:id', [verifyToken, isAdmin], (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM templates WHERE id = ?';
    db.run(sql, id, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Plantilla no encontrada.' });
        }
        res.status(200).json({ message: 'Plantilla eliminada exitosamente.' });
    });
});

// --- RUTAS DE GESTIÓN DE PACIENTES (protegidas) ---

// Registrar un nuevo paciente
app.post('/api/patients', [verifyToken], (req, res) => {
    const {
        service_type, attention_code, dni, age, last_name, first_name, phone, 
        gender, contact_family, contact_phone, requesting_doctor, study_reason, 
        clinic, registration_date, delivery_date
    } = req.body;

    if (!attention_code || !last_name || !first_name) {
        return res.status(400).json({ error: 'Los campos Cod. Atención, Apellidos y Nombres son requeridos.' });
    }

    const sql = `INSERT INTO patients (service_type, attention_code, dni, age, last_name, first_name, phone, gender, contact_family, contact_phone, requesting_doctor, study_reason, clinic, registration_date, delivery_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
    const params = [service_type, attention_code, dni, age, last_name, first_name, phone, gender, contact_family, contact_phone, requesting_doctor, study_reason, clinic, registration_date, delivery_date];

    db.run(sql, params, function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'El código de atención ya existe.' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ message: 'Paciente registrado exitosamente.', patientId: this.lastID });
    });
});

// Actualizar un paciente
app.put('/api/patients/:id', [verifyToken], async (req, res) => {
    const { id } = req.params;
    let {
        dni, age, last_name, first_name, phone, gender, contact_family, 
        contact_phone, requesting_doctor, study_reason, clinic, 
        macro_description, micro_description, diagnosis, photo1, photo2
    } = req.body;

    try {
        // Procesar photo1 si existe
        if (photo1 && photo1.startsWith('data:image')) {
            const base64Data = photo1.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const processedImageBuffer = await sharp(buffer)
                .gamma(1.5) // Ajuste de brillo y contraste
                .modulate({ saturation: 1.2 }) // Ajuste de saturación
                .toBuffer();
            photo1 = `data:image/jpeg;base64,${processedImageBuffer.toString('base64')}`;
        }

        // Procesar photo2 si existe
        if (photo2 && photo2.startsWith('data:image')) {
            const base64Data = photo2.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            const processedImageBuffer = await sharp(buffer)
                .gamma(1.5) // Ajuste de brillo y contraste
                .modulate({ saturation: 1.2 }) // Ajuste de saturación
                .toBuffer();
            photo2 = `data:image/jpeg;base64,${processedImageBuffer.toString('base64')}`;
        }

    } catch (error) {
        console.error('Error procesando la imagen:', error);
        return res.status(500).json({ error: 'Error al procesar la imagen.' });
    }

    const sql = `UPDATE patients SET 
                    dni = ?,
                    age = ?,
                    last_name = ?,
                    first_name = ?,
                    phone = ?,
                    gender = ?,
                    contact_family = ?,
                    contact_phone = ?,
                    requesting_doctor = ?,
                    study_reason = ?,
                    clinic = ?,
                    macro_description = ?,
                    micro_description = ?,
                    diagnosis = ?,
                    photo1 = ?,
                    photo2 = ?
                 WHERE id = ?`;

    const params = [dni, age, last_name, first_name, phone, gender, contact_family, contact_phone, requesting_doctor, study_reason, clinic, macro_description, micro_description, diagnosis, photo1, photo2, id];

    db.run(sql, params, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Paciente no encontrado.' });
        }
        res.status(200).json({ message: 'Informe guardado exitosamente.' });
    });
});

// Obtener todos los pacientes
app.get('/api/patients', [verifyToken], (req, res) => {
    const sql = "SELECT * FROM patients ORDER BY id DESC";
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ patients: rows });
    });
});

// Obtener un paciente por ID
app.get('/api/patients/:id', [verifyToken], (req, res) => {
    const { id } = req.params;
    const sql = "SELECT * FROM patients WHERE id = ?";
    db.get(sql, [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            return res.status(404).json({ error: 'Paciente no encontrado.' });
        }
        res.json({ patient: row });
    });
});

// Firmar un informe de paciente
// Firmar un informe de paciente

async function generarInformeHtml(patient) {
    // 1. Read CSS from informe-preliminar.html
    const informeHtmlContent = fs.readFileSync('informe-preliminar.html', 'utf8');
    const styleRegex = /<style>([\s\S]*?)<\/style>/;
    const cssMatch = styleRegex.exec(informeHtmlContent);
    const css = cssMatch ? cssMatch[1] : '';

    // 2. Read images and convert to base64
    const encabezado = fs.readFileSync('./informe-preliminar_files/encabezado.png').toString('base64');
    const linea1 = fs.readFileSync('./informe-preliminar_files/linea1.png').toString('base64');
    const linea2 = fs.readFileSync('./informe-preliminar_files/linea2.png').toString('base64');
    const firma = fs.readFileSync('./informe-preliminar_files/firma.png').toString('base64');

    // 3. Construct HTML
    const reportHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Informe</title>
        <style>${css}</style>
    </head>
    <body>
        <div class="a4-container">
            <div class="preliminary-report">
                <div class="report-header">
                    <img src="data:image/png;base64,${encabezado}" alt="Encabezado">
                </div>
                <div class="patient-info">
                    <h3>DATOS DEL PACIENTE</h3>
                    <table class="patient-data-table">
                        <tbody>
                            <tr>
                                <td class="info-cell" width="70%">
                                    <strong>APELLIDOS Y NOMBRES:</strong> ${patient.last_name} ${patient.first_name}
                                </td>
                                <td rowspan="2" class="codigo-cell" width="30%">
                                    ${patient.attention_code}
                                </td>
                            </tr>
                            <tr>
                                <td class="info-cell">
                                    <strong>SEXO:</strong> ${patient.gender}
                                </td>
                            </tr>
                            <tr>
                                <td class="info-cell">
                                    <strong>FECHA RECEPCIÓN:</strong> ${patient.registration_date}
                                </td>
                                <td class="info-cell">
                                    <strong>FECHA INFORME:</strong> ${new Date().toLocaleDateString('es-ES', {day: '2-digit', month: '2-digit', year: 'numeric'})}
                                </td>
                            </tr>
                            <tr>
                                <td class="info-cell">
                                    <strong>MÉDICO:</strong> ${patient.requesting_doctor}
                                </td>
                                <td class="info-cell">
                                    <strong>CLÍNICA:</strong> ${patient.clinic}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="report-section">
                    <h3>DESCRIPCIÓN MACROSCÓPICA</h3>
                    <img src="data:image/png;base64,${linea1}" alt="Línea decorativa" class="decorative-line">
                    <div class="report-content">${patient.macro_description || ''}</div>
                </div>
                <div class="report-section">
                    <h3>DESCRIPCIÓN MICROSCÓPICA</h3>
                    <img src="data:image/png;base64,${linea2}" alt="Línea decorativa" class="decorative-line">
                    <div class="report-content">${patient.micro_description || ''}</div>
                </div>
                <div class="diagnosis-section">
                    <div class="diagnosis-title">DIAGNÓSTICO HISTOLÓGICO:</div>
                    <div class="report-content">${patient.diagnosis || ''}</div>
                </div>
                ${(patient.photo1 || patient.photo2) ? `
                <div class="report-section photos-section">
                    <div class="photos-grid">
                        ${patient.photo1 ? `<img src="${patient.photo1}" alt="Foto 1" class="report-photo">` : ''}
                        ${patient.photo2 ? `<img src="${patient.photo2}" alt="Foto 2" class="report-photo">` : ''}
                    </div>
                </div>
                ` : ''}
                <div class="report-footer-container">
                    <div class="signature-section">
                        <img src="data:image/png;base64,${firma}" alt="Firma" class="signature-image">
                    </div>
                    <div class="report-footer-line"></div>
                    <div class="document-footer">
                        <div class="footer-left">
                            ${patient.attention_code} ${patient.last_name} ${patient.first_name}
                        </div>
                        <div class="footer-right">
                            <span>página 1 de 1</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    return reportHtml;
}

app.put('/api/patients/:id/sign', [verifyToken], async (req, res) => {
    const { id } = req.params;

    try {
        // 1. Set is_signed flag
        await new Promise((resolve, reject) => {
            const sql = 'UPDATE patients SET is_signed = 1 WHERE id = ?';
            db.run(sql, [id], function(err) {
                if (err) return reject(err);
                if (this.changes === 0) return reject(new Error('Paciente no encontrado.'));
                resolve();
            });
        });

        // 2. Fetch full patient data
        const patient = await new Promise((resolve, reject) => {
            const sql = "SELECT * FROM patients WHERE id = ?";
            db.get(sql, [id], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!patient) {
            return res.status(404).json({ error: 'Paciente no encontrado después de firmar.' });
        }

        // 3. Generate HTML
        const htmlContent = await generarInformeHtml(patient);

        // 4. Generate PDF with Puppeteer
        const browser = await puppeteer.launch({
            executablePath: '/usr/bin/chromium-browser',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfPath = `${reportsDir}/${patient.attention_code}.pdf`;
        await page.pdf({ path: pdfPath, format: 'A4', printBackground: true });
        await browser.close();

        // 5. Update patient with PDF path
        await new Promise((resolve, reject) => {
            const sql = 'UPDATE patients SET pdf_path = ? WHERE id = ?';
            db.run(sql, [pdfPath, id], (err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        res.status(200).json({ 
            message: 'Informe firmado y PDF generado exitosamente.', 
            pdfPath: pdfPath 
        });

    } catch (error) {
        console.error("Error al firmar y generar PDF:", error);
        res.status(500).json({ error: error.message });
    }
});


app.use('/reports', express.static('reports'));

// --- Universal Search ---
app.get('/api/search', [verifyToken], async (req, res) => {
    const query = req.query.q;

    if (!query) {
        return res.json([]);
    }

    const searchQuery = `%${query}%`;

    try {
        const searchPatients = new Promise((resolve, reject) => {
            const sql = "SELECT id, attention_code, last_name, first_name, clinic FROM patients WHERE attention_code LIKE ? OR last_name LIKE ? OR clinic LIKE ?";
            db.all(sql, [searchQuery, searchQuery, searchQuery], (err, rows) => {
                if (err) return reject(err);
                resolve(rows.map(r => ({ ...r, type: 'patient' })));
            });
        });

        const searchUsers = new Promise((resolve, reject) => {
            const sql = "SELECT id, username, role FROM users WHERE username LIKE ?";
            db.all(sql, [searchQuery], (err, rows) => {
                if (err) return reject(err);
                resolve(rows.map(r => ({ ...r, type: 'user' })));
            });
        });

        const [patients, users] = await Promise.all([searchPatients, searchUsers]);

        res.json([...patients, ...users]);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});