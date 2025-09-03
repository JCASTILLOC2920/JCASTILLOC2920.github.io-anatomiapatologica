// =============================================
// SISTEMA OPTIMIZADO DE GESTIÓN DE USUARIOS
// =============================================

// Configuración global
const APP_CONFIG = {
    STORAGE_KEY: 'lab_users_data',
    BACKUP_KEY: 'lab_users_backup',
    SESSION_KEY: 'lab_current_session',
    VERSION: '2.0.0'
};

// Clase principal de gestión de usuarios
class UserManager {
    constructor() {
        this.users = new Map();
        this.currentUser = null;
        this.isInitialized = false;
        this.init();
    }

    // Inicializar el sistema
    async init() {
        try {
            console.log('🚀 Inicializando sistema de usuarios...');
            
            // Cargar usuarios desde localStorage
            await this.loadUsersFromStorage();
            
            // Crear usuario admin si no existe
            await this.ensureAdminUser();
            
            // Configurar event listeners
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('✅ Sistema de usuarios inicializado');
            
        } catch (error) {
            console.error('❌ Error inicializando sistema:', error);
            this.handleError(error);
        }
    }

    // Cargar usuarios desde localStorage
    async loadUsersFromStorage() {
        try {
            const storedData = localStorage.getItem(APP_CONFIG.STORAGE_KEY);
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                this.users = new Map(parsedData.users || []);
                console.log(`📊 Usuarios cargados: ${this.users.size}`);
            } else {
                console.log('📝 No hay usuarios almacenados, creando estructura inicial');
                this.users = new Map();
            }
        } catch (error) {
            console.error('❌ Error cargando usuarios:', error);
            this.users = new Map();
        }
    }

    // Guardar usuarios en localStorage
    async saveUsersToStorage() {
        try {
            const dataToStore = {
                users: Array.from(this.users.entries()),
                lastUpdate: new Date().toISOString(),
                version: APP_CONFIG.VERSION
            };
            
            localStorage.setItem(APP_CONFIG.STORAGE_KEY, JSON.stringify(dataToStore));
            
            // Crear respaldo
            localStorage.setItem(APP_CONFIG.BACKUP_KEY, JSON.stringify(dataToStore));
            
            console.log('💾 Usuarios guardados en localStorage');
        } catch (error) {
            console.error('❌ Error guardando usuarios:', error);
            throw error;
        }
    }

    // Asegurar que existe el usuario administrador
    async ensureAdminUser() {
        if (!this.users.has('josehpcastillo')) {
            console.log('👤 Creando usuario administrador...');
            
            const adminUser = {
                username: 'josehpcastillo',
                password: '41457466', // En producción usar hash
                permissions: 'admin',
                status: 'active',
                lastLogin: null,
                createdAt: new Date().toISOString()
            };
            
            this.users.set('josehpcastillo', adminUser);
            await this.saveUsersToStorage();
            console.log('✅ Usuario administrador creado');
        }
    }

    // Autenticar usuario
    async authenticateUser(username, password) {
        try {
            const user = this.users.get(username);
            
            if (!user) {
                throw new Error('Usuario no encontrado');
            }
            
            if (user.password !== password) {
                throw new Error('Contraseña incorrecta');
            }
            
            if (user.status !== 'active') {
                throw new Error('Usuario inactivo');
            }
            
            // Actualizar último acceso
            user.lastLogin = new Date().toISOString();
            await this.saveUsersToStorage();
            
            // Guardar sesión actual
            this.currentUser = {
                username: user.username,
                permissions: user.permissions,
                loginTime: new Date().toISOString(),
                sessionId: 'session_' + Date.now()
            };
            
            sessionStorage.setItem(APP_CONFIG.SESSION_KEY, JSON.stringify(this.currentUser));
            
            console.log(`🔐 Usuario autenticado: ${username}`);
            return this.currentUser;
            
        } catch (error) {
            console.error('❌ Error de autenticación:', error);
            throw error;
        }
    }

    // Crear nuevo usuario
    async createUser(username, password) {
        try {
            // Validaciones
            if (this.users.has(username)) {
                throw new Error('El usuario ya existe');
            }
            
            if (username.length < 3) {
                throw new Error('El nombre de usuario debe tener al menos 3 caracteres');
            }
            
            if (password.length < 6) {
                throw new Error('La contraseña debe tener al menos 6 caracteres');
            }
            
            // Crear usuario con permisos de solo lectura
            const newUser = {
                username: username,
                password: password,
                permissions: 'lectura',
                status: 'active',
                lastLogin: null,
                createdAt: new Date().toISOString()
            };
            
            this.users.set(username, newUser);
            await this.saveUsersToStorage();
            
            console.log(`✅ Usuario creado: ${username}`);
            return newUser;
            
        } catch (error) {
            console.error('❌ Error creando usuario:', error);
            throw error;
        }
    }

    // Eliminar usuario
    async deleteUser(username) {
        try {
            if (username === 'josehpcastillo') {
                throw new Error('No se puede eliminar el usuario administrador');
            }
            
            if (!this.users.has(username)) {
                throw new Error('Usuario no encontrado');
            }
            
            this.users.delete(username);
            await this.saveUsersToStorage();
            
            console.log(`✅ Usuario eliminado: ${username}`);
            return true;
            
        } catch (error) {
            console.error('❌ Error eliminando usuario:', error);
            throw error;
        }
    }

    // Obtener lista de usuarios
    getUsersList() {
        return Array.from(this.users.values()).map(user => ({
            username: user.username,
            permissions: user.permissions,
            status: user.status,
            lastLogin: user.lastLogin,
            createdAt: user.createdAt
        }));
    }

    // Cerrar sesión
    logout() {
        this.currentUser = null;
        sessionStorage.removeItem(APP_CONFIG.SESSION_KEY);
        console.log('🔓 Sesión cerrada');
    }

    // Verificar si hay sesión activa
    hasActiveSession() {
        const session = sessionStorage.getItem(APP_CONFIG.SESSION_KEY);
        if (session) {
            try {
                this.currentUser = JSON.parse(session);
                return true;
            } catch (error) {
                sessionStorage.removeItem(APP_CONFIG.SESSION_KEY);
                return false;
            }
        }
        return false;
    }

    // Configurar event listeners
    setupEventListeners() {
        // Toggle de contraseña
        const togglePassword = document.getElementById('togglePassword');
        const passwordInput = document.getElementById('password');
        
        if (togglePassword && passwordInput) {
            togglePassword.addEventListener('click', (e) => {
                e.preventDefault();
                const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                togglePassword.classList.toggle('fa-eye');
                togglePassword.classList.toggle('fa-eye-slash');
            });
        }

        // Formulario de login
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', this.handleLogin.bind(this));
        }

        // Botones del panel de administración
        this.setupAdminButtons();
    }

    // Manejar login
    async handleLogin(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        try {
            const user = await this.authenticateUser(username, password);
            
            // Ocultar login y mostrar panel de administración
            document.getElementById('loginContainer').style.display = 'none';
            document.getElementById('adminPanel').style.display = 'flex';
            
            // Cargar lista de usuarios
            this.loadUserList();
            
        } catch (error) {
            this.showError(error.message);
        }
    }

    // Configurar botones del panel de administración
    setupAdminButtons() {
        // Botón para proseguir
        const proceedBtn = document.getElementById('proceedBtn');
        if (proceedBtn) {
            proceedBtn.addEventListener('click', () => {
                window.location.href = "pagina2.html";
            });
        }

        // Botón para crear usuario
        const createUserBtn = document.getElementById('createUserBtn');
        if (createUserBtn) {
            createUserBtn.addEventListener('click', this.handleCreateUser.bind(this));
        }

        // Botón para cerrar sesión
        const logoutBtn = document.getElementById('logoutAdminBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', this.handleLogout.bind(this));
        }

        // Controles de paginación
        this.setupPagination();
    }

    // Manejar creación de usuario
    async handleCreateUser() {
        try {
            const username = prompt('Ingrese el nombre de usuario (mínimo 3 caracteres):');
            if (!username) return;
            
            const password = prompt('Ingrese la contraseña (mínimo 6 caracteres):');
            if (!password) return;
            
            await this.createUser(username, password);
            
            // Recargar lista de usuarios
            this.loadUserList();
            
            alert(`✅ Usuario "${username}" creado exitosamente\n\nPermisos: Solo Lectura\nEstado: Activo`);
            
        } catch (error) {
            alert(`❌ Error: ${error.message}`);
        }
    }

    // Manejar logout
    handleLogout() {
        this.logout();
        
        // Mostrar login y ocultar panel de administración
        document.getElementById('adminPanel').style.display = 'none';
        document.getElementById('loginContainer').style.display = 'flex';
        
        // Limpiar formulario
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        this.clearError();
    }

    // Cargar lista de usuarios en la tabla
    loadUserList() {
        const userList = document.getElementById('userList');
        if (!userList) return;
        
        userList.innerHTML = '';
        
        const users = this.getUsersList();
        
        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <span class="user-status status-${user.status}"></span>
                    ${user.username}
                </td>
                <td>${user.permissions}</td>
                <td class="last-login">${user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Nunca'}</td>
                <td class="action-cell">
                    ${user.username !== 'josehpcastillo' ? 
                        `<button class="delete-btn" data-user="${user.username}">
                            <i class="fas fa-trash-alt"></i> Eliminar
                        </button>` : 
                        '<span class="admin-badge">Administrador</span>'
                    }
                </td>
            `;
            userList.appendChild(tr);
        });
        
        // Agregar event listeners a los botones de eliminar
        this.setupDeleteButtons();
    }

    // Configurar botones de eliminar
    setupDeleteButtons() {
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', async (e) => {
                const username = e.target.closest('.delete-btn').getAttribute('data-user');
                
                if (confirm(`¿Está seguro de eliminar al usuario "${username}"?`)) {
                    try {
                        await this.deleteUser(username);
                        this.loadUserList();
                        alert(`✅ Usuario "${username}" eliminado correctamente`);
                    } catch (error) {
                        alert(`❌ Error: ${error.message}`);
                    }
                }
            });
        });
    }

    // Configurar paginación
    setupPagination() {
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                // Implementar paginación si es necesario
                console.log('Página anterior');
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                // Implementar paginación si es necesario
                console.log('Página siguiente');
            });
        }
    }

    // Mostrar error
    showError(message) {
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.textContent = message;
            document.getElementById('loginForm').classList.add('error-animation');
            setTimeout(() => {
                document.getElementById('loginForm').classList.remove('error-animation');
            }, 500);
        }
    }

    // Limpiar error
    clearError() {
        const errorMessage = document.getElementById('errorMessage');
        if (errorMessage) {
            errorMessage.textContent = '';
        }
    }

    // Manejar errores generales
    handleError(error) {
        console.error('Error del sistema:', error);
        alert(`Error del sistema: ${error.message}`);
    }
}

// =============================================
// INICIALIZACIÓN DE LA APLICACIÓN
// =============================================

let userManager;

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Iniciando aplicación...');
    userManager = new UserManager();
});

// Inicializar cuando la página esté completamente cargada
window.addEventListener('load', function() {
    console.log('📱 Inicializando funcionalidades móviles...');
    
    // Verificar si hay sesión activa
    if (userManager && userManager.hasActiveSession()) {
        console.log('🔐 Sesión activa detectada');
        // Aquí podrías redirigir automáticamente si es necesario
    }
});

// =============================================
// FUNCIONALIDADES MÓVILES OPTIMIZADAS
// =============================================

// Detectar dispositivo móvil
function detectMobileDevice() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    if (isMobile || isTouch) {
        document.body.classList.add('mobile-device');
        
        // Prevenir zoom en inputs en iOS
        const inputs = document.querySelectorAll('input[type="text"], input[type="password"]');
        inputs.forEach(input => {
            input.addEventListener('focus', function() {
                this.style.fontSize = '16px';
            });
        });
    }
}

// Optimizar formularios para móvil
function optimizeMobileForms() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        const usernameInput = form.querySelector('input[type="text"]');
        if (usernameInput) {
            usernameInput.setAttribute('autocomplete', 'username');
            usernameInput.setAttribute('autocapitalize', 'none');
            usernameInput.setAttribute('autocorrect', 'off');
        }
        
        const passwordInput = form.querySelector('input[type="password"]');
        if (passwordInput) {
            passwordInput.setAttribute('autocomplete', 'current-password');
        }
    });
}

// Inicializar funcionalidades móviles
function initializeMobileFeatures() {
    detectMobileDevice();
    optimizeMobileForms();
}

// Ejecutar optimizaciones móviles
initializeMobileFeatures();

