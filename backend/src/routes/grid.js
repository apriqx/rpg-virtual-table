const express = require('express');
const router = express.Router();
const { getGridConfig, updateGridConfig } = require('../controllers/gridController');
const auth = require('../middleware/auth');
const { requireMaster, isTableMember } = require('../middleware/permissions');

router.get('/:tableId/maps/:mapId/grid', auth, isTableMember, getGridConfig);
router.put('/:tableId/maps/:mapId/grid', auth, requireMaster, updateGridConfig);

module.exports = router;
