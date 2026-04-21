#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, panic_with_error, token, Address, Env, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    MarketToken,             // The XLM token address
    Admin,                   // Trusted address to verify and add win points
    Registration(Address),   // Maps a User's Address to their IGN (Username)
    Profile(Address),        // Maps a Player's Address to their PlayerProfile
    CurrentBidder(Address),  // Maps a Player's Address to the current (best-offer) bidder
    CurrentBid(Address),     // Maps a Player's Address to the current bid amount
    PlayerRegistry,          // Vec<Address> containing all player addresses minted
    LoanRecord(Address),     // Maps a Player's Address to their active LoanRecord
    LoanPool,                // i128 — total XLM available in the lending pool
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 100,
    Unauthorized = 101,
    BidTooLow = 102,
    NotRegistered = 103,
    NoActiveBid = 104,
    InvalidAmount = 105,
    UserAlreadyRegistered = 106,
    NotInitialized = 107,
    ProfileAlreadyExists = 108,
    LoanAlreadyExists = 109,
    NoActiveLoan = 110,
    InsufficientPool = 111,
    LoanNotExpired = 112,
    CollateralNotOwned = 113,
    ExceedsLTV = 114,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlayerProfile {
    pub username: String,          // The player's IGN
    pub role: String,              // e.g., "Jungler", "Roamer"
    pub bio: String,               // Personal bio
    pub achievements: soroban_sdk::Vec<String>, // List of curated achievements
    pub win_points: u32,           // Managed by the ScoutGrid WebApp
    pub owner: Address,            // The current owner of the profile asset
    pub original_creator: Address, // Recipient of the 10% royalty
    pub list_price: i128,          // Asking price (bargain bids must be below this)
    pub listed: bool,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct LoanRecord {
    pub borrower: Address,
    pub principal: i128,
    pub start_ledger: u32,
    pub due_ledger: u32,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct MarketItem {
    pub player: Address,
    pub profile: PlayerProfile,
    pub current_bid: i128,
    pub current_bidder: Option<Address>,
}

pub const LOAN_DURATION_LEDGERS: u32 = 518_400; // ~30 days at 5s/ledger
pub const INTEREST_RATE_BPS: u32 = 500;         // 5% per term

fn compute_max_ltv(win_points: u32) -> u32 {
    match win_points {
        0 => 50,
        1..=2 => 55,
        3..=5 => 65,
        6..=9 => 72,
        _ => 80,
    }
}

#[contract]
pub struct ScoutGridMarket;

#[contractimpl]
impl ScoutGridMarket {

    // Initializes the marketplace with the native XLM token and an Admin to verify wins
    pub fn init(env: Env, token: Address, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, ContractError::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::MarketToken, &token);
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    pub fn set_admin(env: Env, new_admin: Address) {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotInitialized));
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
    }

    // 1. Initial Account Verification: Register an IGN for the wallet
    pub fn register_user(env: Env, user: Address, username: String) {
        user.require_auth();
        if !env.storage().persistent().has(&DataKey::Registration(user.clone())) {
            env.storage().persistent().set(&DataKey::Registration(user), &username);
        } else {
            panic_with_error!(&env, ContractError::UserAlreadyRegistered);
        }
    }

    // 2. Mint Player Profile: List yourself on the marketplace
    pub fn mint_player_profile(env: Env, player: Address, role: String, bio: String, achievements: soroban_sdk::Vec<String>, list_price: i128) {
        player.require_auth();
        
        let username: String = env.storage().persistent()
            .get(&DataKey::Registration(player.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotRegistered));

        if list_price <= 0 {
            panic_with_error!(&env, ContractError::InvalidAmount);
        }

        if !env.storage().persistent().has(&DataKey::Profile(player.clone())) {
            let profile = PlayerProfile {
                username,
                role,
                bio,
                achievements,
                win_points: 0,
                owner: player.clone(),
                original_creator: player.clone(),
                list_price,
                listed: true,
            };
            env.storage().persistent().set(&DataKey::Profile(player.clone()), &profile);
            env.storage().persistent().set(&DataKey::CurrentBid(player.clone()), &0i128);

            // Register the address for global discovery
            let mut registry: soroban_sdk::Vec<Address> = env.storage().persistent().get(&DataKey::PlayerRegistry).unwrap_or(soroban_sdk::vec![&env]);
            registry.push_back(player);
            env.storage().persistent().set(&DataKey::PlayerRegistry, &registry);
        } else {
            panic_with_error!(&env, ContractError::ProfileAlreadyExists);
        }
    }

    // Legacy function for backwards compatibility or simplified registration
    pub fn register_player(env: Env, player: Address, role: String, list_price: i128) {
        player.require_auth();
        // Auto-sets dummy username and bio for the legacy call
        let username = String::from_str(&env, "LegacyPlayer");
        let bio = String::from_str(&env, "ScoutGrid Veteran");
        let achievements = soroban_sdk::vec![&env];

        if !env.storage().persistent().has(&DataKey::Profile(player.clone())) {
            let profile = PlayerProfile {
                username, role, bio, achievements,
                win_points: 0,
                owner: player.clone(),
                original_creator: player.clone(),
                list_price,
                listed: true,
            };
            env.storage().persistent().set(&DataKey::Profile(player.clone()), &profile);
            env.storage().persistent().set(&DataKey::CurrentBid(player.clone()), &0i128);

            // Register for global discovery (Legacy)
            let mut registry: soroban_sdk::Vec<Address> = env.storage().persistent().get(&DataKey::PlayerRegistry).unwrap_or(soroban_sdk::vec![&env]);
            registry.push_back(player);
            env.storage().persistent().set(&DataKey::PlayerRegistry, &registry);
        }
    }

    // Admin adds a win point to the player, increasing their prestige
    pub fn add_win_point(env: Env, player: Address) {
        let admin: Address = env.storage().instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotInitialized));
        admin.require_auth();

        if let Some(mut profile) = env.storage().persistent().get::<_, PlayerProfile>(&DataKey::Profile(player.clone())) {
            profile.win_points += 1;
            env.storage().persistent().set(&DataKey::Profile(player), &profile);
        } else {
            panic!("Player not found");
        }
    }

    // A guild places a bargain bid — must be LOWER than the list_price (asking price).
    // This refunds the previous bidder and locks the new bid in the contract.
    pub fn place_bid(env: Env, bidder: Address, player: Address, amount: i128) {
        bidder.require_auth();

        if amount <= 0 {
            panic_with_error!(&env, ContractError::InvalidAmount);
        }

        let profile: PlayerProfile = env.storage()
            .persistent()
            .get(&DataKey::Profile(player.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotRegistered));

        if amount >= profile.list_price {
            // Bargain mechanic: bids must be below list_price.
            // Use buyout() to pay the full asking price instantly.
            panic_with_error!(&env, ContractError::BidTooLow);
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::MarketToken).unwrap();
        let client = token::Client::new(&env, &token_addr);

        // Lock the new bidder's XLM in the contract
        client.transfer(&bidder, &env.current_contract_address(), &amount);

        // Refund the previous bidder if there was one
        let current_bid: i128 = env.storage()
            .persistent()
            .get(&DataKey::CurrentBid(player.clone()))
            .unwrap_or(0);

        if current_bid > 0 {
            let previous_bidder: Address = env.storage()
                .persistent()
                .get(&DataKey::CurrentBidder(player.clone()))
                .unwrap();
            client.transfer(&env.current_contract_address(), &previous_bidder, &current_bid);
        }

        // Update to new bid
        env.storage().persistent().set(&DataKey::CurrentBidder(player.clone()), &bidder);
        env.storage().persistent().set(&DataKey::CurrentBid(player), &amount);
    }

    // The current owner accepts the current standing bid, applying royalties automatically
    pub fn accept_bid(env: Env, player: Address) {
        let mut profile: PlayerProfile = env.storage()
            .persistent()
            .get(&DataKey::Profile(player.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotRegistered));
        profile.owner.require_auth();

        let current_bid: i128 = env.storage()
            .persistent()
            .get(&DataKey::CurrentBid(player.clone()))
            .unwrap_or(0);

        if current_bid == 0 {
            panic_with_error!(&env, ContractError::NoActiveBid);
        }

        let current_bidder: Address = env.storage()
            .persistent()
            .get(&DataKey::CurrentBidder(player.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NoActiveBid));

        let token_addr: Address = env.storage().instance().get(&DataKey::MarketToken).unwrap();
        let client = token::Client::new(&env, &token_addr);

        let royalty_cut = current_bid / 10;
        let seller_cut = current_bid - royalty_cut;

        if profile.owner == profile.original_creator {
            client.transfer(&env.current_contract_address(), &profile.owner, &current_bid);
        } else {
            client.transfer(&env.current_contract_address(), &profile.original_creator, &royalty_cut);
            client.transfer(&env.current_contract_address(), &profile.owner, &seller_cut);
        }

        // 4. Update ownership, reflect accepted price, and UNLIST
        profile.owner = current_bidder;
        profile.list_price = current_bid;
        profile.listed = false;
        env.storage().persistent().set(&DataKey::Profile(player.clone()), &profile);

        env.storage().persistent().set(&DataKey::CurrentBid(player.clone()), &0i128);
        env.storage().persistent().remove(&DataKey::CurrentBidder(player));
    }

    // Direct Buyout: Buyer pays list_price to get the profile immediately
    pub fn buyout(env: Env, buyer: Address, player: Address) {
        buyer.require_auth();

        let mut profile: PlayerProfile = env.storage()
            .persistent()
            .get(&DataKey::Profile(player.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotRegistered));

        let amount = profile.list_price;
        if amount <= 0 {
            panic_with_error!(&env, ContractError::InvalidAmount);
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::MarketToken).unwrap();
        let client = token::Client::new(&env, &token_addr);

        let royalty_cut = amount / 10;
        let seller_cut = amount - royalty_cut;

        if profile.owner == profile.original_creator {
            client.transfer(&buyer, &profile.owner, &amount);
        } else {
            client.transfer(&buyer, &profile.original_creator, &royalty_cut);
            client.transfer(&buyer, &profile.owner, &seller_cut);
        }

        // Refund any existing bargain bidder
        let current_bid: i128 = env.storage()
            .persistent()
            .get(&DataKey::CurrentBid(player.clone()))
            .unwrap_or(0);
        
        if current_bid > 0 {
            let previous_bidder: Address = env.storage()
                .persistent()
                .get(&DataKey::CurrentBidder(player.clone()))
                .unwrap();
            client.transfer(&env.current_contract_address(), &previous_bidder, &current_bid);
        }

        // 4. Update ownership and UNLIST
        profile.owner = buyer.clone();
        profile.listed = false; // Sold!
        env.storage().persistent().set(&DataKey::Profile(player.clone()), &profile);

        env.storage().persistent().set(&DataKey::CurrentBid(player.clone()), &0i128);
        env.storage().persistent().remove(&DataKey::CurrentBidder(player));
    }

    // Read the current bid amount for a player (for the frontend to display)
    pub fn get_current_bid(env: Env, player: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::CurrentBid(player))
            .unwrap_or(0)
    }

    // Read function for the frontend to query player profile
    pub fn get_profile(env: Env, player: Address) -> PlayerProfile {
        env.storage()
            .persistent()
            .get(&DataKey::Profile(player))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotRegistered))
    }

    // Read function to get user IGN
    pub fn get_username(env: Env, user: Address) -> String {
        env.storage()
            .persistent()
            .get(&DataKey::Registration(user))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotRegistered))
    }

    // Returns all player addresses that have minted a profile
    pub fn get_all_player_addresses(env: Env) -> soroban_sdk::Vec<Address> {
        env.storage()
            .persistent()
            .get(&DataKey::PlayerRegistry)
            .unwrap_or(soroban_sdk::vec![&env])
    }

    // High-performance sync: Gets everything in ONE call
    pub fn get_all_market_items(env: Env) -> soroban_sdk::Vec<MarketItem> {
        let addresses = Self::get_all_player_addresses(env.clone());
        let mut items = soroban_sdk::vec![&env];

        for player in addresses.iter() {
            if let Some(profile) = env.storage().persistent().get::<DataKey, PlayerProfile>(&DataKey::Profile(player.clone())) {
                let current_bid = env.storage().persistent().get(&DataKey::CurrentBid(player.clone())).unwrap_or(0);
                let current_bidder = env.storage().persistent().get(&DataKey::CurrentBidder(player.clone()));
                
                // Only include in market items if LISTED
                if profile.listed {
                    items.push_back(MarketItem {
                        player,
                        profile,
                        current_bid,
                        current_bidder,
                    });
                }
            }
        }
        items
    }

    // ─── Loan Functions ───────────────────────────────────────────────────────

    // Admin (or any sponsor) deposits XLM into the lending pool
    pub fn fund_pool(env: Env, funder: Address, amount: i128) {
        funder.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, ContractError::InvalidAmount);
        }
        let token_addr: Address = env.storage().instance().get(&DataKey::MarketToken)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotInitialized));
        let client = token::Client::new(&env, &token_addr);
        client.transfer(&funder, &env.current_contract_address(), &amount);
        let pool: i128 = env.storage().persistent().get(&DataKey::LoanPool).unwrap_or(0);
        env.storage().persistent().set(&DataKey::LoanPool, &(pool + amount));
    }

    // Owner locks their player contract as collateral and borrows XLM from the pool
    pub fn take_loan(env: Env, borrower: Address, player: Address, amount: i128) {
        borrower.require_auth();
        if amount <= 0 {
            panic_with_error!(&env, ContractError::InvalidAmount);
        }
        let mut profile: PlayerProfile = env.storage().persistent()
            .get(&DataKey::Profile(player.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotRegistered));
        if profile.owner != borrower {
            panic_with_error!(&env, ContractError::CollateralNotOwned);
        }
        if env.storage().persistent().has(&DataKey::LoanRecord(player.clone())) {
            panic_with_error!(&env, ContractError::LoanAlreadyExists);
        }
        let ltv = compute_max_ltv(profile.win_points);
        let max_borrow = profile.list_price * ltv as i128 / 100;
        if amount > max_borrow {
            panic_with_error!(&env, ContractError::ExceedsLTV);
        }
        let pool: i128 = env.storage().persistent().get(&DataKey::LoanPool).unwrap_or(0);
        if amount > pool {
            panic_with_error!(&env, ContractError::InsufficientPool);
        }
        let token_addr: Address = env.storage().instance().get(&DataKey::MarketToken).unwrap();
        let client = token::Client::new(&env, &token_addr);
        client.transfer(&env.current_contract_address(), &borrower, &amount);
        let current_ledger = env.ledger().sequence();
        let loan = LoanRecord {
            borrower: borrower.clone(),
            principal: amount,
            start_ledger: current_ledger,
            due_ledger: current_ledger + LOAN_DURATION_LEDGERS,
        };
        env.storage().persistent().set(&DataKey::LoanRecord(player.clone()), &loan);
        env.storage().persistent().set(&DataKey::LoanPool, &(pool - amount));
        // Lock the collateral — cannot be sold while pledged
        profile.listed = false;
        env.storage().persistent().set(&DataKey::Profile(player), &profile);
    }

    // Borrower repays principal + compound interest to unlock their player contract
    pub fn repay_loan(env: Env, borrower: Address, player: Address) {
        borrower.require_auth();
        let loan: LoanRecord = env.storage().persistent()
            .get(&DataKey::LoanRecord(player.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NoActiveLoan));
        if loan.borrower != borrower {
            panic_with_error!(&env, ContractError::Unauthorized);
        }
        let current_ledger = env.ledger().sequence();
        let elapsed = current_ledger.saturating_sub(loan.start_ledger);
        let terms = ((elapsed + LOAN_DURATION_LEDGERS - 1) / LOAN_DURATION_LEDGERS).max(1);
        // Compound interest: apply INTEREST_RATE_BPS per term
        let mut repayment = loan.principal;
        for _ in 0..terms {
            repayment = repayment + (repayment * INTEREST_RATE_BPS as i128 / 10_000);
        }
        let token_addr: Address = env.storage().instance().get(&DataKey::MarketToken).unwrap();
        let client = token::Client::new(&env, &token_addr);
        client.transfer(&borrower, &env.current_contract_address(), &repayment);
        let pool: i128 = env.storage().persistent().get(&DataKey::LoanPool).unwrap_or(0);
        env.storage().persistent().set(&DataKey::LoanPool, &(pool + repayment));
        env.storage().persistent().remove(&DataKey::LoanRecord(player.clone()));
        // Unlock the collateral — re-list on the market
        let mut profile: PlayerProfile = env.storage().persistent()
            .get(&DataKey::Profile(player.clone()))
            .unwrap();
        profile.listed = true;
        env.storage().persistent().set(&DataKey::Profile(player), &profile);
    }

    // Anyone can liquidate an expired loan — ownership transfers to admin, pool recovers principal
    pub fn liquidate(env: Env, player: Address) {
        let loan: LoanRecord = env.storage().persistent()
            .get(&DataKey::LoanRecord(player.clone()))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NoActiveLoan));
        if env.ledger().sequence() <= loan.due_ledger {
            panic_with_error!(&env, ContractError::LoanNotExpired);
        }
        let admin: Address = env.storage().instance().get(&DataKey::Admin)
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::NotInitialized));
        // Recover principal into pool (collateral covers the debt)
        let pool: i128 = env.storage().persistent().get(&DataKey::LoanPool).unwrap_or(0);
        env.storage().persistent().set(&DataKey::LoanPool, &(pool + loan.principal));
        env.storage().persistent().remove(&DataKey::LoanRecord(player.clone()));
        // Transfer ownership to admin and re-list for community repo auction
        let mut profile: PlayerProfile = env.storage().persistent()
            .get(&DataKey::Profile(player.clone()))
            .unwrap();
        profile.owner = admin;
        profile.listed = true;
        env.storage().persistent().set(&DataKey::Profile(player), &profile);
    }

    pub fn get_loan(env: Env, player: Address) -> Option<LoanRecord> {
        env.storage().persistent().get(&DataKey::LoanRecord(player))
    }

    pub fn get_pool_balance(env: Env) -> i128 {
        env.storage().persistent().get(&DataKey::LoanPool).unwrap_or(0)
    }

    pub fn get_owned_assets(env: Env, owner: Address) -> soroban_sdk::Vec<MarketItem> {
        let addresses = Self::get_all_player_addresses(env.clone());
        let mut items = soroban_sdk::vec![&env];

        for player in addresses.iter() {
            if let Some(profile) = env.storage().persistent().get::<DataKey, PlayerProfile>(&DataKey::Profile(player.clone())) {
                if profile.owner == owner {
                    let current_bid = env.storage().persistent().get(&DataKey::CurrentBid(player.clone())).unwrap_or(0);
                    let current_bidder = env.storage().persistent().get(&DataKey::CurrentBidder(player.clone()));
                    
                    items.push_back(MarketItem {
                        player,
                        profile,
                        current_bid,
                        current_bidder,
                    });
                }
            }
        }
        items
    }
}

#[cfg(test)]
mod test;