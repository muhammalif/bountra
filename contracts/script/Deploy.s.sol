// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {BountraEscrow} from "../src/BountraEscrow.sol";

contract DeployScript is Script {
    function run() external returns (BountraEscrow escrow) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address agentSigner = vm.envAddress("AGENT_SIGNER");

        vm.startBroadcast(deployerPrivateKey);

        escrow = new BountraEscrow(agentSigner);
        console.log("BountraEscrow deployed at:", address(escrow));
        console.log("Agent Signer set to:", agentSigner);

        vm.stopBroadcast();
    }
}
