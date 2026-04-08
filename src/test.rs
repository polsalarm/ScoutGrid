#![cfg(test)]
mod tests {
    use soroban_sdk::{testutils::Address as _, Address, Env, String};
    use soroban_sdk::token::{StellarAssetClient, Client as TokenClient};
    use crate::{ScoutGridMarket, ScoutGridMarketClient};

    fn setup_env<'a>() -> (Env, ScoutGridMarketClient<'a>, Address, Address, Address, Address, TokenClient<'a>, StellarAssetClient<'a>) {
        let env = Env::default();
        env.mock_all_auths();
        
        let contract_id = env.register(ScoutGridMarket, ());
        let client = ScoutGridMarketClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        let player = Address::generate(&env);
        let guild_a = Address::generate(&env);
        let guild_b = Address::generate(&env);
        
        let token_admin = Address::generate(&env);
        let token_contract = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
        let token_client = TokenClient::new(&env, &token_contract);
        let token_admin_client = StellarAssetClient::new(&env, &token_contract);
        
        // Mint enough XLM for guilds to bargain with
        token_admin_client.mint(&guild_a, &10_000);
        token_admin_client.mint(&guild_b, &10_000);
        
        (env, client, admin, player, guild_a, guild_b, token_client, token_admin_client)
    }

    #[test]
    fn test_1_happy_path_register_and_first_sale() {
        let (env, client, admin, player, guild_a, _, token_client, _) = setup_env();

        client.init(&token_client.address, &admin);

        // Player registers with a list price of 5000 stroops
        let role = String::from_str(&env, "Jungler");
        client.register_player(&player, &role, &5000);

        // Guild A bargains — offers 3000 (below list price of 5000)
        client.place_bid(&guild_a, &player, &3000);
        assert_eq!(token_client.balance(&guild_a), 7000); // 10000 - 3000 locked

        // Player accepts the bargain bid
        client.accept_bid(&player);

        // Player receives full 3000 (first sale)
        assert_eq!(token_client.balance(&player), 3000);

        let profile = client.get_profile(&player);
        assert_eq!(profile.owner, guild_a);
        // List price updated to accepted bid amount
        assert_eq!(profile.list_price, 3000);
    }

    #[test]
    fn test_2_secondary_sale_with_royalty() {
        let (env, client, admin, player, guild_a, guild_b, token_client, _) = setup_env();

        client.init(&token_client.address, &admin);
        let role = String::from_str(&env, "Roamer");
        client.register_player(&player, &role, &5000);

        // First sale: Guild A buys for 3000
        client.place_bid(&guild_a, &player, &3000);
        client.accept_bid(&player); // player gets 3000, guild_a owns it (list_price now 3000)

        // Guild A now owns it with list_price 3000. Guild B bargains at 2000.
        client.place_bid(&guild_b, &player, &2000);
        client.accept_bid(&player); // guild_a is current owner, accepts

        // Secondary: royalty_cut = 2000/10 = 200 to original player
        // seller_cut = 2000 - 200 = 1800 to guild_a
        assert_eq!(token_client.balance(&player), 3200); // 3000 (first) + 200 (royalty)
        assert_eq!(token_client.balance(&guild_a), 10_000 - 3000 + 1800); // 8800

        let profile = client.get_profile(&player);
        assert_eq!(profile.owner, guild_b);
    }

    #[test]
    #[should_panic(expected = "Bid must be LOWER than the list price")]
    fn test_3_bid_at_or_above_list_price_rejected() {
        let (env, client, admin, player, guild_a, _, token_client, _) = setup_env();

        client.init(&token_client.address, &admin);
        let role = String::from_str(&env, "Midlane");
        client.register_player(&player, &role, &5000);

        // Bidding at exactly the list price should panic
        client.place_bid(&guild_a, &player, &5000);
    }

    #[test]
    fn test_4_refund_on_new_bid() {
        let (env, client, admin, player, guild_a, guild_b, token_client, _) = setup_env();

        client.init(&token_client.address, &admin);
        let role = String::from_str(&env, "Goldlane");
        client.register_player(&player, &role, &5000);

        // Guild A bids 3000
        client.place_bid(&guild_a, &player, &3000);
        assert_eq!(token_client.balance(&guild_a), 7000); // locked

        // Guild B bids 2500 (lower = better offer for the player in bargain mode)
        client.place_bid(&guild_b, &player, &2500);

        // Guild A is automatically refunded
        assert_eq!(token_client.balance(&guild_a), 10_000); // fully refunded
        assert_eq!(token_client.balance(&guild_b), 7500);   // 2500 locked

        assert_eq!(client.get_current_bid(&player), 2500);
    }

    #[test]
    #[should_panic]
    fn test_5_edge_case_unauthorized_register() {
        let env = Env::default();
        // No mock_all_auths — player must sign themselves
        let contract_id = env.register(ScoutGridMarket, ());
        let client = ScoutGridMarketClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let player = Address::generate(&env);
        let token = Address::generate(&env);

        client.init(&token, &admin);

        let role = String::from_str(&env, "Support");
        client.register_player(&player, &role, &1000);
    }
}