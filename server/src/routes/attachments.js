import crypto from 'node:crypto';
import path from 'node:path';

import { Router } from 'express';
import multer from 'multer';

import { requireAuth } from '../auth.js';

export const attachmentsRouter = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (_req, file, cb) => {
    const id = crypto.randomUUID();
    cb(null, `${id}${path.extname(file.originalname)}`);
  }
});
// Same 10MB-per-file ceiling as the old web app's Drive-upload flow used
// implicitly - keeps one accidental huge upload from filling the VM's disk.
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// Replaces app.js's uploadAttachmentToDrive_() (app.js:2612-2657) - files
// now live on the VM's disk instead of the requester's Google Drive, since
// sign-in is no longer Google-specific (see PROJECT.md). nginx serves
// `/files/*` straight out of UPLOAD_DIR (see the deploy notes), so this
// route only has to save the file and hand back a stable URL.
attachmentsRouter.post('/', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  res.status(201).json({
    name: req.file.originalname,
    fileId: req.file.filename,
    url: `${process.env.APP_URL || ''}/files/${req.file.filename}`
  });
});
