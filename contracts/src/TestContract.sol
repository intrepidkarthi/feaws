// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract TestContract {
    string public message;
    
    constructor() {
        message = "ETHGlobal UNITE - Step 1 Foundation Setup Complete";
    }
    
    function getMessage() external view returns (string memory) {
        return message;
    }
}
