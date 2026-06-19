# 🚀 Configurações Completas do Coolify - Canário Lima

## ✅ TODAS AS CONFIGURAÇÕES PRONTAS PARA PREENCHER

Copie e cole exatamente como está abaixo em cada campo do Coolify.

---

## 📋 TELA 1: "Create a new Application"

### Campo 1: Repository URL
```
https://github.com/vml-arquivos/Canaril
```

### Campo 2: Rate Limit
```
(deixe em branco ou padrão)
```

### Campo 3: Branch
```
main
```

### Campo 4: Base Directory
```
/
```

### Campo 5: Build Pack
```
Dockerfile
```

**Ação**: Clique em **"Continue"**

---

## 📋 TELA 2: Build Configuration

### Campo 1: Build Command
```
pnpm build
```

### Campo 2: Start Command
```
node dist/index.js
```

### Campo 3: Port
```
3000
```

### Campo 4: Publish Port
```
3000
```

### Campo 5: Exposed Port
```
3000
```

**Ação**: Clique em **"Continue"**

---

## 📋 TELA 3: Environment Variables

Adicione CADA variável clicando em **"Add Variable"**:

### Variável 1
```
KEY: DATABASE_URL
VALUE: postgresql://postgis:postgis@postgres:5432/canario_lima_db
```

### Variável 2
```
KEY: VITE_APP_TITLE
VALUE: Canário Gestão Pro
```

### Variável 3
```
KEY: JWT_SECRET
VALUE: TVITqnLcUTCxp0ucX8aZlBHKjlKSBnt1a6v0y+bD25Y=
```

### Variável 4
```
KEY: NODE_ENV
VALUE: production
```

### Variável 5
```
KEY: VITE_APP_ID
VALUE: canario-gestao-pro-001
```

### Variável 6
```
KEY: CSRF_SECRET
VALUE: 26e3313ac552271a67533cd7d4b8f04f357c023b271c311c6c6aaa4632b5309b
```

### Variável 7
```
KEY: SESSION_SECRET
VALUE: BKyZUOvHcSqgKWj2V6Ski9kz2FjVyEZJb8IAHHxfyrs=
```

### Variável 8
```
KEY: OWNER_NAME
VALUE: Canário Lima
```

### Variável 9
```
KEY: CORS_ORIGIN
VALUE: https://canarillima.casadf.com.br
```

### Variável 10
```
KEY: PORT
VALUE: 3000
```

**Ação**: Clique em **"Continue"**

---

## 📋 TELA 4: Database Configuration

### Opção: Add Database
```
✅ Clique em "Add Database"
```

### Campo 1: Database Type
```
PostgreSQL
```

### Campo 2: Database Name
```
canario_lima_db
```

### Campo 3: Database User
```
postgis
```

### Campo 4: Database Password
```
postgis
```

### Campo 5: Database Version
```
17-alpine (ou versão mais recente)
```

**Ação**: Clique em **"Continue"**

---

## 📋 TELA 5: Destination Configuration

### Campo 1: Destination
```
(Selecione seu servidor/VPS na lista)
```

### Campo 2: Network
```
(deixe padrão ou selecione sua rede)
```

**Ação**: Clique em **"Continue"**

---

## 📋 TELA 6: Domain Configuration

### Opção: Add Domain
```
✅ Clique em "Add Domain"
```

### Campo 1: Domain
```
canarillima.casadf.com.br
```

### Campo 2: Port
```
443 (HTTPS automático)
```

### Campo 3: SSL Certificate
```
(Traefik gerencia automaticamente)
```

**Ação**: Clique em **"Continue"**

---

## 📋 TELA 7: Advanced Configuration (Opcional)

### Restart Policy
```
always (reinicia se cair)
```

### Memory Limit
```
512 MB (ou mais se necessário)
```

### CPU Limit
```
1 vCPU (ou mais se necessário)
```

**Ação**: Clique em **"Deploy"** ✅

---

## 🎯 RESUMO RÁPIDO

| Campo | Valor |
|-------|-------|
| **Repository** | https://github.com/vml-arquivos/Canaril |
| **Branch** | main |
| **Base Directory** | / |
| **Build Pack** | Dockerfile |
| **Build Command** | pnpm build |
| **Start Command** | node dist/index.js |
| **Port** | 3000 |
| **Database** | PostgreSQL (canario_lima_db) |
| **Domain** | canarillima.casadf.com.br |
| **SSL** | Automático (Traefik) |

---

## ✅ CHECKLIST DE CONFIGURAÇÃO

### Tela 1: Application
- [ ] Repository URL preenchido
- [ ] Branch = main
- [ ] Base Directory = /
- [ ] Build Pack = Dockerfile

### Tela 2: Build
- [ ] Build Command = pnpm build
- [ ] Start Command = node dist/index.js
- [ ] Port = 3000

### Tela 3: Environment Variables
- [ ] DATABASE_URL adicionado
- [ ] VITE_APP_TITLE adicionado
- [ ] JWT_SECRET adicionado
- [ ] NODE_ENV = production
- [ ] CSRF_SECRET adicionado
- [ ] SESSION_SECRET adicionado
- [ ] OWNER_NAME adicionado
- [ ] CORS_ORIGIN adicionado
- [ ] PORT = 3000

### Tela 4: Database
- [ ] PostgreSQL selecionado
- [ ] Database Name = canario_lima_db
- [ ] User = postgis
- [ ] Password = postgis

### Tela 5: Destination
- [ ] Servidor/VPS selecionado

### Tela 6: Domain
- [ ] Domain = canarillima.casadf.com.br
- [ ] SSL automático (Traefik)

### Tela 7: Advanced
- [ ] Restart Policy = always

---

## 🚀 APÓS CONFIGURAR TUDO

1. **Clique em "Deploy"**
2. Aguarde build completar (5-10 minutos)
3. Acesse: **https://canarillima.casadf.com.br**
4. Pronto! ✅

---

## 🔍 VERIFICAÇÃO PÓS-DEPLOY

```
✅ https://canarillima.casadf.com.br (Página Pública)
✅ https://canarillima.casadf.com.br/login (Login)
✅ https://canarillima.casadf.com.br/dashboard (Dashboard)
✅ SSL/TLS ativo (cadeado verde)
✅ Banco de dados conectado
```

---

## ⚠️ PROBLEMAS COMUNS

### Erro: "Build failed"
- Verifique se Build Command = `pnpm build`
- Verifique se Start Command = `node dist/index.js`

### Erro: "Database connection refused"
- Verifique DATABASE_URL
- Verifique credenciais do PostgreSQL

### Erro: "Domain not resolving"
- Verifique se DNS aponta para o IP da VPS
- Aguarde propagação DNS (até 24h)

---

**Versão**: 1.0  
**Data**: 2026-06-19  
**Status**: ✅ Pronto para Deploy

🚀 **Preencha exatamente como está acima e faça o deploy!**
