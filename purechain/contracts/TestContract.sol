// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract TestContract {
    uint256 public counter;

    constructor() {
        counter = 0;
    }

    function increment() public returns (uint256) {
        require(counter < type(uint256).max, "Counter would overflow");
        counter += 1;
        return counter;
    }

    function getCounter() public view returns (uint256) {
        return counter;
    }
}