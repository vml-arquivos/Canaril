# 🔐 Variáveis de Ambiente - Canário Lima

## ✅ TODAS AS VARIÁVEIS NECESSÁRIAS PARA DEPLOY

Copie e cole essas variáveis no Coolify (Environment Variables):

---

## 📋 VARIÁVEIS ESSENCIAIS (OBRIGATÓRIAS)

```
DATABASE_URL=postgresql://postgis:postgis@postgres:5432/canario_lima_db
VITE_APP_TITLE=Canário Gestão Pro
JWT_SECRET=troque-por-jwt-secret-forte
```

---

## 📋 VARIÁVEIS RECOMENDADAS (ADICIONE TAMBÉM)

```
NODE_ENV=production
VITE_APP_ID=canario-gestao-pro-001
VITE_APP_LOGO=https://canarillima.casadf.com.br/logo.png
CSRF_SECRET=troque-por-csrf-secret-forte
SESSION_SECRET=troque-por-session-secret-forte
OWNER_NAME=Canário Lima
OWNER_OPEN_ID=canario-lima-001
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
VALUE: postgresql://postgis:postgis@postgres:5432/canario_lima_db

KEY: VITE_APP_TITLE
VALUE: Canário Gestão Pro

KEY: JWT_SECRET
VALUE: troque-por-jwt-secret-forte

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
DATABASE_URL=postgresql://postgis:postgis@postgres:5432/canario_lima_db
VITE_APP_TITLE=Canário Gestão Pro
JWT_SECRET=troque-por-jwt-secret-forte
NODE_ENV=production
VITE_APP_ID=canario-gestao-pro-001
VITE_APP_LOGO=https://canarillima.casadf.com.br/logo.png
CSRF_SECRET=troque-por-csrf-secret-forte
SESSION_SECRET=troque-por-session-secret-forte
OWNER_NAME=Canário Lima
OWNER_OPEN_ID=canario-lima-001
CORS_ORIGIN=https://canarillima.casadf.com.br
LOG_LEVEL=info
PORT=3000
```

---

**Pronto! Adicione essas variáveis no Coolify e faça o deploy!** ✅
