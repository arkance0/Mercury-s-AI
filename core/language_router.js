// Mercury's AI-Generator | core/language_router.js
// Router inteligente que detecta el lenguaje objetivo desde el prompt

const config = require('../config/languages.json');

class LanguageRouter {
  constructor() {
    this.languagePatterns = {
      javascript: ['js', 'javascript', 'node', 'nodejs', 'npm', 'es6', 'typescript', 'ts '],
      python: ['python', 'py ', 'py3', 'pip', 'django', 'flask', 'pandas', 'numpy', 'py '],
      bash: ['bash', 'shell', 'sh ', 'linux', 'unix', 'cli', 'terminal', 'gnu'],
      c: ['c ', 'lenguaje c', 'código c', 'gcc', 'clang', 'compilar c'],
      cpp: ['c++', 'cpp', 'c plus plus', 'g++', 'clang++'],
      java: ['java', 'javac', 'jvm', 'spring', 'maven', 'gradle'],
      go: ['go ', 'golang', 'golang', 'go run', 'go build'],
      rust: ['rust ', 'rustlang', 'cargo', 'rustc'],
      php: ['php ', 'php7', 'php8', 'laravel', 'symfony', 'composer'],
      ruby: ['ruby ', 'rails', 'ruby on rails', 'gem ', 'bundler'],
      powershell: ['powershell', 'ps1', 'pwsh', 'powershell core', 'windows powershell'],
      sql: ['sql', 'mysql', 'postgresql', 'postgres', 'sqlite', 'mongodb', 'query', 'select ', 'insert ']
    };

    this.defaultLanguage = 'javascript';
    this.confidenceThreshold = 0.6;
  }

  // Detecta el lenguaje desde el texto del prompt
  detect(prompt) {
    const promptLower = prompt.toLowerCase();
    const scores = {};

    for (const [lang, patterns] of Object.entries(this.languagePatterns)) {
      scores[lang] = this._calculateScore(promptLower, patterns);
    }

    const bestMatch = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

    if (bestMatch[1] >= this.confidenceThreshold) {
      return {
        language: bestMatch[0],
        confidence: bestMatch[1],
        allScores: scores
      };
    }

    return {
      language: this.defaultLanguage,
      confidence: 0,
      allScores: scores,
      fallback: true
    };
  }

  // Calcula puntuación de coincidencia
  _calculateScore(prompt, patterns) {
    let score = 0;
    patterns.forEach(pattern => {
      if (prompt.includes(pattern)) {
        score += pattern.length / prompt.length;
      }
    });
    return Math.min(score, 1.0);
  }

  // Verifica si un lenguaje es válido
  isValid(language) {
    return config.languages.hasOwnProperty(language.toLowerCase());
  }

  // Obtiene toda la información de un lenguaje
  getLanguageInfo(language) {
    return config.languages[language.toLowerCase()] || null;
  }
}

module.exports = new LanguageRouter();