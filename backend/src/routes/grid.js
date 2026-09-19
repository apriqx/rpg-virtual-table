const express = require('express');
const router = express.Router();
const { getGridConfig, updateGridConfig, getFogConfig, updateFogConfig } = require('../controllers/gridController');
const auth = require('../middleware/auth');
const { requireMaster, isTableMember } = require('../middleware/permissions');

router.get('/:tableId/maps/:mapId/grid', auth, isTableMember, getGridConfig);
router.put('/:tableId/maps/:mapId/grid', auth, requireMaster, updateGridConfig);
router.get('/:tableId/maps/:mapId/fog-config', auth, isTableMember, getFogConfig);
router.put('/:tableId/maps/:mapId/fog-config', auth, requireMaster, updateFogConfig);

module.exports = router;
