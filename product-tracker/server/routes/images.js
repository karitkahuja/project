// server/routes/images.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const IMAGE_DIR = path.join(__dirname, '../public/images');
const VALID_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];

router.get('/:productId', (req, res) => {
  const { productId } = req.params;

  // Try each valid extension
  for (const ext of VALID_EXTENSIONS) {
    const filePath = path.join(IMAGE_DIR, `${productId}.${ext}`);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
  }

  // If no image found
  res.status(404).send('Image not found');
});

module.exports = router;
