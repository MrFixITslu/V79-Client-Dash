# V79 Business Agent — Phase 1

This is the first safe version of the V79 Digital business agent.

## Think of an agent like a new employee

A normal AI chat model is like a smart person sitting at a desk with no access to anything.

An **agent** is that same smart person plus:

1. **A job description** — its instructions.
2. **Tools** — things it is allowed to use.
3. **Memory/state** — what it knows about the current job.
4. **Rules** — what it must never do on its own.
5. **A manager** — a human approval step for risky actions.

In this project, the **V79 Business Manager** is the front desk. It can hand work to specialist agents:

- V79 Operations
- V79 Growth
- V79 Finance
- V79 Customer Experience
- CombatZone Operations
- V79 Technology

## Why Phase 1 is read-only

A business agent should not get every password and every permission on day one.

This first version can:

- answer business questions;
- send a task to the right specialist;
- check configured app health endpoints;
- prepare recommendations and drafts;
- identify when owner approval is required.

It cannot yet:

- send emails;
- change a Laser Tag booking;
- refund or charge money;
- edit production data;
- deploy code;
- change security settings.

That is intentional.

## The agent loop

When you ask:

> "Why is Laser Tag not taking bookings?"

the service follows this loop:

1. The manager reads the request.
2. It decides CombatZone Operations or Technology is the right specialist.
3. The specialist may call the health-check tool.
4. The tool returns real data.
5. The specialist explains what it found.
6. The run stops when there are no more tools to call.

That loop — **think -> use a tool -> look at the result -> think again -> answer** — is the heart of an agent.

## Model provider

Production defaults to the local Ollama service:

- provider: `ollama`
- OpenAI-compatible endpoint: `http://ollama:11434/v1`
- default model: `qwen2.5:1.5b`
- request timeout: 60 seconds
- OpenAI tracing is disabled while Ollama is selected.

The Hub permissions and tools do not change when the model provider changes. OpenAI remains an optional fallback by setting `V79_AGENT_MODEL_PROVIDER=openai` and configuring an API key.

## Run locally

```bash
cd agent-service
cp .env.example .env
# Ensure Ollama is reachable and the configured model is installed.
# For local development also set V79_AGENT_API_TOKEN.
npm install
npm run lint
npm test
npm start
```

Health check:

```bash
curl http://localhost:3055/health
```

Agent request:

```bash
curl -X POST http://localhost:3055/api/agent/chat \
  -H 'content-type: application/json' \
  -H 'x-v79-agent-token: YOUR_TOKEN' \
  -d '{"message":"Check the V79 systems and tell me what needs attention."}'
```

## Connect it to the Hub

The recommended production layout is:

```text
Owner
  |
V79 Hub  <---- cockpit / approval screen
  |
V79 Business Agent
  |
  +-- Operations
  +-- Growth
  +-- Finance
  +-- Customer Experience
  +-- CombatZone
  +-- Technology
        |
        +-- approved tools for V79 apps
```

The Hub should call the agent over the internal Docker network and send
`x-v79-agent-token`. Do not expose the agent API directly to the public internet.

## Learning roadmap

### Phase 1 — Brain
Manager, specialists, read-only tools, basic policy. **This branch.**

### Phase 2 — Eyes
Connect live read-only data from the Hub, website, POS, Marketing, Tiquet,
FFPRO, Academy, Games and CombatZone.

### Phase 3 — Voice
Connect Gmail and Calendar so the agent can read business communications and
prepare drafts, while sending/changing events still requires approval.

### Phase 4 — Hands with supervision
Add write tools one by one. Every customer, money, production or security
change creates an approval request in the Hub.

### Phase 5 — Routine manager
Scheduled morning brief, lead follow-ups, app-health checks, booking preparation,
inventory warnings and KPI summaries.

### Phase 6 — Controlled autonomy
Only low-risk, well-tested actions become automatic. High-risk actions stay
human-approved.

## Security rule

Never give the model a raw database password, server root password, payment
secret or unrestricted shell. Give it a narrow tool that performs one approved
job and validates every input.