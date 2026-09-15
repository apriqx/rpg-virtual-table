const express = require('express');
const router = express.Router();
const { getCharacters, getCharacter, createCharacter, updateCharacter, deleteCharacter } = require('../controllers/characterController');
const auth = require('../middleware/auth');
const { isTableMember, requireMaster } = require('../middleware/permissions');

router.get('/:tableId/characters', auth, isTableMember, getCharacters);
router.get('/:tableId/characters/:characterId', auth, isTableMember, getCharacter);
router.post('/:tableId/characters', auth, isTableMember, createCharacter);
router.put('/:tableId/characters/:characterId', auth, isTableMember, updateCharacter);
router.delete('/:tableId/characters/:characterId', auth, isTableMember, deleteCharacter);

module.exports = router;