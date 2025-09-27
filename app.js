const express = require('express');
const cors = require('cors');
const db = require('./database.js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { verifyToken, isAdmin } = require('./authMiddleware.js');

const app = express();
const port = 3000;
const JWT_SECRET = 'your_jwt_secret_key'; // ¡Cambia esto por una clave secreta más segura!

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('¡El servidor backend está funcionando!');
});

// --- RUTAS DE AUTENTICACIÓN ---

// Ruta de login (pública)
app.post('/api/login', (req, res) => {
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
app.put('/api/patients/:id', [verifyToken], (req, res) => {
    const { id } = req.params;
    const {
        dni, age, last_name, first_name, phone, gender, contact_family, 
        contact_phone, requesting_doctor, study_reason, clinic, 
        macro_description, micro_description, diagnosis, photo1, photo2
    } = req.body;

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
app.put('/api/patients/:id/sign', [verifyToken], (req, res) => {
    const { id } = req.params;
    const sql = 'UPDATE patients SET is_signed = 1 WHERE id = ?';
    db.run(sql, [id], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Paciente no encontrado.' });
        }
        res.status(200).json({ message: 'Informe firmado exitosamente.' });
    });
});


app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
