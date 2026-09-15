const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { upload, cloudinaryEnabled, uploadToCloudinary, removeLocalFile } = require('../utils/upload');

router.post('/', auth, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  if (cloudinaryEnabled) {
    try {
      const result = await uploadToCloudinary(req.file.path, req.file.originalname);
      removeLocalFile(req.file.path);
      return res.status(201).json({ url: result.secure_url });
    } catch (e) {
      removeLocalFile(req.file.path);
      console.error('Cloudinary upload falhou:', e.message);
      return res.status(500).json({ error: 'Erro no upload para a nuvem' });
    }
  }
  res.status(201).json({ url: '/uploads/' + req.file.filename });
});

module.exports = router;
