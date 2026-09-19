const express = require("express");
const path = require("path");

const engine = require("../core/engine");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));

// Servir la web
app.use(express.static(path.join(__dirname, "../frontend")));

// Página principal
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Health
app.get("/health", (req, res) => {
    res.json({
        success: true,
        status: "online",
        service: "Mercury's AI-Generator",
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Lenguajes disponibles
app.get("/languages", (req, res) => {
    try {
        const languages = engine.getSupportedLanguages();

        res.json({
            success: true,
            count: languages.length,
            languages
        });
    } catch (error) {
        console.error("LANGUAGES ERROR:", error);

        res.status(500).json({
            success: false,
            error: "Could not load languages."
        });
    }
});

// Generar código
app.post("/generate", async (req, res) => {
    try {
        const {
            prompt,
            language,
            complexity,
            obfuscate,
            encrypt
        } = req.body;

        if (!prompt || typeof prompt !== "string") {
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

        const result = await engine.generate(prompt, {
            language,
            complexity,
            obfuscate: obfuscate === true,
            encrypt: encrypt === true
        });

        res.json(result);

    } catch (error) {
        console.error("GENERATE ERROR:", error);

        res.status(400).json({
            success: false,
            error: error.message || "Generation failed."
        });
    }
});

// Generación en varios lenguajes
app.post("/generate-multi", async (req, res) => {
    try {
        const {
            prompt,
            languages,
            complexity,
            obfuscate,
            encrypt
        } = req.body;

        if (!prompt || typeof prompt !== "string") {
            return res.status(400).json({
                success: false,
                error: "The 'prompt' field is required."
            });
        }

        if (!Array.isArray(languages) || languages.length === 0) {
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

        const results = await engine.generateMulti(
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
        console.error("GENERATE MULTI ERROR:", error);

        res.status(400).json({
            success: false,
            error: error.message || "Generation failed."
        });
    }
});

// Cualquier ruta desconocida
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: "Endpoint not found."
    });
});

// Errores
app.use((error, req, res, next) => {
    console.error("SERVER ERROR:", error);

    res.status(500).json({
        success: false,
        error: "Internal server error."
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(
        `🚀 Mercury's AI-Generator running on port ${PORT}`
    );
});