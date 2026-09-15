const express = require('express');
const router = express.Router();
const { getMessages, createMessage, clearMessages } = require('../controllers/chatController');
const auth = require('../middleware/auth');
const { isTableMember } = require('../middleware/permissions');
const { requireMaster } = require('../middleware/permissions');

router.get('/:tableId/chat', auth, isTableMember, getMessages);
router.post('/:tableId/chat', auth, isTableMember, createMessage);
router.delete('/:tableId/chat', auth, requireMaster, clearMessages);

module.exports = router;