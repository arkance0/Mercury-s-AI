function getPrompt(parsed) {
    if (!parsed) return "Create a useful program.";

    return (
        parsed.raw ||
        parsed.prompt ||
        "Create a useful program."
    );
}

function cleanComment(text) {
    return String(text)
        .replace(/\r?\n/g, " ")
        .slice(0, 500);
}

function createGenerator(language) {
    return {
        async generate(parsed, options = {}) {
            const prompt = cleanComment(
                getPrompt(parsed)
            );

            switch (language) {
                case "javascript":
                    return javascript(prompt);

                case "python":
                    return python(prompt);

                case "bash":
                    return bash(prompt);

                case "c":
                    return c(prompt);

                case "cpp":
                    return cpp(prompt);

                case "java":
                    return java(prompt);

                case "go":
                    return go(prompt);

                case "rust":
                    return rust(prompt);

                case "php":
                    return php(prompt);

                case "ruby":
                    return ruby(prompt);

                case "powershell":
                    return powershell(prompt);

                case "sql":
                    return sql(prompt);

                default:
                    throw new Error(
                        `Unsupported generator: ${language}`
                    );
            }
        }
    };
}


// ================================
// JAVASCRIPT
// ================================

function javascript(prompt) {
    return `// Mercury's AI-Generator
// Request: ${prompt}

"use strict";

function main() {
    console.log("Mercury generated a JavaScript starter.");
}

main();
`;
}


// ================================
// PYTHON
// ================================

function python(prompt) {
    return `# Mercury's AI-Generator
# Request: ${prompt}

def main():
    print("Mercury generated a Python starter.")


if __name__ == "__main__":
    main()
`;
}


// ================================
// BASH
// ================================

function bash(prompt) {
    return `#!/usr/bin/env bash

# Mercury's AI-Generator
# Request: ${prompt}

set -e

echo "Mercury generated a Bash starter."
`;
}


// ================================
// C
// ================================

function c(prompt) {
    return `/*
 * Mercury's AI-Generator
 * Request: ${prompt}
 */

#include <stdio.h>

int main(void) {
    printf("Mercury generated a C starter.\\n");
    return 0;
}
`;
}


// ================================
// C++
// ================================

function cpp(prompt) {
    return `/*
 * Mercury's AI-Generator
 * Request: ${prompt}
 */

#include <iostream>

int main() {
    std::cout
        << "Mercury generated a C++ starter."
        << std::endl;

    return 0;
}
`;
}


// ================================
// JAVA
// ================================

function java(prompt) {
    return `/*
 * Mercury's AI-Generator
 * Request: ${prompt}
 */

public class Main {

    public static void main(String[] args) {
        System.out.println(
            "Mercury generated a Java starter."
        );
    }
}
`;
}


// ================================
// GO
// ================================

function go(prompt) {
    return `// Mercury's AI-Generator
// Request: ${prompt}

package main

import "fmt"

func main() {
    fmt.Println(
        "Mercury generated a Go starter."
    )
}
`;
}


// ================================
// RUST
// ================================

function rust(prompt) {
    return `// Mercury's AI-Generator
// Request: ${prompt}

fn main() {
    println!(
        "Mercury generated a Rust starter."
    );
}
`;
}


// ================================
// PHP
// ================================

function php(prompt) {
    return `<?php

// Mercury's AI-Generator
// Request: ${prompt}

echo "Mercury generated a PHP starter.\\n";

?>
`;
}


// ================================
// RUBY
// ================================

function ruby(prompt) {
    return `# Mercury's AI-Generator
# Request: ${prompt}

def main
    puts "Mercury generated a Ruby starter."
end

main
`;
}


// ================================
// POWERSHELL
// ================================

function powershell(prompt) {
    return `# Mercury's AI-Generator
# Request: ${prompt}

Write-Output "Mercury generated a PowerShell starter."
`;
}


// ================================
// SQL
// ================================

function sql(prompt) {
    return `-- Mercury's AI-Generator
-- Request: ${prompt}

SELECT
    'Mercury generated a SQL starter.'
    AS message;
`;
}


module.exports = {
    createGenerator
};