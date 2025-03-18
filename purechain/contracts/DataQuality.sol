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
        mapping(string => bool) submittedIds; 
    }

    mapping(address => User) public users;
    mapping(string => string) public dataHashes; 
    address[] public userAddresses;

    event UserPenalized(address indexed user, string uniqueId);
    event DataSubmitted(address indexed user, string uniqueId, string ipfsHash);
    event UserBlacklisted(address indexed user, string uniqueId);
    event UserRewarded(address indexed user, string uniqueId, uint256 reputationGain);

    uint256 public constant INITIAL_REPUTATION = 1;
    int256 public constant REPUTATION_LOSS = 1;
    uint256 public constant REPUTATION_GAIN = 2;

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

        require(!user.submittedIds[uniqueId], "Duplicate submission");
        user.submittedIds[uniqueId] = true;

        dataHashes[uniqueId] = ipfsHash;
        user.submissionCount++;
        user.reputation += int256(REPUTATION_GAIN);
        
        emit DataSubmitted(msg.sender, uniqueId, ipfsHash);
        emit UserRewarded(msg.sender, uniqueId, REPUTATION_GAIN);
    }

    function penalizeUser(string memory uniqueId) public notBlacklisted {
        User storage user = users[msg.sender];
        require(user.submittedIds[uniqueId], "Submission not found");

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

    function getReputation() public view returns (int256) {
        return users[msg.sender].reputation;
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
        User storage user = users[userAddress]; // Use storage to reference the struct
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