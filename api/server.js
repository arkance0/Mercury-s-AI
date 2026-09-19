const express = require('express');
const engine = require('../core/engine');
const { initDatabase } = require('./init-db');
const { query } = require('./db');
const {
  register,
  login,
  authenticate
} = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));

// ======================================================
// DATABASE
// ======================================================

const databaseReady = initDatabase()
  .then(() => {
    console.log('🗄️ PostgreSQL listo.');
  })
  .catch((error) => {
    console.error(
      '❌ Error inicializando PostgreSQL:',
      error.message
    );
  });

app.use(async (req, res, next) => {
  await databaseReady;
  next();
});

// ======================================================
// LOGIN / REGISTER PAGE
// ======================================================

app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport"
      content="width=device-width, initial-scale=1.0">

<title>Mercury's AI-Generator</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #0b0b10;
  color: #fff;
  font-family: Arial, sans-serif;
}

button,
input,
textarea,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

.hidden {
  display: none !important;
}

/* ==================================================
   AUTH
================================================== */

#authScreen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.authBox {
  width: 100%;
  max-width: 430px;
  background: #15151d;
  border: 1px solid #292936;
  border-radius: 20px;
  padding: 28px;
  box-shadow: 0 20px 70px rgba(0,0,0,.45);
}

.logo {
  text-align: center;
  font-size: 28px;
  font-weight: bold;
  margin-bottom: 8px;
}

.subtitle {
  text-align: center;
  color: #9292a5;
  margin-bottom: 25px;
}

.authBox input {
  width: 100%;
  padding: 15px;
  margin-bottom: 12px;
  border-radius: 11px;
  border: 1px solid #30303d;
  background: #0d0d13;
  color: white;
  outline: none;
}

.authBox input:focus {
  border-color: #6d5dfc;
}

.primary {
  width: 100%;
  padding: 14px;
  border: 0;
  border-radius: 11px;
  background: #6d5dfc;
  color: white;
  font-weight: bold;
  margin-top: 6px;
}

.secondary {
  width: 100%;
  padding: 14px;
  border: 0;
  border-radius: 11px;
  background: #292936;
  color: white;
  font-weight: bold;
  margin-top: 10px;
}

.message {
  margin-top: 15px;
  padding: 12px;
  border-radius: 10px;
  background: #0d0d13;
  color: #c5c5d3;
  text-align: center;
  font-size: 14px;
}

/* ==================================================
   APP
================================================== */

#app {
  height: 100vh;
  display: flex;
  overflow: hidden;
}

/* SIDEBAR */

.sidebar {
  width: 280px;
  flex-shrink: 0;
  background: #111118;
  border-right: 1px solid #292936;
  display: flex;
  flex-direction: column;
}

.sidebarTop {
  padding: 15px;
  border-bottom: 1px solid #292936;
}

.brand {
  font-weight: bold;
  font-size: 18px;
  margin-bottom: 13px;
}

.newChat {
  width: 100%;
  border: 1px solid #393947;
  background: #1b1b24;
  color: white;
  padding: 12px;
  border-radius: 10px;
}

.history {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.chatItem {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
}

.chatButton {
  flex: 1;
  min-width: 0;
  border: 0;
  background: transparent;
  color: #c9c9d5;
  text-align: left;
  padding: 11px;
  border-radius: 9px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chatButton:hover {
  background: #20202a;
  color: white;
}

.deleteChat {
  border: 0;
  background: transparent;
  color: #777788;
  padding: 7px;
}

.deleteChat:hover {
  color: #ff6666;
}

.sidebarBottom {
  padding: 13px;
  border-top: 1px solid #292936;
}

.userEmail {
  color: #9999aa;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 9px;
}

.logout {
  width: 100%;
  padding: 10px;
  border: 0;
  border-radius: 9px;
  background: #292936;
  color: white;
}

/* MAIN */

.main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.topbar {
  height: 58px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 15px;
  border-bottom: 1px solid #292936;
  background: #111118;
}

.menuBtn {
  display: none;
  border: 0;
  background: transparent;
  color: white;
  font-size: 23px;
}

.chatTitle {
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 25px;
}

.welcome {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #888899;
}

.messageRow {
  max-width: 900px;
  margin: 0 auto 22px;
  display: flex;
}

.messageRow.user {
  justify-content: flex-end;
}

.bubble {
  max-width: 85%;
  padding: 14px 16px;
  border-radius: 15px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}

.user .bubble {
  background: #5d50dc;
}

.assistant .bubble {
  background: #181821;
  border: 1px solid #2b2b38;
}

.code {
  margin-top: 12px;
  background: #09090d;
  border: 1px solid #30303c;
  border-radius: 10px;
  padding: 14px;
  overflow-x: auto;
  white-space: pre;
  font-family: monospace;
  font-size: 13px;
}

.codeButtons {
  display: flex;
  gap: 8px;
  margin-top: 9px;
}

.smallBtn {
  border: 0;
  border-radius: 8px;
  background: #292936;
  color: white;
  padding: 8px 10px;
  font-size: 12px;
}

/* INPUT */

.composer {
  padding: 12px 18px 18px;
  border-top: 1px solid #292936;
  background: #111118;
}

.composerInner {
  max-width: 900px;
  margin: auto;
}

.controls {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.controls select {
  background: #1b1b24;
  border: 1px solid #30303d;
  color: white;
  border-radius: 8px;
  padding: 8px;
}

.promptRow {
  display: flex;
  gap: 9px;
}

#prompt {
  flex: 1;
  resize: none;
  min-height: 52px;
  max-height: 180px;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid #30303d;
  background: #0d0d13;
  color: white;
  outline: none;
}

.sendBtn {
  width: 55px;
  border: 0;
  border-radius: 12px;
  background: #6d5dfc;
  color: white;
  font-size: 20px;
}

/* ==================================================
   MOBILE
================================================== */

@media (max-width: 700px) {

  .sidebar {
    position: fixed;
    z-index: 20;
    left: -290px;
    top: 0;
    bottom: 0;
    transition: left .2s;
  }

  .sidebar.open {
    left: 0;
  }

  .menuBtn {
    display: block;
  }

  .messages {
    padding: 16px 12px;
  }

  .bubble {
    max-width: 92%;
  }

  .composer {
    padding: 9px;
  }

  .controls {
    overflow-x: auto;
  }

  .topbar {
    height: 54px;
  }
}

</style>
</head>

<body>

<!-- ==================================================
     AUTH
================================================== -->

<div id="authScreen">

  <div class="authBox">

    <div class="logo">
      Mercury's AI-Generator
    </div>

    <div class="subtitle">
      Tu asistente especializado en programación
    </div>

    <input
      id="email"
      type="email"
      placeholder="Correo electrónico"
      autocomplete="email"
    >

    <input
      id="password"
      type="password"
      placeholder="Contraseña"
      autocomplete="current-password"
    >

    <button
      class="primary"
      onclick="registerUser()"
    >
      Crear cuenta
    </button>

    <button
      class="secondary"
      onclick="loginUser()"
    >
      Iniciar sesión
    </button>

    <div
      id="authMessage"
      class="message hidden"
    ></div>

  </div>

</div>

<!-- ==================================================
     APP
================================================== -->

<div id="app" class="hidden">

  <aside
    id="sidebar"
    class="sidebar"
  >

    <div class="sidebarTop">

      <div class="brand">
        Mercury ⚡
      </div>

      <button
        class="newChat"
        onclick="newChat()"
      >
        ＋ Nueva conversación
      </button>

    </div>

    <div
      id="history"
      class="history"
    ></div>

    <div class="sidebarBottom">

      <div
        id="userEmail"
        class="userEmail"
      ></div>

      <button
        class="logout"
        onclick="logout()"
      >
        Cerrar sesión
      </button>

    </div>

  </aside>

  <main class="main">

    <header class="topbar">

      <button
        class="menuBtn"
        onclick="toggleSidebar()"
      >
        ☰
      </button>

      <div
        id="chatTitle"
        class="chatTitle"
      >
        Nueva conversación
      </div>

    </header>

    <section
      id="messages"
      class="messages"
    >

      <div class="welcome">
        <div>
          <h2>¿Qué quieres programar?</h2>
          <p>
            Pídeme crear, explicar, corregir
            o mejorar código.
          </p>
        </div>
      </div>

    </section>

    <div class="composer">

      <div class="composerInner">

        <div class="controls">

          <select id="language">
            <option value="javascript">
              JavaScript
            </option>

            <option value="python">
              Python
            </option>

            <option value="bash">
              Bash
            </option>

            <option value="c">
              C
            </option>

            <option value="cpp">
              C++
            </option>

            <option value="java">
              Java
            </option>

            <option value="go">
              Go
            </option>

            <option value="rust">
              Rust
            </option>

            <option value="php">
              PHP
            </option>

            <option value="ruby">
              Ruby
            </option>

            <option value="powershell">
              PowerShell
            </option>

            <option value="sql">
              SQL
            </option>

          </select>

        </div>

        <div class="promptRow">

          <textarea
            id="prompt"
            placeholder="Escribe lo que quieres crear..."
          ></textarea>

          <button
            class="sendBtn"
            onclick="sendMessage()"
          >
            ➤
          </button>

        </div>

      </div>

    </div>

  </main>

</div>

<script>

let token =
  localStorage.getItem('mercury_token');

let currentConversation = null;

// ==================================================
// HELPERS
// ==================================================

function authHeaders() {

  return {
    'Content-Type':
      'application/json',

    'Authorization':
      'Bearer ' + token
  };

}

function showAuthMessage(text) {

  const box =
    document.getElementById(
      'authMessage'
    );

  box.textContent = text;
  box.classList.remove('hidden');

}

function hideAuth() {

  document
    .getElementById('authScreen')
    .classList.add('hidden');

  document
    .getElementById('app')
    .classList.remove('hidden');

}

function showAuth() {

  document
    .getElementById('authScreen')
    .classList.remove('hidden');

  document
    .getElementById('app')
    .classList.add('hidden');

}

// ==================================================
// REGISTER
// ==================================================

async function registerUser() {

  const email =
    document
      .getElementById('email')
      .value
      .trim();

  const password =
    document
      .getElementById('password')
      .value;

  if (!email || !password) {

    showAuthMessage(
      'Introduce correo y contraseña.'
    );

    return;
  }

  try {

    const response =
      await fetch('/register', {

        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
          email,
          password
        })

      });

    const data =
      await response.json();

    if (!response.ok) {

      showAuthMessage(
        '❌ ' +
        (data.error || 'Error')
      );

      return;
    }

    token = data.token;

    localStorage.setItem(
      'mercury_token',
      token
    );

    await startApp();

  } catch (error) {

    showAuthMessage(
      '❌ Error de conexión.'
    );

  }

}

// ==================================================
// LOGIN
// ==================================================

async function loginUser() {

  const email =
    document
      .getElementById('email')
      .value
      .trim();

  const password =
    document
      .getElementById('password')
      .value;

  if (!email || !password) {

    showAuthMessage(
      'Introduce correo y contraseña.'
    );

    return;
  }

  try {

    const response =
      await fetch('/login', {

        method: 'POST',

        headers: {
          'Content-Type':
            'application/json'
        },

        body: JSON.stringify({
          email,
          password
        })

      });

    const data =
      await response.json();

    if (!response.ok) {

      showAuthMessage(
        '❌ ' +
        (data.error || 'Error')
      );

      return;
    }

    token = data.token;

    localStorage.setItem(
      'mercury_token',
      token
    );

    await startApp();

  } catch (error) {

    showAuthMessage(
      '❌ Error de conexión.'
    );

  }

}

// ==================================================
// START APP
// ==================================================

async function startApp() {

  hideAuth();

  await loadMe();

  await loadConversations();

  if (!currentConversation) {
    newChat();
  }

}

// ==================================================
// USER
// ==================================================

async function loadMe() {

  try {

    const response =
      await fetch('/me', {
        headers: authHeaders()
      });

    if (!response.ok) {

      logout();
      return;

    }

    const data =
      await response.json();

    document
      .getElementById('userEmail')
      .textContent =
        data.user.email;

  } catch {

    logout();

  }

}

// ==================================================
// CONVERSATIONS
// ==================================================

async function loadConversations() {

  try {

    const response =
      await fetch(
        '/conversations',
        {
          headers:
            authHeaders()
        }
      );

    if (!response.ok) {

      return;
    }

    const data =
      await response.json();

    renderHistory(
      data.conversations
    );

    if (
      data.conversations.length > 0
    ) {

      await openConversation(
        data.conversations[0].id
      );

    }

  } catch (error) {

    console.error(error);

  }

}

function renderHistory(
  conversations
) {

  const history =
    document.getElementById(
      'history'
    );

  history.innerHTML = '';

  conversations.forEach(
    conversation => {

      const row =
        document.createElement('div');

      row.className =
        'chatItem';

      const button =
        document.createElement('button');

      button.className =
        'chatButton';

      button.textContent =
        conversation.title ||
        'Nueva conversación';

      button.onclick = () =>
        openConversation(
          conversation.id
        );

      const del =
        document.createElement('button');

      del.className =
        'deleteChat';

      del.textContent = '🗑️';

      del.onclick = () =>
        deleteConversation(
          conversation.id
        );

      row.appendChild(button);
      row.appendChild(del);

      history.appendChild(row);

    }
  );

}

// ==================================================
// NEW CHAT
// ==================================================

function newChat() {

  currentConversation = null;

  document
    .getElementById('chatTitle')
    .textContent =
      'Nueva conversación';

  const messages =
    document.getElementById(
      'messages'
    );

  messages.innerHTML = `
    <div class="welcome">
      <div>
        <h2>¿Qué quieres programar?</h2>
        <p>
          Pídeme crear, explicar, corregir
          o mejorar código.
        </p>
      </div>
    </div>
  `;

  closeSidebar();

}

// ==================================================
// OPEN CHAT
// ==================================================

async function openConversation(id) {

  try {

    const response =
      await fetch(
        '/conversations/' +
        id,
        {
          headers:
            authHeaders()
        }
      );

    if (!response.ok) {
      return;
    }

    const data =
      await response.json();

    currentConversation =
      data.conversation;

    document
      .getElementById('chatTitle')
      .textContent =
        currentConversation.title;

    renderMessages(
      data.messages
    );

    closeSidebar();

  } catch (error) {

    console.error(error);

  }

}

// ==================================================
// RENDER MESSAGES
// ==================================================

function renderMessages(messages) {

  const container =
    document.getElementById(
      'messages'
    );

  container.innerHTML = '';

  if (!messages.length) {

    newChat();
    return;

  }

  messages.forEach(
    message => {

      addMessageToScreen(
        message.role,
        message.content,
        message.language
      );

    }
  );

  scrollMessages();

}

function addMessageToScreen(
  role,
  content,
  language
) {

  const container =
    document.getElementById(
      'messages'
    );

  const row =
    document.createElement('div');

  row.className =
    'messageRow ' +
    (role === 'user'
      ? 'user'
      : 'assistant');

  const bubble =
    document.createElement('div');

  bubble.className =
    'bubble';

  if (
    role === 'assistant' &&
    language
  ) {

    const text =
      document.createElement('div');

    text.textContent =
      'Código generado (' +
      language +
      ')';

    bubble.appendChild(text);

    const code =
      document.createElement('pre');

    code.className =
      'code';

    code.textContent =
      content;

    bubble.appendChild(code);

    const buttons =
      document.createElement(
        'div'
      );

    buttons.className =
      'codeButtons';

    const copy =
      document.createElement('button');

    copy.className =
      'smallBtn';

    copy.textContent =
      '📋 Copiar';

    copy.onclick = () =>
      navigator.clipboard.writeText(
        content
      );

    const download =
      document.createElement('button');

    download.className =
      'smallBtn';

    download.textContent =
      '📥 Descargar';

    download.onclick = () =>
      downloadCode(
        content,
        language
      );

    buttons.appendChild(copy);
    buttons.appendChild(download);

    bubble.appendChild(buttons);

  } else {

    bubble.textContent =
      content;

  }

  row.appendChild(bubble);

  container.appendChild(row);

}

// ==================================================
// SEND MESSAGE
// ==================================================

async function sendMessage() {

  const input =
    document.getElementById(
      'prompt'
    );

  const prompt =
    input.value.trim();

  if (!prompt) {
    return;
  }

  input.value = '';

  addMessageToScreen(
    'user',
    prompt
  );

  scrollMessages();

  try {

    const language =
      document
        .getElementById(
          'language'
        )
        .value;

    const response =
      await fetch(
        '/chat',
        {
          method: 'POST',

          headers:
          