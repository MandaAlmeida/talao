# Talão — Plataforma de Eventos e Ingressos

Um organizador publica eventos (shows ou peças, com poster vindo do catálogo do TMDb), um cliente reserva e paga (de forma simulada, via Stripe em modo de teste) e recebe um ingresso com QR code, e a portaria valida a entrada escaneando esse código.

[🔗 **Aplicação publicada:** \[URL AQUI\] <!-- TODO: colar o link da Vercel -->](https://talao-ruddy.vercel.app/)

<!-- TODO: adicionar screenshot ou GIF do fluxo aqui -->
<!-- ![Demo do Talão](docs/demo.gif) -->

## Sumário

- [Stack](#stack)
- [Como rodar](#como-rodar)
- [Dados de teste (seed)](#dados-de-teste-seed)
- [Estrutura do repositório](#estrutura-do-repositório)
- [O que foi feito e o que ficou de fora](#o-que-foi-feito-e-o-que-ficou-de-fora)
- [Decisões de projeto](#decisões-de-projeto)
- [Uso de IA](#uso-de-ia)

## Stack

- **Backend**: NestJS 11 + Prisma 6 + PostgreSQL 16, autenticação JWT com 3 papéis (organizador, cliente, portaria), Stripe para pagamento, Swagger para documentação da API.
- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind CSS v4.
- **Infra local**: Docker Compose só para o Postgres — API e frontend rodam direto com Node.

Detalhes de arquitetura, variáveis de ambiente e scripts de cada lado estão nos READMEs específicos:

- [`backend/README.md`](backend/README.md)
- [`frontend/README.md`](frontend/README.md)

## Como rodar

Pré-requisitos: Node 20+, Docker (para o Postgres), e uma conta [Stripe](https://dashboard.stripe.com/test/apikeys) em modo de teste (gratuita).

```bash
# 1. Banco de dados
cd backend
docker compose up -d
cp .env.example .env   # preencha STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET (veja backend/README.md)
npm install
npx prisma migrate deploy
npx prisma db seed
npm run start:dev       # http://localhost:3001 — Swagger em /docs

# 2. Frontend (em outro terminal)
cd frontend
cp .env.local.example .env.local   # preencha NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
npm install
npm run dev              # http://localhost:3000
```

O passo a passo completo — incluindo como obter as chaves do Stripe e como testar o webhook localmente — está no [README do backend](backend/README.md#stripe).

## Dados de teste (seed)

O `npx prisma db seed` cria, sem precisar montar nada manualmente:

| Papel       | E-mail                  | Senha      |
| ----------- | ----------------------- | ---------- |
| Organizador | `organizador@talao.dev` | `senha123` |
| Cliente 1   | `cliente1@talao.dev`    | `senha123` |
| Cliente 2   | `cliente2@talao.dev`    | `senha123` |
| Portaria    | `portaria@talao.dev`    | `senha123` |

E dois eventos publicados:

- **Marrom, o Musical** (teatro, Brasília) — usa mapa de assentos; os assentos A1 e A2 já estão ocupados por uma reserva confirmada do cliente 1, para já dar pra ver o mapa com lugares indisponíveis.
- **Noite do Rock** (show, São Paulo) — estoque por quantidade (sem mapa de assentos); o cliente 2 já tem 3 ingressos confirmados.

O código de compra de cada reserva do seed aparece no terminal ao final do `db seed` — dá pra colar direto na tela de portaria para testar uma validação "já utilizado" logo de cara.

## Estrutura do repositório

```
talao/
├── backend/    # API NestJS + Prisma
├── frontend/   # Next.js
└── README.md   # este arquivo
```

## O que foi feito e o que ficou de fora

**Feito:**

- Autenticação JWT com 3 papéis (organizador, cliente, portaria) e guards de rota por papel.
- CRUD de eventos pelo organizador, com catálogo de filmes do TMDb para preencher título/sinopse/pôster automaticamente quando a categoria é "cinema".
- Fluxo de reserva com **os dois modos** pedidos no desafio: mapa de assentos (para eventos com lugar marcado) e quantidade de ingressos (para pista/estoque simples).
- Pagamento via Stripe em modo de teste (PaymentIntent + webhook assinado + reembolso automático no cancelamento) — cobrança real nunca acontece, mas o fluxo (incluindo recusa de cartão) é o mesmo que rodaria em produção.
- QR code assinado com HMAC (não é só um UUID em formato de imagem — o código de compra é assinado com um segredo do servidor, então não dá pra forjar um válido sem ele).
- Compartilhamento de ingresso por link (`shareToken` público, sem precisar de login para conferir).
- Portaria com leitura por câmera (via `qr-scanner`) e digitação manual como alternativa, com os 4 retornos pedidos: válido, inválido, já utilizado, evento errado.
- Garantia de que o mesmo assento não é vendido duas vezes (testado com reservas concorrentes, ver `bookings.service.spec.ts` e o teste e2e de concorrência).
- Cancelamento de ingresso pelo cliente, com reembolso automático quando o pagamento já tinha sido confirmado — item que o desafio lista como opcional.
- Rate limiting no login (proteção básica contra brute-force) e Swagger documentando toda a API.
- Testes automatizados: unitários (mockados, cobrindo as regras de negócio mais sensíveis — estoque, concorrência de assento, validação de QR, cancelamento/reembolso) e um e2e ponta a ponta contra um Postgres real.
- Painel de métricas do organizador: em "Meus eventos", cada card mostra ingressos vendidos (por tipo e total) sobre a capacidade, e a receita já arrecadada.
- **Aplicação publicada:** [talao.vercel.app](https://talao-ruddy.vercel.app/)

## Decisões de projeto

- **Pagamento simulado com Stripe real, em vez de um mock local**: o desafio permite qualquer uma das duas abordagens. Optei pelo Stripe em modo de teste porque o requisito não-funcional pede para "contemplar a confirmação e também a recusa" — um mock local reproduz isso trivialmente (um `if`), mas não mostra nada sobre como eu lidaria com webhook, assinatura, race condition entre confirmação e expiração da reserva, ou reembolso. É mais trabalho, mas é o tipo de decisão que a proposta pede pra eu justificar.
- **QR assinado com HMAC, não um QR "burro"**: o código de compra sozinho (`TLO-XXXXXX`) é curto e poderia ser adivinhado; a portaria valida o código _e_ a assinatura, então mesmo sabendo o formato não dá pra montar um ingresso válido sem o segredo do servidor.
- **Reserva primeiro, cobrança depois**: ao reservar, o backend já marca o assento/estoque como ocupado (status `PENDENTE`) antes de criar o PaymentIntent — evita que dois clientes vejam o mesmo assento como "livre" enquanto um deles está no meio do pagamento. Reservas pendentes que não são pagas em 10 minutos expiram automaticamente (job agendado) e liberam o lugar de novo.
- **Cancelamento com reembolso automático**: adicionei porque o desafio lista "cancelamento com devolução ao estoque" como diferencial — fiz o reembolso financeiro andar junto, já que parcial não faz sentido sem devolver o dinheiro de verdade quando o pagamento foi real.

## Uso de IA

Utilizei o Claude Code (Anthropic) como ferramenta de apoio durante praticamente todo o desenvolvimento, desde o scaffold inicial até a implementação das funcionalidades, correções e elaboração deste README.

A IA foi utilizada principalmente para:

- Implementação de código, incluindo controllers, services e componentes React, a partir dos requisitos e orientações definidos durante o desenvolvimento.
- Apoio na revisão e correção de lint e tipagem.
- Auxílio na identificação e correção de problemas encontrados durante a implementação.
- Elaboração deste README.

Durante o desenvolvimento, as funcionalidades foram sendo implementadas de forma incremental, com validações e ajustes conforme cada fluxo era concluído. Algumas inconsistências introduzidas durante o processo também foram identificadas e corrigidas, como uma tela que ainda utilizava dados de um sistema mockado após a migração do fluxo para dados reais e uma versão de uma tela que havia perdido a navegação baseada no papel do usuário.

Também realizei testes manuais dos principais fluxos, utilizando curl e o navegador, para validar o comportamento da aplicação após as alterações.

A utilização da IA teve como principal objetivo agilizar a implementação e reduzir o tempo gasto em tarefas repetitivas, mantendo o acompanhamento e a validação das decisões tomadas ao longo do desenvolvimento.
