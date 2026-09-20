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

// ============================================================
// CONFIG
// ============================================================

app.use(express.json({ limit: '1mb' }));

// Servir frontend
app.use(
  express.static(
    path.join(__dirname, '../frontend')
  )
);

// ============================================================
// DATABASE
// ============================================================

async function initDatabase() {
  // ----------------------------------------------------------
  // USERS
  // ----------------------------------------------------------

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ----------------------------------------------------------
  // MIGRACIÓN DE USERS EXISTENTES
  // ----------------------------------------------------------

  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN
  `);

  await db.query(`
    UPDATE users
    SET is_admin = FALSE
    WHERE is_admin IS NULL
  `);

  await db.query(`
    ALTER TABLE users
    ALTER COLUMN is_admin SET DEFAULT FALSE
  `);

  await db.query(`
    ALTER TABLE users
    ALTER COLUMN is_admin SET NOT NULL
  `);

  // ----------------------------------------------------------
  // CHATS
  // ----------------------------------------------------------

  await db.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Nuevo chat',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ----------------------------------------------------------
  // MESSAGES
  // ----------------------------------------------------------

  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      chat_id INTEGER NOT NULL
        REFERENCES chats(id)
        ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      language TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
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
    .scryptSync(password, salt, 64)
    .toString('hex');

  return {
    hash,
    salt
  };
}

function verifyPassword(
  password,
  storedHash,
  salt
) {
  try {
    const hash = crypto
      .scryptSync(password, salt, 64)
      .toString('hex');

    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(storedHash, 'hex');

    if (a.length !== b.length) {
      return false;
    }

    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ============================================================
// SESSIONS
// ============================================================

const sessions = new Map();

function createSession(user) {
  const token = crypto
    .randomBytes(32)
    .toString('hex');

  sessions.set(token, {
    userId: user.id,
    email: user.email,
    isAdmin: user.is_admin === true,
    createdAt: Date.now()
  });

  return token;
}

function getSession(req) {
  const header =
    req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice(7).trim();

  if (!token) {
    return null;
  }

  return sessions.get(token) || null;
}

function requireAuth(req, res, next) {
  const session = getSession(req);

  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'No has iniciado sesión.'
    });
  }

  req.user = session;

  next();
}

// ============================================================
// ADMIN
// ============================================================

function requireAdmin(req, res, next) {
  if (!req.user || req.user.isAdmin !== true) {
    return res.status(403).json({
      success: false,
      error: 'Acceso de administrador requerido.'
    });
  }

  next();
}

// ============================================================
// ROOT
// ============================================================

app.get('/', (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      '../frontend/index.html'
    )
  );
});

// ============================================================
// HEALTH
// ============================================================

app.get('/health', async (req, res) => {
  try {
    const result =
      await db.testConnection();

    res.json({
      success: true,
      status: 'online',
      database: 'connected',
      databaseTime: result.now,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(
      'HEALTH ERROR:',
      error.message
    );

    res.status(500).json({
      success: false,
      status: 'online',
      database: 'error',
      error: error.message
    });
  }
});

// ============================================================
// LANGUAGES
// ============================================================

app.get('/languages', (req, res) => {
  try {
    const languages =
      engine.getSupportedLanguages();

    res.json({
      success: true,
      count: languages.length,
      languages
    });

  } catch (error) {
    console.error(
      'LANGUAGES ERROR:',
      error
    );

    res.status(500).json({
      success: false,
      error: 'Could not load languages.'
    });
  }
});

// ============================================================
// REGISTER
// ============================================================

app.post(
  '/auth/register',
  async (req, res) => {
    try {
      const email =
        String(req.body.email || '')
          .trim()
          .toLowerCase();

      const password =
        String(req.body.password || '');

      // ------------------------------------------------------
      // VALIDACIÓN
      // ------------------------------------------------------

      if (
        !email ||
        !email.includes('@') ||
        email.length > 320
      ) {
        return res.status(400).json({
          success: false,
          error: 'Introduce un email válido.'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          error:
            'La contraseña debe tener al menos 6 caracteres.'
        });
      }

      // ------------------------------------------------------
      // COMPROBAR EMAIL
      // ------------------------------------------------------

      const existing =
        await db.query(
          `
          SELECT id
          FROM users
          WHERE email = $1
          `,
          [email]
        );

      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error:
            'Ese email ya está registrado.'
        });
      }

      // ------------------------------------------------------
      // PASSWORD
      // ------------------------------------------------------

      const passwordData =
        hashPassword(password);

      // ------------------------------------------------------
      // CREAR USUARIO
      //
      // IMPORTANTE:
      // is_admin usa FALSE directamente.
      // Nunca se envía "".
      // ------------------------------------------------------

      const result =
        await db.query(
          `
          INSERT INTO users
            (
              email,
              password_hash,
              password_salt,
              is_admin
            )
          VALUES
            (
              $1,
              $2,
              $3,
              FALSE
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
            passwordData.salt
          ]
        );

      const user =
        result.rows[0];

      // ------------------------------------------------------
      // SESIÓN
      // ------------------------------------------------------

      const token =
        createSession(user);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          isAdmin:
            user.is_admin === true
        }
      });

    } catch (error) {
      console.error(
        'REGISTER ERROR:',
        error
      );

      // Email duplicado por condición de carrera
      if (
        error.code === '23505'
      ) {
        return res.status(409).json({
          success: false,
          error:
            'Ese email ya está registrado.'
        });
      }

      res.status(500).json({
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
      const email =
        String(req.body.email || '')
          .trim()
          .toLowerCase();

      const password =
        String(req.body.password || '');

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error:
            'Introduce email y contraseña.'
        });
      }

      const result =
        await db.query(
          `
          SELECT
            id,
            email,
            password_hash,
            password_salt,
            is_admin
          FROM users
          WHERE email = $1
          `,
          [email]
        );

      if (result.rows.length === 0) {
        return res.status(401).json({
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
        return res.status(401).json({
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
            user.is_admin === true
        }
      });

    } catch (error) {
      console.error(
        'LOGIN ERROR:',
        error
      );

      res.status(500).json({
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
  requireAuth,
  (req, res) => {
    const header =
      req.headers.authorization || '';

    if (header.startsWith('Bearer ')) {
      const token =
        header.slice(7).trim();

      if (token) {
        sessions.delete(token);
      }
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
  requireAuth,
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

      if (result.rows.length === 0) {
        return res.status(404).json({
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

      res.status(500).json({
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
  requireAuth,
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
          INSERT INTO chats
            (user_id, title)
          VALUES
            ($1, $2)
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

      res.status(500).json({
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
  requireAuth,
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

      res.status(500).json({
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
  requireAuth,
  async (req, res) => {
    try {
      const chatId =
        Number(req.params.id);

      if (
        !Number.isInteger(chatId) ||
        chatId <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            'ID de chat inválido.'
        });
      }

      const chatResult =
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
            chatId,
            req.user.userId
          ]
        );

      if (
        chatResult.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            'Chat no encontrado.'
        });
      }

      const messagesResult =
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
          ORDER BY created_at ASC
          `,
          [chatId]
        );

      res.json({
        success: true,
        chat: chatResult.rows[0],
        messages:
          messagesResult.rows
      });

    } catch (error) {
      console.error(
        'GET CHAT ERROR:',
        error
      );

      res.status(500).json({
        success: false,
        error:
          'No se pudo cargar el chat.'
      });
    }
  }
);

// ============================================================
// DELETE CHAT
// ============================================================

app.delete(
  '/chats/:id',
  requireAuth,
  async (req, res) => {
    try {
      const chatId =
        Number(req.params.id);

      if (
        !Number.isInteger(chatId) ||
        chatId <= 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            'ID de chat inválido.'
        });
      }

      const result =
        await db.query(
          `
          DELETE FROM chats
          WHERE id = $1
          AND user_id = $2
          RETURNING id
          `,
          [
            chatId,
            req.user.userId
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          error:
            'Chat no encontrado.'
        });
      }

      res.json({
        success: true
      });

    } catch (error) {
      console.error(
        'DELETE CHAT ERROR:',
        error
      );

      res.status(500).json({
        success: false,
        error:
          'No se pudo borrar el chat.'
      });
    }
  }
);

// ============================================================
// SAVE MESSAGE
// ============================================================

async function saveMessage(
  chatId,
  role,
  content,
  language = null
) {
  await db.query(
    `
    INSERT INTO messages
      (
        chat_id,
        role,
        content,
        language
      )
    VALUES
      (
        $1,
        $2,
        $3,
        $4
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
// GENERATE
// ============================================================

app.post(
  '/generate',
  requireAuth,
  async (req, res) => {
    try {
      const {
        prompt,
        language,
        complexity,
        obfuscate,
        encrypt,
        chatId
      } = req.body;

      if (
        !prompt ||
        typeof prompt !== 'string'
      ) {
        return res.status(400).json({
          success: false,
          error:
            "El campo 'prompt' es obligatorio."
        });
      }

      if (prompt.length > 10000) {
        return res.status(400).json({
          success: false,
          error:
            'El prompt es demasiado largo.'
        });
      }

      let currentChatId =
        Number(chatId);

      // ------------------------------------------------------
      // CREAR CHAT AUTOMÁTICAMENTE
      // ------------------------------------------------------

      if (
        !Number.isInteger(
          currentChatId
        ) ||
        currentChatId <= 0
      ) {
        const chat =
          await db.query(
            `
            INSERT INTO chats
              (user_id, title)
            VALUES
              ($1, $2)
            RETURNING id
            `,
            [
              req.user.userId,
              prompt
                .slice(0, 60)
                .trim() ||
                'Nuevo chat'
            ]
          );

        currentChatId =
          chat.rows[0].id;

      } else 