/* ============================================
   FILE: obsidian.js
   PATH: bridge/obsidian.js
   VERSION: 2.2.4
   DESCRIPTION: Obsidian vault sync — reads from webapp API, writes .md files, tag folders, closed detection.
   ============================================ */

const fs = require('fs');
const path = require('path');

const ACTIVE_DIR = '📁 Active Monitoring';
const CLOSED_DIR = '📁 Closed WOs';

function ensureFolders(vaultPath, tags) {
  const base = path.join(vaultPath, ACTIVE_DIR);
  if (!fs.existsSync(base)) fs.mkdirSync(base, { recursive: true });

  // Tag folders
  (tags || []).forEach(tag => {
    const tagFolder = path.join(base, sanitizeFolderName(tag.name));
    if (!fs.existsSync(tagFolder)) fs.mkdirSync(tagFolder, { recursive: true });
  });

  // Closed folder
  const closedBase = path.join(vaultPath, CLOSED_DIR);
  if (!fs.existsSync(closedBase)) fs.mkdirSync(closedBase, { recursive: true });
}

// =====================
// OBSIDIAN SYNC — Webapp data as source
// =====================

async function syncWOs(vaultPath, wos, tagsMap) {
  // wos: flat array from webapp API [{wo_number, property, unit, ..., is_active, category_ids}]
  // tagsMap: { wo_number: [category_names] } resolved by Bridge
  const activeBase = path.join(vaultPath, ACTIVE_DIR);
  const closedBase = path.join(vaultPath, CLOSED_DIR);

  const active = (wos || []).filter(w => w.is_active);
  const closed = (wos || []).filter(w => !w.is_active);

  const activeNumbers = new Set(active.map(w => w.wo_number));
  const closedNumbers = new Set(closed.map(w => w.wo_number));
  const allKnown = new Set([...activeNumbers, ...closedNumbers]);

  // 1. Write/update active WOs in tag folders
  active.forEach(wo => {
    const woTags = tagsMap[wo.wo_number] || [];
    const md = generateMarkdown(wo, woTags);
    const fileName = sanitizeFileName(wo.wo_number) + '.md';

    woTags.forEach(tagName => {
      const tagFolder = path.join(activeBase, sanitizeFolderName(tagName));
      if (!fs.existsSync(tagFolder)) fs.mkdirSync(tagFolder, { recursive: true });
      fs.writeFileSync(path.join(tagFolder, fileName), md, 'utf8');
    });

    if (woTags.length === 0) {
      fs.writeFileSync(path.join(activeBase, fileName), md, 'utf8');
    }
  });

  // 2. Move closed WOs
  closed.forEach(wo => {
    const fileName = sanitizeFileName(wo.wo_number) + '.md';
    const tagFolders = fs.existsSync(activeBase) ? fs.readdirSync(activeBase) : [];
    tagFolders.forEach(folder => {
      const fPath = path.join(activeBase, folder, fileName);
      if (fs.existsSync(fPath)) fs.unlinkSync(fPath);
    });
    const rootPath = path.join(activeBase, fileName);
    if (fs.existsSync(rootPath)) fs.unlinkSync(rootPath);
    const closedMd = generateMarkdown(wo, [], true);
    fs.writeFileSync(path.join(closedBase, fileName), closedMd, 'utf8');
  });

  // 3. Cleanup: remove orphaned files not in any active or closed list
  const tagFolders = fs.existsSync(activeBase) ? fs.readdirSync(activeBase) : [];
  tagFolders.forEach(folder => {
    const folderPath = path.join(activeBase, folder);
    if (!fs.statSync(folderPath).isDirectory()) return;
    const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.md'));
    files.forEach(f => {
      const woNum = f.replace('.md', '');
      if (!allKnown.has(woNum)) {
        fs.unlinkSync(path.join(folderPath, f));
        console.log('[OBSIDIAN] Removed orphan:', f, 'from', folder);
      }
    });
  });
}

function generateMarkdown(wo, tags, isClosed = false) {
  const lines = [];
  lines.push(`# ${wo.wo_number}`);
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push(`| Property | ${wo.property || wo.property_name || ''} |`);
  lines.push(`| Unit | ${wo.unit || ''} |`);
  lines.push(`| Resident | ${wo.primary_resident || ''} |`);
  lines.push(`| Priority | ${wo.priority || ''} |`);
  lines.push(`| Status | ${wo.status || ''} |`);
  lines.push(`| Vendor | ${wo.vendor || ''} |`);
  lines.push(`| Created | ${wo.created_at || ''} |`);
  lines.push(`| Estimate | ${wo.estimate_amount || ''} |`);
  lines.push(`| Approval | ${wo.estimate_approval_status || ''} |`);
  lines.push('');

  if (tags && tags.length) {
    lines.push(`**Tags:** ${tags.map(t => `#${t}`).join(' ')}`);
    lines.push('');
  }

  if (wo.job_description) {
    lines.push('## Description');
    lines.push(wo.job_description);
    lines.push('');
  }

  if (wo.work_order_issue) {
    lines.push('## Issue');
    lines.push(wo.work_order_issue);
    lines.push('');
  }

  if (isClosed) {
    lines.push('---');
    lines.push(`**Status:** CLOSED as of ${new Date().toISOString().split('T')[0]}`);
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Synced from HALQ Bridge — ${new Date().toISOString()}*`);

  return lines.join('\n');
}

function sanitizeFolderName(name) {
  return String(name).replace(/[<>:"/\\|?*]/g, '_').trim() || 'untitled';
}

function sanitizeFileName(name) {
  return String(name).replace(/[<>:"/\\|?*]/g, '_').trim() || 'untitled';
}

module.exports = {
  ensureFolders,
  syncWOs,
  generateMarkdown,
  sanitizeFolderName,
  sanitizeFileName
};