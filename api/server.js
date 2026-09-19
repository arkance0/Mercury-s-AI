const express = require('express');
const crypto = require('crypto');
const path = require('path');

const engine = require('../core/engine');
const { query } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

// =====================================================
// STATIC WEBSITE
// =====================================================

app.use(express.static(
  path.join(__dirname, '../public')
));

// =====================================================
// AUTH
// =====================================================

const AUTH_SECRET =
  process.env.AUTH_SECRET ||
  'mercury-development-secret-change-this';

const TOKEN_LIFETIME =
  7 * 24 * 60 * 60 * 1000;


// Password hashing
function hashPassword(password) {

  const salt =
    crypto.randomBytes(16).toString('hex');

  const hash =
    crypto.scryptSync(
      password,
      salt,
      64
    ).toString('hex');

  return salt + ':' + hash;
}


// Password verification
function verifyPassword(
  password,
  stored
) {

  try {

    const parts =
      stored.split(':');

    if (parts.length !== 2) {
      return false;
    }

    const salt = parts[0];
    const originalHash =
      Buffer.from(parts[1], 'hex');

    const hash =
      crypto.scryptSync(
        password,
        salt,
        64
      );

    return (
      originalHash.length === hash.length &&
      crypto.timingSafeEqual(
        originalHash,
        hash
      )
    );

  } catch (error) {

    return false;

  }

}


// Base64 URL
function base64Url(value) {

  return Buffer
    .from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

}


// Create token
function createToken(user) {

  const payload = {
    id: user.id,
    email: user.email,
    exp: Date.now() + TOKEN_LIFETIME
  };

  const encoded =
    base64Url(
      JSON.stringify(payload)
    );

  const signature =
    crypto
      .createHmac(
        'sha256',
        AUTH_SECRET
      )
      .update(encoded)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

  return encoded + '.' + signature;

}


// Verify token
function verifyToken(token) {

  try {

    if (!token) {
      return null;
    }

    const parts =
      token.split('.');

    if (parts.length !== 2) {
      return null;
    }

    const encoded = parts[0];
    const signature = parts[1];

    const expected =
      crypto
        .createHmac(
          'sha256',
          AUTH_SECRET
        )
        .update(encoded)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

    if (
      signature.length !== expected.length
    ) {
      return null;
    }

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected)
      )
    ) {
      return null;
    }

    const payload =
      JSON.parse(
        Buffer
          .from(
            encoded,
            'base64url'
          )
          .toString('utf8')
      );

    if (
      !payload.exp ||
      Date.now() > payload.exp
    ) {
      return null;
    }

    return payload;

  } catch (error) {

    return null;

  }

}


// Authentication middleware
function authenticate(req, res, next) {

  const header =
    req.headers.authorization || '';

  if (!header.startsWith('Bearer ')) {

    return res.status(401).json({
      success: false,
      error: 'No autenticado.'
    });

  }

  const token =
    header.slice(7);

  const user =
    verifyToken(token);

  if (!user) {

    return res.status(401).json({
      success: false,
      error: 'Sesión inválida o expirada.'
    });

  }

  req.user = user;

  next();

}


// =====================================================
// DATABASE INITIALIZATION
// =====================================================

async function initDatabase() {

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
      title VARCHAR(255)
        NOT NULL
        DEFAULT 'Nueva conversación',
      created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL
        REFERENCES conversations(id)
        ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      language VARCHAR(50),
      created_at TIMESTAMP
        DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('🗄️ PostgreSQL: tablas listas.');

}


// =====================================================
// ROOT
// =====================================================

app.get('/health', (req, res) => {

  res.json({
    success: true,
    status: 'online',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });

});


app.get('/api/status', (req, res) => {

  res.json({
    success: true,
    name: "Mercury's AI-Generator",
    status: 'online'
  });

});


// =====================================================
// REGISTER
// =====================================================

app.post('/api/register', async (req, res) => {

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
        error: 'Correo y contraseña son obligatorios.'
      });

    }

    if (
      !email.includes('@') ||
      email.length > 255
    ) {

      return res.status(400).json({
        success: false,
        error: 'Correo electrónico inválido.'
      });

    }

    if (password.length < 6) {

      return res.status(400).json({
        success: false,
        error: 'La contraseña debe tener al menos 6 caracteres.'
      });

    }

    const existing =
      await query(
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
        error: 'Ese correo ya está registrado.'
      });

    }

    const passwordHash =
      hashPassword(password);

    const result =
      await query(
        `
        INSERT INTO users
          (email, password_hash)
        VALUES
          ($1, $2)
        RETURNING
          id,
          email,
          created_at
        `,
        [
          email,
          passwordHash
        ]
      );

    const user =
      result.rows[0];

    const token =
      createToken(user);

    res.status(201).json({

      success: true,

      user,

      token

    });

  } catch (error) {

    console.error(
      'REGISTER ERROR:',
      error
    );

    res.status(500).json({
      success: false,
      error: 'Error creando la cuenta.'
    });

  }

});


// =====================================================
// LOGIN
// =====================================================

app.post('/api/login', async (req, res) => {

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
        error: 'Correo y contraseña son obligatorios.'
      });

    }

    const result =
      await query(
        `
        SELECT
          id,
          email,
          password_hash,
          created_at
        FROM users
        WHERE email = $1
        `,
        [email]
      );

    if (result.rows.length === 0) {

      return res.status(401).json({
        success: false,
        error: 'Correo o contraseña incorrectos.'
      });

    }

    const user =
      result.rows[0];

    const valid =
      verifyPassword(
        password,
        user.password_hash
      );

    if (!valid) {

      return res.status(401).json({
        success: false,
        error: 'Correo o contraseña incorrectos.'
      });

    }

    const safeUser = {
      id: user.id,
      email: user.email,
      created_at: user.created_at
    };

    const token =
      createToken(safeUser);

    res.json({

      success: true,

      user: safeUser,

      token

    });

  } catch (error) {

    console.error(
      'LOGIN ERROR:',
      error
    );

    res.status(500).json({
      success: false,
      error: 'Error iniciando sesión.'
    });

  }

});


// =====================================================
// CURRENT USER
// =====================================================

app.get(
  '/api/me',
  authenticate,
  (req, res) => {

    res.json({
      success: true,
      user: req.user
    });

  }
);


// =====================================================
// CONVERSATIONS
// =====================================================

app.get(
  '/api/conversations',
  authenticate,
  async (req, res) => {

    try {

      const result =
        await query(
          `
          SELECT
            id,
            title,
            created_at,
            updated_at
          FROM conversations
          WHERE user_id = $1
          ORDER BY updated_at DESC
          `,
          [req.user.id]
        );

      res.json({
        success: true,
        conversations: result.rows
      });

    } catch (error) {

      console.error(
        'CONVERSATIONS ERROR:',
        error
      );

      res.status(500).json({
        success: false,
        error: 'No se pudieron cargar las conversaciones.'
      });

    }

  }
);


// =====================================================
// OPEN CONVERSATION
// =====================================================

app.get(
  '/api/conversations/:id',
  authenticate,
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      if (!Number.isInteger(id)) {

        return res.status(400).json({
          success: false,
          error: 'ID inválido.'
        });

      }

      const conversation =
        await query(
          `
          SELECT
            id,
            title,
            created_at,
            updated_at
          FROM conversations
          WHERE id = $1
          AND user_id = $2
          `,
          [
            id,
            req.user.id
          ]
        );

      if (
        conversation.rows.length === 0
      ) {

        return res.status(404).json({
          success: false,
          error: 'Conversación no encontrada.'
        });

      }

      const messages =
        await query(
          `
          SELECT
            id,
            role,
            content,
            language,
            created_at
          FROM messages
          WHERE conversation_id = $1
          ORDER BY id ASC
          `,
          [id]
        );

      res.json({

        success: true,

        conversation:
          conversation.rows[0],

        messages:
          messages.rows

      });

    } catch (error) {

      console.error(
        'OPEN CHAT ERROR:',
        error
      );

      res.status(500).json({
        success: false,
        error: 'No se pudo abrir la conversación.'
      });

    }

  }
);


// =====================================================
// DELETE CONVERSATION
// =====================================================

app.delete(
  '/api/conversations/:id',
  authenticate,
  async (req, res) => {

    try {

      const id =
        Number(req.params.id);

      if (!Number.isInteger(id)) {

        return res.status(400).json({
          success: false,
          error: 'ID inválido.'
        });

      }

      const result =
        await query(
          `
          DELETE FROM conversations
          WHERE id = $1
          AND user_id = $2
          RETURNING id
          `,
          [
            id,
            req.user.id
          ]
        );

      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          success: false,
          error: 'Conversación no encontrada.'
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
        error: 'No se pudo eliminar la conversación.'
      });

    }

  }
);


// =====================================================
// CHAT + GENERATION
// =====================================================

app.post(
  '/api/chat',
  authenticate,
  async (req, res) => {

    try {

      const prompt =
        String(req.body.prompt || '').trim();

      const language =
        String(
          req.body.language ||
          'javascript'
        ).toLowerCase();

      let conversationId =
        req.body.conversationId;

      if (!prompt) {

        return res.status(400).json({
          success: false,
          error: 'Escribe algo primero.'
        });

      }

      if (prompt.length > 10000) {

        return res.status(400).json({
          success: false,
          error: 'El mensaje es demasiado largo.'
        });

      }


      // -------------------------------------------
      // CREATE CONVERSATION
      // -------------------------------------------

      if (!conversationId) {

        let title =
          prompt
            .replace(/\s+/g, ' ')
            .slice(0, 60);

        if (!title) {
          title = 'Nueva conversación';
        }

        const created =
          await query(
            `
            INSERT INTO conversations
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
              req.user.id,
              title
            ]
          );

        conversationId =
          created.rows[0].id;

      } else {

        conversationId =
          Number(conversationId);

        const owned =
          await query(
            `
            SELECT id
            FROM conversations
            WHERE id = $1
            AND user_id = $2
            `,
            [
              conversationId,
              req.user.id
            ]
          );

        if (owned.rows.length === 0) {

          return res.status(404).json({
            success: false,
            error: 'Conversación no encontrada.'
          });

        }

      }


      // -------------------------------------------
      // SAVE USER MESSAGE
      // -------------------------------------------

      await query(
        `
        INSERT INTO messages
          (
            conversation_id,
            role,
            content,
            language
          )
        VALUES
          ($1, 'user', $2, $3)
        `,
        [
          conversationId,
          prompt,
          language
        ]
      );


      // -------------------------------------------
      // GENERATE CODE
      // -------------------------------------------

      const result =
        await engine.generate(
          prompt,
          {
            language
          }
        );


      // -------------------------------------------
      // SAVE AI MESSAGE
      // -------------------------------------------

      await query(
        `
        INSERT INTO messages
          (
            conversation_id,
            role,
            content,
            language
          )
        VALUES
          ($1, 'assistant', $2, $3)
        `,
        [
          conversationId,
          result.code,
          result.language
        ]
      );


      // -------------------------------------------
      // UPDATE DATE
      // -------------------------------------------

      const updated =
        await query(
          `
          UPDATE conversations
          SET updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          AND user_id = $2
          RETURNING
            id,
            title,
            created_at,
            updated_at
          `,
          [
            conversationId,
            req.user.id
          ]
        );


      res.json({

        success: true,

        conversation:
          updated.rows[0],

        result

      });

    } catch (error) {

      console.error(
        'CHAT ERROR:',
        error
      );

      res.status(400).json({
        success: false,
        error: error.message
      });

    }

  }
);


// =====================================================
// LANGUAGES
// =====================================================

app.get('/api/languages', (req, res) => {

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
      error: 'No se pudieron cargar los lenguajes.'
    });

  }

});


// =====================================================
// GENERATE DIRECTLY
// =====================================================

app.post(
  '/api/generate',
  authenticate,
  async (req, res) => {

    try {

      const prompt =
        String(req.body.prompt || '');

      const language =
        req.body.language;

      const complexity =
        req.body.complexity;

      if (!prompt.trim()) {

        return res.status(400).json({
          success: false,
          error: 'El prompt es obligatorio.'
        });

      }

      if (prompt.length > 10000) {

        return res.status(400).json({
          success: false,
          error: 'El prompt es demasiado largo.'
        });

      }

      const result =
        await engine.generate(
          prompt,
          {
            language,
            complexity
          }
        );

      res.json(result);

    } catch (error) {

      console.error(
        'GENERATE ERROR:',
        error
      );

      res.status(400).json({
        success: false,
        error: error.message
      });

    }

  }
);


// =====================================================
// 404
// =====================================================

app.use((req, res) => {

  res.status(404).json({
    success: false,
    error: 'Endpoint not found.'
  });

});


// =====================================================
// START
// =====================================================

async function start() {

  try {

    await initDatabase();

    app.listen(
      PORT,
      '0.0.0.0',
      () => {

        console.log(
          "🚀 Mercury's AI-Generator running on port " +
          PORT
        );

        console.log(
          '🌐 Environment: ' +
          (
            process.env.NODE_ENV ||
            'production'
          )
        );

      }
    );

  } catch (error) {

    console.error(
      '❌ DATABASE START ERROR:',
      error
    );

    process.exit(1);

  }

}

start();