const express=require('express');
const path=require('path');
const crypto=require('crypto');
const engine=require('../core/engine');
const db=require('./db');

const app=express();
const PORT=process.env.PORT||3000;
const sessions=new Map();

app.use(express.json({limit:'1mb'}));
app.use(express.static(path.join(__dirname,'../frontend')));

async function initDatabase(){
  await db.query(`CREATE TABLE IF NOT EXISTS users(
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN`);
  await db.query(`UPDATE users SET is_admin=FALSE WHERE is_admin IS NULL`);
  await db.query(`ALTER TABLE users ALTER COLUMN is_admin SET DEFAULT FALSE`);
  await db.query(`ALTER TABLE users ALTER COLUMN is_admin SET NOT NULL`);

  await db.query(`CREATE TABLE IF NOT EXISTS chats(
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Nuevo chat',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  await db.query(`CREATE TABLE IF NOT EXISTS messages(
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    language TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`);

  console.log('✅ Base de datos preparada.');
}

function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){
  return {
    hash:crypto.scryptSync(password,salt,64).toString('hex'),
    salt
  };
}

function verifyPassword(password,stored,salt){
  try{
    const hash=crypto.scryptSync(password,salt,64).toString('hex');
    const a=Buffer.from(hash,'hex');
    const b=Buffer.from(stored,'hex');
    return a.length===b.length&&crypto.timingSafeEqual(a,b);
  }catch{
    return false;
  }
}

function createSession(user){
  const token=crypto.randomBytes(32).toString('hex');

  sessions.set(token,{
    userId:user.id,
    email:user.email,
    isAdmin:user.is_admin===true
  });

  return token;
}

function getSession(req){
  const h=req.headers.authorization||'';

  if(!h.startsWith('Bearer '))return null;

  return sessions.get(h.slice(7).trim())||null;
}

function auth(req,res,next){
  const s=getSession(req);

  if(!s){
    return res.status(401).json({
      success:false,
      error:'No has iniciado sesión.'
    });
  }

  req.user=s;
  next();
}

function admin(req,res,next){
  if(req.user?.isAdmin!==true){
    return res.status(403).json({
      success:false,
      error:'Acceso de administrador requerido.'
    });
  }

  next();
}

async function ownChat(chatId,userId){
  const r=await db.query(
    'SELECT id FROM chats WHERE id=$1 AND user_id=$2',
    [chatId,userId]
  );

  return r.rows.length>0;
}

async function saveMessage(chatId,role,content,language=null){
  await db.query(
    `INSERT INTO messages(chat_id,role,content,language)
     VALUES($1,$2,$3,$4)`,
    [chatId,role,content,language]
  );

  await db.query(
    'UPDATE chats SET updated_at=NOW() WHERE id=$1',
    [chatId]
  );
}

/* ROOT */

app.get('/',(req,res)=>{
  res.sendFile(
    path.join(__dirname,'../frontend/index.html')
  );
});

/* HEALTH */

app.get('/health',async(req,res)=>{
  try{
    const r=await db.testConnection();

    res.json({
      success:true,
      status:'online',
      database:'connected',
      databaseTime:r.now,
      uptime:process.uptime(),
      timestamp:new Date().toISOString()
    });
  }catch(e){
    res.status(500).json({
      success:false,
      status:'online',
      database:'error',
      error:e.message
    });
  }
});

/* LANGUAGES */

app.get('/languages',(req,res)=>{
  try{
    const languages=engine.getSupportedLanguages();

    res.json({
      success:true,
      count:languages.length,
      languages
    });
  }catch(e){
    res.status(500).json({
      success:false,
      error:e.message
    });
  }
});

/* REGISTER */

app.post('/auth/register',async(req,res)=>{
  try{
    const email=String(req.body.email||'')
      .trim()
      .toLowerCase();

    const password=String(req.body.password||'');

    if(
      !email||
      !email.includes('@')||
      email.length>320
    ){
      return res.status(400).json({
        success:false,
        error:'Introduce un email válido.'
      });
    }

    if(password.length<6){
      return res.status(400).json({
        success:false,
        error:'La contraseña debe tener al menos 6 caracteres.'
      });
    }

    const exists=await db.query(
      'SELECT id FROM users WHERE email=$1',
      [email]
    );

    if(exists.rows.length){
      return res.status(409).json({
        success:false,
        error:'Ese email ya está registrado.'
      });
    }

    const p=hashPassword(password);

    const r=await db.query(
      `INSERT INTO users(
        email,
        password_hash,
        password_salt,
        is_admin
      )
      VALUES($1,$2,$3,FALSE)
      RETURNING id,email,is_admin,created_at`,
      [email,p.hash,p.salt]
    );

    const user=r.rows[0];
    const token=createSession(user);

    res.json({
      success:true,
      token,
      user:{
        id:user.id,
        email:user.email,
        isAdmin:user.is_admin===true
      }
    });

  }catch(e){
    console.error('REGISTER ERROR:',e);

    res.status(
      e.code==='23505'?409:500
    ).json({
      success:false,
      error:e.code==='23505'
        ?'Ese email ya está registrado.'
        :'No se pudo crear la cuenta.'
    });
  }
});

/* LOGIN */

app.post('/auth/login',async(req,res)=>{
  try{
    const email=String(req.body.email||'')
      .trim()
      .toLowerCase();

    const password=String(req.body.password||'');

    const r=await db.query(
      `SELECT
        id,
        email,
        password_hash,
        password_salt,
        is_admin
       FROM users
       WHERE email=$1`,
      [email]
    );

    if(
      !r.rows.length||
      !verifyPassword(
        password,
        r.rows[0].password_hash,
        r.rows[0].password_salt
      )
    ){
      return res.status(401).json({
        success:false,
        error:'Email o contraseña incorrectos.'
      });
    }

    const user=r.rows[0];
    const token=createSession(user);

    res.json({
      success:true,
      token,
      user:{
        id:user.id,
        email:user.email,
        isAdmin:user.is_admin===true
      }
    });

  }catch(e){
    console.error('LOGIN ERROR:',e);

    res.status(500).json({
      success:false,
      error:'No se pudo iniciar sesión.'
    });
  }
});

/* LOGOUT */

app.post('/auth/logout',auth,(req,res)=>{
  const h=req.headers.authorization||'';

  if(h.startsWith('Bearer ')){
    sessions.delete(h.slice(7).trim());
  }

  res.json({success:true});
});

/* CURRENT USER */

app.get('/auth/me',auth,async(req,res)=>{
  try{
    const r=await db.query(
      `SELECT id,email,is_admin,created_at
       FROM users
       WHERE id=$1`,
      [req.user.userId]
    );

    if(!r.rows.length){
      return res.status(404).json({
        success:false,
        error:'Usuario no encontrado.'
      });
    }

    const u=r.rows[0];

    res.json({
      success:true,
      user:{
        id:u.id,
        email:u.email,
        isAdmin:u.is_admin===true,
        createdAt:u.created_at
      }
    });

  }catch(e){
    res.status(500).json({
      success:false,
      error:'No se pudo obtener el usuario.'
    });
  }
});

/* CREATE CHAT */

app.post('/chats',auth,async(req,res)=>{
  try{
    const title=
      String(req.body.title||'Nuevo chat')
      .trim()
      .slice(0,100)||
      'Nuevo chat';

    const r=await db.query(
      `INSERT INTO chats(user_id,title)
       VALUES($1,$2)
       RETURNING id,title,created_at,updated_at`,
      [req.user.userId,title]
    );

    res.json({
      success:true,
      chat:r.rows[0]
    });

  }catch(e){
    res.status(500).json({
      success:false,
      error:'No se pudo crear el chat.'
    });
  }
});

/* LIST CHATS */

app.get('/chats',auth,async(req,res)=>{
  try{
    const r=await db.query(
      `SELECT id,title,created_at,updated_at
       FROM chats
       WHERE user_id=$1
       ORDER BY updated_at DESC`,
      [req.user.userId]
    );

    res.json({
      success:true,
      chats:r.rows
    });

  }catch(e){
    res.status(500).json({
      success:false,
      error:'No se pudieron cargar los chats.'
    });
  }
});

/* GET CHAT */

app.get('/chats/:id',auth,async(req,res)=>{
  try{
    const id=Number(req.params.id);

    if(!Number.isInteger(id)||id<1){
      return res.status(400).json({
        success:false,
        error:'ID de chat inválido.'
      });
    }

    const chat=await db.query(
      `SELECT id,title,created_at,updated_at
       FROM chats
       WHERE id=$1 AND user_id=$2`,
      [id,req.user.userId]
    );

    if(!chat.rows.length){
      return res.status(404).json({
        success:false,
        error:'Chat no encontrado.'
      });
    }

    const messages=await db.query(
      `SELECT id,role,content,language,created_at
       FROM messages
       WHERE chat_id=$1
       ORDER BY created_at ASC`,
      [id]
    );

    res.json({
      success:true,
      chat:chat.rows[0],
      messages:messages.rows
    });

  }catch(e){
    res.status(500).json({
      success:false,
      error:'No se pudo cargar el chat.'
    });
  }
});

/* DELETE CHAT */

app.delete('/chats/:id',auth,async(req,res)=>{
  try{
    const id=Number(req.params.id);

    const r=await db.query(
      `DELETE FROM chats
       WHERE id=$1 AND user_id=$2
       RETURNING id`,
      [id,req.user.userId]
    );

    if(!r.rows.length){
      return res.status(404).json({
        success:false,
        error:'Chat no encontrado.'
      });
    }

    res.json({success:true});

  }catch(e){
    res.status(500).json({
      success:false,
      error:'No se pudo borrar el chat.'
    });
  }
});

/* GENERATE */

app.post('/generate',auth,async(req,res)=>{
  try{
    const{
      prompt,
      language,
      complexity,
      obfuscate,
      encrypt,
      chatId
    }=req.body;

    if(
      !prompt||
      typeof prompt!=='string'
    ){
      return res.status(400).json({
        success:false,
        error:"El campo 'prompt' es obligatorio."
      });
    }

    if(prompt.length>10000){
      return res.status(400).json({
        success:false,
        error:'El prompt es demasiado largo.'
      });
    }

    let id=Number(chatId);

    if(
      !Number.isInteger(id)||
      id<1
    ){
      const r=await db.query(
        `INSERT INTO chats(user_id,title)
         VALUES($1,$2)
         RETURNING id`,
        [
          req.user.userId,
          prompt.slice(0,60)||'Nuevo chat'
        ]
      );

      id=r.rows[0].id;

    }else if(
      !(await ownChat(id,req.user.userId))
    ){
      return res.status(403).json({
        success:false,
        error:'Ese chat no pertenece a tu cuenta.'
      });
    }

    await saveMessage(
      id,
      'user',
      prompt,
      language||null
    );

    const result=
      await engine.generate(
        prompt,
        {
          language,
          complexity,
          obfuscate:obfuscate===true,
          encrypt:encrypt===true
        }
      );

    await saveMessage(
      id,
      'assistant',
      result.code,
      result.language
    );

    res.json({
      ...result,
      chatId:id
    });

  }catch(e){
    console.error(
      'GENERATE ERROR:',
      e
    );

    res.status(400).json({
      success:false,
      error:e.message||
        'Error generando código.'
    });
  }
});

/* GENERATE MULTI */

app.post(
  '/generate-multi',
  auth,
  async(req,res)=>{
    try{
      const{
        prompt,
        languages,
        complexity,
        obfuscate,
        encrypt
      }=req.body;

      if(
        !prompt||
        typeof prompt!=='string'
      ){
        return res.status(400).json({
          success:false,
          error:"El campo 'prompt' es obligatorio."
        });
      }

      if(
        !Array.isArray(languages)||
        languages.length<1||
        languages.length>10
      ){
        return res.status(400).json({
          success:false,
          error:'Debes indicar entre 1 y 10 lenguajes.'
        });
      }

      const results=
        await engine.generateMulti(
          prompt,
          languages,
          {
            complexity,
            obfuscate:obfuscate===true,
            encrypt:encrypt===true
          }
        );

      res.json({
        success:true,
        prompt,
        results
      });

    }catch(e){
      res.status(400).json({
        success:false,
        error:e.message
      });
    }
  }
);

/* ADMIN USERS */

app.get(
  '/admin/users',
  auth,
  admin,
  async(req,res)=>{
    try{
      const r=await db.query(
        `SELECT id,email,is_admin,created_at
         FROM users
         ORDER BY created_at ASC`
      );

      res.json({
        success:true,
        users:r.rows
      });

    }catch(e){
      res.status(500).json({
        success:false,
        error:'No se pudieron cargar los usuarios.'
      });
    }
  }
);

/* ADMIN CHATS */

app.get(
  '/admin/chats',
  auth,
  admin,
  async(req,res)=>{
    try{
      const r=await db.query(
        `SELECT
          c.id,
          c.title,
          c.created_at,
          c.updated_at,
          u.id AS user_id,
          u.email
         FROM chats c
         JOIN users u ON u.id=c.user_id
         ORDER BY c.updated_at DESC`
      );

      res.json({
        success:true,
        chats:r.rows
      });

    }catch(e){
      res.status(500).json({
        success:false,
        error:'No se pudieron cargar los chats.'
      });
    }
  }
);

/* API 404 */

app.use((req,res,next)=>{
  const api=
    req.path.startsWith('/auth')||
    req.path.startsWith('/chats')||
    req.path.startsWith('/generate')||
    req.path.startsWith('/admin')||
    req.path==='/languages'||
    req.path==='/health';

  if(api){
    return res.status(404).json({
      success:false,
      error:'Endpoint not found.'
    });
  }

  next();
});

/* FRONTEND */

app.use((req,res)=>{
  res.sendFile(
    path.join(
      __dirname,
      '../frontend/index.html'
    )
  );
});

/* ERROR */

app.use((err,req,res,next)=>{
  console.error(
    'SERVER ERROR:',
    err
  );

  res.status(500).json({
    success:false,
    error:'Internal server error.'
  });
});

/* START */

async function start(){
  try{
    await initDatabase();

    app.listen(
      PORT,
      '0.0.0.0',
      ()=>{
        console.log(
          `🚀 Mercury's AI-Generator running on port ${PORT}`
        );
      }
    );

  }catch(e){
    console.error(
      '❌ Error iniciando Mercury:',
      e
    );

    process.exit(1);
  }
}

start();