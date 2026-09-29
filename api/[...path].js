const { handleRequest } = require('../server');

module.exports = function homeScoutApi(request, response) {
  return handleRequest(request, response);
};

