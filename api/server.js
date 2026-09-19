const express = require('express');
const engine = require('../core/engine');
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

async function initChatTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL DEFAULT 'Nueva conversación',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT NOT NULL,
      language VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('🗄️ Tablas de conversaciones listas.');
}

const databaseReady = initChatTables()
  .then(() => {
    console.log('✅ PostgreSQL preparado.');
  })
  .catch((error) => {
    console.error(
      '❌ Error preparando PostgreSQL:',
      error.message
    );
  });

app.use(async (req, res, next) => {
  await databaseReady;
  next();
});

// ======================================================
// FRONTEND
// ======================================================

app.get('/', (req, res) => {

  res.send(`
<!DOCTYPE html>
<html lang="es">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>Mercury's AI-Generator</title>

<style>

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
}

body {
  background: #09090d;
  color: #ffffff;
  font-family: Arial, Helvetica, sans-serif;
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

/* ==========================================
   LOGIN
========================================== */

#authScreen {
  min-height: 100vh;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.authBox {
  width: 100%;
  max-width: 430px;
  background: #15151d;
  border: 1px solid #2b2b37;
  border-radius: 22px;
  padding: 30px;
  box-shadow: 0 20px 70px rgba(0, 0, 0, 0.45);
}

.logo {
  text-align: center;
  font-size: 30px;
  font-weight: 800;
  margin-bottom: 8px;
}

.subtitle {
  text-align: center;
  color: #9999aa;
  margin-bottom: 25px;
}

.authBox input {
  display: block;
  width: 100%;
  padding: 15px;
  margin-bottom: 12px;
  border-radius: 12px;
  border: 1px solid #33333f;
  background: #0d0d13;
  color: #ffffff;
  outline: none;
}

.authBox input:focus {
  border-color: #6d5dfc;
}

.primaryButton {
  width: 100%;
  border: 0;
  border-radius: 12px;
  padding: 14px;
  background: #6d5dfc;
  color: #ffffff;
  font-weight: 700;
}

.secondaryButton {
  width: 100%;
  border: 0;
  border-radius: 12px;
  padding: 14px;
  margin-top: 10px;
  background: #292936;
  color: #ffffff;
  font-weight: 700;
}

.authMessage {
  margin-top: 15px;
  padding: 12px;
  border-radius: 10px;
  background: #0d0d13;
  color: #ccccd5;
  text-align: center;
}

/* ==========================================
   APP
========================================== */

#app {
  width: 100%;
  height: 100vh;
  display: flex;
  overflow: hidden;
}

/* ==========================================
   SIDEBAR
========================================== */

.sidebar {
  width: 280px;
  min-width: 280px;
  height: 100%;
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
  font-size: 19px;
  font-weight: 800;
  margin-bottom: 14px;
}

.newChatButton {
  width: 100%;
  border: 1px solid #393947;
  border-radius: 10px;
  padding: 12px;
  background: #1c1c25;
  color: #ffffff;
}

.history {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.chatItem {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
}

.chatButton {
  flex: 1;
  min-width: 0;
  border: 0;
  border-radius: 9px;
  padding: 11px;
  background: transparent;
  color: #c7c7d2;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chatButton:hover {
  background: #20202a;
  color: #ffffff;
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
  margin-bottom: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logoutButton {
  width: 100%;
  border: 0;
  border-radius: 9px;
  padding: 10px;
  background: #292936;
  color: #ffffff;
}

/* ==========================================
   MAIN
========================================== */

.main {
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.topbar {
  height: 58px;
  min-height: 58px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 15px;
  background: #111118;
  border-bottom: 1px solid #292936;
}

.menuButton {
  display: none;
  border: 0;
  background: transparent;
  color: #ffffff;
  font-size: 23px;
}

.chatTitle {
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ==========================================
   MESSAGES
========================================== */

.messages {
  flex: 1;
  overflow-y: auto;
  padding: 25px 15px;
}

.welcome {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #888899;
}

.welcome h2 {
  color: #ffffff;
}

.messageRow {
  width: 100%;
  max-width: 900px;
  margin: 0 auto 20px;
  display: flex;
}

.messageRow.user {
  justify-content: flex-end;
}

.bubble {
  max-width: 85%;
  padding: 14px 16px;
  border-radius: 15px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.messageRow.user .bubble {
  background: #5d50dc;
}

.messageRow.assistant .bubble {
  background: #181821;
  border: 1px solid #2d2d39;
}

.code {
  margin-top: 12px;
  padding: 14px;
  background: #09090d;
  border: 1px solid #30303c;
  border-radius: 10px;
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

.smallButton {
  border: 0;
  border-radius: 8px;
  padding: 8px 10px;
  background: #292936;
  color: #ffffff;
  font-size: 12px;
}

/* ==========================================
   COMPOSER
========================================== */

.composer {
  padding: 10px 15px 18px;
  background: #111118;
  border-top: 1px solid #292936;
}

.composerInner {
  width: 100%;
  max-width: 900px;
  margin: auto;
}

.controls {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.controls select {
  padding: 8px;
  border-radius: 8px;
  border: 1px solid #30303d;
  background: #1b1b24;
  color: #ffffff;
}

.promptRow {
  display: flex;
  gap: 9px;
}

#prompt {
  flex: 1;
  min-height: 52px;
  max-height: 180px;
  resize: none;
  padding: 14px;
  border-radius: 12px;
  border: 1px solid #30303d;
  background: #0d0d13;
  color: #ffffff;
  outline: none;
}

#prompt:focus {
  border-color: #6d5dfc;
}

.sendButton {
  width: 55px;
  min-width: 55px;
  border: 0;
  border-radius: 12px;
  background: #6d5dfc;
  color: #ffffff;
  font-size: 20px;
}

/* ==========================================
   MOBILE
========================================== */

@media (max-width: 700px) {

  .sidebar {
    position: fixed;
    z-index: 100;
    left: -290px;
    top: 0;
    bottom: 0;
    transition: left 0.2s ease;
  }

  .sidebar.open {
    left: 0;
  }

  .menuButton {
    display: block;
  }

  .messages {
    padding: 15px 10px;
  }

  .bubble {
    max-width: 92%;
  }

  .composer {
    padding: 8px;
  }

  .controls {
    overflow-x: auto;
  }

  .topbar {
    height: 54px;
    min-height: 54px;
  }

  .authBox {
    padding: 24px;
  }

}

</style>

</head>

<body>

<!-- ==========================================
     AUTH
========================================== -->

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
      class="primaryButton"
      onclick="registerUser()"
    >
      Crear cuenta
    </button>

    <button
      class="secondaryButton"
      onclick="loginUser()"
    >
      Iniciar sesión
    </button>

    <div
      id="authMessage"
      class="authMessage hidden"
    ></div>

  </div>

</div>

<!-- ==========================================
     APP
========================================== -->

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
        class="newChatButton"
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
        class="logoutButton"
        onclick="logout()"
      >
        Cerrar sesión
      </button>

    </div>

  </aside>

  <main class="main">

    <header class="topbar">

      <button
        class="menuButton"
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

          <h2>
            ¿Qué quieres programar?
          </h2>

          <p>
            Pídeme crear, explicar,
            corregir o mejorar código.
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
            class="sendButton"
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
// AUTH HEADERS
// ==================================================

function authHeaders() {

  return {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token
  };

}


// ==================================================
// AUTH MESSAGE
// ==================================================

function showAuthMessage(text) {

  const box =
    document.getElementById('authMessage');

  box.textContent = text;

  box.classList.remove('hidden');

}


// ==================================================
// SHOW APP
// ==================================================

function showApp() {

  document
    .getElementById('authScreen')
    .classList.add('hidden');

  document
    .getElementById('app')
    .classList.remove('hidden');

}


// ==================================================
// SHOW LOGIN
// ==================================================

function showLogin() {

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
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          email: email,
          password: password
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

    console.error(error);

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
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          email: email,
          password: password
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

    console.error(error);

    showAuthMessage(
      '❌ Error de conexión.'
    );

  }

}


// ==================================================
// START APP
// ==================================================

async function startApp() {

  showApp();

  const valid =
    await loadMe();

  if (!valid) {
    return;
  }

  await loadConversations();

}


// ==================================================
// LOAD USER
// ==================================================

async function loadMe() {

  try {

    const response =
      await fetch('/me', {
        headers: authHeaders()
      });

    if (!response.ok) {

      logout();

      return false;

    }

    const data =
      await response.json();

    document
      .getElementById('userEmail')
      .textContent =
        data.user.email;

    return true;

  } catch (error) {

    console.error(error);

    logout();

    return false;

  }

}


// ==================================================
// LOAD CONVERSATIONS
// ==================================================

async function loadConversations() {

  try {

    const response =
      await fetch('/conversations', {
        headers: authHeaders()
      });

    if (!response.ok) {
      return;
    }

    const data =
      await response.json();

    renderHistory(
      data.conversations
    );

  } catch (error) {

    console.error(error);

  }

}


// ==================================================
// RENDER HISTORY
// ==================================================

function renderHistory(conversations) {

  const history =
    document.getElementById('history');

  history.innerHTML = '';

  conversations.forEach(function(conversation) {

    const row =
      document.createElement('div');

    row.className = 'chatItem';

    const button =
      document.createElement('button');

    button.className = 'chatButton';

    button.textContent =
      conversation.title ||
      'Nueva conversación';

    button.onclick = function() {

      openConversation(
        conversation.id
      );

    };

    const deleteButton =
      document.createElement('button');

    deleteButton.className =
      'deleteChat';

    deleteButton.textContent = '🗑️';

    deleteButton.onclick = function(event) {

      event.stopPropagation();

      deleteConversation(
        conversation.id
      );

    };

    row.appendChild(button);

    row.appendChild(deleteButton);

    history.appendChild(row);

  });

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
    document.getElementById('messages');

  messages.innerHTML =
    '<div class="welcome">' +
      '<div>' +
        '<h2>¿Qué quieres programar?</h2>' +
        '<p>' +
          'Pídeme crear, explicar, corregir ' +
          'o mejorar código.' +
        '</p>' +
      '</div>' +
    '</div>';

  closeSidebar();

}


// ==================================================
// OPEN CONVERSATION
// ==================================================

async function openConversation(id) {

  try {

    const response =
      await fetch(
        '/conversations/' + id,
        {
          headers: authHeaders()
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
    document.getElementById('messages');

  container.innerHTML = '';

  if (!messages.length) {

    newChat();

    return;

  }

  messages.forEach(function(message) {

    addMessageToScreen(
      message.role,
      message.content,
      message.language
    );

  });

  scrollMessages();

}


// ==================================================
// ADD MESSAGE
// ==================================================

function addMessageToScreen(
  role,
  content,
  language
) {

  const container =
    document.getElementById('messages');
