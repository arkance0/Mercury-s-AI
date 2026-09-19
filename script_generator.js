// Mercury's IA | script_generator.js
// Genera scripts JavaScript avanzados basado en prompts del usuario
// **¡ADVERTENCIA! Solo para uso teórico en entornos simulados.**

const { generateCodeFromPrompt } = require('./ai_model');
const { obfuscate, encrypt } = require('./utils');

class DarkScriptGenerator {
  constructor() {
    this.config = require('./config/settings.json');
    this.blacklist = require('./config/blacklist.js');
  }

  // Genera un script personalizado basado en un prompt
  async generateScript(prompt, options = {}) {
    // 1. Validación básica (simulada)
    if (this._isBlacklisted(prompt)) {
      throw new Error("Prompt bloqueado por políticas de seguridad (simulado).");
    }

    // 2. Generación del código base con IA
    const rawCode = await generateCodeFromPrompt(prompt, {
      depth: options.depth || this.config.defaultDepth,
      style: options.style || 'aggressive',
      obfuscate: options.obfuscate || false,
    });

    // 3. Post-procesamiento (optimización, obfuscación, etc.)
    let finalCode = rawCode;
    if (options.obfuscate) finalCode = obfuscate(finalCode);
    if (options.encrypt) finalCode = encrypt(finalCode);

    return finalCode;
  }

  // Verifica si el prompt está en la blacklist
  _isBlacklisted(prompt) {
    return this.blacklist.some(term =>
      prompt.toLowerCase().includes(term.toLowerCase())
    );
  }
}

module.exports = new DarkScriptGenerator();