// Mercury's AI-Generator | core/prompt_parser.js
// Analizador de prompts que extrae intención, lenguaje y complejidad

const languageRouter = require('./language_router');

class PromptParser {
  constructor() {
    this.intentPatterns = {
      scanner: ['escanear', 'scan', 'detectar', 'encontrar', 'buscar', 'descubrir', 'reconocer', 'enumerar', 'fingerprint'],
      brute_force: ['fuerza bruta', 'brute force', 'crackear', 'romper', 'adivinar', 'intentar todas'],
      keylogger: ['keylogger', 'registrar teclas', 'capturar teclado', 'log de teclas', 'keystroke'],
      network: ['red', 'network', 'ping', 'puerto', 'socket', 'conexión', 'conectar', 'ip', 'subred'],
      web_scraper: ['raspador', 'scraper', 'web scraping', 'extraer web', 'crawler', 'spider', 'web'],
      exploit: ['exploit', 'vulnerabilidad', 'ataque', 'inyección', 'buffer overflow', 'desbordamiento'],
      ransomware: ['ransomware', 'cifrar archivos', 'secuestrar', 'encrypt', 'bloquear archivos'],
      encryption: ['cifrar', 'encriptar', 'encrypt', 'codificar', 'encode', 'hash'],
      obfuscation: ['ofuscar', 'obfuscate', 'ocultar', 'disfrazar', 'camuflar'],
      automation: ['automatizar', 'automatización', 'script automatizado', 'auto'],
      simulation: ['simular', 'simulación', 'sim', 'fake', 'dummy', 'prueba'],
      reverse_shell: ['reverse shell', 'conexión inversa', 'shell inverso', 'backconnect'],
      privilege_escalation: ['escalada de privilegios', 'privilege escalation', 'root', 'sudo', 'admin'],
      data_exfiltration: ['exfiltración', 'robar datos', 'data steal', 'exfiltrar', 'extraer datos'],
      persistence: ['persistencia', 'persistente', 'backdoor', 'permanente', 'resistente'],
      phishing: ['phishing', 'suplantación', 'ingenuar', 'engañar', 'fake login'],
      dos: ['denegación de servicio', 'dos', 'ddos', 'ataque de denegación', 'bombardeo'],
      api: ['api', 'rest', 'endpoint', 'json', 'http'],
      database: ['base de datos', 'database', 'db', 'query', 'sql'],
      file_operations: ['archivo', 'file', 'lectura', 'escritura', 'copy', 'move', 'delete'],
      botnet: ['botnet', 'zombi', 'red de bots', 'distributed'],
      crypto: ['criptomoneda', 'crypto', 'minería', 'minar', 'blockchain', 'bitcoin'],
      steganography: ['esteganografía', 'ocultar información', 'stego', 'esconder datos']
    };

    this.complexityPatterns = {
      low: ['simple', 'básico', 'easy', 'fácil', 'rápido', 'simple', 'básico'],
      medium: ['medio', 'medium', 'normal', 'estándar', 'moderado', 'completo'],
      high: ['avanzado', 'avanzada', 'advanced', 'complejo', 'compleja', 'potente', 'hardcore', 'extremo', 'extrema', 'ultra', 'mega', 'super']
    };
  }

  parse(prompt) {
    const promptLower = prompt.toLowerCase();

    return {
      language: this._detectLanguage(prompt),
      intent: this._detectIntent(promptLower),
      complexity: this._detectComplexity(promptLower),
      target: this._extractTarget(promptLower),
      options: this._extractOptions(promptLower),
      raw: prompt
    };
  }

  _detectLanguage(prompt) {
    const detection = languageRouter.detect(prompt);
    return detection.language;
  }

  _detectIntent(prompt) {
    let bestIntent = 'generic';
    let bestScore = 0;

    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      let score = 0;
      patterns.forEach(pattern => {
        if (prompt.includes(pattern)) {
          score += pattern.length;
        }
      });
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    }

    return bestIntent;
  }

  _detectComplexity(prompt) {
    for (const [level, patterns] of Object.entries(this.complexityPatterns)) {
      for (const pattern of patterns) {
        if (prompt.includes(pattern)) {
          return level;
        }
      }
    }
    return 'medium';
  }

  _extractTarget(prompt) {
    const targetPatterns = [
      /target[:\s]+(\S+)/i,
      /url[:\s]+(\S+)/i