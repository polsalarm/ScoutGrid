# Option D — Collateralized Loan Against Roster

## The Problem It Solves

Independent scouts and small guilds hold real value in their player contracts but often lack liquid XLM
to act on time-sensitive opportunities (tournament entries, player buyouts, team expansion). Option D
lets them unlock that value without selling — borrowing against what they already own.

---

## Real-World Story: Kai's Tournament Entry

> Kai is an independent esports scout. After months of scouting, he mints two player profiles on
> ScoutGrid — Renz (Jungler, valued 3,000 XLM) and Dae (Roamer, valued 2,000 XLM). A major
> tournament drops with a 4,000 XLM entry fee and an 80,000 XLM prize pool. Kai's balance is 600 XLM.
>
> The old system: a guild funds him in exchange for 30% of prize winnings and partial ownership of his
> contracts.
>
> The ScoutGrid way: Kai puts Renz's contract up as collateral and borrows 2,500 XLM. He puts Dae's
> contract up and borrows another 2,000 XLM. He enters the tournament. His team finishes second —
> 18,000 XLM prize. He repays both loans with interest, recovers his contracts, and keeps full
> ownership.
>
> No guild took a cut. No co-ownership was diluted. He leveraged what he already built.

This is asset-backed lending for esports — the same mechanic as mortgages, margin accounts, and
invoice financing, adapted to on-chain player contracts.

---

## Smart Contract Design

### New Data Structures

```rust
#[contracttype]
#[derive(Clone, Debug)]
pub struct LoanRecord {
    pub borrower: Address,       // Scout/guild who took the loan
    pub collateral_player: Address, // Player contract locked as collateral
    pub principal: i128,         // XLM borrowed
    pub interest_rate_bps: u32,  // Basis points (e.g. 500 = 5%)
    pub due_ledger: u32,         // Ledger number when loan expires
    pub repaid: bool,
}

// New DataKey variants
LoanRecord(Address),    // keyed by collateral player address
LoanPool,               // i128 — total XLM available in the lending pool
```

### New Error Codes

```rust
ContractError::LoanAlreadyExists    = 109,
ContractError::NoActiveLoan         = 110,
ContractError::InsufficientPool     = 111,
ContractError::LoanNotDue           = 112,
ContractError::CollateralNotOwned   = 113,
```

### New Contract Functions

#### `fund_pool(env, funder, amount)`
Anyone (a guild, sponsor, or the admin) deposits XLM into the lending pool.
- Transfers `amount` from `funder` to the contract.
- Increments `LoanPool` in storage.

#### `take_loan(env, borrower, player, amount)`
Borrower locks a player contract they own as collateral and receives XLM.
- Verifies `borrower` owns `profile.owner == borrower`.
- Verifies no existing loan on this player (`!has LoanRecord(player)`).
- Verifies `amount <= pool_balance * MAX_LTV` (e.g. 80% of list_price).
- Sets `profile.listed = false` — collateral cannot be sold while locked.
- Writes `LoanRecord` with `due_ledger = env.ledger().sequence() + LOAN_DURATION_LEDGERS`.
- Transfers `amount` from contract to borrower.
- Decrements `LoanPool`.

#### `repay_loan(env, borrower, player)`
Borrower repays principal + interest to recover their player contract.
- Computes `repayment = principal + (principal * interest_rate_bps / 10_000)`.
- Transfers `repayment` from `borrower` to contract.
- Increments `LoanPool` by `repayment`.
- Deletes `LoanRecord(player)`.
- Re-sets `profile.listed = true` — contract is tradeable again.

#### `liquidate(env, caller, player)`
Anyone can call this after the due ledger passes if the loan is unpaid.
- Verifies `env.ledger().sequence() > loan.due_ledger`.
- Transfers ownership of the player profile to the contract/admin (or a designated liquidator).
- Increments `LoanPool` by `principal` (partial recovery; interest is forgiven on liquidation).
- Deletes `LoanRecord(player)`.
- Emits an event (Soroban `env.events().publish(...)`) for frontend to surface.

#### `get_loan(env, player) -> Option<LoanRecord>`
Read-only query for the frontend.

#### `get_pool_balance(env) -> i128`
Returns current XLM available in the lending pool.

---

## Parameters (Configurable by Admin)

| Parameter | Suggested Default | Description |
|-----------|-------------------|-------------|
| `MAX_LTV` | 80% of list_price | Max loan-to-value ratio |
| `INTEREST_RATE_BPS` | 500 (5%) | Flat rate per loan term |
| `LOAN_DURATION_LEDGERS` | ~518,400 | ~30 days at 5s/ledger |

---

## Frontend Changes

### New UI Components

- **`LoanModal.tsx`** — triggered from PlayerCard or MyRoster when the user owns the player.
  - Shows: collateral player name, list price, max borrowable (80% of list_price), interest preview,
    due date estimate.
  - CTA: "Borrow XLM" → calls `take_loan` via `contract.ts`.

- **`LoanBadge.tsx`** — small indicator on PlayerCard/RosterCard showing "LOCKED — COLLATERAL"
  when `profile.listed == false` and a `LoanRecord` exists.

- **`RepayModal.tsx`** — triggered from MyRoster on a locked card.
  - Shows: principal, interest owed, total repayment, ledgers remaining.
  - CTA: "Repay & Unlock" → calls `repay_loan` via `contract.ts`.

### Store Changes

```typescript
// Add to ScoutState:
loans: Map<string, LoanRecord>;   // keyed by player address
setLoans: (loans: Map<string, LoanRecord>) => void;
```

### contract.ts Changes

```typescript
export async function takePlayerLoan(borrower: string, playerAddress: string, amount: number): Promise<void>
export async function repayPlayerLoan(borrower: string, playerAddress: string): Promise<void>
export async function getActiveLoan(playerAddress: string): Promise<LoanRecord | null>
export async function getPoolBalance(): Promise<number>
```

---

## Implementation Order

| # | Task | File |
|---|------|------|
| 1 | Add `LoanRecord`, `LoanPool` DataKey, new error codes | `contract/src/lib.rs` |
| 2 | Implement `fund_pool`, `take_loan`, `repay_loan`, `liquidate`, `get_loan`, `get_pool_balance` | `contract/src/lib.rs` |
| 3 | Write tests: happy path, over-LTV rejection, liquidation, double-loan rejection | `contract/src/test.rs` |
| 4 | Add `takePlayerLoan`, `repayPlayerLoan`, `getActiveLoan`, `getPoolBalance` to contract.ts | `frontend/src/lib/contract.ts` |
| 5 | Add `loans` slice to store | `frontend/src/lib/store.ts` |
| 6 | Create `LoanBadge.tsx` | `frontend/src/components/ui/` |
| 7 | Create `LoanModal.tsx` | `frontend/src/components/ui/` |
| 8 | Create `RepayModal.tsx` | `frontend/src/components/ui/` |
| 9 | Wire modals into `PlayerCard.tsx` and `MyRoster.tsx` | existing files |
| 10 | Update README.md with Kai's story and loan mechanics | `README.md` |

---

## Design Decisions (Resolved)

| Question | Decision | Notes |
|----------|----------|-------|
| Who seeds the lending pool? | **Admin wallet** for MVP | Admin calls `fund_pool` to bootstrap liquidity. In v2, open to any guild as liquidity provider earning a yield share. |
| Where do liquidated contracts go? | **Community repo pool** with admin fee | Liquidated profiles enter a special `RepoListed` state. Anyone can bid on them via a separate repo auction. A flat % fee on the repo sale goes to the admin address as protocol revenue. |
| Does interest compound? | **Yes — compound per term extension** | If a borrower extends past `due_ledger`, interest compounds on the outstanding balance each additional term. Encourages repayment over rollover abuse. |
| Is MAX_LTV global or per-player? | **Per-player based on `win_points`** | Higher WP = better loan terms. E.g. 0 WP → 50% LTV, 5 WP → 65% LTV, 10+ WP → 80% LTV. Strengthens the financial systems story: reputation earns real economic privilege on-chain. |

### WP-Based LTV Table (Suggested)

| Win Points | Max LTV |
|-----------|---------|
| 0 | 50% of list_price |
| 1–2 | 55% |
| 3–5 | 65% |
| 6–9 | 72% |
| 10+ | 80% |

### Repo Pool Flow

1. Loan expires unpaid → anyone calls `liquidate(player)`
2. Profile ownership transfers to contract (locked)
3. Profile enters `RepoListed` state — visible on a "Repo Auction" tab in the frontend
4. Any guild places bids (standard bargain mechanic)
5. When bid is accepted by admin, **admin fee (e.g. 5%) is deducted** from the sale price and sent to the admin address; remainder fills the pool
6. Profile ownership transfers to the winning bidder
