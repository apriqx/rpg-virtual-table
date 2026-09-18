const express = require('express');
const router = express.Router();
const { uploadMap, getMaps, getMap, updateMap, duplicateMap, deleteMap } = require('../controllers/mapController');
const auth = require('../middleware/auth');
const { requireMaster, isTableMember } = require('../middleware/permissions');
const { upload } = require('../utils/upload');

router.post('/:tableId/maps', auth, requireMaster, upload.single('image'), uploadMap);
router.get('/:tableId/maps', auth, isTableMember, getMaps);
router.get('/:tableId/maps/:mapId', auth, isTableMember, getMap);
router.put('/:tableId/maps/:mapId', auth, requireMaster, upload.single('image'), updateMap);
router.post('/:tableId/maps/:mapId/duplicate', auth, requireMaster, duplicateMap);
router.delete('/:tableId/maps/:mapId', auth, requireMaster, deleteMap);

module.exports = router;
