/* ============================================
   FILE: obsidian.js
   PATH: bridge/obsidian.js
   VERSION: 2.2.5
   DESCRIPTION: Obsidian vault sync — primary tag folders, monthly closed folders, YAML frontmatter.
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

  // Closed base folder
  const closedBase = path.join(vaultPath, CLOSED_DIR);
  if (!fs.existsSync(closedBase)) fs.mkdirSync(closedBase, { recursive: true });
}

// =====================
// OBSIDIAN SYNC — Primary tag folders + monthly closed
// =====================

async function syncWOs(vaultPath, wos, tagsMap) {
  // wos: flat array from webapp API [{wo_number, ..., is_active, category_ids}]
  // tagsMap: { wo_number: [category_names] } resolved by Bridge
  const activeBase = path.join(vaultPath, ACTIVE_DIR);
  const closedBase = path.join(vaultPath, CLOSED_DIR);

  const active = (wos || []).filter(w => w.is_active);
  const closed = (wos || []).filter(w => !w.is_active);

  const activeNumbers = new Set(active.map(w => w.wo_number));
  const closedNumbers = new Set(closed.map(w => w.wo_number));
  const allKnown = new Set([...activeNumbers, ...closedNumbers]);

  // 1. Write/update active WOs in primary tag folder only
  active.forEach(wo => {
    const woTags = tagsMap[wo.wo_number] || [];
    const md = generateMarkdown(wo, woTags);
    const fileName = sanitizeFileName(wo.wo_number) + '.md';

    // Remove from ALL active locations first (handles tag change migration)
    _removeFromAllActiveFolders(activeBase, fileName);

    // Write to primary tag folder (first tag = primary)
    if (woTags.length > 0) {
      const primaryTag = woTags[0];
      const tagFolder = path.join(activeBase, sanitizeFolderName(primaryTag));
      if (!fs.existsSync(tagFolder)) fs.mkdirSync(tagFolder, { recursive: true });
      fs.writeFileSync(path.join(tagFolder, fileName), md, 'utf8');
    } else {
      // No tags — root of active folder
      fs.writeFileSync(path.join(activeBase, fileName), md, 'utf8');
    }
  });

  // 2. Move closed WOs to monthly folder
  closed.forEach(wo => {
    const fileName = sanitizeFileName(wo.wo_number) + '.md';

    // Remove from ALL active locations
    _removeFromAllActiveFolders(activeBase, fileName);

    // Determine close month (YYYY-MM)
    const closeDate = _getCloseDate(wo);
    const monthFolder = closeDate.substring(0, 7); // YYYY-MM
    const monthPath = path.join(closedBase, monthFolder);
    if (!fs.existsSync(monthPath)) fs.mkdirSync(monthPath, { recursive: true });

    const closedMd = generateMarkdown(wo, [], true);
    fs.writeFileSync(path.join(monthPath, fileName), closedMd, 'utf8');
  });

  // 3. Cleanup: remove orphaned active files not in any known list
  const allFolders = fs.existsSync(activeBase) ? fs.readdirSync(activeBase) : [];
  allFolders.forEach(folder => {
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

// Remove a WO file from all active folders (root + subfolders)
function _removeFromAllActiveFolders(activeBase, fileName) {
  // Remove from root
  const rootPath = path.join(activeBase, fileName);
  if (fs.existsSync(rootPath)) fs.unlinkSync(rootPath);

  // Remove from all subfolders
  if (!fs.existsSync(activeBase)) return;
  const folders = fs.readdirSync(activeBase);
  folders.forEach(folder => {
    const folderPath = path.join(activeBase, folder);
    if (!fs.statSync(folderPath).isDirectory()) return;
    const fPath = path.join(folderPath, fileName);
    if (fs.existsSync(fPath)) fs.unlinkSync(fPath);
  });
}

// Get close date: prefer WO data, fallback to today
function _getCloseDate(wo) {
  // Try various date fields from WO
  const d = wo.closed_at || wo.completed_at || wo.close_date || wo.date_closed;
  if (d && typeof d === 'string') {
    // Validate it's a reasonable date string
    const parsed = new Date(d);
    if (!isNaN(parsed.getTime())) return d.split('T')[0];
  }
  // Default: today
  return new Date().toISOString().split('T')[0];
}

function generateMarkdown(wo, tags, isClosed = false) {
  const lines = [];

  // YAML frontmatter — all tags listed for Obsidian search
  lines.push('---');
  lines.push(`wo_number: "${wo.wo_number || ''}"`);
  if (tags && tags.length) {
    lines.push(`tags: [${tags.map(t => `"${t}"`).join(', ')}]`);
  }
  if (wo.priority) lines.push(`priority: "${wo.priority}"`);
  if (wo.status) lines.push(`status: "${wo.status}"`);
  if (wo.vendor) lines.push(`vendor: "${wo.vendor}"`);
  if (wo.property || wo.property_name) {
    lines.push(`property: "${wo.property || wo.property_name || ''}"`);
  }
  if (wo.unit) lines.push(`unit: "${wo.unit}"`);
  if (wo.primary_resident) lines.push(`resident: "${wo.primary_resident}"`);
  if (wo.created_at) lines.push(`created: "${wo.created_at}"`);
  lines.push('---');
  lines.push('');

  // Body
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
