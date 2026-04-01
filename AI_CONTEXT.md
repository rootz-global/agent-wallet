# @rootz/agent-wallet — AI Context

**Version**: 0.1.0
**Location**: `rootz-v6/packages/agent-wallet/`
**Role**: SDK for AI agents with provable origin
**Status**: v0.1.0 — standalone wallet, birth certificates, session archiving
**GitHub**: https://github.com/rootz-global/agent-wallet

---

## FOR AI ASSISTANTS: This is the External Developer SDK

If someone says "I want to add proof of origin to my AI agent" — this is what they install.

**Three calls:**
```typescript
import { createAgentWallet } from '@rootz/agent-wallet';

// 1. Create wallet (generates birth certificate)
const wallet = createAgentWallet({
  ownerAddress: '0xYourWallet...',
  model: 'gpt-4',
  provider: 'openai',
  scope: 'research',
});

// 2. Record each inference call
wallet.recordInference({
  prompt: 'What is quantum computing?',
  response: 'Quantum computing uses...',
  model: 'gpt-4',
  promptTokens: 12,
  completionTokens: 150,
  totalTokens: 162,
  latencyMs: 2400,
});

// 3. Settle the session
const settlement = wallet.settle();
// settlement.merkleRoot — covers all actions
// settlement.archiveContent — full markdown for IPFS/chain
// settlement.totalTokens — session stats
```

**Provider-agnostic.** Works with OpenAI, Anthropic, Morpheus, Ollama, any AI.

---

## What This Package Does

- Creates agent wallets with birth certificates (names AI parent + key-holder authorizer)
- Records inference calls as hash-linked entries (SHA-256, chain integrity)
- Settles sessions with Merkle root and full archive content
- Returns markdown ready for on-chain archiving

## What This Package Does NOT Do

- Blockchain writes (use Desktop V6 or direct ethers.js)
- IPFS uploads (use NoteManager or Pinata)
- Signing with real keys (use Desktop TPM relay or agent-tee)
- Policy enforcement (use agent-tee)

Those are handled by the Rootz infrastructure. This SDK is the data layer.

---

## File Map

| File | Purpose |
|------|---------|
| `src/index.ts` | Everything: AgentWallet class, createAgentWallet(), types |

Single file, ~350 lines. Intentionally simple.

---

## Key Types

```typescript
// Create a wallet
interface CreateWalletConfig {
  ownerAddress: string;     // Key holder (not assumed human)
  ownerName?: string;
  model: string;            // AI model name
  provider?: string;        // AI provider
  apiEndpoint?: string;
  scope: string;            // What the agent does
  dailyAllowance?: number;
  currency?: string;
  agentIndex?: number;      // BIP-32 derivation index
}

// Record an inference
interface InferenceRecord {
  prompt: string;
  systemPrompt?: string;
  response: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
}

// Settlement result
interface SettlementResult {
  merkleRoot: string;       // Covers all actions
  actionCount: number;
  totalTokens: number;
  archiveContent: string;   // Full markdown for archiving
  timestamp: string;
}
```

---

## Integration with Rootz Infrastructure

```
@rootz/agent-wallet (THIS — data layer)
    ↓ produces birth certificates, hash chains, archive content
@rootz/agent-runtime (types + chain)
    ↓ provides unified event model
apps/agent-tee (policy + signing)
    ↓ enforces limits, signs via TPM
apps/desktop-v6 (archive + blockchain)
    ↓ writes to Polygon, uploads to IPFS
```

For Tim/Adam/external devs: start with agent-wallet. Add agent-tee when you need policy enforcement. Add Desktop when you need on-chain archiving.

---

*Last updated: 2026-04-01 by Claude Opus 4.6*
