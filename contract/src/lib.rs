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
pub struct MarketItem {
    pub player: Address,
    pub profile: PlayerProfile,
    pub current_bid: i128,
    pub current_bidder: Option<Address>,
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
            // Mechanics: You bargain for a LOWER price than the buyout.
            // If you want to pay list price, you should use a (future) buyout() function.
            // For now, we enforce BARGAIN logic.
            panic_with_error!(&env, ContractError::BidTooLow);
        }

        // Additional Check: Must be higher than existing bid
        let current_bid: i128 = env.storage()
            .persistent()
            .get(&DataKey::CurrentBid(player.clone()))
            .unwrap_or(0);
        
        if amount <= current_bid {
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

        // 4. Update ownership and UNLIST
        profile.owner = current_bidder;
        profile.listed = false; // Sold!
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