# Bountra — Schema Documentation

## 1. On-Chain Storage Layout (`BountraEscrow.sol`)

### Structs

```solidity
struct Bounty {
    address creator;          // Project owner who funded the bounty
    address token;            // ERC-20 token address (USDT / WBNB)
    uint256 amount;           // Reward amount in token decimals
    string issueUrl;          // GitHub Issue URL (e.g. "https://github.com/org/repo/issues/12")
    uint256 deadline;         // Unix timestamp after which creator can refund
    bool claimed;             // True once developer successfully claims
    bool cancelled;           // True if creator refunded after deadline
}
```

### Mappings

```solidity
// Bounty ID → Bounty data
mapping(uint256 => Bounty) public bounties;

// Auto-incrementing bounty counter
uint256 public bountyCount;

// Agent signer address (set at deployment, immutable)
address public immutable agentSigner;

// Replay protection: consumed signature hashes
mapping(bytes32 => bool) public usedSignatures;
```

### Events

```solidity
event BountyCreated(uint256 indexed bountyId, address indexed creator, address token, uint256 amount, string issueUrl, uint256 deadline);
event BountyClaimed(uint256 indexed bountyId, address indexed developer, string prUrl, string commitHash);
event BountyCancelled(uint256 indexed bountyId, address indexed creator);
```

---

## 2. Off-Chain Database (SQLite via Drizzle ORM)

### ERD

```
┌─────────────────────────┐       ┌──────────────────────────────┐
│        bounties          │       │         audit_logs            │
├─────────────────────────┤       ├──────────────────────────────┤
│ id         INTEGER PK   │──┐    │ id            INTEGER PK     │
│ bounty_id  INTEGER UQ   │  │    │ bounty_id     INTEGER FK     │──> bounties.bounty_id
│ issue_url  TEXT NOT NULL │  │    │ pr_url        TEXT NOT NULL   │
│ repo_owner TEXT NOT NULL │  │    │ commit_hash   TEXT NOT NULL   │
│ repo_name  TEXT NOT NULL │  │    │ developer     TEXT NOT NULL   │
│ issue_num  INTEGER       │  │    │ ci_status     TEXT            │  -- "passed" | "failed"
│ creator    TEXT NOT NULL │  │    │ ci_detail     TEXT            │  -- JSON: test counts
│ token      TEXT NOT NULL │  │    │ integrity_ok  INTEGER         │  -- 0 | 1
│ amount     TEXT NOT NULL │  │    │ ai_score      INTEGER         │  -- 0-100
│ deadline   INTEGER       │  │    │ ai_verdict    TEXT            │  -- "passed" | "failed"
│ status     TEXT NOT NULL │  │    │ ai_comment    TEXT            │  -- Full review text
│ tx_hash    TEXT          │  │    │ signature     TEXT            │  -- ECDSA hex
│ created_at TEXT DEFAULT  │  │    │ claim_tx_hash TEXT            │  -- On-chain claim tx
│ updated_at TEXT DEFAULT  │  │    │ status        TEXT NOT NULL   │  -- "pending" | "passed" | "failed" | "claimed"
└─────────────────────────┘  │    │ created_at    TEXT DEFAULT    │
                             │    └──────────────────────────────┘
                             │
                             │    ┌──────────────────────────────┐
                             │    │       webhook_events          │
                             │    ├──────────────────────────────┤
                             └──> │ id            INTEGER PK     │
                                  │ bounty_id     INTEGER FK     │──> bounties.bounty_id (nullable)
                                  │ event_type    TEXT NOT NULL   │  -- "pull_request.opened" | "pull_request.synchronize"
                                  │ pr_number     INTEGER         │
                                  │ pr_url        TEXT NOT NULL   │
                                  │ sender        TEXT NOT NULL   │  -- GitHub username
                                  │ commit_hash   TEXT NOT NULL   │
                                  │ payload_hash  TEXT NOT NULL   │  -- SHA-256 of raw payload (dedup)
                                  │ processed     INTEGER DEFAULT │  -- 0 | 1
                                  │ created_at    TEXT DEFAULT    │
                                  └──────────────────────────────┘
```

### Table Descriptions

| Table | Purpose | Write Frequency |
|---|---|---|
| `bounties` | Mirror of on-chain bounty state + metadata for fast queries | On `BountyCreated` event or manual sync |
| `audit_logs` | Full audit trail per PR evaluation (CI, integrity, AI, signature) | Once per PR webhook event |
| `webhook_events` | Raw webhook event log for dedup and debugging | Every incoming webhook |

### Indexes

```sql
CREATE UNIQUE INDEX idx_bounties_bounty_id ON bounties(bounty_id);
CREATE INDEX idx_bounties_status ON bounties(status);
CREATE INDEX idx_audit_logs_bounty_id ON audit_logs(bounty_id);
CREATE INDEX idx_audit_logs_status ON audit_logs(status);
CREATE UNIQUE INDEX idx_webhook_payload_hash ON webhook_events(payload_hash);
```

---

## 3. Migration Plan

### MVP (Hackathon)
- SQLite single file (`agent/data/bountra.db`)
- Drizzle ORM with `drizzle-kit` for schema push
- No migration versioning needed (reset DB on each demo)

### Post-Hackathon (If Scaling)
- Migrate to PostgreSQL (Supabase or self-hosted)
- Add Drizzle migration versioning (`drizzle-kit generate`)
- Add RLS for multi-tenant support
- Consider indexing on-chain events via subgraph or Envio
