// Mercury's AI-Generator | core/engine.js
// Motor central de generación de scripts multilingüe

const promptParser = require('./prompt_parser');
const validatorModule = require('./validator');

const config = require('../config/settings.json');
const languages = require('../config/languages.json');

class MultiLangEngine {
  constructor() {
    this.generators = new Map();

    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 30000;

    this._loadGenerators();
  }

  // Carga los generadores disponibles
  _loadGenerators() {
    const fs = require('fs');
    const path = require('path');

    const generatorsDir = path.join(__dirname, '../generators');

    if (!fs.existsSync(generatorsDir)) {
      console.warn('⚠️ No existe la carpeta generators/');
      return;
    }

    const dirs = fs.readdirSync(generatorsDir, {
      withFileTypes: true
    });

    for (const entry of dirs) {
      if (!entry.isDirectory()) continue;

      const dir = entry.name;
      const genPath = path.join(
        generatorsDir,
        dir,
        'index.js'
      );

      if (!fs.existsSync(genPath)) continue;

      try {
        const generator = require(genPath);

        if (
          generator &&
          typeof generator.generate === 'function'
        ) {
          this.generators.set(
            dir.toLowerCase(),
            generator
          );

          console.log(`✅ Generador cargado: ${dir}`);
        } else {
          console.warn(
            `⚠️ ${dir}/index.js no exporta generate()`
          );
        }
      } catch (error) {
        console.error(
          `❌ Error cargando generador ${dir}:`,
          error.message
        );
      }
    }

    console.log(
      `🔥 ${this.generators.size} generadores activos`
    );
  }

  // Genera código a partir de un prompt
  async generate(prompt, options = {}) {
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('El prompt debe ser un texto.');
    }

    const startTime = Date.now();

    // Prompt parser
    const parsed =
      typeof promptParser.parse === 'function'
        ? promptParser.parse(prompt)
        : {
            language: 'javascript',
            intent: 'generic',
            complexity: 'medium',
            raw: prompt
          };

    const targetLanguage =
      options.language ||
      parsed.language ||
      'javascript';

    const complexity =
      options.complexity ||
      parsed.complexity ||
      'medium';

    const obfuscate =
      options.obfuscate === true;

    const encrypt =
      options.encrypt === true;

    const language =
      targetLanguage.toLowerCase();

    // Verificar generador
    if (!this.generators.has(language)) {
      const available =
        Array.from(this.generators.keys());

      throw new Error(
        `Lenguaje "${targetLanguage}" no soportado. ` +
        `Disponibles: ${available.join(', ')}`
      );
    }

    const generator =
      this.generators.get(language);

    let code = null;
    let attempts = 0;

    // Generación con reintentos
    while (attempts < this.maxRetries) {
      try {
        code = await Promise.race([
          generator.generate(parsed, {
            complexity,
            targetLanguage,
            ...options
          }),

          new Promise((_, reject) => {
            setTimeout(() => {
              reject(
                new Error(
                  'La generación excedió el tiempo límite.'
                )
              );
            }, this.timeout);
          })
        ]);

        break;

      } catch (error) {
        attempts++;

        if (attempts >= this.maxRetries) {
          throw error;
        }

        console.warn(
          `⚠️ Reintento ${attempts}/${this.maxRetries}`
        );
      }
    }

    if (typeof code !== 'string') {
      throw new Error(
        'El generador no devolvió código válido.'
      );
    }

    // Validación
    let validation = {
      valid: true,
      errors: [],
      warnings: []
    };

    try {
      if (
        typeof validatorModule.validateCode ===
        'function'
      ) {
        validation =
          validatorModule.validateCode(
            code,
            targetLanguage
          );
      } else if (
        typeof validatorModule.validate ===
        'function'
      ) {
        validation =
          validatorModule.validate(
            code,
            targetLanguage
          );
      }
    } catch (error) {
      console.warn(
        '⚠️ Error durante la validación:',
        error.message
      );
    }

    // Ofuscación opcional
    let finalCode = code;

    if (obfuscate) {
      finalCode =
        await this._obfuscate(
          finalCode,
          language
        );
    }

    // Cifrado opcional
    if (encrypt) {
      finalCode =
        await this._encrypt(
          finalCode,
          language
        );
    }

    return {
      success: true,
      language: targetLanguage,
      prompt,
      code: finalCode,

      metadata: {
        linesOfCode:
          finalCode.split('\n').length,

        characters:
          finalCode.length,

        complexity,

        generationTime:
          Date.now() - startTime,

        validation,

        obfuscated: obfuscate,
        encrypted: encrypt
      },

      suggestions:
        this._getSuggestions(
          targetLanguage,
          parsed.intent
        )
    };
  }

  // Generar en varios lenguajes
  async generateMulti(
    prompt,
    languagesArray,
    options = {}
  ) {
    const results = {};

    if (!Array.isArray(languagesArray)) {
      throw new Error(
        'languagesArray debe ser un array.'
      );
    }

    await Promise.all(
      languagesArray.map(
        async language => {
          try {
            results[language] =
              await this.generate(
                prompt,
                {
                  ...options,
                  language
                }
              );
          } catch (error) {
            results[language] = {
              success: false,
              error: error.message
            };
          }
        }
      )
    );

    return results;
  }

  // Lenguajes disponibles
  getSupportedLanguages() {
    return Array.from(
      this.generators.keys()
    ).map(language => ({
      name: language,

      info:
        languages[language] || {
          description:
            'Generador de código'
        }
    }));
  }

  // Ofuscación
  async _obfuscate(code, language) {
    const path = require('path');
    const fs = require('fs');

    const obfuscatorPath =
      path.join(
        __dirname,
        '../generators',
        language,
        'obfuscator.js'
      );

    if (!fs.existsSync(obfuscatorPath)) {
      console.warn(
        `⚠️ No existe obfuscator para ${language}`
      );

      return code;
    }

    const obfuscator =
      require(obfuscatorPath);

    if (
      typeof obfuscator.obfuscate !==
      'function'
    ) {
      return code;
    }

    return obfuscator.obfuscate(code);
  }

  // Cifrado
  async _encrypt(code, language) {
    const crypto =
      require('../utils/crypto');

    if (
      typeof crypto.encrypt !==
      'function'
    ) {
      throw new Error(
        'crypto.js no exporta encrypt().'
      );
    }

    return crypto.encrypt(
      code,
      language
    );
  }

  // Sugerencias seguras
  _getSuggestions(language, intent) {
    const suggestions = {
      javascript: {
        api: 'Añade manejo de errores y validación de entradas.',
        database: 'Usa consultas parametrizadas.',
        automation: 'Añade logs y límites de ejecución.',
        generic: 'Revisa el código y añade pruebas.'
      },

      python: {
        api: 'Valida las entradas y controla los errores.',
        database: 'Utiliza consultas parametrizadas.',
        automation: 'Añade logging y manejo de excepciones.',
        generic: 'Añade pruebas unitarias.'
      },

      bash: {
        automation: 'Valida argumentos antes de ejecutar comandos.',
        generic: 'Usa manejo de errores y evita comandos destructivos.'
      },

      go: {
        api: 'Valida las entradas y controla errores.',
        network: 'Añade timeouts y límites de conexión.',
        generic: 'Añade pruebas y manejo de errores.'
      },

      rust: {
        network: 'Controla errores y límites de recursos.',
        generic: 'Aprovecha Result y Option para manejar errores.'
      }
    };

    return (
      suggestions[language]?.[intent] ||
      suggestions[language]?.generic ||
      'Revisa el código generado antes de ejecutarlo.'
    );
  }
}

module.exports = new MultiLangEngine();