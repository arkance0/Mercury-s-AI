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

// Servir frontend/
app.use(express.static(
  path.join(__dirname, '../frontend')
));

// ============================================================
// DATABASE
// ============================================================

async function initDatabase() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS chats (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'Nuevo chat',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
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

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto
    .scryptSync(password, salt, 64)
    .toString('hex');

  return {
    hash,
    salt
  };
}

function verifyPassword(password, storedHash, salt) {
  const hash = crypto
    .scryptSync(password, salt, 64)
    .toString('hex');

  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(storedHash, 'hex');

  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(a, b);
}

// ============================================================
// SIMPLE SESSION TOKENS
// ============================================================

const sessions = new Map();

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');

  sessions.set(token, {
    userId: user.id,
    email: user.email,
    createdAt: Date.now()
  });

  return token;
}

function getSession(req) {
  const header = req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice(7);

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
// ROOT
// ============================================================

app.get('/', (req, res) => {
  res.sendFile(
    path.join(__dirname, '../frontend/index.html')
  );
});

// ============================================================
// HEALTH
// ============================================================

app.get('/health', async (req, res) => {
  try {
    const result = await db.testConnection();

    res.json({
      success: true,
      status: 'online',
      database: 'connected',
      databaseTime: result.now,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
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
    const languages = engine.getSupportedLanguages();

    res.json({
      success: true,
      count: languages.length,
      languages
    });
  } catch (error) {
    console.error('LANGUAGES ERROR:', error);

    res.status(500).json({
      success: false,
      error: 'Could not load languages.'
    });
  }
});

// ============================================================
// REGISTER
// ============================================================

app.post('/auth/register', async (req, res) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();

    const password = String(req.body.password || '');

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Introduce un email válido.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'La contraseña debe tener al menos 6 caracteres.'
      });
    }

    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Ese email ya está registrado.'
      });
    }

    const passwordData = hashPassword(password);

    const result = await db.query(
      `
      INSERT INTO users
        (email, password_hash, password_salt)
      VALUES
        ($1, $2, $3)
      RETURNING id, email, created_at
      `,
      [
        email,
        passwordData.hash,
        passwordData.salt
      ]
    );

    const user = result.rows[0];

    const token = createSession(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });

  } catch (error) {
    console.error('REGISTER ERROR:', error);

    res.status(500).json({
      success: false,
      error: 'No se pudo crear la cuenta.'
    });
  }
});

// ============================================================
// LOGIN
// ============================================================

app.post('/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '')
      .trim()
      .toLowerCase();

    const password = String(req.body.password || '');

    const result = await db.query(
      `
      SELECT
        id,
        email,
        password_hash,
        password_salt
      FROM users
      WHERE email = $1
      `,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Email o contraseña incorrectos.'
      });
    }

    const user = result.rows[0];

    const valid = verifyPassword(
      password,
      user.password_hash,
      user.password_salt
    );

    if (!valid) {
      return res.status(401).json({
        success: false,
        error: 'Email o contraseña incorrectos.'
      });
    }

    const token = createSession(user);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });

  } catch (error) {
    console.error('LOGIN ERROR:', error);

    res.status(500).json({
      success: false,
      error: 'No se pudo iniciar sesión.'
    });
  }
});

// ============================================================
// LOGOUT
// ============================================================

app.post('/auth/logout', requireAuth, (req, res) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : null;

  if (token) {
    sessions.delete(token);
  }

  res.json({
    success: true
  });
});

// ============================================================
// CURRENT USER
// ============================================================

app.get('/auth/me', requireAuth, async (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.userId,
      email: req.user.email
    }
  });
});

// ============================================================
// CREATE CHAT
// ============================================================

app.post('/chats', requireAuth, async (req, res) => {
  try {
    const title =
      String(req.body.title || 'Nuevo chat')
        .trim()
        .slice(0, 100) || 'Nuevo chat';

    const result = await db.query(
      `
      INSERT INTO chats
        (user_id, title)
      VALUES
        ($1, $2)
      RETURNING id, title, created_at, updated_at
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
    console.error('CREATE CHAT ERROR:', error);

    res.status(500).json({
      success: false,
      error: 'No se pudo crear el chat.'
    });
  }
});

// ============================================================
// LIST CHATS
// ============================================================

app.get('/chats', requireAuth, async (req, res) => {
  try {
    const result = await db.query(
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
    console.error('LIST CHATS ERROR:', error);

    res.status(500).json({
      success: false,
      error: 'No se pudieron cargar los chats.'
    });
  }
});

// ============================================================
// GET CHAT
// ============================================================

app.get('/chats/:id', requireAuth, async (req, res) => {
  try {
    const chatId = Number(req.params.id);

    const chatResult = await db.query(
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

    if (chatResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Chat no encontrado.'
      });
    }

    const messagesResult = await db.query(
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
      messages: messagesResult.rows
    });

  } catch (error) {
    console.error('GET CHAT ERROR:', error);

    res.status(500).json({
      success: false,
      error: 'No se pudo cargar el chat.'
    });
  }
});

// ============================================================
// DELETE CHAT
// ============================================================

app.delete('/chats/:id', requireAuth, async (req, res) => {
  try {
    const chatId = Number(req.params.id);

    const result = await db.query(
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

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Chat no encontrado.'
      });
    }

    res.json({
      success: true
    });

  } catch (error) {
    console.error('DELETE CHAT ERROR:', error);

    res.status(500).json({
      success: false,
      error: 'No se pudo borrar el chat.'
    });
  }
});

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
      (chat_id, role, content, language)
    VALUES
      ($1, $2, $3, $4)
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

app.post('/generate', requireAuth, async (req, res) => {
  try {
    const {
      prompt,
      language,
      complexity,
      obfuscate,
      encrypt,
      chatId
    } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: "El campo 'prompt' es obligatorio."
      });
    }

    if (prompt.length > 10000) {
      return res.status(400).json({
        success: false,
        error: 'El prompt es demasiado largo.'
      });
    }

    let currentChatId = Number(chatId);

    // Si no existe chat, crear uno
    if (!currentChatId) {
      const chat = await db.query(
        `
        INSERT INTO chats
          (user_id, title)
        VALUES
          ($1, $2)
        RETURNING id
        `,
        [
          req.user.userId,
          prompt.slice(0, 60)
        ]
      );

      currentChatId = chat.rows[0].id;
    } else {
      // Comprobar que el chat pertenece al usuario
      const ownership = await db.query(
        `
        SELECT id
        FROM chats
        WHERE id = $1
        AND user_id = $2
        `,
        [
          currentChatId,
          req.user.userId
        ]
      );

      if (ownership.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Ese chat no pertenece a tu cuenta.'
        });
      }
    }

    // Guardar prompt
    await saveMessage(
      currentChatId,
      'user',
      prompt,
      language || null
    );

    const result = await engine.generate(
      prompt,
      {
        language,
        complexity,
        obfuscate: obfuscate === true,
        encrypt: encrypt === true
      }
    );

    // Guardar respuesta
    await saveMessage(
      currentChatId,
      'assistant',
      result.code,
      result.language
    );

    res.json({
      ...result,
      chatId: currentChatId
    });

  } catch (error) {
    console.error('GENERATE ERROR:', error);

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// GENERATE MULTI
// ============================================================

app.post('/generate-multi', requireAuth, async (req, res) => {
  try {
    const {
      prompt,
      languages,
      complexity,
      obfuscate,
      encrypt
    } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: "El campo 'prompt' es obligatorio."
      });
    }

    if (!Array.isArray(languages)) {
      return res.status(400).json({
        success: false,
        error: "'languages' debe ser un array."
      });
    }

    if (languages.length === 0 || languages.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Debes indicar entre 1 y 10 lenguajes.'
      });
    }

    const results = await engine.generateMulti(
      prompt,
      languages,
      {
        complexity,
        obfuscate: obfuscate === true,
        encrypt: encrypt === true
      }
    );

    res.json({
      success: true,
      prompt,
      results
    });

  } catch (error) {
    console.error('GENERATE MULTI ERROR:', error);

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================================
// API 404
// ============================================================

app.use((req, res, next) => {
  // Si parece una petición de API, devolver JSON.
  if (
    req.path.startsWith('/auth') ||
    req.path.startsWith('/chats') ||
    req.path.startsWith('/generate') ||
    req.path === '/languages' ||
    req.path === '/health'
  ) {
    return res.status(404).json({
      success: false,
      error: 'Endpoint not found.'
    });
  }

  next();
});

// ============================================================
// FRONTEND FALLBACK
// ============================================================

app.use((req, res) => {
  res.sendFile(
    path.join(__dirname, '../frontend/index.html')
  );
});

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((error, req, res, next) => {
  console.error('SERVER ERROR:', error);

  res.status(500).json({
    success: false,
    error: 'Internal server error.'
  });
});

// ============================================================
// START
// ============================================================

async function start() {
  try {
    await initDatabase();

    app.listen(PORT, '0.0.0.0', () => {
      console.log(
        `🚀 Mercury's AI-Generator running on port ${PORT}`
      );

      console.log(
        `🌐 Environment: ${process.env.NODE_ENV || 'production'}`
      );

      console.log(
        `📁 Frontend: ${path.join(__dirname, '../frontend')}`
      );
    });

  } catch (error) {
    console.error(
      '❌ Error iniciando Mercury:',
      error
    );

    process.exit(1);
  }
}

start();