---
author: Gabriel Carvalho
pubDatetime: 2025-01-24T18:30:00.000Z
title: "Auth at the Edge: Better Auth + Cloudflare Workers"
slug: "better-auth-cloudflare-workers"
featured: true
tags:
  - typescript
  - cloudflare
  - workers
  - authentication
  - better-auth
  - hono
  - drizzle
  - d1
  - serverless
description: "How to build a complete authentication system on Cloudflare Workers using Better Auth, Drizzle and D1. With session caching via KV that reduces latency from 800ms to 20ms."
---

If you're building an API on Cloudflare Workers and need authentication, Better Auth is probably the best choice today. It works like Lego: you declare the plugins you want (email/password, OAuth, 2FA, admin) and it generates all the routes, callbacks and even the database schema.

The combo with Cloudflare is particularly good because:

- **D1** (SQLite at the edge) as the main database
- **KV** as session cache (800ms → 20ms, seriously)
- **R2** for per-user avatar uploads
- **Free geolocation** on every request

> If you want to skip straight to the code, there's a ready-made template: [github.com/gabszs/workers-template](https://github.com/gabszs/workers-template)

## Table of contents

## The problem we're solving

Authentication is one of those problems that seems simple until you start implementing it. You think "oh, it's just a login with email and password", and suddenly you're debugging OAuth flows, writing migrations for refresh tokens, and wondering why the cookie isn't being set in Safari.

Better Auth exists because someone decided this suffering was optional. You configure a JavaScript object with what you want, and it handles the rest: routes, handlers, validations, database schema.

The interesting part is that it works through **plugins**. Want admin? Add `admin()`. Want phone login? Add `phoneNumber()`. Each plugin can add database fields and API routes automatically.

---

## Stack

| Peça | O que faz |
|------|-----------|
| **Hono** | Framework web. Rápido, leve, roda em qualquer lugar |
| **Better Auth** | O framework de auth. Modular, type-safe |
| **Drizzle** | ORM. Gera queries SQL sem magia negra |
| **D1** | SQLite do Cloudflare. Serverless, na edge |
| **better-auth-cloudflare** | Cola tudo junto com os bindings do CF |

---

## Setup inicial

Primeiro, as dependências:

```bash
pnpm create hono  # selecione cloudflare-workers
pnpm add better-auth better-auth-cloudflare
pnpm add drizzle-orm
pnpm add -D drizzle-kit
pnpm add resend  # para emails
```

### Variáveis de ambiente

Crie um `.dev.vars` na raiz:

```env
BETTER_AUTH_SECRET=uma-string-longa-e-aleatoria-aqui

# OAuth (opcional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Email
RESEND_API_KEY=

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

O `BETTER_AUTH_SECRET` é usado para assinar tokens e cookies. **Nunca commite isso no repo.**

### Tipos do Cloudflare

Rode `pnpm wrangler types` para gerar os tipos dos bindings. Seu `tsconfig.json` precisa incluir:

```json
{
  "compilerOptions": {
    "types": ["./worker-configuration.d.ts"]
  }
}
```

### Drizzle config

O Drizzle precisa saber onde está o banco. Em dev, o Wrangler cria um `.sqlite` dentro de `.wrangler/`. Em prod, usa o D1 via HTTP.

```ts
// drizzle.config.ts
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

function getLocalD1DB() {
  try {
    const basePath = path.resolve(".wrangler");
    const dbFile = fs
      .readdirSync(basePath, { encoding: "utf-8", recursive: true })
      .find((f) => f.endsWith(".sqlite"));

    if (!dbFile) {
      throw new Error(`.sqlite file not found in ${basePath}`);
    }

    return path.resolve(basePath, dbFile);
  } catch (err) {
    console.log(`Error: ${err}`);
  }
}

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/models.ts",
  out: "./src/db/migrations",
  ...(process.env.ALCHEMY_STAGE === "prod"
    ? {
        driver: "d1-http",
        dbCredentials: {
          accountId: process.env.CLOUDFLARE_D1_ACCOUNT_ID,
          databaseId: process.env.CLOUDFLARE_DATABASE_ID,
          token: process.env.CLOUDFLARE_D1_API_TOKEN,
        },
      }
    : {
        dbCredentials: {
          url: getLocalD1DB(),
        },
      }),
});
```

---

## A configuração mínima

Se você só quer email/password funcionando, o setup é bem direto:

```ts
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { models } from "../db/models";

function createAuth(env: CloudflareBindings) {
  const db = drizzle(env.D1, { schema: models });

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "sqlite",
      usePlural: true,
      schema: models,
    }),
    emailAndPassword: {
      enabled: true,
    },
    trustedOrigins: env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
    secret: env.BETTER_AUTH_SECRET,
    basePath: "/api/auth",
  });
}

export function getAuthInstance(env: CloudflareBindings) {
  return createAuth(env);
}

export { createAuth };
```

Pronto. Isso já te dá `/api/auth/sign-in`, `/api/auth/sign-up`, `/api/auth/sign-out`, e validação de sessão.

---

## A configuração completa (com os plugins interessantes)

Aqui é onde a coisa fica divertida. O `better-auth-cloudflare` adiciona integrações nativas com D1, KV e R2. Combinado com os plugins oficiais, você consegue um sistema de auth bem robusto.

```ts
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, emailOTP, openAPI, phoneNumber } from "better-auth/plugins";
import { withCloudflare } from "better-auth-cloudflare";
import { drizzle } from "drizzle-orm/d1";
import { Resend } from "resend";
import { models } from "../db/models";

function createAuth(env: CloudflareBindings, cf?: IncomingRequestCfProperties) {
  const db = drizzle(env.D1, { schema: models });

  return betterAuth({
    ...withCloudflare(
      {
        autoDetectIpAddress: true,
        geolocationTracking: true,
        cf: cf || {},
        d1: {
          db,
          options: {
            usePlural: true,
            debugLogs: true,
          },
        },
        kv: env.KV,
        r2: {
          bucket: env.R2,
          maxFileSize: 2 * 1024 * 1024,
          allowedTypes: [".jpg", ".jpeg", ".png", ".gif"],
        },
      },
      {
        emailAndPassword: {
          enabled: true,
          requireEmailVerification: true,
          sendResetPassword: async ({ user, url }) => {
            const resend = new Resend(env.RESEND_API_KEY);
            await resend.emails.send({
              from: "App <noreply@seudominio.com>",
              to: user.email,
              subject: "Reset your password",
              html: `<p>Clique <a href="${url}">aqui</a> para resetar sua senha.</p>`,
            });
          },
        },
        emailVerification: {
          sendVerificationEmail: async ({ user, url }) => {
            const resend = new Resend(env.RESEND_API_KEY);
            await resend.emails.send({
              from: "App <noreply@seudominio.com>",
              to: user.email,
              subject: "Verify your email",
              html: `<p>Clique <a href="${url}">aqui</a> para verificar seu email.</p>`,
            });
          },
          sendOnSignUp: true,
          autoSignInAfterVerification: true,
        },
        plugins: [
          openAPI(),
          admin(),
          phoneNumber(),
          emailOTP({
            async sendVerificationOTP({ email, otp, type }) {
              if (type === "sign-in") {
                const resend = new Resend(env.RESEND_API_KEY);
                await resend.emails.send({
                  from: "App <noreply@seudominio.com>",
                  to: email,
                  subject: "Your verification code",
                  html: `<p>Seu código: <strong>${otp}</strong></p>`,
                });
              }
            },
          }),
        ],
        socialProviders: {
          google: {
            clientId: env.GOOGLE_CLIENT_ID || "",
            clientSecret: env.GOOGLE_CLIENT_SECRET || "",
          },
          github: {
            clientId: env.GITHUB_CLIENT_ID || "",
            clientSecret: env.GITHUB_CLIENT_SECRET || "",
          },
        },
      }
    ),
    database: drizzleAdapter(db, {
      provider: "sqlite",
      usePlural: true,
      schema: models,
    }),
    trustedOrigins: env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
    secret: env.BETTER_AUTH_SECRET,
    basePath: "/api/auth",
    telemetry: { enabled: false },
  });
}

export function getAuthInstance(env: CloudflareBindings) {
  return createAuth(env);
}

export { createAuth };
```

---

## Os plugins que valem a pena

### openAPI()

Gera documentação OpenAPI de todas as rotas de auth. Acesse `/api/auth/reference` e você tem uma UI interativa para testar tudo.

Tem um exemplo rodando aqui: [template-hono-workers-api.gabszs.workers.dev/api/auth/reference](https://template-hono-workers-api.gabszs.workers.dev/api/auth/reference)

### admin()

Adiciona gerenciamento de usuários: listar, banir, impersonar sessões, gerenciar roles.

**Campos adicionados:**

- `users.role`
- `users.banned`
- `users.banReason`
- `users.banExpires`
- `sessions.impersonatedBy`

### phoneNumber()

Adiciona `users.phoneNumber` e `users.phoneNumberVerified`. Permite login via SMS/WhatsApp.

### emailOTP()

Alternativa ao magic link. Usuário recebe código de 6 dígitos por email ao invés de um link.

### withCloudflare() - esse é o importante

O pacote [better-auth-cloudflare](https://github.com/zpg6/better-auth-cloudflare) é o que faz a integração com Cloudflare valer a pena.

**KV como cache de sessões:**

Essa é a feature mais impactante. Verificar sessão no D1 em cold start leva ~800ms-1s. Com KV, cai para ~12-20ms. A diferença é absurda em aplicações com muitas requests autenticadas.

**R2 para uploads:**

Cria rotas automáticas para upload de arquivos por usuário. Você configura tamanho máximo e tipos permitidos, e cada arquivo fica associado ao usuário logado.

**Geolocalização nas sessions:**

Adiciona automaticamente:

- `timezone`
- `city`
- `country`
- `region`
- `regionCode`
- `colo`
- `latitude`
- `longitude`

Você consegue saber de onde seus usuários estão logando sem fazer nada.

---

## OAuth: Google e GitHub

Configurar OAuth é só passar as credenciais:

```ts
socialProviders: {
  google: {
    clientId: env.GOOGLE_CLIENT_ID || "",
    clientSecret: env.GOOGLE_CLIENT_SECRET || "",
  },
  github: {
    clientId: env.GITHUB_CLIENT_ID || "",
    clientSecret: env.GITHUB_CLIENT_SECRET || "",
  },
},
```

Para pegar as credenciais:

1. **Google:** [console.cloud.google.com](https://console.cloud.google.com/) → APIs & Services → Credentials → OAuth 2.0 Client ID
   - Redirect URI: `https://seu-dominio.com/api/auth/callback/google`

2. **GitHub:** [github.com/settings/developers](https://github.com/settings/developers) → OAuth Apps → New
   - Callback URL: `https://seu-dominio.com/api/auth/callback/github`

O Better Auth gera as rotas automaticamente:

- `/api/auth/sign-in/google`
- `/api/auth/sign-in/github`
- `/api/auth/callback/google`
- `/api/auth/callback/github`

---

## O schema gerado

O CLI do Better Auth gera o schema Drizzle automaticamente. Depois de rodar `pnpm auth:generate`, você terá algo assim:

```ts
// src/db/authModels.ts
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  // admin()
  role: text("role"),
  banned: integer("banned", { mode: "boolean" }).default(false),
  banReason: text("ban_reason"),
  banExpires: integer("ban_expires", { mode: "timestamp_ms" }),
  // phoneNumber()
  phoneNumber: text("phone_number").unique(),
  phoneNumberVerified: integer("phone_number_verified", { mode: "boolean" }),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // withCloudflare geolocation
  timezone: text("timezone"),
  city: text("city"),
  country: text("country"),
  region: text("region"),
  regionCode: text("region_code"),
  colo: text("colo"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  // admin()
  impersonatedBy: text("impersonated_by"),
});
```

---

## Montando o handler no Hono

```ts
// src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createAuth, getAuthInstance } from "./lib/auth";

type AppBindings = {
  Bindings: CloudflareBindings;
  Variables: {
    userId: string;
    auth: ReturnType<typeof createAuth>;
  };
};

const app = new Hono<AppBindings>();

app.use(
  "/*",
  cors({
    origin: (origin, c) => c.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
    credentials: true,
  })
);

app.use("*", async (c, next) => {
  if (c.req.path.startsWith("/api/auth")) {
    const auth = createAuth(c.env, (c.req.raw as any).cf || {});
    c.set("auth", auth);
  }
  await next();
});

app.all("/api/auth/*", async (c) => {
  const auth = c.get("auth");
  return auth.handler(c.req.raw);
});

export default app;
```

---

## Protegendo rotas

```ts
// src/lib/middleware.ts
import { createMiddleware } from "hono/factory";
import { getAuthInstance } from "./auth";

export const authMiddleware = createMiddleware(async (c, next) => {
  const auth = getAuthInstance(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    return c.text("Unauthorized", 401);
  }

  c.set("userId", session.user.id);
  await next();
});
```

Uso:

```ts
import { Hono } from "hono";
import { authMiddleware } from "./lib/middleware";

const app = new Hono();

// Rotas públicas
app.get("/health", (c) => c.json({ status: "ok" }));

// Rotas protegidas
app.use("/api/*", authMiddleware);

app.get("/api/me", (c) => {
  const userId = c.get("userId");
  return c.json({ userId });
});
```

---

## Gerando o frontend com IA

O plugin `openAPI()` gera uma especificação completa em `/api/auth/openapi.json`. Você pode jogar isso pra uma IA e pedir pra gerar os hooks do frontend:

```
Gere hooks de autenticação para React baseado nesta spec OpenAPI:

[cola o JSON aqui]

Requisitos:
- fetch nativo com credentials: 'include'
- TypeScript
- Hooks para: sign-in, sign-up, sign-out, get-session
- Tratamento de erros
```

Funciona surpreendentemente bem.

---

## Scripts úteis

```json
{
  "scripts": {
    "dev": "wrangler types && wrangler dev",
    "deploy": "wrangler types && wrangler deploy",
    "cf-typegen": "wrangler types",
    "auth:generate": "ALCHEMY_STAGE=dev npx @better-auth/cli@latest generate --config src/lib/auth.ts --output src/db/authModels.ts -y",
    "db:generate": "drizzle-kit generate",
    "db:migrate:dev": "wrangler d1 migrations apply seu-db --local",
    "db:migrate:prod": "wrangler d1 migrations apply seu-db --remote",
    "studio": "drizzle-kit studio"
  }
}
```

---

## Fluxo de desenvolvimento

### Setup inicial

```bash
pnpm cf-typegen      # gera tipos do Cloudflare
pnpm auth:generate   # gera schema do Better Auth
pnpm db:generate     # gera migrations
pnpm db:migrate:dev  # aplica migrations localmente
pnpm dev             # roda o servidor
```

### Adicionando um plugin

```bash
# 1. Adiciona o plugin em src/lib/auth.ts

# 2. Regenera o schema
pnpm auth:generate

# 3. Gera nova migration
pnpm db:generate

# 4. Aplica localmente
pnpm db:migrate:dev

# 5. Em prod
pnpm db:migrate:prod
```

> O `auth:generate` precisa rodar toda vez que você mexe em plugins. Ele lê sua config e gera os models correspondentes.

---

## Deploy

```bash
pnpm db:migrate:prod  # migrations primeiro
pnpm deploy           # depois o worker
```

---

## Por que essa stack?

- **Latência mínima**: tudo roda na edge, perto do usuário
- **Custo zero pra começar**: D1 tem tier gratuito generoso
- **Type-safety de ponta a ponta**: do banco ao frontend
- **Modular**: você só adiciona o que precisa
- **KV como cache**: reduz verificação de sessão de 1s pra 20ms
- **Geo grátis**: Cloudflare já te dá isso em cada request

---

## Links

- [Template completo](https://github.com/gabszs/workers-template)
- [Better Auth docs](https://www.better-auth.com/)
- [better-auth-cloudflare](https://github.com/zpg6/better-auth-cloudflare)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)

---

If you like the post, had any feedback or question, you can send me a message on [whatsapp](https://wa.me/5511947047830) or [email](mailto:gabrielcarvalho.workk@gmail.com).

By [Gabriel Carvalho](https://www.linkedin.com/in/gabzsz/)
