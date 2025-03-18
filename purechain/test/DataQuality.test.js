const DataQuality = artifacts.require("DataQuality");
const truffleAssert = require("truffle-assertions");
const chai = require("chai");
const expect = chai.expect;

contract("DataQuality", (accounts) => {
  let instance;

  beforeEach(async () => {
    instance = await DataQuality.new();
  });

  it("should register new user and submit data", async () => {
    await instance.submitData(
      "John Doe",
      "Test Org",
      "user123",
      "Qm123456789",
      { from: accounts[0] }
    );
    const reputation = await instance.getReputation({ from: accounts[0] });
    expect(reputation.toString()).to.equal("3");
  });

  it("should prevent duplicate submissions", async () => {
    await instance.submitData(
      "John Doe",
      "Test Org",
      "user123",
      "Qm123456789",
      { from: accounts[0] }
    );
    await truffleAssert.reverts(
      instance.submitData(
        "John Doe",
        "Test Org",
        "user123",
        "Qm123456789",
        { from: accounts[0] }
      ),
      "Duplicate submission"
    );
  });

  it("should set initial reputation for new user", async () => {
    await instance.submitData(
      "Jane Doe",
      "Test Org",
      "user456",
      "Qm987654321",
      { from: accounts[1] }
    );
    const reputation = await instance.getReputation({ from: accounts[1] });
    expect(reputation.toString()).to.equal("3"); // 1 (initial) + 2 (gain)
  });

  it("should blacklist user when reputation drops below 0", async () => {
    await instance.submitData(
      "John Doe",
      "Test Org",
      "user123",
      "Qm123456789",
      { from: accounts[0] }
    );
    // Reputation starts at 3 (1 initial + 2 gain)
    await instance.penalizeUser("user123", { from: accounts[0] }); // -1 = 2
    await instance.penalizeUser("user123", { from: accounts[0] }); // -1 = 1
    await instance.penalizeUser("user123", { from: accounts[0] }); // -1 = 0
    await instance.penalizeUser("user123", { from: accounts[0] }); // -1 = -1 (blacklisted)
    const user = await instance.getUserByAddress(accounts[0]);
    expect(user.isBlacklisted).to.equal(true);
  });

  it("should prevent submission when user is blacklisted", async () => {
    await instance.submitData(
      "John Doe",
      "Test Org",
      "user123",
      "Qm123456789",
      { from: accounts[0] }
    );
    // Lower reputation to -1 and blacklist
    await instance.penalizeUser("user123", { from: accounts[0] });
    await instance.penalizeUser("user123", { from: accounts[0] });
    await instance.penalizeUser("user123", { from: accounts[0] });
    await instance.penalizeUser("user123", { from: accounts[0] });
    await truffleAssert.reverts(
      instance.submitData(
        "John Doe",
        "Test Org",
        "user123",
        "Qm999999999",
        { from: accounts[0] }
      ),
      "User is blacklisted"
    );
  });

  it("should revert on unique ID mismatch for existing user", async () => {
    await instance.submitData(
      "John Doe",
      "Test Org",
      "user123",
      "Qm123456789",
      { from: accounts[0] }
    );
    await truffleAssert.reverts(
      instance.submitData(
        "John Doe",
        "Test Org",
        "user999", // Different uniqueId
        "Qm987654321",
        { from: accounts[0] }
      ),
      "Unique ID mismatch"
    );
  });

  it("should revert on empty IPFS hash", async () => {
    await truffleAssert.reverts(
      instance.submitData(
        "John Doe",
        "Test Org",
        "user123",
        "", // Empty IPFS hash
        { from: accounts[0] }
      ),
      "IPFS hash required"
    );
  });

  it("should return correct user details", async () => {
    await instance.submitData(
      "John Doe",
      "Test Org",
      "user123",
      "Qm123456789",
      { from: accounts[0] }
    );
    const user = await instance.getUserByAddress(accounts[0]);
    expect(user.name).to.equal("John Doe");
    expect(user.organization).to.equal("Test Org");
    expect(user.uniqueId).to.equal("user123");
    expect(user.reputation.toString()).to.equal("3");
    expect(user.isBlacklisted).to.equal(false);
    expect(user.submissionCount.toString()).to.equal("1");
  });

  it("should increment user count with new users", async () => {
    await instance.submitData(
      "John Doe",
      "Test Org",
      "user123",
      "Qm123456789",
      { from: accounts[0] }
    );
    await instance.submitData(
      "Jane Doe",
      "Test Org",
      "user456",
      "Qm987654321",
      { from: accounts[1] }
    );
    const userCount = await instance.getUserCount();
    expect(userCount.toString()).to.equal("2");
  });
});