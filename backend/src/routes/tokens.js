const express = require('express');
const router = express.Router();
const {
  createToken, getTokens, updateToken, deleteToken,
  setTokenPermissions, getTokenPermissions
} = require('../controllers/tokenController');
const auth = require('../middleware/auth');
const { requireMaster, isTableMember, canModifyToken } = require('../middleware/permissions');

router.post('/:tableId/maps/:mapId/tokens', auth, requireMaster, createToken);
router.get('/:tableId/maps/:mapId/tokens', auth, isTableMember, getTokens);
router.put('/:tableId/maps/:mapId/tokens/:tokenId', auth, canModifyToken, updateToken);
router.delete('/:tableId/maps/:mapId/tokens/:tokenId', auth, canModifyToken, deleteToken);
router.put('/:tableId/maps/:mapId/tokens/:tokenId/permissions', auth, requireMaster, setTokenPermissions);
router.get('/:tableId/maps/:mapId/tokens/:tokenId/permissions', auth, isTableMember, getTokenPermissions);

module.exports = router;
