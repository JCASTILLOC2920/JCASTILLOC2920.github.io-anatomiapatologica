const jwt = require('jsonwebtoken');
const JWT_SECRET = 'your_jwt_secret_key'; // Debe ser la misma clave secreta que en app.js

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato "Bearer TOKEN"

    if (!token) {
        return res.status(403).send("Se requiere un token para la autenticación");
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
    } catch (err) {
        return res.status(401).send("Token inválido");
    }
    return next();
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).send("Acceso denegado. Se requiere rol de administrador.");
    }
};

module.exports = { verifyToken, isAdmin };
