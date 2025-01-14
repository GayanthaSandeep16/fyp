// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;


contract DataQuality {
    struct DataSubmission {
        string ipfsHash;           // Hash of data stored in IPFS
        uint256 timestamp;         // Submission timestamp
        address submitter;         // Address of data submitter
        bool validated;            // Validation status
        uint256 qualityScore;     // Data quality score
    }
    
    // Mapping of data submissions
    mapping(string => DataSubmission) public submissions;
    
    // Events
    event DataSubmitted(string ipfsHash, address submitter);
    event DataValidated(string ipfsHash, bool validated, uint256 qualityScore);
    
    // Submit data
    function submitData(string memory ipfsHash) public {
        require(submissions[ipfsHash].submitter == address(0), "Data already exists");
        
        submissions[ipfsHash] = DataSubmission({
            ipfsHash: ipfsHash,
            timestamp: block.timestamp,
            submitter: msg.sender,
            validated: false,
            qualityScore: 0
        });
        
        emit DataSubmitted(ipfsHash, msg.sender);
    }
    
    // Validate data
    function validateData(string memory ipfsHash, bool isValid, uint256 score) public {
        require(submissions[ipfsHash].submitter != address(0), "Data does not exist");
        
        DataSubmission storage submission = submissions[ipfsHash];
        submission.validated = isValid;
        submission.qualityScore = score;
        
        emit DataValidated(ipfsHash, isValid, score);
    }
}
