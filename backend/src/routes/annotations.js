const express = require('express');
const router = express.Router();
const { getAnnotations, createAnnotation, updateAnnotation, deleteAnnotation } = require('../controllers/annotationController');
const auth = require('../middleware/auth');
const { requireMaster, isTableMember } = require('../middleware/permissions');

router.get('/:tableId/maps/:mapId/annotations', auth, isTableMember, getAnnotations);
router.post('/:tableId/maps/:mapId/annotations', auth, requireMaster, createAnnotation);
router.put('/:tableId/maps/:mapId/annotations/:annotationId', auth, requireMaster, updateAnnotation);
router.delete('/:tableId/maps/:mapId/annotations/:annotationId', auth, requireMaster, deleteAnnotation);

module.exports = router;