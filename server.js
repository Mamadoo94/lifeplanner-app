import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import cors from 'cors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and body parsers
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure upload directory exists
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Setup Multer Storage for Trade Screenshot Images
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const originalExt = path.extname(file.originalname).toLowerCase() || '.png';
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(originalExt)
      ? originalExt
      : '.png';
    cb(null, `trade-${uniqueSuffix}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (PNG, JPG, WEBP, GIF) are allowed.'));
    }
  },
});

// 1. Static Route: Serve uploaded images directly at /uploads/...
app.use('/uploads', express.static(uploadDir));

// 2. Image Upload API for desktop browsers and mobile devices
app.post('/api/upload', (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Image upload error:', err);
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded.' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    return res.status(200).json({
      success: true,
      url: imageUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  });
});

// 3. Local/Remote Mobile Data Sync (Sync data across Ubuntu and Mobile PWA)
const syncDataFile = path.join(__dirname, 'public', 'sync-store.json');

app.get('/api/sync', (_req, res) => {
  try {
    if (fs.existsSync(syncDataFile)) {
      const data = fs.readFileSync(syncDataFile, 'utf-8');
      return res.json({ success: true, data: JSON.parse(data) });
    }
    return res.json({ success: true, data: null });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/sync', (req, res) => {
  try {
    fs.writeFileSync(syncDataFile, JSON.stringify(req.body, null, 2), 'utf-8');
    return res.json({ success: true, message: 'Data synced successfully with Ubuntu server.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Server Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    app: 'LifePlanner SMC Trading & Habits PWA',
    server: 'Ubuntu Linux / Node.js Express',
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// 5. Serve Static PWA files from dist or public
const staticDistPath = path.join(__dirname, 'dist');
const staticPublicPath = path.join(__dirname, 'public');

if (fs.existsSync(staticDistPath)) {
  app.use(express.static(staticDistPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticDistPath, 'index.html'));
  });
} else {
  app.use(express.static(staticPublicPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(staticPublicPath, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`  LifePlanner Server running at: http://0.0.0.0:${PORT}`);
  console.log(`  - Local Access:     http://localhost:${PORT}`);
  console.log(`  - LAN Mobile Access: http://<UBUNTU_LOCAL_IP>:${PORT}`);
  console.log(`  - Tailscale Access:  http://<TAILSCALE_IP>:${PORT}`);
  console.log(`  - Uploads Folder:    ${uploadDir}`);
  console.log(`=======================================================`);
});
