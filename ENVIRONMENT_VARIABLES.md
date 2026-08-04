# 🔐 Variáveis de Ambiente - Canário Lima

## ✅ TODAS AS VARIÁVEIS NECESSÁRIAS PARA DEPLOY

Copie e cole essas variáveis no Coolify (Environment Variables):

---

## 📋 VARIÁVEIS ESSENCIAIS (OBRIGATÓRIAS)

```
DATABASE_URL=postgresql://USUARIO:SENHA@postgres:5432/BANCO
VITE_APP_TITLE=Canário Gestão Pro
JWT_SECRET=GERAR_COM_OPENSSL_RAND_BASE64_48
```

---

## 📋 VARIÁVEIS RECOMENDADAS (ADICIONE TAMBÉM)

```
NODE_ENV=production
VITE_APP_ID=canario-gestao-pro-001
VITE_APP_LOGO=https://canarillima.casadf.com.br/logo.png
CSRF_SECRET=<GERE_UM_SEGREDO_CSRF_UNICO_COM_64_CARACTERES_HEXADECIMAIS>
SESSION_SECRET=<GERE_UM_SEGREDO_DE_SESSAO_UNICO_COM_NO_MINIMO_32_CARACTERES>
OWNER_NAME=Canário Lima
OWNER_OPEN_ID=canario-lima-001
ADMIN_NAME=Vilson Marcio
ADMIN_EMAIL=vilsonmarcio@gmail.com
ADMIN_PASSWORD=DEFINA_UMA_SENHA_FORTE
CORS_ORIGIN=https://canarillima.casadf.com.br
LOG_LEVEL=info
PORT=3000
```

---

## 📋 VARIÁVEIS OPCIONAIS (SE USAR APIS EXTERNAS)

```
# Manus OAuth (se usar)
VITE_OAUTH_PORTAL_URL=https://oauth.manus.im
OAUTH_SERVER_URL=https://api.manus.im

# Manus Built-in APIs (se usar)
BUILT_IN_FORGE_API_URL=https://forge.manus.im/api
BUILT_IN_FORGE_API_KEY=sua-chave-aqui
VITE_FRONTEND_FORGE_API_URL=https://forge.manus.im/api
VITE_FRONTEND_FORGE_API_KEY=sua-chave-frontend-aqui

# Analytics (se usar)
VITE_ANALYTICS_ENDPOINT=https://analytics.seu-dominio.com
VITE_ANALYTICS_WEBSITE_ID=seu-website-id
```

---

## 🎯 COMO ADICIONAR NO COOLIFY

### Passo 1: Na tela de "Create Application"
1. Preencha os campos básicos (Repository, Branch, Build Pack)
2. Clique em "Continue"

### Passo 2: Na próxima tela
1. Procure por "Environment Variables"
2. Clique em "Add Variable"

### Passo 3: Adicione cada variável
```
KEY: DATABASE_URL
VALUE: postgresql://USUARIO:SENHA@postgres:5432/BANCO

KEY: VITE_APP_TITLE
VALUE: Canário Gestão Pro

KEY: JWT_SECRET
VALUE: GERAR_COM_OPENSSL_RAND_BASE64_48

... (repita para todas as outras)
```

### Passo 4: Clique em "Continue"

---

## ✅ CHECKLIST DE VARIÁVEIS

### Essenciais (OBRIGATÓRIAS)
- [ ] DATABASE_URL
- [ ] VITE_APP_TITLE
- [ ] JWT_SECRET

### Recomendadas
- [ ] NODE_ENV=production
- [ ] VITE_APP_ID
- [ ] CSRF_SECRET
- [ ] SESSION_SECRET
- [ ] OWNER_NAME
- [ ] OWNER_OPEN_ID
- [ ] ADMIN_NAME
- [ ] ADMIN_EMAIL
- [ ] ADMIN_PASSWORD
- [ ] CORS_ORIGIN
- [ ] PORT=3000

### Opcionais (Só se usar)
- [ ] BUILT_IN_FORGE_API_URL (se usar APIs Manus)
- [ ] VITE_ANALYTICS_ENDPOINT (se usar analytics)

---

## 🔒 SEGURANÇA

⚠️ **IMPORTANTE:**
- Nunca compartilhe essas chaves publicamente
- Guarde JWT_SECRET, CSRF_SECRET e SESSION_SECRET em local seguro
- Se alguém vir essas chaves, regenere-as imediatamente

---

## 🔄 COMO REGENERAR CHAVES (Se Necessário)

```bash
# JWT_SECRET
openssl rand -base64 32

# CSRF_SECRET
openssl rand -hex 32

# SESSION_SECRET
openssl rand -base64 32
```

---

## 📝 RESUMO PARA COOLIFY

**Copie e Cole Tudo Isso nas Environment Variables do Coolify:**

```
DATABASE_URL=postgresql://USUARIO:SENHA@postgres:5432/BANCO
VITE_APP_TITLE=Canário Gestão Pro
JWT_SECRET=GERAR_COM_OPENSSL_RAND_BASE64_48
NODE_ENV=production
VITE_APP_ID=canario-gestao-pro-001
VITE_APP_LOGO=https://canarillima.casadf.com.br/logo.png
CSRF_SECRET=<GERE_UM_SEGREDO_CSRF_UNICO_COM_64_CARACTERES_HEXADECIMAIS>
SESSION_SECRET=<GERE_UM_SEGREDO_DE_SESSAO_UNICO_COM_NO_MINIMO_32_CARACTERES>
OWNER_NAME=Canário Lima
OWNER_OPEN_ID=canario-lima-001
ADMIN_NAME=Vilson Marcio
ADMIN_EMAIL=vilsonmarcio@gmail.com
ADMIN_PASSWORD=DEFINA_UMA_SENHA_FORTE
CORS_ORIGIN=https://canarillima.casadf.com.br
LOG_LEVEL=info
PORT=3000
```

---

**Pronto! Adicione essas variáveis no Coolify e faça o deploy!** ✅
