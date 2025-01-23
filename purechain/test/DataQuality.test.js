const DataQuality = artifacts.require("DataQuality");

contract("DataQuality", (accounts) => {
  let instance;
  const [owner, user] = accounts;

  beforeEach(async () => {
    instance = await DataQuality.new();
  });

  it("should penalize user on invalid submission", async () => {
    // First submit valid data to establish reputation
    await instance.submitData(
      "John Doe",
      "TestOrg",
      "123",
      "QmValidHash",
      { from: user }
    );

    // Penalize user
    const result = await instance.penalizeUser(
      "123",
      { from: user }
    );

    // Check reputation decrease
    const userData = await instance.users(user);
    assert.equal(userData.reputation, 0, "Reputation not decreased");

    // Check event emission
    const event = result.logs[0];
    assert.equal(event.event, "UserPenalized", "Wrong event emitted");
    assert.equal(event.args.uniqueId, "123", "Incorrect uniqueId");
  });

  it("should blacklist user with negative reputation", async () => {
    // Submit valid data first
    await instance.submitData(
      "John Doe",
      "TestOrg",
      "123",
      "QmValidHash",
      { from: user }
    );

    // Penalize twice (initial reputation = 1)
    await instance.penalizeUser("123", { from: user });
    const result = await instance.penalizeUser("123", { from: user });

    const userData = await instance.users(user);
    assert.isTrue(userData.isBlacklisted, "User not blacklisted");
    assert.equal(userData.reputation, -1, "Reputation not updated");
    
    // Check blacklist event
    const blacklistEvent = result.logs.find(e => e.event === "UserBlacklisted");
    assert.exists(blacklistEvent, "Blacklist event not emitted");
  });
});