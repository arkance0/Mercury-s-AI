// Mercury's AI-Generator | api/auth.js

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.warn('⚠️ JWT_SECRET no está configurado.');
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      is_admin: user.is_admin
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

async function register(email, password) {
  email = String(email || '').trim().toLowerCase();

  if (!email || !email.includes('@')) {
    throw new Error('Correo electrónico no válido.');
  }

  if (!password || password.length < 8) {
    throw new Error(
      'La contraseña debe tener al menos 8 caracteres.'
    );
  }

  const existing = await query(
    'SELECT id FROM users WHERE email = $1',
    [email]
  );

  if (existing.rows.length > 0) {
    throw new Error('Ese correo ya está registrado.');
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const adminEmail = String(
    process.env.ADMIN_EMAIL || ''
  ).trim().toLowerCase();

  const isAdmin =
    adminEmail &&
    email === adminEmail;

  const result = await query(
    `
    INSERT INTO users
      (email, password_hash, is_admin)
    VALUES
      ($1, $2, $3)
    RETURNING id, email, is_admin, created_at
    `,
    [email, passwordHash, isAdmin]
  );

  const user = result.rows[0];

  return {
    user,
    token: createToken(user)
  };
}

async function login(email, password) {
  email = String(email || '').trim().toLowerCase();

  const result = await query(
    `
    SELECT id, email, password_hash, is_admin, created_at
    FROM users
    WHERE email = $1
    `,
    [email]
  );

  if (result.rows.length === 0) {
    throw new Error('Correo o contraseña incorrectos.');
  }

  const user = result.rows[0];

  const valid = await bcrypt.compare(
    password,
    user.password_hash
  );

  if (!valid) {
    throw new Error('Correo o contraseña incorrectos.');
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      is_admin: user.is_admin,
      created_at: user.created_at
    },
    token: createToken(user)
  };
}

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Autenticación requerida.'
    });
  }

  const token = header.slice(7);

  try {
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET no configurado.');
    }

    req.user = jwt.verify(
      token,
      JWT_SECRET
    );

    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: 'Token inválido o expirado.'
    });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.is_admin !== true) {
    return res.status(403).json({
      success: false,
      error: 'Acceso de administrador requerido.'
    });
  }

  next();
}

module.exports = {
  register,
  login,
  authenticate,
  requireAdmin
};