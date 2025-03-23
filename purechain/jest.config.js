module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest', // Transform .js files using babel-jest
  },
  testPathIgnorePatterns: ['/test/'], // Ignore DataQuality.test.js

  // The critical piece: load this setup file before running tests
  setupFiles: ['<rootDir>/jest.setup.js'],
};
