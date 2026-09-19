const express = require('express');
const engine = require('../core/engine');
const { initDatabase } = require('./init-db');
const {
  register,
  login,
  authenticate
} = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

const databaseReady = initDatabase()
  .then(() => {
    console.log('🗄️ PostgreSQL listo.');
  })
  .catch((error) => {
    console.error(
      '❌ Error inicializando PostgreSQL:',
      error.message
    );
  });

// Esperar a que PostgreSQL esté listo para las rutas
app.use(async (req, res, next) => {
  await databaseReady;
  next();
});

app.get('/', (req, res) => {
  res.json({
    name: "Mercury's AI-Generator",
    status: "online",
    version: "1.0.0"
  });
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: "online",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ================================
// AUTH
// ================================

app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await register(
      email,
      password
    );

    res.status(201).json({
      success: true,
      message: 'Cuenta creada correctamente.',
      user: result.user,
      token: result.token
    });

  } catch (error) {
    console.error('REGISTER ERROR:', error);

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await login(
      email,
      password
    );

    res.json({
      success: true,
      message: 'Inicio de sesión correcto.',
      user: result.user,
      token: result.token
    });

  } catch (error) {
    console.error('LOGIN ERROR:', error);

    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/me', authenticate, (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// ================================
// LANGUAGES
// ================================

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
    console.error('LANGUAGES ERROR:', error);

    res.status(500).json({
      success: false,
      error: 'Could not load languages.'
    });
  }
});

// ================================
// GENERATE
// ================================

app.post('/generate', async (req, res) => {
  try {
    const {
      prompt,
      language,
      complexity,
      obfuscate,
      encrypt
    } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        success: false,
        error: "The 'prompt' field is required."
      });
    }

    if (prompt.length > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is too long.'
      });
    }

    const result = await engine.generate(
      prompt,
      {
        language,
        complexity,
        obfuscate: obfuscate === true,
        encrypt: encrypt === true
      }
    );

    res.json(result);

  } catch (error) {
    console.error('GENERATE ERROR:', error);

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ================================
// GENERATE MULTI
// ================================

app.post('/generate-multi', async (req, res) => {
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
        error: "The 'prompt' field is required."
      });
    }

    if (!Array.isArray(languages)) {
      return res.status(400).json({
        success: false,
        error: "'languages' must be an array."
      });
    }

    if (
      languages.length === 0 ||
      languages.length > 10
    ) {
      return res.status(400).json({
        success: false,
        error: 'Languages must contain between 1 and 10 items.'
      });
    }

    const results =
      await engine.generateMulti(
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
    console.error(
      'GENERATE MULTI ERROR:',
      error
    );

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

// ================================
// 404
// ================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found.'
  });
});

// ================================
// SERVER
// ================================

app.use((error, req, res, next) => {
  console.error(
    'SERVER ERROR:',
    error
  );

  res.status(500).json({
    success: false,
    error: 'Internal server error.'
  });
});

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `🚀 Mercury's AI-Generator running on port ${PORT}`
    );

    console.log(
      `🌐 Environment: ${
        process.env.NODE_ENV || 'production'
      }`
    );
  }
);