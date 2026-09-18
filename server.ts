import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';

const app = express();
const httpServer = http.createServer(app);
const PORT = 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure uploads directory exists in both public/uploads and dist/uploads
const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration for trade screenshot images
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    // Generate clean, safe timestamped filename
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
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max limit
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('فقط فایل‌های تصویری (PNG, JPG, WEBP) مجاز هستند.'));
    }
  },
});

// 1. Static Route: Serve uploaded chart images
app.use('/uploads', express.static(uploadDir));

// 2. API Route: Upload Image endpoint for desktop and mobile
app.post('/api/upload', (req, res) => {
  upload.single('image')(req, res, (err: any) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({
        success: false,
        error: err.message || 'خطا در بارگذاری تصویر',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'هیچ فایلی ارسال نشده است.',
      });
    }

    // Public URL accessible through server
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

// 3. API Route: Sync endpoint for multi-device sync (Ubuntu server <-> Mobile PWA)
const syncDataFile = path.join(process.cwd(), 'public', 'sync-store.json');

app.get('/api/sync', (_req, res) => {
  try {
    if (fs.existsSync(syncDataFile)) {
      const data = fs.readFileSync(syncDataFile, 'utf-8');
      return res.json({ success: true, data: JSON.parse(data) });
    }
    return res.json({ success: true, data: null });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/sync', (req, res) => {
  try {
    const payload = req.body;
    fs.writeFileSync(syncDataFile, JSON.stringify(payload, null, 2), 'utf-8');
    return res.json({ success: true, message: 'داده‌ها با سرور اوبونتو همگام‌سازی شدند.' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// 4. API Route: Health & Server status
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    app: 'LifePlanner SMC Trading & Habits PWA',
    server: 'Ubuntu Linux / Node.js Express',
    port: PORT,
    timestamp: new Date().toISOString(),
  });
});

// 5. Vite Middleware (Dev) or Static Assets (Prod)
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 LifePlanner server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
