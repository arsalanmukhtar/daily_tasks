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
const FILE_SIZE_LIMIT = { fileSize: 10 * 1024 * 1024 };

// The generic route below stays unrestricted (any file type) for every
// existing caller - normal leave attachments, late-arrival attachments,
// etc. Emergency-leave documentation is the one upload that must be
// restricted to actual documents, so it's a second multer instance with a
// fileFilter, selected via ?restrict=docs rather than a separate route -
// same disk storage/size limit, just a narrower allowlist.
const DOC_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg']);
const upload = multer({ storage, limits: FILE_SIZE_LIMIT });
const uploadDocsOnly = multer({
  storage,
  limits: FILE_SIZE_LIMIT,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!DOC_EXTENSIONS.has(ext)) return cb(new Error('Only PDF, DOC, DOCX, PNG, or JPG files are allowed.'));
    cb(null, true);
  }
});

// Replaces app.js's uploadAttachmentToDrive_() (app.js:2612-2657) - files
// now live on the VM's disk instead of the requester's Google Drive, since
// sign-in is no longer Google-specific (see PROJECT.md). nginx serves
// `/files/*` straight out of UPLOAD_DIR (see the deploy notes), so this
// route only has to save the file and hand back a stable URL.
attachmentsRouter.post('/', requireAuth, (req, res, next) => {
  const middleware = req.query.restrict === 'docs' ? uploadDocsOnly : upload;
  middleware.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'Could not upload this file.' });
    next();
  });
}, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  res.status(201).json({
    name: req.file.originalname,
    fileId: req.file.filename,
    url: `${process.env.APP_URL || ''}/files/${req.file.filename}`
  });
});
