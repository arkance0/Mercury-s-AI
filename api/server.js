// ============================================================
// Mercury's AI-Generator
// api/server.js
// ============================================================

const express = require('express');
const path = require('path');
const crypto = require('crypto');

const engine = require('../core/engine');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const sessions = new Map();
let databaseReady = false;

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.json({ limit: '1mb' }));

app.use(
  express.static(
    path.join(__dirname, '../frontend')
  )
);

// ============================================================
// DATABASE
// ============================================================

async function initDatabase() {

  console.log('🔧 Preparando base de datos...');

  // ---------------- USERS ----------------

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      password_salt TEXT,
      is_admin BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_hash TEXT
  `);

  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_salt TEXT
  `);

  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN
  `);

  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
  `);

  await db.query(`
    UPDATE users
    SET is_admin = FALSE
    WHERE is_admin IS NULL
  `);

  await db.query(`
    UPDATE users
    SET created_at = NOW()
    WHERE created_at IS NULL
  `);

  await db.query(`
    ALTER TABLE users
    ALTER COLUMN is_admin SET DEFAULT FALSE
  `);

  // Si todavía no existe ningún admin,
  // el primer usuario se convierte en admin.
  await db.query(`
    UPDATE users
    SET is_admin = TRUE
    WHERE id = (
      SELECT MIN(id)
      FROM users
    )
    AND NOT EXISTS (
      SELECT 1
      FROM users
      WHERE is_admin = TRUE
    )
  `);

  // ---------------- CHATS ----------------

  await db.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      title TEXT DEFAULT 'Nuevo chat',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.query(`
    ALTER TABLE chats
    ADD COLUMN IF NOT EXISTS user_id INTEGER
  `);

  await db.query(`
    ALTER TABLE chats
    ADD COLUMN IF NOT EXISTS title TEXT
  `);

  await db.query(`
    ALTER TABLE chats
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
  `);

  await db.query(`
    ALTER TABLE chats
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
  `);

  await db.query(`
    UPDATE chats
    SET title = 'Nuevo chat'
    WHERE title IS NULL
       OR title = ''
  `);

  await db.query(`
    UPDATE chats
    SET created_at = NOW()
    WHERE created_at IS NULL
  `);

  await db.query(`
    UPDATE chats
    SET updated_at = created_at
    WHERE updated_at IS NULL
  `);

  // ---------------- MESSAGES ----------------

  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      chat_id INTEGER,
      role TEXT,
      content TEXT,
      language TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.query(`
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS chat_id INTEGER
  `);

  await db.query(`
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS role TEXT
  `);

  await db.query(`
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS content TEXT
  `);

  await db.query(`
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS language TEXT
  `);

  await db.query(`
    ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
  `);

  await db.query(`
    UPDATE messages
    SET created_at = NOW()
    WHERE created_at IS NULL
  `);

  console.log('✅ Base de datos preparada.');
}

// ============================================================
// PASSWORDS
// ============================================================

function hashPassword(
  password,
  salt = crypto.randomBytes(16).toString('hex')
) {

  const hash = crypto
    .scryptSync(
      password,
      salt,
      64
    )
    .toString('hex');

  return {
    hash,
    salt
  };
}

function verifyPassword(
  password,
  storedHash,
  storedSalt
) {

  try {

    if (
      !password ||
      !storedHash ||
      !storedSalt
    ) {
      return false;
    }

    const hash = crypto
      .scryptSync(
        password,
        storedSalt,
        64
      )
      .toString('hex');

    const a = Buffer.from(
      hash,
      'hex'
    );

    const b = Buffer.from(
      storedHash,
      'hex'
    );

    if (a.length !== b.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      a,
      b
    );

  } catch {

    return false;
  }
}

// ============================================================
// SESSIONS
// ============================================================

function createSession(user) {

  const token =
    crypto
      .randomBytes(32)
      .toString('hex');

  sessions.set(
    token,
    {
      userId: user.id,
      email: user.email,
      isAdmin:
        user.is_admin === true
    }
  );

  return token;
}

function getSession(req) {

  const header =
    req.headers.authorization || '';

  if (
    !header.startsWith('Bearer ')
  ) {
    return null;
  }

  const token =
    header
      .slice(7)
      .trim();

  if (!token) {
    return null;
  }

  return (
    sessions.get(token) ||
    null
  );
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function auth(req, res, next) {

  if (!databaseReady) {

    return res
      .status(503)
      .json({
        success: false,
        error:
          'La base de datos todavía está iniciando. Inténtalo de nuevo en unos segundos.'
      });
  }

  const session =
    getSession(req);

  if (!session) {

    return res
      .status(401)
      .json({
        success: false,
        error:
          'No has iniciado sesión.'
      });
  }

  req.user = session;

  next();
}

function admin(req, res, next) {

  if (
    req.user?.isAdmin !== true
  ) {

    return res
      .status(403)
      .json({
        success: false,
        error:
          'Acceso de administrador requerido.'
      });
  }

  next();
}

// ============================================================
// CHAT HELPERS
// ============================================================

async function ownChat(
  chatId,
  userId
) {

  const result =
    await db.query(
      `
      SELECT id
      FROM chats
      WHERE id = $1
      AND user_id = $2
      `,
      [
        chatId,
        userId
      ]
    );

  return (
    result.rows.length > 0
  );
}

async function saveMessage(
  chatId,
  role,
  content,
  language = null
) {

  await db.query(
    `
    INSERT INTO messages (
      chat_id,
      role,
      content,
      language,
      created_at
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      NOW()
    )
    `,
    [
      chatId,
      role,
      content,
      language
    ]
  );

  await db.query(
    `
    UPDATE chats
    SET updated_at = NOW()
    WHERE id = $1
    `,
    [chatId]
  );
}

// ============================================================
// FRONTEND
// ============================================================

app.get(
  '/',
  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        '../frontend/index.html'
      )
    );
  }
);

// ============================================================
// HEALTH
// ============================================================

app.get(
  '/health',
  async (req, res) => {

    try {

      const result =
        await db.testConnection();

      res.json({
        success: true,
        status: 'online',
        database: 'connected',
        databaseReady,
        databaseTime: result.now,
        uptime: process.uptime(),
        timestamp:
          new Date().toISOString()
      });

    } catch (error) {

      console.error(
        'HEALTH ERROR:',
        error.message
      );

      res
        .status(503)
        .json({
          success: false,
          status: 'online',
          database: 'error',
          databaseReady: false,
          error: error.message
        });
    }
  }
);

// ============================================================
// LANGUAGES
// ============================================================

app.get(
  '/languages',
  (req, res) => {

    try {

      const languages =
        engine.getSupportedLanguages();

      res.json({
        success: true,
        count: languages.length,
        languages
      });

    } catch (error) {

      res
        .status(500)
        .json({
          success: false,
          error: error.message
        });
    }
  }
);

// ============================================================
// REGISTER
// ============================================================

app.post(
  '/auth/register',
  async (req, res) => {

    try {

      if (!databaseReady) {

        return res
          .status(503)
          .json({
            success: false,
            error:
              'La base de datos todavía está iniciando.'
          });
      }

      const email =
        String(
          req.body.email || ''
        )
        .trim()
        .toLowerCase();

      const password =
        String(
          req.body.password || ''
        );

      if (
        !email ||
        !email.includes('@') ||
        email.length > 320
      ) {

        return res
          .status(400)
          .json({
            success: false,
            error:
              'Introduce un email válido.'
          });
      }

      if (
        password.length < 6
      ) {

        return res
          .status(400)
          .json({
            success: false,
            error:
              'La contraseña debe tener al menos 6 caracteres.'
          });
      }

      const existing =
        await db.query(
          `
          SELECT id
          FROM users
          WHERE email = $1
          `,
          [email]
        );

      if (
        existing.rows.length > 0
      ) {

        return res
          .status(409)
          .json({
            success: false,
            error:
              'Ese email ya está registrado.'
          });
      }

      const passwordData =
        hashPassword(password);

      const adminCheck =
        await db.query(
          `
          SELECT COUNT(*)::int AS count
          FROM users
          `
        );

      const isFirstUser =
        adminCheck.rows[0].count === 0;

      const result =
        await db.query(
          `
          INSERT INTO users (
            email,
            password_hash,
            password_salt,
            is_admin,
            created_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            NOW()
          )
          RETURNING
            id,
            email,
            is_admin,
            created_at
          `,
          [
            email,
            passwordData.hash,
            passwordData.salt,
            isFirstUser
          ]
        );

      const user =
        result.rows[0];

      const token =
        createSession(user);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          isAdmin:
            user.is_admin === true,
          createdAt:
            user.created_at
        }
      });

    } catch (error) {

      console.error(
        'REGISTER ERROR:',
        error
      );

      if (
        error.code === '23505'
      ) {

        return res
          .status(409)
          .json({
            success: false,
            error:
              'Ese email ya está registrado.'
          });
      }

      res
        .status(500)
        .json({
          success: false,
          error:
            'No se pudo crear la cuenta.'
        });
    }
  }
);

// ============================================================
// LOGIN
// ============================================================

app.post(
  '/auth/login',
  async (req, res) => {

    try {

      if (!databaseReady) {

        return res
          .status(503)
          .json({
            success: false,
            error:
              'La base de datos todavía está iniciando.'
          });
      }

      const email =
        String(
          req.body.email || ''
        )
        .trim()
        .toLowerCase();

      const password =
        String(
          req.body.password || ''
        );

      const result =
        await db.query(
          `
          SELECT
            id,
            email,
            password_hash,
            password_salt,
            is_admin,
            created_at
          FROM users
          WHERE email = $1
          `,
          [email]
        );

      if (
        result.rows.length === 0
      ) {

        return res
          .status(401)
          .json({
            success: false,
            error:
              'Email o contraseña incorrectos.'
          });
      }

      const user =
        result.rows[0];

      const valid =
        verifyPassword(
          password,
          user.password_hash,
          user.password_salt
        );

      if (!valid) {

        return res
          .status(401)
          .json({
            success: false,
            error:
              'Email o contraseña incorrectos.'
          });
      }

      const token =
        createSession(user);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          isAdmin:
            user.is_admin === true,
          createdAt:
            user.created_at
        }
      });

    } catch (error) {

      console.error(
        'LOGIN ERROR:',
        error
      );

      res
        .status(500)
        .json({
          success: false,
          error:
            'No se pudo iniciar sesión.'
        });
    }
  }
);

// ============================================================
// LOGOUT
// ============================================================

app.post(
  '/auth/logout',
  auth,
  (req, res) => {

    const header =
      req.headers.authorization || '';

    if (
      header.startsWith('Bearer ')
    ) {

      const token =
        header
          .slice(7)
          .trim();

      sessions.delete(token);
    }

    res.json({
      success: true
    });
  }
);

// ============================================================
// CURRENT USER
// ============================================================

app.get(
  '/auth/me',
  auth,
  async (req, res) => {

    try {

      const result =
        await db.query(
          `
          SELECT
            id,
            email,
            is_admin,
            created_at
          FROM users
          WHERE id = $1
          `,
          [req.user.userId]
        );

      if (
        result.rows.length === 0
      ) {

        return res
          .status(404)
          .json({
            success: false,
            error:
              'Usuario no encontrado.'
          });
      }

      const user =
        result.rows[0];

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          isAdmin:
            user.is_admin === true,
          createdAt:
            user.created_at
        }
      });

    } catch (error) {

      console.error(
        'ME ERROR:',
        error
      );

      res
        .status(500)
        .json({
          success: false,
          error:
            'No se pudo obtener el usuario.'
        });
    }
  }
);

// ============================================================
// CREATE CHAT
// ============================================================

app.post(
  '/chats',
  auth,
  async (req, res) => {

    try {

      const title =
        String(
          req.body.title ||
          'Nuevo chat'
        )
        .trim()
        .slice(0, 100) ||
        'Nuevo chat';

      const result =
        await db.query(
          `
          INSERT INTO chats (
            user_id,
            title,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            NOW(),
            NOW()
          )
          RETURNING
            id,
            title,
            created_at,
            updated_at
          `,
          [
            req.user.userId,
            title
          ]
        );

      res.json({
        success: true,
        chat: result.rows[0]
      });

    } catch (error) {

      console.error(
        'CREATE CHAT ERROR:',
        error
      );

      res
        .status(500)
        .json({
          success: false,
          error:
            'No se pudo crear el chat.'
        });
    }
  }
);

// ============================================================
// LIST CHATS
// ============================================================

app.get(
  '/chats',
  auth,
  async (req, res) => {

    try {

      const result =
        await db.query(
          `
          SELECT
            id,
            title,
            created_at,
            updated_at
          FROM chats
          WHERE user_id = $1
          ORDER BY updated_at DESC
          `,
          [req.user.userId]
        );

      res.json({
        success: true,
        chats: result.rows
      });

    } catch (error) {

      console.error(
        'LIST CHATS ERROR:',
        error
      );

      res
        .status(500)
        .json({
          success: false,
          error:
            'No se pudieron cargar los chats.'
        });
    }
  }
);

// ============================================================
// GET CHAT
// ============================================================

app.get(
  '/chats/:id',
  auth,
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id < 1
      ) {

        return res
          .status(400)
          .json({
            success: false,
            error:
              'ID de chat inválido.'
          });
      }

      const chat =
        await db.query(
          `
          SELECT
            id,
            title,
            created_at,
            updated_at
          FROM chats
          WHERE id = $1
          AND user_id = $2
          `,
          [
            id,
            req.user.userId
          ]
        );

      if (
        chat.rows.length === 0
      ) {

        return res
          .status(404)
          .json({
            success: false,
            error:
              'Chat no encontrado.'
          });
      }

      const messages =
        await db.query(
          `
          SELECT
            id,
            role,
            content,
            language,
            created_at
          FROM messages
          WHERE chat_id = $1
          ORDER BY
            created_at ASC,
            id ASC
          `,
          [id]
        );

      res.json({
        success: true,
        chat: chat.rows[0],
        messages: messages.rows
      });

    } catch (error) {

      console.error(
        'GET CHAT ERROR:',
        error
      );

      res
        .status(500)
        .json({
          success: false,
          error:
            'No se pudo cargar el chat.'
        });
    }
  }
);

// =============================================