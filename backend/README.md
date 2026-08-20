# Talão — Backend

API REST em NestJS + Prisma + PostgreSQL para a plataforma de eventos e ingressos Talão. Veja o [README raiz](../README.md) para uma visão geral do projeto (frontend, decisões, uso de IA).

## Stack

- **NestJS 11** — módulos, guards, pipes.
- **Prisma 6** — ORM sobre PostgreSQL 16.
- **JWT** (`@nestjs/jwt` + `passport-jwt`) — autenticação com 3 papéis: `ORGANIZADOR`, `CLIENTE`, `PORTARIA`.
- **Stripe** — pagamento (PaymentIntent) e reembolso, em modo de teste.
- **`@nestjs/throttler`** — rate limiting (5 tentativas/min em `/auth/login`).
- **`@nestjs/swagger`** — documentação interativa da API.
- **Jest + Supertest** — testes unitários e e2e.

## Pré-requisitos

- Node 20+
- Docker (só para o Postgres — a API roda direto com Node)
- Uma conta [Stripe](https://dashboard.stripe.com) (gratuita, modo de teste)

## Configuração

```bash
docker compose up -d          # sobe o Postgres em localhost:5433
cp .env.example .env
npm install
npx prisma migrate deploy
npx prisma db seed
```

### Variáveis de ambiente (`.env`)

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão do Postgres (já vem certa para o `docker-compose.yml` deste repo) |
| `PORT` | Porta da API (padrão `3001`) |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Segredo e validade do token de autenticação |
| `QR_SECRET` | Segredo usado para assinar (HMAC) o código de compra dos ingressos — sem ele ninguém forja um QR válido |
| `TMDB_API_KEY` / `TMDB_BASE_URL` | Chave da API do TMDb, usada para popular eventos de categoria "cinema" a partir do catálogo de filmes |
| `STRIPE_SECRET_KEY` | Chave secreta do Stripe (modo teste) |
| `STRIPE_WEBHOOK_SECRET` | Segredo de assinatura do webhook do Stripe |

### TMDb

Chave gratuita em [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) (v3 auth). Sem ela, o app inteiro funciona normalmente — só a busca de filmes em "Criar evento → categoria cinema" fica indisponível (o endpoint retorna 500 com uma mensagem explicando o motivo).

### Stripe

1. Crie uma conta em [dashboard.stripe.com](https://dashboard.stripe.com) e confirme que o modo **Test mode** está ativo.
2. Em **Developers → API keys**, copie a **Secret key** (`sk_test_...`) para `STRIPE_SECRET_KEY`. A **Publishable key** (`pk_test_...`) vai no `.env.local` do frontend, não aqui.
3. Para o webhook local, instale a [Stripe CLI](https://docs.stripe.com/stripe-cli) (`brew install stripe/stripe-cli/stripe` no macOS) e rode, num terminal separado, deixando ativo enquanto testa pagamentos:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3001/webhooks/stripe
   ```
   O comando imprime um `whsec_...` — cole em `STRIPE_WEBHOOK_SECRET`.

Sem essas duas chaves a API sobe normalmente, mas qualquer reserva de ingresso **pago** falha ao tentar criar o PaymentIntent (ingressos gratuitos continuam funcionando sem Stripe nenhum, já que nunca chamam a API).

## Rodando

```bash
npm run start:dev
```

API em `http://localhost:3001`. Documentação interativa (Swagger) em `http://localhost:3001/docs`.

## Dados de teste

`npx prisma db seed` cria um organizador, dois clientes, um usuário de portaria e dois eventos publicados (um com mapa de assentos parcialmente ocupado, outro com estoque por quantidade). Credenciais e detalhes no [README raiz](../README.md#dados-de-teste-seed).

## Testes

```bash
npm test          # unitários — mockados, não precisam de banco
npm run test:e2e  # e2e — precisa do Postgres rodando com as migrations aplicadas (docker compose up -d + prisma migrate deploy)
npm run test:cov  # unitários com relatório de cobertura
```

O e2e (`test/fluxo-completo.e2e-spec.ts`) sobe a aplicação inteira contra um banco real e percorre o fluxo crítico ponta a ponta: registro dos 3 papéis, login, criação e publicação de evento, reserva de ingresso, listagem "meus ingressos", validação de QR na portaria (válido → já utilizado → inválido) e um teste de concorrência garantindo que o mesmo assento não é reservado duas vezes.

## Módulos e rotas

| Módulo | Rota base | Responsabilidade |
|---|---|---|
| `auth` | `/auth` | Registro e login (JWT) |
| `events` | `/events` | CRUD de eventos, listagem pública com filtro por categoria/cidade/busca |
| `bookings` | `/events/:id/bookings`, `/bookings` | Reserva, disponibilidade, "minhas reservas", compartilhamento por link, cancelamento |
| `tickets` | `/tickets/validar` | Validação de ingresso na portaria |
| `catalog` | `/catalog/filmes` | Busca de filmes no TMDb |
| `payments` | `/webhooks/stripe` | Webhook do Stripe (confirmação/recusa de pagamento) |

Lista completa de endpoints, parâmetros e respostas: `/docs` (Swagger) com a API rodando.

## Decisões técnicas específicas do backend

- **Reserva otimista**: o assento/estoque é marcado como ocupado (`status: PENDENTE`) dentro de uma transação Prisma antes do PaymentIntent ser criado — dois clientes reservando o mesmo assento ao mesmo tempo nunca "passam" os dois (testado em `bookings.service.spec.ts` e no e2e).
- **Expiração automática**: um `@Cron` (`bookings-cleanup.service.ts`) roda a cada minuto e expira reservas `PENDENTE` havia mais de 10 minutos, liberando o assento — evita que um carrinho abandonado prenda estoque para sempre.
- **QR assinado, não só um código aleatório**: `qr.util.ts` assina o `codigoCompra` com HMAC-SHA256 usando `QR_SECRET`. A portaria valida código + assinatura, então adivinhar o formato do código não é suficiente para forjar um ingresso.
- **Rate limiting diferenciado**: `/auth/login` tem limite de 5 req/min (protege contra brute-force de senha); `/auth/registro` tem 20 req/min (ação legítima menos sensível, não deveria travar um fluxo de testes ou onboarding em lote).
