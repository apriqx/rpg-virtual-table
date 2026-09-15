const express = require('express');
const router = express.Router();
const {
  createTable, getTables, getTable, updateTable, deleteTable,
  addMember, removeMember, updateMemberRole, muteMember, spotlight
} = require('../controllers/tableController');
const { exportTable, importTable } = require('../controllers/backupController');
const auth = require('../middleware/auth');
const { requireMaster, isTableMember } = require('../middleware/permissions');

router.post('/', auth, createTable);
router.get('/', auth, getTables);
router.get('/:tableId', auth, isTableMember, getTable);
router.put('/:tableId', auth, requireMaster, updateTable);
router.delete('/:tableId', auth, requireMaster, deleteTable);
router.post('/:tableId/members', auth, requireMaster, addMember);
router.delete('/:tableId/members/:userId', auth, requireMaster, removeMember);
router.put('/:tableId/members/:userId', auth, requireMaster, updateMemberRole);
router.put('/:tableId/members/:userId/mute', auth, requireMaster, muteMember);
router.post('/:tableId/spotlight', auth, requireMaster, spotlight);
router.get('/:tableId/export', auth, requireMaster, exportTable);
router.post('/:tableId/import', auth, requireMaster, importTable);

module.exports = router;