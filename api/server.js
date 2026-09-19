// Mercury's AI-Generator | api/server.js

const express = require('express');

const engine = require('../core/engine');

const app = express();

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '1mb' }));

// -------------------------
// GET /
// -------------------------

app.get('/', (req, res) => {
  res.json({
    name: "Mercury's AI-Generator",
    status: "online",
    version: "1.0.0",
    endpoints: {
      health: "GET /health",
      languages: "GET /languages",
      generate: "POST /generate",
      generateMulti: "POST /generate-multi"
    }
  });
});

// -------------------------
// GET /health
// -------------------------

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: "online",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// -------------------------
// GET /languages
// -------------------------

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
      error: "Could not load languages."
    });
  }
});

// -------------------------
// POST /generate
// -------------------------

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
        error: "The 'prompt' field is required."
      });
    }

    if (prompt.length > 10000) {
      return res.status(400).json({
        success: false,
        error: "Prompt is too long."
      });
    }

    const result =
      await engine.generate(
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

// -------------------------
// POST /generate-multi
// -------------------------

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
          error: "The 'prompt' field is required."
        });
      }

      if (!Array.isArray(languages)) {
        return res.status(400).json({
          success: false,
          error: "'languages' must be an array."
        });
      }

      if (languages.length === 0) {
        return res.status(400).json({
          success: false,
          error: "At least one language is required."
        });
      }

      if (languages.length > 10) {
        return res.status(400).json({
          success: false,
          error: "Maximum of 10 languages per request."
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
  }
);

// -------------------------
// 404
// -------------------------

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found."
  });
});

// -------------------------
// Error handler
// -------------------------

app.use(
  (error, req, res, next) => {
    console.error(
      'SERVER ERROR:',
      error
    );

    res.status(500).json({
      success: false,
      error: "Internal server error."
    });
  }
);

// -------------------------
// Start server
// -------------------------

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `🚀 Mercury's AI-Generator running on port ${PORT}`
    );

    console.log(
      `🌐 Environment: ${process.env.NODE_ENV || 'production'}`
    );
  }
);