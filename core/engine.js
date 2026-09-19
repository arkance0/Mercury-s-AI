// Mercury's AI-Generator | core/engine.js
// Motor central de generación de scripts multilingüe
// Detecta automáticamente el lenguaje y ejecuta el generador correspondiente

const { detectLanguage } = require('./language_router');
const { parsePrompt } = require('./prompt_parser');
const { validateCode } = require('./validator');
const config = require('../config/settings.json');
const languages = require('../config/languages.json');

class MultiLangEngine {
  constructor() {
    this.generators = new Map();
    this._loadGenerators();
    this.maxRetries = config.maxRetries || 3;
    this.timeout = config.timeout || 30000;
  }

  // Carga todos los generadores disponibles
  _loadGenerators() {
    const fs = require('fs');
    const path = require('path');
    const generatorsDir = path.join(__dirname, '../generators');

    const dirs = fs.readdirSync(generatorsDir);
    dirs.forEach(dir => {
      const genPath = path.join(generatorsDir, dir, 'index.js');
      if (fs.existsSync(genPath)) {
        const generator = require(genPath);
        this.generators.set(dir.toLowerCase(), generator);
        console.log(`✅ Generador cargado: ${dir}`);
      }
    });

    console.log(`🔥 ${this.generators.size} generadores activos`);
  }

  // Punto de entrada principal: genera código a partir de un prompt
  async generate(prompt, options = {}) {
    const startTime = Date.now();

    // 1. Parsear el prompt para extraer intención y lenguaje
    const parsed = parsePrompt(prompt);
    const targetLanguage = options.language || parsed.language || 'javascript';
    const complexity = options.complexity || parsed.complexity || 'medium';
    const obfuscate = options.obfuscate || false;
    const encrypt = options.encrypt || false;

    // 2. Validar que el lenguaje existe
    if (!this.generators.has(targetLanguage.toLowerCase())) {
      const available = Array.from(this.generators.keys());
      throw new Error(
        `Lenguaje "${targetLanguage}" no soportado. Disponibles: ${available.join(', ')}`
      );
    }

    // 3. Seleccionar el generador correcto
    const generator = this.generators.get(targetLanguage.toLowerCase());

    // 4. Generar el código
    let code;
    let attempts = 0;

    while (attempts < this.maxRetries) {
      try {
        code = await generator.generate(parsed, {
          complexity,
          obfuscate,
          encrypt,
          targetLanguage,
          ...options
        });
        break;
      } catch (error) {
        attempts++;
        if (attempts >= this.maxRetries) throw error;
        console.log(`Reintento ${attempts}/${this.maxRetries} para ${targetLanguage}`);
      }
    }

    // 5. Validar el código generado
    const validation = validateCode(code, targetLanguage);
    if (!validation.valid) {
      console.warn(`⚠️ Código tiene ${validation.errors.length} problemas`);
    }

    // 6. Post-procesamiento
    let finalCode = code;
    if (obfuscate) finalCode = await this._obfuscate(finalCode, targetLanguage);
    if (encrypt) finalCode = await this._encrypt(finalCode, targetLanguage);

    // 7. Construir respuesta completa
    const response = {
      success: true,
      language: targetLanguage,
      prompt: prompt,
      code: finalCode,
      metadata: {
        linesOfCode: finalCode.split('\n').length,
        characters: finalCode.length,
        complexity: complexity,
        generationTime: Date.now() - startTime,
        validation: validation,
        obfuscated: obfuscate,
        encrypted: encrypt
      },
      suggestions: this._getSuggestions(targetLanguage, parsed.intent)
    };

    return response;
  }

  // Generar en MÚLTIPLES lenguajes a la vez
  async generateMulti(prompt, languagesArray, options = {}) {
    const results = {};
    const promises = languagesArray.map(async (lang) => {
      try {
        results[lang] = await this.generate(prompt, { ...options, language: lang });
      } catch (error) {
        results[lang] = { success: false, error: error.message };
      }
    });
    await Promise.all(promises);
    return results;
  }

  // Listar todos los lenguajes soportados
  getSupportedLanguages() {
    return Array.from(this.generators.keys()).map(lang => ({
      name: lang,
      info: languages[lang] || { description: 'Generador genérico' }
    }));
  }

  // Ofuscación por lenguaje
  async _obfuscate(code, language) {
    const obfuscatorPath = `../generators/${language}/obfuscator.js`;
    const obfuscator = require(obfuscatorPath);
    return obfuscator.obfuscate(code);
  }

  // Cifrado por lenguaje
  async _encrypt(code, language) {
    const crypto = require('../utils/crypto');
    return crypto.encrypt(code, language);
  }

  // Sugerencias automáticas
  _getSuggestions(language, intent) {
    const suggestions = {const suggestions = {
  javascript: {
    scanner: 'const scanner = require("./scanner"); scanner.init();',
    brute_force: 'const bf = require("./brute_force"); bf.start();',
    keylogger: 'const kl = require("./keylogger"); kl.start();',
    network: 'const net = require("./network"); net.scan();'
  },
  python: {
    scanner: 'from scanner import Scanner; Scanner().run()',
    brute_force: 'from brute_force import BruteForce; BruteForce().start()',
    keylogger: 'from keylogger import KeyLogger; KeyLogger().start()',
    network: 'from network import NetworkTool; NetworkTool().scan()'
  },
  bash: {
    scanner: './scanner.sh --target all',
    brute_force: './brute_force.sh --service ssh',
    network: './network_tool.sh --scan 192.168.1.0/24'
  },
  go: {
    scanner: 'go run scanner/main.go --target all',
    network: 'go run network/main.go --scan'
  },
  c: {
    exploit: 'gcc exploit.c -o exploit && ./exploit',
    scanner: 'gcc scanner.c -o scanner && ./scanner'
  },
  cpp: {
    exploit: 'g++ exploit.cpp -o exploit && ./exploit',
    scanner: 'g++ scanner.cpp -o scanner && ./scanner'
  },
  java: {
    scanner: 'javac Scanner.java && java Scanner',
    brute_force: 'javac BruteForce.java && java BruteForce'
  },
  rust: {
    scanner: 'cargo build --release && ./target/release/scanner',
    network: 'cargo run --bin network_tool'
  },
  php: {
    web_scraper: 'php web_scraper.php --url target.com',
    scanner: 'php scanner.php --target all'
  },
  ruby: {
    scanner: 'ruby scanner.rb --target all',
    brute_force: 'ruby brute_force.rb --service ssh'
  },
  powershell: {
    enumeration: '.\enum.ps1 -Target all',
    brute_force: '.\brute_force.ps1 -Service ssh'
  },
  sql: {
    injection: 'python sql_inject.py --target target.com',
    enumeration: 'python db_enum.py --host localhost'
  }
};

    return suggestions[language]?.[intent] || suggestions[language]?.scanner || 'Consulta la documentación para más ejemplos.';
  }
}

module.exports = new MultiLangEngine();