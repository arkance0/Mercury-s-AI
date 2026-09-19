const chat = document.getElementById("chat");
const promptInput = document.getElementById("promptInput");
const sendBtn = document.getElementById("sendBtn");

const sendText = document.getElementById("sendText");
const loading = document.getElementById("loading");

const languageSelect =
    document.getElementById("languageSelect");

const complexitySelect =
    document.getElementById("complexitySelect");

const newChatBtn =
    document.getElementById("newChatBtn");

const statusText =
    document.getElementById("statusText");

const statusDot =
    document.querySelector(".status-dot");

const welcome =
    document.getElementById("welcome");


// ==============================
// STATUS
// ==============================

async function checkServer() {

    try {

        const response =
            await fetch("/health");

        if (!response.ok) {
            throw new Error();
        }

        const data =
            await response.json();

        if (data.success) {

            statusText.textContent =
                "Online";

            statusDot.classList.add(
                "online"
            );

        }

    } catch (error) {

        statusText.textContent =
            "Offline";

        statusDot.classList.remove(
            "online"
        );
    }
}

checkServer();


// ==============================
// AUTO RESIZE
// ==============================

promptInput.addEventListener(
    "input",
    () => {

        promptInput.style.height =
            "auto";

        promptInput.style.height =
            Math.min(
                promptInput.scrollHeight,
                180
            ) + "px";
    }
);


// ==============================
// SEND WITH ENTER
// ==============================

promptInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();
        }
    }
);


// ==============================
// EXAMPLE BUTTONS
// ==============================

document.querySelectorAll(
    ".example"
).forEach(button => {

    button.addEventListener(
        "click",
        () => {

            promptInput.value =
                button.dataset.prompt;

            promptInput.focus();

            promptInput.dispatchEvent(
                new Event("input")
            );
        }
    );
});


// ==============================
// NEW CHAT
// ==============================

newChatBtn.addEventListener(
    "click",
    () => {

        chat.innerHTML = "";

        chat.appendChild(
            welcome
        );

        promptInput.value = "";

        promptInput.focus();
    }
);


// ==============================
// SEND
// ==============================

sendBtn.addEventListener(
    "click",
    sendMessage
);


async function sendMessage() {

    const prompt =
        promptInput.value.trim();

    if (!prompt) {
        return;
    }

    if (sendBtn.disabled) {
        return;
    }

    addUserMessage(prompt);

    promptInput.value = "";

    promptInput.style.height =
        "auto";

    setLoading(true);

    try {

        const response =
            await fetch("/generate", {

                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    prompt,

                    language:
                        languageSelect.value,

                    complexity:
                        complexitySelect.value,

                    obfuscate: false,

                    encrypt: false
                })
            });


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Generation failed."
            );
        }


        addAssistantMessage(data);

    } catch (error) {

        addErrorMessage(
            error.message
        );

    } finally {

        setLoading(false);
    }
}


// ==============================
// USER MESSAGE
// ==============================

function addUserMessage(text) {

    if (welcome.parentNode) {
        welcome.remove();
    }

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "message message-user";

    const bubble =
        document.createElement("div");

    bubble.className =
        "user-bubble";

    bubble.textContent =
        text;

    wrapper.appendChild(
        bubble
    );

    chat.appendChild(
        wrapper
    );

    scrollBottom();
}


// ==============================
// ASSISTANT MESSAGE
// ==============================

function addAssistantMessage(data) {

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "message";

    const container =
        document.createElement("div");

    container.className =
        "assistant-message";


    const header =
        document.createElement("div");

    header.className =
        "assistant-header";

    const title =
        document.createElement("span");

    title.textContent =
        "Mercury";


    const language =
        document.createElement("span");

    language.textContent =
        data.language ||
        languageSelect.value;


    header.appendChild(title);
    header.appendChild(language);


    container.appendChild(header);


    // Obtener código generado
    const code =
        data.code ||
        data.generatedCode ||
        data.output ||
        "";


    if (code) {

        const codeContainer =
            document.createElement("div");

        codeContainer.className =
            "code-container";


        const pre =
            document.createElement("pre");

        const codeElement =
            document.createElement("code");

        codeElement.textContent =
            code;


        pre.appendChild(
            codeElement
        );


        const copy =
            document.createElement("button");

        copy.className =
            "copy-btn";

        copy.textContent =
            "Copy";


        copy.addEventListener(
            "click",
            async () => {

                try {

                    await navigator.clipboard
                        .writeText(code);

                    copy.textContent =
                        "Copied!";

                    setTimeout(
                        () => {
                            copy.textContent =
                                "Copy";
                        },
                        1500
                    );

                } catch {

                    copy.textContent =
                        "Failed";
                }
            }
        );


        codeContainer.appendChild(
            pre
        );

        codeContainer.appendChild(
            copy
        );

        container.appendChild(
            codeContainer
        );

    } else {

        const text =
            document.createElement("div");

        text.className =
            "assistant-text";

        text.textContent =
            data.message ||
            data.explanation ||
            "No code was returned.";

        container.appendChild(
            text
        );
    }


    // Mensaje adicional
    if (
        data.message &&
        code
    ) {

        const explanation =
            document.createElement("div");

        explanation.className =
            "assistant-text";

        explanation.textContent =
            data.message;

        container.appendChild(
            explanation
        );
    }


    wrapper.appendChild(
        container
    );

    chat.appendChild(
        wrapper
    );

    scrollBottom();
}


// ==============================
// ERROR
// ==============================

function addErrorMessage(message) {

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "message";


    const error =
        document.createElement("div");

    error.className =
        "error-message";

    error.textContent =
        "Error: " + message;


    wrapper.appendChild(
        error
    );

    chat.appendChild(
        wrapper
    );

    scrollBottom();
}


// ==============================
// LOADING
// ==============================

function setLoading(value) {

    sendBtn.disabled =
        value;

    if (value) {

        sendText.classList.add(
            "hidden"
        );

        loading.classList.remove(
            "hidden"
        );

    } else {

        sendText.classList.remove(
            "hidden"
        );

        loading.classList.add(
            "hidden"
        );
    }
}


// ==============================
// SCROLL
// ==============================

function scrollBottom() {

    setTimeout(
        () => {

            chat.scrollTo({
                top: chat.scrollHeight,
                behavior: "smooth"
            });

        },
        50
    );
}


// ==============================
// TOOLS
// ==============================

document.getElementById(
    "explainBtn"
).addEventListener(
    "click",
    () => {

        promptInput.value =
            "Explain the following code step by step:\n\n";

        promptInput.focus();

        promptInput.dispatchEvent(
            new Event("input")
        );
    }
);


document.getElementById(
    "fixBtn"
).addEventListener(
    "click",
    () => {

        promptInput.value =
            "Find and fix the problems in this code. Return the corrected version and explain the changes:\n\n";

        promptInput.focus();

        promptInput.dispatchEvent(
            new Event("input")
        );
    }
);


document.getElementById(
    "convertBtn"
).addEventListener(
    "click",
    () => {

        promptInput.value =
            "Convert the following code to " +
            languageSelect.value +
            " and explain the conversion:\n\n";

        promptInput.focus();

        promptInput.dispatchEvent(
            new Event("input")
        );
    }
);