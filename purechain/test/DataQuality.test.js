const DataQuality = artifacts.require("DataQuality");
const truffleAssert = require("truffle-assertions");
const chai = require("chai");
const expect = chai.expect;

// due config issue if you want run this test using truffle test --config truffle-config.cjs command you need to change in package.json 
// type: "module" remoce


contract("DataQuality", (accounts) => {
  console.log("Loading DataQuality.test.cjs");
  const DataQuality = artifacts.require("DataQuality");
  let instance;
  const [account0, account1, account2] = accounts; // Use multiple accounts for testing

  // Deploy a fresh instance before each test to ensure isolation
  beforeEach(async () => {
    instance = await DataQuality.new();
  });

  // 1. Test User Registration and Initial Data Submission
  it("should register a new user and submit data correctly", async () => {
    const tx = await instance.submitData(
      "John Doe",
      "Test Org",
      "user123",
      "Qm123456789",
      { from: account0 }
    );

    // Verify reputation (1 initial + 2 gain = 3)
    const reputation = await instance.getReputation({ from: account0 });
    expect(reputation.toString()).to.equal("3", "Reputation should be 3 after first submission");

    // Check user details
    const user = await instance.getUserByAddress(account0);
    expect(user.name).to.equal("John Doe", "Name should match");
    expect(user.organization).to.equal("Test Org", "Organization should match");
    expect(user.uniqueId).to.equal("user123", "Unique ID should match");
    expect(user.submissionCount.toString()).to.equal("1", "Submission count should be 1");
    expect(user.isBlacklisted).to.equal(false, "User should not be blacklisted");

    // Verify events
    truffleAssert.eventEmitted(tx, "DataSubmitted", (ev) => {
      return ev.user === account0 && ev.uniqueId === "user123" && ev.ipfsHash === "Qm123456789";
    });
    truffleAssert.eventEmitted(tx, "UserRewarded", (ev) => {
      return ev.user === account0 && ev.uniqueId === "user123" && ev.reputationGain.toString() === "2";
    });
  });

  // 2. Test Duplicate Submission Prevention
  it("should prevent duplicate submissions with the same uniqueId", async () => {
    await instance.submitData("John Doe", "Test Org", "user123", "Qm123456789", { from: account0 });
    await truffleAssert.reverts(
      instance.submitData("John Doe", "Test Org", "user123", "Qm987654321", { from: account0 }),
      "Duplicate submission",
      "Should revert on duplicate submission"
    );
  });

  // 3. Test Initial Reputation for New User
  it("should set initial reputation correctly for a new user", async () => {
    await instance.submitData("Jane Doe", "Test Org", "user456", "Qm987654321", { from: account1 });
    const reputation = await instance.getReputation({ from: account1 });
    expect(reputation.toString()).to.equal("3", "Reputation should be 1 (initial) + 2 (gain)");
  });

  // 4. Test Blacklisting When Reputation Drops Below 0
  it("should blacklist user when reputation drops below 0", async () => {
    await instance.submitData("John Doe", "Test Org", "user123", "Qm123456789", { from: account0 });
    let reputation = await instance.getReputation({ from: account0 });
    expect(reputation.toString()).to.equal("3", "Initial reputation should be 3");

    // Penalize multiple times: 3 -> 2 -> 1 -> 0 -> -1 (blacklist)
    await instance.penalizeUser("user123", { from: account0 });
    reputation = await instance.getReputation({ from: account0 });
    expect(reputation.toString()).to.equal("2", "Reputation should decrease to 2");

    await instance.penalizeUser("user123", { from: account0 });
    reputation = await instance.getReputation({ from: account0 });
    expect(reputation.toString()).to.equal("1", "Reputation should decrease to 1");

    await instance.penalizeUser("user123", { from: account0 });
    reputation = await instance.getReputation({ from: account0 });
    expect(reputation.toString()).to.equal("0", "Reputation should decrease to 0");

    const tx = await instance.penalizeUser("user123", { from: account0 });
    reputation = await instance.getReputation({ from: account0 });
    expect(reputation.toString()).to.equal("-1", "Reputation should be -1");

    const user = await instance.getUserByAddress(account0);
    expect(user.isBlacklisted).to.equal(true, "User should be blacklisted");

    // Verify events
    truffleAssert.eventEmitted(tx, "UserBlacklisted", (ev) => {
      return ev.user === account0 && ev.uniqueId === "user123";
    });
    truffleAssert.eventEmitted(tx, "UserPenalized", (ev) => {
      return ev.user === account0 && ev.uniqueId === "user123";
    });
  });

  // 5. Test Submission Prevention for Blacklisted Users
  it("should prevent data submission when user is blacklisted", async () => {
    await instance.submitData("John Doe", "Test Org", "user123", "Qm123456789", { from: account0 });
    // Blacklist the user
    await instance.penalizeUser("user123", { from: account0 }); // 3 -> 2
    await instance.penalizeUser("user123", { from: account0 }); // 2 -> 1
    await instance.penalizeUser("user123", { from: account0 }); // 1 -> 0
    await instance.penalizeUser("user123", { from: account0 }); // 0 -> -1 (blacklisted)

    await truffleAssert.reverts(
      instance.submitData("John Doe", "Test Org", "user123", "Qm999999999", { from: account0 }),
      "User is blacklisted",
      "Should revert for blacklisted user"
    );
  });

  // 6. Test Unique ID Mismatch for Existing User
  it("should revert on unique ID mismatch for an existing user", async () => {
    await instance.submitData("John Doe", "Test Org", "user123", "Qm123456789", { from: account0 });
    await truffleAssert.reverts(
      instance.submitData("John Doe", "Test Org", "user999", "Qm987654321", { from: account0 }),
      "Unique ID mismatch",
      "Should revert on unique ID mismatch"
    );
  });

  // 7. Test Empty IPFS Hash Rejection
  it("should revert when submitting with an empty IPFS hash", async () => {
    await truffleAssert.reverts(
      instance.submitData("John Doe", "Test Org", "user123", "", { from: account0 }),
      "IPFS hash required",
      "Should revert on empty IPFS hash"
    );
  });

  // 8. Test User Details Retrieval
  it("should return correct user details after submission", async () => {
    await instance.submitData("John Doe", "Test Org", "user123", "Qm123456789", { from: account0 });
    const user = await instance.getUserByAddress(account0);
    expect(user.name).to.equal("John Doe", "Name should match");
    expect(user.organization).to.equal("Test Org", "Organization should match");
    expect(user.uniqueId).to.equal("user123", "Unique ID should match");
    expect(user.reputation.toString()).to.equal("3", "Reputation should be 3");
    expect(user.isBlacklisted).to.equal(false, "User should not be blacklisted");
    expect(user.submissionCount.toString()).to.equal("1", "Submission count should be 1");
  });

  // 9. Test User Count Increment
  it("should increment user count with new users", async () => {
    await instance.submitData("John Doe", "Test Org", "user123", "Qm123456789", { from: account0 });
    await instance.submitData("Jane Doe", "Test Org", "user456", "Qm987654321", { from: account1 });
    const userCount = await instance.getUserCount();
    expect(userCount.toString()).to.equal("2", "User count should be 2");
  });

  // 10. Test Multiple Submissions by Same User
  it("should allow submissions from different users with different uniqueIds and update reputation", async () => {
    await instance.submitData("John Doe", "Test Org", "user123", "Qm123456789", { from: account0 });
    await instance.submitData("Jane Doe", "Test Org", "user124", "Qm987654321", { from: account1 });
    const reputation0 = await instance.getReputation({ from: account0 });
    const reputation1 = await instance.getReputation({ from: account1 });
    expect(reputation0.toString()).to.equal("3", "Reputation for account0 should be 1 (initial) + 2 = 3");
    expect(reputation1.toString()).to.equal("3", "Reputation for account1 should be 1 (initial) + 2 = 3");
    const user0 = await instance.getUserByAddress(account0);
    const user1 = await instance.getUserByAddress(account1);
    expect(user0.submissionCount.toString()).to.equal("1", "Submission count for account0 should be 1");
    expect(user1.submissionCount.toString()).to.equal("1", "Submission count for account1 should be 1");
  });

  // 11. Test Penalize Non-Existent Submission
  it("should revert when penalizing a non-existent submission", async () => {
    await instance.submitData("John Doe", "Test Org", "user123", "Qm123456789", { from: account0 });
    await truffleAssert.reverts(
      instance.penalizeUser("user999", { from: account0 }),
      "Submission not found",
      "Should revert when penalizing non-existent submission"
    );
  });

  // 12. Test Data Hash Storage
  it("should store and retrieve IPFS hash correctly", async () => {
    await instance.submitData("John Doe", "Test Org", "user123", "Qm123456789", { from: account0 });
    const storedHash = await instance.dataHashes("user123");
    expect(storedHash).to.equal("Qm123456789", "Stored IPFS hash should match submitted hash");
  });

  // 13. Test Blacklisted User Cannot Penalize
  it("should prevent blacklisted user from penalizing", async () => {
    await instance.submitData("John Doe", "Test Org", "user123", "Qm123456789", { from: account0 });
    // Blacklist the user
    await instance.penalizeUser("user123", { from: account0 }); // 3 -> 2
    await instance.penalizeUser("user123", { from: account0 }); // 2 -> 1
    await instance.penalizeUser("user123", { from: account0 }); // 1 -> 0
    await instance.penalizeUser("user123", { from: account0 }); // 0 -> -1 (blacklisted)

    await truffleAssert.reverts(
      instance.penalizeUser("user123", { from: account0 }),
      "User is blacklisted",
      "Blacklisted user should not be able to penalize"
    );
  });

  // 14. Test User Details for Non-Registered Address
  it("should return empty details for non-registered address", async () => {
    const user = await instance.getUserByAddress(account2);
    expect(user.name).to.equal("", "Name should be empty for unregistered user");
    expect(user.organization).to.equal("", "Organization should be empty");
    expect(user.uniqueId).to.equal("", "Unique ID should be empty");
    expect(user.reputation.toString()).to.equal("0", "Reputation should be 0");
    expect(user.isBlacklisted).to.equal(false, "User should not be blacklisted");
    expect(user.submissionCount.toString()).to.equal("0", "Submission count should be 0");
  });

  // 15. Test Event Emission Consistency Across Multiple Submissions
  it("should emit events consistently for submissions from different users", async () => {
    const tx1 = await instance.submitData("John Doe", "Test Org", "user123", "Qm123456789", { from: account0 });
    const tx2 = await instance.submitData("Jane Doe", "Test Org", "user124", "Qm987654321", { from: account1 });
  
    truffleAssert.eventEmitted(tx1, "DataSubmitted", (ev) => ev.uniqueId === "user123");
    truffleAssert.eventEmitted(tx1, "UserRewarded", (ev) => ev.reputationGain.toString() === "2");
    truffleAssert.eventEmitted(tx2, "DataSubmitted", (ev) => ev.uniqueId === "user124");
    truffleAssert.eventEmitted(tx2, "UserRewarded", (ev) => ev.reputationGain.toString() === "2");
  });
});