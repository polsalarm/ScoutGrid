#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, String};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    MarketToken,             // The XLM token address
    Admin,                   // Trusted address to verify and add win points
    Profile(Address),        // Maps a Player's Address to their PlayerProfile
    CurrentBidder(Address),  // Maps a Player's Address to the current (best-offer) bidder
    CurrentBid(Address),     // Maps a Player's Address to the current bid amount
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PlayerProfile {
    pub original_creator: Address, // Used to track who gets the 10% royalty
    pub role: String,              // e.g., "Jungler", "Roamer"
    pub win_points: u32,           // Hardcoded point system that increases value
    pub owner: Address,            // The current guild or player who owns this contract
    pub list_price: i128,          // The asking price in stroops; bids must be below this
}

#[contract]
pub struct ScoutGridMarket;

#[contractimpl]
impl ScoutGridMarket {

    // Initializes the marketplace with the native XLM token and an Admin to verify wins
    pub fn init(env: Env, token: Address, admin: Address) {
        env.storage().instance().set(&DataKey::MarketToken, &token);
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    // A player registers themselves with a list price (their asking price in stroops).
    // Guilds must bid BELOW this price — bargaining mechanic.
    pub fn register_player(env: Env, player: Address, role: String, list_price: i128) {
        player.require_auth();

        if list_price <= 0 {
            panic!("List price must be positive");
        }

        if !env.storage().persistent().has(&DataKey::Profile(player.clone())) {
            let profile = PlayerProfile {
                original_creator: player.clone(),
                role,
                win_points: 0,
                owner: player.clone(),
                list_price,
            };
            env.storage().persistent().set(&DataKey::Profile(player.clone()), &profile);
            env.storage().persistent().set(&DataKey::CurrentBid(player), &0i128);
        }
    }

    // Admin adds a win point to the player, increasing their prestige
    pub fn add_win_point(env: Env, player: Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
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
            panic!("Bid amount must be positive");
        }

        let profile: PlayerProfile = env.storage()
            .persistent()
            .get(&DataKey::Profile(player.clone()))
            .unwrap_or_else(|| panic!("Player not registered"));

        if amount >= profile.list_price {
            panic!("Bid must be LOWER than the list price (bargaining mechanic)");
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
            .unwrap();
        profile.owner.require_auth();

        let current_bid: i128 = env.storage()
            .persistent()
            .get(&DataKey::CurrentBid(player.clone()))
            .unwrap_or(0);

        if current_bid == 0 {
            panic!("No active bids to accept");
        }

        let current_bidder: Address = env.storage()
            .persistent()
            .get(&DataKey::CurrentBidder(player.clone()))
            .unwrap();

        let token_addr: Address = env.storage().instance().get(&DataKey::MarketToken).unwrap();
        let client = token::Client::new(&env, &token_addr);

        let royalty_cut = current_bid / 10;
        let seller_cut = current_bid - royalty_cut;

        if profile.owner == profile.original_creator {
            // First sale: player gets the full amount
            client.transfer(&env.current_contract_address(), &profile.owner, &current_bid);
        } else {
            // Secondary sale: 10% royalty to original player, 90% to current team
            client.transfer(&env.current_contract_address(), &profile.original_creator, &royalty_cut);
            client.transfer(&env.current_contract_address(), &profile.owner, &seller_cut);
        }

        // Transfer ownership to winning bidder
        profile.owner = current_bidder;
        // Update list price to the accepted amount (new market value)
        profile.list_price = current_bid;
        env.storage().persistent().set(&DataKey::Profile(player.clone()), &profile);

        // Reset bid state
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
            .unwrap()
    }
}

#[cfg(test)]
mod test;