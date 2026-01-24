const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const chatController = require('../controllers/chatController');

// Send message - OHNE AUTH für Testing
router.post('/', chatController.sendMessage);

// Get chat history - MIT AUTH
router.get('/history', auth, chatController.getChatHistory);

// Delete chat history - MIT AUTH
router.delete('/history/:id?', auth, chatController.deleteChatHistory);

// Get preferences - MIT AUTH
router.get('/preferences', auth, chatController.getPreferences);

// Save preferences - MIT AUTH
router.post('/preferences', auth, chatController.savePreferences);

module.exports = router;