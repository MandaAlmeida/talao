# Talão — Frontend

Interface em Next.js para a plataforma de eventos e ingressos Talão. Veja o [README raiz](../README.md) para uma visão geral do projeto (backend, decisões, uso de IA).

## Stack

- **Next.js 16** (App Router) + **React 19**
- **Tailwind CSS v4**
- **`@stripe/react-stripe-js`** — formulário de cartão embutido (Stripe Elements)
- **`qr-scanner`** — leitura de QR code pela câmera na tela de portaria
- **`qrcode`** — geração do QR do ingresso em "Meus ingressos"

Sem gerenciador de estado global (Redux/Zustand): sessão do usuário e caches de listagem usam `useSyncExternalStore` direto sobre `localStorage`/memória, o suficiente para o tamanho do app.

## Pré-requisitos

- Node 20+
- O [backend](../backend) rodando em `http://localhost:3001`

## Configuração

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

App em `http://localhost:3000`.

### Variáveis de ambiente (`.env.local`)

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL do backend (padrão `http://localhost:3001`) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Chave publicável do Stripe (`pk_test_...`), obtida no [Dashboard](https://dashboard.stripe.com/test/apikeys) — a chave secreta correspondente fica só no backend |

Sem a chave do Stripe, tudo funciona normalmente exceto a etapa de pagamento de um ingresso **pago** (o formulário de cartão não carrega). Ingressos gratuitos não usam Stripe em nenhum momento.

## Rotas principais

| Rota | Papel | Descrição |
|---|---|---|
| `/` | público | Lista de eventos publicados, com busca e filtro por local/categoria |
| `/login`, `/registro` | público | Autenticação, com escolha de papel no registro |
| `/eventos/[id]` | público | Detalhe do evento e disponibilidade de ingressos em tempo real |
| `/eventos/[id]/comprar` | cliente | Seleção de assento (mapa) ou quantidade, dados do comprador, pagamento via Stripe Elements |
| `/criar-evento`, `/meus-eventos`, `/eventos/[id]/editar` | organizador | CRUD de eventos |
| `/meus-ingressos`, `/meus-ingressos/[id]` | cliente | Ingressos comprados, QR code, cancelamento com reembolso |
| `/portaria` | portaria | Validação de ingresso por câmera ou código digitado |

Acesso é controlado pelo componente `RequireRole`, que redireciona para `/login` se o usuário não tem o papel esperado para a rota.

## Testes

```bash
npm run lint
```

Não há suíte de testes automatizados no frontend nesta entrega — a cobertura de testes do projeto está concentrada no backend (unitários + e2e), onde vivem as regras de negócio mais sensíveis (estoque, pagamento, validação de QR). Ver [README raiz](../README.md#o-que-foi-feito-e-o-que-ficou-de-fora).

## Decisões técnicas específicas do frontend

- **`useSyncExternalStore` em vez de uma lib de estado**: para o tamanho do app (sessão + duas listagens com cache simples), trazer Redux/Zustand seria peso sem ganho — a API nativa do React já resolve.
- **Assentos e quantidade no mesmo formulário**: `EventForm` tem um toggle "usa mapa de assentos"; a tela de compra (`/comprar`) lê essa flag do evento e decide entre `<SeatMap>` (grade clicável) ou um contador de quantidade, sem duplicar a tela.
- **Confirmação de pagamento com polling**: depois que o Stripe confirma o cartão no navegador, o backend só sabe que o pagamento foi aprovado quando o *webhook* chega (assíncrono). A tela de compra faz polling em `GET /bookings/:id` a cada 1.5s até o status mudar de `PENDENTE`, em vez de assumir sucesso na hora — reflete o delay real que existe em produção.
