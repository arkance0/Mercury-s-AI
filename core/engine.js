// Mercury's AI-Generator | core/engine.js
// Motor central de generación de scripts multilingüe

const fs = require("fs");
const path = require("path");

const promptParser = require("./prompt_parser");
const validatorModule = require("./validator");

const config = require("../config/settings.json");
const languages = require("../config/languages.json");

class MultiLangEngine {
    constructor() {
        this.generators = new Map();

        this.maxRetries = config.maxRetries || 3;
        this.timeout = config.timeout || 30000;

        this._loadGenerators();
    }

    // ==========================================
    // CARGAR GENERADORES
    // ==========================================

    _loadGenerators() {
        const generatorsDir = path.join(
            __dirname,
            "../generators"
        );

        console.log("🔎 Buscando generadores en:");
        console.log(generatorsDir);

        if (!fs.existsSync(generatorsDir)) {
            console.warn(
                "⚠️ No existe la carpeta generators/"
            );

            return;
        }

        const entries = fs.readdirSync(
            generatorsDir,
            {
                withFileTypes: true
            }
        );

        console.log(
            `📁 Elementos encontrados: ${entries.length}`
        );

        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }

            const directoryName =
                entry.name;

            const generatorDir =
                path.join(
                    generatorsDir,
                    directoryName
                );

            console.log(
                `🔍 Revisando: generators/${directoryName}`
            );

            const possibleFiles = [
                "index.js",
                "generator.js",
                "generate.js"
            ];

            let generatorPath = null;

            for (const file of possibleFiles) {
                const testPath =
                    path.join(
                        generatorDir,
                        file
                    );

                if (fs.existsSync(testPath)) {
                    generatorPath = testPath;
                    break;
                }
            }

            if (!generatorPath) {
                console.warn(
                    `⚠️ No se encontró archivo de generador en ${directoryName}/`
                );

                continue;
            }

            try {
                let generator =
                    require(generatorPath);

                /*
                 * Soportar:
                 *
                 * module.exports = {
                 *   generate() {}
                 * }
                 *
                 * y:
                 *
                 * module.exports = function() {}
                 */

                if (
                    typeof generator ===
                    "function"
                ) {
                    generator = {
                        generate: generator
                    };
                }

                if (
                    generator &&
                    typeof generator.generate ===
                    "function"
                ) {
                    const normalized =
                        this._normalizeLanguage(
                            directoryName
                        );

                    this.generators.set(
                        normalized,
                        generator
                    );

                    console.log(
                        `✅ Generador cargado: ${directoryName} → ${normalized}`
                    );
                } else {
                    console.warn(
                        `⚠️ ${generatorPath} no exporta generate()`
                    );
                }

            } catch (error) {
                console.error(
                    `❌ Error cargando ${directoryName}:`,
                    error.message
                );
            }
        }

        console.log(
            `🔥 ${this.generators.size} generadores activos`
        );

        if (this.generators.size === 0) {
            console.warn(
                "⚠️ NO HAY GENERADORES CARGADOS."
            );

            console.warn(
                "Comprueba la carpeta generators/ y que cada lenguaje tenga index.js, generator.js o generate.js."
            );
        }
    }

    // ==========================================
    // NORMALIZAR LENGUAJES
    // ==========================================

    _normalizeLanguage(language) {
        if (!language) {
            return "javascript";
        }

        const value =
            String(language)
                .trim()
                .toLowerCase();

        const aliases = {
            js: "javascript",
            node: "javascript",
            nodejs: "javascript",

            py: "python",

            sh: "bash",
            shell: "bash",

            "c++": "cpp",

            golang: "go",

            rs: "rust",

            ps: "powershell",
            pwsh: "powershell",

            mysql: "sql",
            postgres: "sql",
            postgresql: "sql"
        };

        return (
            aliases[value] ||
            value
        );
    }

    // ==========================================
    // GENERAR
    // ==========================================

    async generate(
        prompt,
        options = {}
    ) {
        if (
            !prompt ||
            typeof prompt !== "string"
        ) {
            throw new Error(
                "El prompt debe ser un texto."
            );
        }

        const startTime =
            Date.now();

        // Parsear prompt
        let parsed;

        try {
            if (
                promptParser &&
                typeof promptParser.parse ===
                "function"
            ) {
                parsed =
                    promptParser.parse(
                        prompt
                    );
            } else {
                parsed = {
                    language: "javascript",
                    intent: "generic",
                    complexity: "medium",
                    raw: prompt
                };
            }
        } catch (error) {
            console.warn(
                "⚠️ Error analizando prompt:",
                error.message
            );

            parsed = {
                language: "javascript",
                intent: "generic",
                complexity: "medium",
                raw: prompt
            };
        }

        const requestedLanguage =
            options.language ||
            parsed.language ||
            "javascript";

        const language =
            this._normalizeLanguage(
                requestedLanguage
            );

        const complexity =
            options.complexity ||
            parsed.complexity ||
            "medium";

        const obfuscate =
            options.obfuscate === true;

        const encrypt =
            options.encrypt === true;

        // ==========================================
        // BUSCAR GENERADOR
        // ==========================================

        let generator =
            this.generators.get(
                language
            );

        // Intentar alias por si el parser devuelve otro nombre
        if (!generator) {
            const normalized =
                this._normalizeLanguage(
                    parsed.language
                );

            generator =
                this.generators.get(
                    normalized
                );
        }

        if (!generator) {
            const available =
                Array.from(
                    this.generators.keys()
                );

            throw new Error(
                `Lenguaje "${requestedLanguage}" no soportado. ` +
                `Generadores cargados: ${
                    available.length
                        ? available.join(", ")
                        : "NINGUNO"
                }`
            );
        }

        let code = null;
        let attempts = 0;

        // ==========================================
        // GENERACIÓN CON TIMEOUT
        // ==========================================

        while (
            attempts <
            this.maxRetries
        ) {
            try {
                code =
                    await Promise.race([
                        Promise.resolve(
                            generator.generate(
                                parsed,
                                {
                                    complexity,
                                    targetLanguage:
                                        language,
                                    prompt,
                                    ...options
                                }
                            )
                        ),

                        new Promise(
                            (_, reject) => {
                                setTimeout(
                                    () => {
                                        reject(
                                            new Error(
                                                "La generación excedió el tiempo límite."
                                            )
                                        );
                                    },
                                    this.timeout
                                );
                            }
                        )
                    ]);

                break;

            } catch (error) {
                attempts++;

                console.warn(
                    `⚠️ Reintento ${attempts}/${this.maxRetries}: ${error.message}`
                );

                if (
                    attempts >=
                    this.maxRetries
                ) {
                    throw error;
                }
            }
        }

        // ==========================================
        // VALIDAR RESULTADO
        // ==========================================

        if (
            typeof code !==
            "string"
        ) {
            throw new Error(
                "El generador no devolvió código válido."
            );
        }

        let validation = {
            valid: true,
            errors: [],
            warnings: []
        };

        try {
            if (
                validatorModule &&
                typeof validatorModule.validateCode ===
                "function"
            ) {
                validation =
                    validatorModule.validateCode(
                        code,
                        language
                    );
            } else if (
                validatorModule &&
                typeof validatorModule.validate ===
                "function"
            ) {
                validation =
                    validatorModule.validate(
                        code,
                        language
                    );
            }
        } catch (error) {
            console.warn(
                "⚠️ Error durante validación:",
                error.message
            );
        }

        // ==========================================
        // OFUSCACIÓN
        // ==========================================

        let finalCode =
            code;

        if (obfuscate) {
            finalCode =
                await this._obfuscate(
                    finalCode,
                    language
                );
        }

        // ==========================================
        // CIFRADO
        // ==========================================

        if (encrypt) {
            finalCode =
                await this._encrypt(
                    finalCode,
                    language
                );
        }

        // ==========================================
        // RESPUESTA
        // ==========================================

        return {
            success: true,

            language,

            prompt,

            code: finalCode,

            metadata: {
                linesOfCode:
                    finalCode.split("\n")
                        .length,

                characters:
                    finalCode.length,

                complexity,

                generationTime:
                    Date.now() -
                    startTime,

                validation,

                obfuscated:
                    obfuscate,

                encrypted:
                    encrypt
            },

            suggestions:
                this._getSuggestions(
                    language,
                    parsed.intent
                )
        };
    }

    // ==========================================
    // MULTILENGUAJE
    // ==========================================

    async generateMulti(
        prompt,
        languagesArray,
        options = {}
    ) {
        if (
            !Array.isArray(
                languagesArray
            )
        ) {
            throw new Error(
                "languagesArray debe ser un array."
            );
        }

        const results = {};

        await Promise.all(
            languagesArray.map(
                async requestedLanguage => {
                    try {
                        const language =
                            this._normalizeLanguage(
                                requestedLanguage
                            );

                        results[
                            language
                        ] =
                            await this.generate(
                                prompt,
                                {
                                    ...options,
                                    language
                                }
                            );

                    } catch (error) {
                        results[
                            requestedLanguage
                        ] = {
                            success: false,
                            error:
                                error.message
                        };
                    }
                }
            )
        );

        return results;
    }

    // ==========================================
    // LENGUAJES
    // ==========================================

    getSupportedLanguages() {
        return Array.from(
            this.generators.keys()
        ).map(language => ({
            name: language,

            info:
                languages[language] || {
                    name: language,
                    description:
                        "Generador de código"
                }
        }));
    }

    // ==========================================
    // OFUSCAR
    // ==========================================

    async _obfuscate(
        code,
        language
    ) {
        const obfuscatorPath =
            path.join(
                __dirname,
                "../generators",
                language,
                "obfuscator.js"
            );

        if (
            !fs.existsSync(
                obfuscatorPath
            )
        ) {
            console.warn(
                `⚠️ No existe obfuscator para ${language}`
            );

            return code;
        }

        const obfuscator =
            require(
                obfuscatorPath
            );

        if (
            !obfuscator ||
            typeof obfuscator.obfuscate !==
            "function"
        ) {
            return code;
        }

        return obfuscator.obfuscate(
            code
        );
    }

    // ==========================================
    // CIFRAR
    // ==========================================

    async _encrypt(
        code,
        language
    ) {
        const crypto =
            require("../utils/crypto");

        if (
            !crypto ||
            typeof crypto.encrypt !==
            "function"
        ) {
            throw new Error(
                "crypto.js no exporta encrypt()."
            );
        }

        return crypto.encrypt(
            code,
            language
        );
    }

    // ==========================================
    // SUGERENCIAS
    // ==========================================

    _getSuggestions(
        language,
        intent
    ) {
        const suggestions = {
            javascript: {
                api:
                    "Añade manejo de errores y validación de entradas.",
                database:
                    "Usa consultas parametrizadas.",
                automation:
                    "Añade logs y límites de ejecución.",
                generic:
                    "Revisa el código y añade pruebas."
            },

            python: {
                api:
                    "Valida las entradas y controla los errores.",
                database:
                    "Utiliza consultas parametrizadas.",
                automation:
                    "Añade logging y manejo de excepciones.",
                generic:
                    "Añade pruebas unitarias."
            },

            bash: {
                automation:
                    "Valida argumentos antes de ejecutar comandos.",
                generic:
                    "Usa manejo de errores y evita comandos destructivos."
            },

            go: {
                api:
                    "Valida las entradas y controla errores.",
                network:
                    "Añade timeouts y límites de conexión.",
                generic:
                    "Añade pruebas y manejo de errores."
            },

            rust: {
                network:
                    "Controla errores y límites de recursos.",
                generic:
                    "Aprovecha Result y Option para manejar errores."
            }
        };

        return (
            suggestions[language]?.[
                intent
            ] ||
            suggestions[language]?.generic ||
            "Revisa el código generado antes de ejecutarlo."
        );
    }
}

module.exports =
    new MultiLangEngine();