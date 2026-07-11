const serverless = require('serverless-http');
const app = require('../../server'); // pointing to server.js in root

module.exports.handler = serverless(app);
