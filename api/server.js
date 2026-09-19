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

// ==========================================
// DATABASE
// ==========================================

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

app.use(async (req, res, next) => {
  await databaseReady;
  next();
});

// ==========================================
// HOME
// ==========================================

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport"
        content="width=device-width, initial-scale=1.0">

  <title>Mercury's AI-Generator</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      background: #0b0b0f;
      color: #ffffff;
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .container {
      width: 100%;
      max-width: 430px;
      background: #15151c;
      border: 1px solid #292936;
      border-radius: 18px;
      padding: 25px;
      box-shadow: 0 15px 50px rgba(0,0,0,.4);
    }

    h1 {
      margin: 0 0 8px;
      text-align: center;
      font-size: 26px;
    }

    .subtitle {
      text-align: center;
      color: #9999aa;
      margin-bottom: 25px;
      font-size: 14px;
    }

    input {
      width: 100%;
      padding: 14px;
      margin-bottom: 12px;
      border-radius: 10px;
      border: 1px solid #30303c;
      background: #0e0e14;
      color: white;
      outline: none;
      font-size: 15px;
    }

    input:focus {
      border-color: #6c63ff;
    }

    button {
      width: 100%;
      padding: 14px;
      margin-top: 8px;
      border: 0;
      border-radius: 10px;
      background: #6c63ff;
      color: white;
      font-size: 15px;
      font-weight: bold;
      cursor: pointer;
    }

    button:hover {
      opacity: .9;
    }

    .secondary {
      background: #292936;
    }

    #result {
      margin-top: 18px;
      padding: 14px;
      border-radius: 10px;
      background: #0e0e14;
      color: #bdbdcc;
      font-size: 13px;
      word-break: break-word;
      display: none;
    }

    .status {
      text-align: center;
      margin-top: 15px;
      color: #777788;
      font-size: 12px;
    }
  </style>
</head>

<body>

  <div class="container">

    <h1>Mercury's AI-Generator</h1>

    <div class="subtitle">
      Crea tu cuenta o inicia sesión
    </div>

    <input
      id="email"
      type="email"
      placeholder="Correo electrónico"
      autocomplete="email"
    >

    <input
      id="password"
      type="password"
      placeholder="Contraseña (mínimo 8 caracteres)"
      autocomplete="current-password"
    >

    <button onclick="registerUser()">
      Crear cuenta
    </button>

    <button
      class="secondary"
      onclick="loginUser()"
    >
      Iniciar sesión
    </button>

    <div id="result"></div>

    <div class="status">
      Mercury's AI-Generator • Online
    </div>

  </div>

<script>

function showResult(message) {
  const result = document.getElementById('result');

  result.style.display = 'block';
  result.textContent = message;
}

function getCredentials() {
  return {
    email:
      document.getElementById('email').value.trim(),

    password:
      document.getElementById('password').value
  };
}

async function registerUser() {

  const credentials = getCredentials();

  if (!credentials.email ||
      !credentials.password) {

    showResult(
      'Introduce tu correo y contraseña.'
    );

    return;
  }

  try {

    const response = await fetch(
      '/register',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify(
          credentials
        )
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      showResult(
        '❌ ' + (data.error || 'Error')
      );

      return;
    }

    localStorage.setItem(
      'mercury_token',
      data.token
    );

    showResult(
      '✅ Cuenta creada correctamente. Ya has iniciado sesión.'
    );

  } catch (error) {

    showResult(
      '❌ Error de conexión con Mercury.'
    );

    console.error(error);
  }
}

async function loginUser() {

  const credentials = getCredentials();

  if (!credentials.email ||
      !credentials.password) {

    showResult(
      'Introduce tu correo y contraseña.'
    );

    return;
  }

  try {

    const response = await fetch(
      '/login',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify(
          credentials
        )
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      showResult(
        '❌ ' + (data.error || 'Error')
      );

      return;
    }

    localStorage.setItem(
      'mercury_token',
      data.token
    );

    showResult(
      '✅ Sesión iniciada correctamente.'
    );

  } catch (error) {

    showResult(
      '❌ Error de conexión con Mercury.'
    );

    console.error(error);
  }
}

</script>

</body>
</html>
  `);
});

// ==========================================
// HEALTH
// ==========================================

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'online',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// AUTH
// ==========================================

app.post('/register', async (req, res) => {

  try {

    const {
      email,
      password
    } = req.body;

    const result =
      await register(
        email,
        password
      );

    res.status(201).json({
      success: true,
      message:
        'Cuenta creada correctamente.',
      user: result.user,
      token: result.token
    });

  } catch (error) {

    console.error(
      'REGISTER ERROR:',
      error
    );

    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/login', async (req, res) => {

  try {

    const {
      email,
      password
    } = req.body;

    const result =
      await login(
        email,
        password
      );

    res.json({
      success: true,
      message:
        'Inicio de sesión correcto.',
      user: result.user,
      token: result.token
    });

  } catch (error) {

    console.error(
      'LOGIN ERROR:',
      error
    );

    res.status(401).json({
      success: false,
      error: error.message
    });
  }
});

app.get(
  '/me',
  authenticate,
  (req, res) => {

    res.json({
      success: true,
      user: req.user
    });

  }
);

// ==========================================
// LANGUAGES
// ==========================================

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
      error:
        'Could not load languages.'
    });
  }
});

// ==========================================
// GENERATE
// ==========================================

app.post('/generate', async (req, res) => {

  try {

    const {
      prompt,
      language,
      complexity,
      obfuscate,
      encrypt
    } = req.body;

    if (
      !prompt ||
      typeof prompt !== 'string'
    ) {

      return res.status(400).json({
        success: false,
        error:
          "The 'prompt' field is required."
      });

    }

    if (prompt.length > 10000) {

      return res.status(400).json({
        success: false,
        error:
          'Prompt is too long.'
      });

    }

    const result =
      await engine.generate(
        prompt,
        {
          language,
          complexity,
          obfuscate:
            obfuscate === true,
          encrypt:
            encrypt === true
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
});

// ==========================================
// GENERATE MULTI
// ==========================================

app.post(
  '/generate-multi',
  async (req, res) => {

    try {

      const {
        prompt,
        languages,
        complexity,
        obfuscate,
        encrypt
      } = req.body;

      if (
        !prompt ||
        typeof prompt !== 'string'
      ) {

        return res.status(400).json({
          success: false,
          error:
            "The 'prompt' field is required."
        });

      }

      if (!Array.isArray(languages)) {

        return res.status(400).json({
          success: false,
          error:
            "'languages' must be an array."
        });

      }

      if (
        languages.length === 0 ||
        languages.length > 10
      ) {

        return res.status(400).json({
          success: false,
          error:
            'Languages must contain between 1 and 10 items.'
        });

      }

      const results =
        await engine.generateMulti(
          prompt,
          languages,
          {
            complexity,
            obfuscate:
              obfuscate === true,
            encrypt:
              encrypt === true
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
  }
);

// ==========================================
// 404
// ==========================================

app.use((req, res) => {

  res.status(404).json({
    success: false,
    error:
      'Endpoint not found.'
  });

});

// ==========================================
// ERROR HANDLER
// ==========================================

app.use(
  (error, req, res, next) => {

    console.error(
      'SERVER ERROR:',
      error
    );

    res.status(500).json({
      success: false,
      error:
        'Internal server error.'
    });

  }
);

// ==========================================
// START
// ==========================================

app.listen(
  PORT,
  '0.0.0.0',
  () => {

    console.log(
      `🚀 Mercury's AI-Generator running on port ${PORT}`
    );

    console.log(
      `🌐 Environment: ${
        process.env.NODE_ENV ||
        'production'
      }`
    );

  }
);