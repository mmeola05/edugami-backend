function userChannelKey(userId) {
  return `user:${userId}`;
}

function sessionChannelKey(sessionId) {
  return `session:${sessionId}`;
}

function classChannelKey(classId) {
  return `class:${classId}`;
}

module.exports = {
  userChannelKey,
  sessionChannelKey,
  classChannelKey
};
