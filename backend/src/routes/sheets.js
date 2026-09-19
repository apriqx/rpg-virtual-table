const express = require('express');
const router = express.Router();
const { getSheets, createSheet, updateSheet, deleteSheet } = require('../controllers/sheetController');
const auth = require('../middleware/auth');
const { requireMaster, isTableMember } = require('../middleware/permissions');

router.get('/:tableId/sheets', auth, isTableMember, getSheets);
router.post('/:tableId/sheets', auth, requireMaster, createSheet);
router.put('/:tableId/sheets/:sheetId', auth, requireMaster, updateSheet);
router.delete('/:tableId/sheets/:sheetId', auth, requireMaster, deleteSheet);

module.exports = router;
