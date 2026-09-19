// Mercury's AI-Generator | core/validator.js

class CodeValidator {
  validateCode(code, language) {
    const errors = [];
    const warnings = [];

    if (typeof code !== 'string') {
      return {
        valid: false,
        errors: ['El código generado no es texto válido.'],
        warnings: []
      };
    }

    if (!code.trim()) {
      return {
        valid: false,
        errors: ['El código generado está vacío.'],
        warnings: []
      };
    }

    const lang = String(language || '').toLowerCase();

    // Comprobaciones básicas de sintaxis
    const brackets = this.checkBrackets(code);

    if (!brackets.valid) {
      errors.push(brackets.error);
    }

    // Comprobaciones específicas por lenguaje
    switch (lang) {
      case 'javascript':
        this.validateJavaScript(code, errors, warnings);
        break;

      case 'python':
        this.validatePython(code, errors, warnings);
        break;

      case 'json':
        this.validateJSON(code, errors);
        break;

      case 'sql':
        this.validateSQL(code, warnings);
        break;

      default:
        break;
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  checkBrackets(code) {
    const pairs = {
      ')': '(',
      ']': '[',
      '}': '{'
    };

    const opening = new Set(['(', '[', '{']);
    const stack = [];

    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inTemplate = false;
    let escaped = false;

    for (let i = 0; i < code.length; i++) {
      const char = code[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\') {
        escaped = true;
        continue;
      }

      if (char === "'" && !inDoubleQuote && !inTemplate) {
        inSingleQuote = !inSingleQuote;
        continue;
      }

      if (char === '"' && !inSingleQuote && !inTemplate) {
        inDoubleQuote = !inDoubleQuote;
        continue;
      }

      if (char === '`' && !inSingleQuote && !inDoubleQuote) {
        inTemplate = !inTemplate;
        continue;
      }

      if (inSingleQuote || inDoubleQuote || inTemplate) {
        continue;
      }

      if (opening.has(char)) {
        stack.push(char);
        continue;
      }

      if (pairs[char]) {
        const last = stack.pop();

        if (last !== pairs[char]) {
          return {
            valid: false,
            error: `Paréntesis o corchetes desbalanceados cerca del carácter ${i}.`
          };
        }
      }
    }

    if (stack.length > 0) {
      return {
        valid: false,
        error: 'Hay paréntesis, corchetes o llaves sin cerrar.'
      };
    }

    if (inSingleQuote || inDoubleQuote || inTemplate) {
      return {
        valid: false,
        error: 'Hay una cadena de texto sin cerrar.'
      };
    }

    return {
      valid: true
    };
  }

  validateJavaScript(code, errors, warnings) {
    if (/\brequire\s*\(\s*['"]{2}\s*\)/.test(code)) {
      warnings.push('Se encontró un require() con una ruta vacía.');
    }

    if (/\bconsole\.log\s*\(\s*$/.test(code)) {
      errors.push('Parece existir un console.log() incompleto.');
    }
  }

  validatePython(code, errors, warnings) {
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (/\bdef\s+\w+\s*\([^)]*\)\s*:\s*$/.test(line)) {
        const nextLine = lines[i + 1];

        if (
          nextLine !== undefined &&
          nextLine.trim() !== '' &&
          !/^\s+/.test(nextLine)
        ) {
          errors.push(
            `Posible bloque Python sin indentación en la línea ${i + 2}.`
          );
        }
      }
    }

    if (/\bprint\s*\(\s*$/.test(code)) {
      warnings.push('Parece existir un print() incompleto.');
    }
  }

  validateJSON(code, errors) {
    try {
      JSON.parse(code);
    } catch (error) {
      errors.push(`JSON inválido: ${error.message}`);
    }
  }

  validateSQL(code, warnings) {
    if (/;\s*DROP\s+TABLE/i.test(code)) {
      warnings.push(
        'El código contiene una operación DROP TABLE. Revísala antes de ejecutarla.'
      );
    }

    if (/;\s*DELETE\s+FROM/i.test(code) && !/\bWHERE\b/i.test(code)) {
      warnings.push(
        'DELETE FROM sin WHERE puede afectar a muchas filas.'
      );
    }
  }

  validate(code, language) {
    return this.validateCode(code, language);
  }
}

module.exports = new CodeValidator();