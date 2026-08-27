const express = require('express');
const router = express.Router();
const {
  getFogRegions, createFogRegion, updateFogRegion,
  deleteFogRegion, batchUpdateFog
} = require('../controllers/fogController');
const auth = require('../middleware/auth');
const { requireMaster, isTableMember } = require('../middleware/permissions');

router.get('/:tableId/maps/:mapId/fog', auth, isTableMember, getFogRegions);
router.post('/:tableId/maps/:mapId/fog', auth, requireMaster, createFogRegion);
router.put('/:tableId/maps/:mapId/fog/:fogId', auth, requireMaster, updateFogRegion);
router.delete('/:tableId/maps/:mapId/fog/:fogId', auth, requireMaster, deleteFogRegion);
router.put('/:tableId/maps/:mapId/fog/batch', auth, requireMaster, batchUpdateFog);

module.exports = router;
