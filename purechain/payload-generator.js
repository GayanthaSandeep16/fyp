const fs = require('fs');
const path = require('path');

module.exports = {
  generateTestData: (context, ee, next) => {
    context.vars.clerkUserId = "user_2tcqdZbvPiN6VdMH8ntKspbfi02";
    context.vars.walletAddress = "0xDe795b11b4B0Ca22a6B813d6De2d42911eDd6D60";
    context.vars.modelId = "model_1";
    context.vars.csvData = "age,gender,bmi\n25,male,22.1";
    console.log('Generated vars:', context.vars);
    return next();
  },
  logRequest: (requestParams, context, ee, next) => {
    console.log('Request params:', JSON.stringify(requestParams, null, 2));
    return next();
  }
};