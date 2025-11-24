function isValidCode(code) {
  return /^[A-Za-z0-9]{6,8}$/.test(code);
}

function isValidUrl(u) {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

function isValidEmail(email) {
  // simple but solid email regex for this project
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

module.exports = { isValidCode, isValidUrl, isValidEmail };
