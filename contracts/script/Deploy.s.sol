// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {ScoutGridMarket} from "../src/ScoutGridMarket.sol";

/// @notice Deploys ScoutGridMarket to whichever chain --rpc-url points at.
///         Usage:
///           forge script script/Deploy.s.sol --rpc-url fuji --broadcast --verify -vvvv
///         Env vars required:
///           PRIVATE_KEY   — deployer key (becomes the contract admin unless ADMIN_ADDRESS is set)
///           ADMIN_ADDRESS — optional; defaults to the deployer address
contract Deploy is Script {
    function run() external returns (ScoutGridMarket market) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address admin = vm.envOr("ADMIN_ADDRESS", deployer);

        vm.startBroadcast(deployerKey);
        market = new ScoutGridMarket(admin);
        vm.stopBroadcast();

        console.log("ScoutGridMarket deployed at:", address(market));
        console.log("Admin:", admin);
    }
}
