module.exports = {
  apiKey: process.env.MESOMB_API_KEY,
  appKey: process.env.MESOMB_APP_KEY,
  secretKey: process.env.MESOMB_SECRET_KEY,
  baseURL: process.env.MESOMB_BASE_URL || 'https://mesomb.hachther.com/api/v1.1'
};