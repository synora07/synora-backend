// Format date to readable string
const formatDate = (date) => {
  return new Date(date).toLocaleDateString('de-DE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Generate random ID
const generateId = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

module.exports = {
  formatDate,
  isValidEmail,
  generateId
};