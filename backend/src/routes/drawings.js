const express = require('express');
const router = express.Router();
const { getDrawings, createDrawing, deleteDrawing, clearDrawings } = require('../controllers/drawingController');
const auth = require('../middleware/auth');
const { requireMaster, isTableMember } = require('../middleware/permissions');

router.get('/:tableId/maps/:mapId/drawings', auth, isTableMember, getDrawings);
router.post('/:tableId/maps/:mapId/drawings', auth, requireMaster, createDrawing);
router.delete('/:tableId/maps/:mapId/drawings', auth, requireMaster, clearDrawings);
router.delete('/:tableId/maps/:mapId/drawings/:drawingId', auth, requireMaster, deleteDrawing);

module.exports = router;