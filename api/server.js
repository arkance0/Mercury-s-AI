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

  // ----------------------------------------------------------
  // USERS
  // ----------------------------------------------------------

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      password_salt TEXT,
      is_admin BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // ----------------------------------------------------------
  // MIGRATIONS
  // ----------------------------------------------------------

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
  return {
    hash: crypto
      .scryptSync(password, salt, 64)
      .toString('hex'),

    salt
  };
}

function verifyPassword(
  password,
  storedHash,
  salt
) {
  try {
    if (!storedHash || !salt) {
      return false;
    }

    const hash = crypto
      .scryptSync(password, salt, 64)
      .toString('hex');

    const a = Buffer.from(hash, 'hex');
    const b = Buffer.from(storedHash, 'hex');

    return (
      a.length === b.length &&
      crypto.timingSafeEqual(a, b)
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
    crypto.randomBytes(32).toString('hex');

  sessions.set(token, {
    userId: user.id,
    email: user.email,
    isAdmin: user.is_admin === true
  });

  return token;
}

function getSession(req) {

  const authorization =
    req.headers.authorization || '';

  if (!authorization.startsWith('Bearer ')) {
    return null;
  }

  const token =
    authorization
      .slice(7)
      .trim();

  if (!token) {
    return null;
  }

  return sessions.get(token) || null;
}

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function auth(req, res, next) {

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
// ADMIN MIDDLEWARE
// ============================================================

function admin(req, res, next) {

  if (req.user?.isAdmin !== true) {
    return res.status(403).json({
      success: false,
      error: 'Acceso de administrador requerido.'
    });
  }

  next();
}

// ============================================================
// CHAT HELPERS
// ============================================================

async function ownChat(chatId, userId) {

  const result = await db.query(
    `
      SELECT id
      FROM chats
      WHERE id = $1
      AND user_id = $2
    `,
    [chatId, userId]
  );

  return result.rows.length > 0;
}

async function saveMessage(
  chatId,
  role,
  content,
  language = null
) {

  await db.query(
    `
      INSERT INTO messages(
        chat_id,
        role,
        content,
        language
      )
      VALUES($1,$2,$3,$4)
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
      timestamp:
        new Date().toISOString()
    });

  } catch (error) {

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

    res.status(500).json({
      success: false,
      error: error.message
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
      // VALIDATION
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
      // CHECK EXISTING USER
      // ------------------------------------------------------

      const exists =
        await db.query(
          `
            SELECT id
            FROM users
            WHERE email = $1
          `,
          [email]
        );

      if (exists.rows.length > 0) {

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
      // ADMIN
      // ------------------------------------------------------
      // Si todavía no existe ningún administrador,
      // esta cuenta se convierte en administrador.
      // Así no necesitas ADMIN_EMAIL.

      const adminCheck =
        await db.query(`
          SELECT id
          FROM users
          WHERE is_admin = TRUE
          LIMIT 1
        `);

      const isAdmin =
        adminCheck.rows.length === 0;

      // ------------------------------------------------------
      // INSERT
      // ------------------------------------------------------

      const result =
        await db.query(
          `
            INSERT INTO users(
              email,
              password_hash,
              password_salt,
              is_admin
            )
            VALUES($1,$2,$3,$4)
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
            isAdmin
          ]
        );

      const user =
        result.rows[0];

      const token =
        createSession(user);

      console.log(
        `✅ Usuario registrado: ${email}`
      );

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

      res.status(
        error.code === '23505'
          ? 409
          : 500
      ).json({
        success: false,
        error:
          error.code === '23505'
            ? 'Ese email ya está registrado.'
            : 'No se pudo crear la cuenta.'
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
  auth,
  (req, res) => {

    const authorization =
      req.headers.authorization || '';

    if (
      authorization.startsWith('Bearer ')
    ) {

      const token =
        authorization
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
            INSERT INTO chats(
              user_id,
              title
            )
            VALUES($1,$2)
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
  auth,
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      if (
        !Number.isInteger(id) ||
        id < 1
      ) {

        return res.status(400).json({
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

      if (chat.rows.length === 0) {

        return res.status(404).json({
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
            ORDER BY created_at ASC
          `,
          [id]
        );

      res.json({
        success: true,
        chat: chat.rows[0],
        messages: messages.rows
      });

    } catch (error) {

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
  auth,
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      const result =
        await db.query(
          `
            DELETE FROM chats
            WHERE id = $1
            AND user_id = $2
            RETURNING id
          `,
          [
            id,
            req.user.userId
          ]
        );

      if (result.rows.length === 0) {

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

      res.status(500).json({
        success: false,
        error:
          'No se pudo borrar el chat.'
      });
    }
  }
);

// ============================================================
// GENERATE
// ============================================================

app.post(
  '/generate',
  auth,
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

      let id =
        Number(chatId);

      // ------------------------------------------------------
      // CREATE CHAT AUTOMATICALLY
      // ------------------------------------------------------

      if (
        !Number.isInteger(id) ||
        id < 1
      ) {

        const chat =
          await db.query(
            `
              INSERT INTO chats(
                user_id,
                title
              )
              VALUES($1,$2)
              RETURNING id
            `,
            [
              req.user.userId,
              prompt
                .slice(0, 60) ||
                'Nuevo chat'
            ]
          );

        id =
          chat.rows[0].id;

      } else {

        const belongs =
          await ownChat(
            id,
            req.user.userId
          );

        if (!belongs) {

          return res.status(403).json({
            success: false,
            error:
              'Ese chat no pertenece a tu cuenta.'
          });
        }
      }

      // ------------------------------------------------------
      // USER MESSAGE
      // ---------