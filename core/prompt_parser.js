// Mercury's AI-Generator | core/prompt_parser.js

class PromptParser {
  constructor() {
    this.languagePatterns = {
      javascript: [
        /\bjavascript\b/i,
        /\bjs\b/i,
        /\bnode\.?js\b/i
      ],

      python: [
        /\bpython\b/i,
        /\bpy\b/i
      ],

      bash: [
        /\bbash\b/i,
        /\bshell\b/i,
        /\bterminal\b/i,
        /\blinux shell\b/i
      ],

      c: [
        /\bprograma en c\b/i,
        /\blenguaje c\b/i,
        /\bc code\b/i
      ],

      cpp: [
        /\bc\+\+\b/i,
        /\bcpp\b/i
      ],

      java: [
        /\bjava\b/i
      ],

      go: [
        /\bgolang\b/i,
        /\bgo\b/i
      ],

      rust: [
        /\brust\b/i
      ],

      php: [
        /\bphp\b/i
      ],

      ruby: [
        /\bruby\b/i
      ],

      powershell: [
        /\bpowershell\b/i,
        /\bpowershell script\b/i,
        /\bps1\b/i
      ],

      sql: [
        /\bsql\b/i,
        /\bdatabase query\b/i
      ]
    };

    this.complexityPatterns = {
      simple: [
        /\bsimple\b/i,
        /\bbásico\b/i,
        /\bbasico\b/i,
        /\bbasic\b/i,
        /\bfácil\b/i,
        /\bfacil\b/i
      ],

      medium: [
        /\bmedio\b/i,
        /\bmoderado\b/i,
        /\bmedium\b/i
      ],

      complex: [
        /\bcomplejo\b/i,
        /\bcomplex\b/i,
        /\badvanced\b/i,
        /\bavanzado\b/i,
        /\bprofesional\b/i
      ]
    };

    this.intentPatterns = {
      api: [
        /\bapi\b/i,
        /\brest api\b/i,
        /\bendpoint\b/i,
        /\bhttp server\b/i
      ],

      web: [
        /\bwebsite\b/i,
        /\bweb\b/i,
        /\bpágina web\b/i,
        /\bpagina web\b/i,
        /\bfrontend\b/i
      ],

      scraper: [
        /\bscraper\b/i,
        /\bscraping\b/i,
        /\bscrapear\b/i,
        /\bextraer datos\b/i
      ],

      database: [
        /\bdatabase\b/i,
        /\bbasedatos\b/i,
        /\bbase de datos\b/i,
        /\bmysql\b/i,
        /\bpostgresql\b/i,
        /\bmongodb\b/i
      ],

      network: [
        /\bred\b/i,
        /\bnetwork\b/i,
        /\bnetworking\b/i
      ],

      scanner: [
        /\bscanner\b/i,
        /\bscáner\b/i,
        /\bscan\b/i,
        /\bescanear\b/i,
        /\bescaner\b/i
      ],

      automation: [
        /\bautomatizar\b/i,
        /\bautomation\b/i,
        /\bautomate\b/i,
        /\bautomático\b/i,
        /\bautomatic\b/i
      ],

      file: [
        /\barchivo\b/i,
        /\bfiles?\b/i,
        /\bfichero\b/i,
        /\bfilesystem\b/i
      ],

      cli: [
        /\bcli\b/i,
        /\bcommand line\b/i,
        /\blínea de comandos\b/i,
        /\bterminal\b/i
      ]
    };
  }

  parse(prompt) {
    if (typeof prompt !== 'string') {
      throw new Error('El prompt debe ser un texto.');
    }

    const text = prompt.trim();

    if (!text) {
      throw new Error('El prompt no puede estar vacío.');
    }

    const language = this.detectLanguage(text);
    const complexity = this.detectComplexity(text);
    const intent = this.detectIntent(text);

    return {
      original: text,
      prompt: text,
      language,
      complexity,
      intent,
      urls: this.extractUrls(text),
      options: this.extractOptions(text)
    };
  }

  detectLanguage(text) {
    for (const [language, patterns] of Object.entries(this.languagePatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return language;
        }
      }
    }

    return null;
  }

  detectComplexity(text) {
    for (const [complexity, patterns] of Object.entries(
      this.complexityPatterns
    )) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return complexity;
        }
      }
    }

    return 'medium';
  }

  detectIntent(text) {
    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return intent;
        }
      }
    }

    return 'general';
  }

  extractUrls(text) {
    const urls = [];

    const urlPatterns = [
      /https?:\/\/[^\s"'<>]+/gi,
      /www\.[^\s"'<>]+/gi,
      /url[:\s]+(\S+)/gi
    ];

    for (const pattern of urlPatterns) {
      const matches = text.match(pattern);

      if (matches) {
        for (const match of matches) {
          let url = match.trim();

          url = url.replace(/^url[:\s]+/i, '');

          url = url.replace(/[.,!?;:]+$/g, '');

          if (!urls.includes(url)) {
            urls.push(url);
          }
        }
      }
    }

    return urls;
  }

  extractOptions(text) {
    const options = {};

    const languageMatch = text.match(
      /(?:language|lenguaje|lang)[:=\s]+([a-zA-Z0-9+#.-]+)/i
    );

    if (languageMatch) {
      options.language = languageMatch[1].toLowerCase();
    }

    const complexityMatch = text.match(
      /(?:complexity|complejidad)[:=\s]+([a-zA-Z]+)/i
    );

    if (complexityMatch) {
      options.complexity = complexityMatch[1].toLowerCase();
    }

    const filenameMatch = text.match(
      /(?:filename|file|archivo|nombre)[:=\s]+([^\s]+)/i
    );

    if (filenameMatch) {
      options.filename = filenameMatch[1];
    }

    return options;
  }
}

module.exports = new PromptParser();