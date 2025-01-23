// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract DataQuality {
    struct User {
        string name;
        string organization;
        string uniqueId;
        int256 reputation;
        bool isBlacklisted;
        uint256 submissionCount;
    }

    mapping(address => User) public users;
    mapping(string => string) public dataHashes; // uniqueId => IPFS hash
    address[] public userAddresses;

    event UserPenalized(address indexed user, string uniqueId);
    event DataSubmitted(address indexed user, string uniqueId, string ipfsHash);
    event UserBlacklisted(address indexed user, string uniqueId);

    uint256 public constant INITIAL_REPUTATION = 1;
    int256 public constant REPUTATION_LOSS = 1;

    modifier notBlacklisted() {
        require(!users[msg.sender].isBlacklisted, "User is blacklisted");
        _;
    }

    function submitData(
        string memory name,
        string memory organization,
        string memory uniqueId,
        string memory ipfsHash
    ) public notBlacklisted {
        require(bytes(ipfsHash).length > 0, "IPFS hash required");
        
        User storage user = users[msg.sender];
        
        if (user.submissionCount == 0) {
            // New user
            user.name = name;
            user.organization = organization;
            user.uniqueId = uniqueId;
            user.reputation = int256(INITIAL_REPUTATION);
            userAddresses.push(msg.sender);
        } else {
            // Existing user
            require(
                keccak256(abi.encodePacked(user.uniqueId)) == 
                keccak256(abi.encodePacked(uniqueId)),
                "Unique ID mismatch"
            );
        }

        dataHashes[uniqueId] = ipfsHash;
        user.submissionCount++;
        
        emit DataSubmitted(msg.sender, uniqueId, ipfsHash);
    }

    function penalizeUser(string memory uniqueId) public notBlacklisted {
        User storage user = users[msg.sender];
        require(user.submissionCount > 0, "No submissions to penalize");
        require(
            keccak256(abi.encodePacked(user.uniqueId)) == 
            keccak256(abi.encodePacked(uniqueId)),
            "Unique ID mismatch"
        );

        user.reputation -= REPUTATION_LOSS;
        
        if (user.reputation < 0) {
            user.isBlacklisted = true;
            emit UserBlacklisted(msg.sender, uniqueId);
        }
        
        emit UserPenalized(msg.sender, uniqueId);
    }

    function getUserCount() public view returns (uint256) {
        return userAddresses.length;
    }

    function getUserByAddress(address userAddress) 
        public 
        view 
        returns (
            string memory name,
            string memory organization,
            string memory uniqueId,
            int256 reputation,
            bool isBlacklisted,
            uint256 submissionCount
        ) 
    {
        User memory user = users[userAddress];
        return (
            user.name,
            user.organization,
            user.uniqueId,
            user.reputation,
            user.isBlacklisted,
            user.submissionCount
        );
    }
}