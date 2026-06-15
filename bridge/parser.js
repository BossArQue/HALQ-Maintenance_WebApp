/* ============================================
   FILE: parser.js
   PATH: bridge/parser.js
   VERSION: 2.2.2
   DESCRIPTION: Excel parser — SheetJS, column mapping by header name, dup header skip.
   ============================================ */

const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Column header → field mapping (from work_order-20260615.xlsx)
const HEADER_MAP = {
  'Property': 'property',
  'Priority': 'priority',
  'Work Order Type': 'wo_type',
  'Work Order Number': 'wo_number',
  'Job Description': 'job_description',
  'Status': 'status',
  'Vendor': 'vendor',
  'Unit': 'unit',
  'Unit Number': 'unit',
  'Primary Resident': 'primary_resident',
  'Created At': 'created_at',
  'Estimate Amount': 'estimate_amount',
  'Estimate Approval Status': 'estimate_approval_status',
  'Work Order Issue': 'work_order_issue',
  'Property Name': 'property_name',
  'Property Street Address 1': 'property_address'
};

// Sheet names we look for (in priority order)
const ACTIVE_SHEET_NAMES = ['Active Monitoring', 'ActiveMonitoring', 'Active', 'Work Queue', 'WorkQueue'];
const CLOSED_SHEET_NAMES = ['Closed', 'Closed WOs', 'ClosedWOs'];
const RAW_SHEET_NAMES = ['AppFolio Data', 'AppFolioData', 'AppFolio', 'Raw Data', 'Export'];

function parseFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found: ' + filePath);
  }

  const buf = fs.readFileSync(filePath);
  const workbook = XLSX.read(buf, { type: 'buffer', cellDates: true });

  console.log('[PARSE] Sheets found:', workbook.SheetNames.join(', '));

  const activeWos = [];
  const closedWos = [];
  let parsedAny = false;

  // Try to find Active/Work Queue sheets
  for (const name of ACTIVE_SHEET_NAMES) {
    if (workbook.Sheets[name]) {
      console.log('[PARSE] Parsing active sheet:', name);
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' });
      const wos = _extractWOs(rows);
      console.log('[PARSE]   → extracted', wos.length, 'WOs from', name);
      activeWos.push(...wos);
      parsedAny = true;
    }
  }

  // Try to find Closed sheet
  for (const name of CLOSED_SHEET_NAMES) {
    if (workbook.Sheets[name]) {
      console.log('[PARSE] Parsing closed sheet:', name);
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' });
      const wos = _extractWOs(rows);
      console.log('[PARSE]   → extracted', wos.length, 'closed WOs from', name);
      closedWos.push(...wos);
      parsedAny = true;
    }
  }

  // If no known sheets found, fall back to first sheet (raw export mode)
  if (!parsedAny && workbook.SheetNames.length > 0) {
    const firstSheet = workbook.SheetNames[0];
    console.log('[PARSE] No known sheets found. Falling back to first sheet:', firstSheet);
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { header: 1, defval: '' });
    const wos = _extractWOs(rows);
    console.log('[PARSE]   → extracted', wos.length, 'WOs from raw export');
    activeWos.push(...wos);
  }

  // Deduplicate by wo_number
  const activeMap = new Map();
  activeWos.forEach(wo => { if (wo.wo_number) activeMap.set(wo.wo_number, wo); });

  const closedMap = new Map();
  closedWos.forEach(wo => { if (wo.wo_number) closedMap.set(wo.wo_number, wo); });

  return {
    active: Array.from(activeMap.values()),
    closed: Array.from(closedMap.values()),
    all: Array.from(activeMap.values()).concat(Array.from(closedMap.values()))
  };
}

function _extractWOs(rows) {
  if (!rows || rows.length < 2) {
    console.log('[PARSE]   Not enough rows (need >= 2, got', rows?.length || 0, ')');
    return [];
  }

  let headerRow = rows[0].map(h => String(h).trim());
  console.log('[PARSE]   Headers (row 0):', headerRow.slice(0, 10).join(', ') + (headerRow.length > 10 ? '...' : ''));

  let dataStartIndex = 1;

  // Detect duplicate header row (row 1 matches row 0)
  if (rows.length > 1) {
    const row1 = rows[1].map(h => String(h).trim());
    const isDupHeader = row1.length === headerRow.length &&
      row1.every((val, i) => val === headerRow[i]);
    if (isDupHeader) {
      console.log('[PARSE]   Row 1 is duplicate header — skipping');
      dataStartIndex = 2;
    }
  }

  const colMap = {};
  headerRow.forEach((h, i) => {
    if (HEADER_MAP[h]) colMap[i] = HEADER_MAP[h];
  });

  console.log('[PARSE]   Mapped columns:', Object.entries(colMap).map(([i, f]) => `${headerRow[i]}→${f}`).join(', '));

  if (Object.keys(colMap).length === 0) {
    console.log('[PARSE]   WARNING: No recognized column headers found!');
    console.log('[PARSE]   Looking for:', Object.keys(HEADER_MAP).join(', '));
  }

  const wos = [];
  for (let r = dataStartIndex; r < rows.length; r++) {
    const row = rows[r];

    // Skip property group header rows — real WOs have a Work Order Number
    const woNumIdx = headerRow.indexOf('Work Order Number');
    if (woNumIdx >= 0) {
      const woNum = row[woNumIdx];
      if (!woNum || String(woNum).trim() === '') {
        // This is a property group header row, skip it
        continue;
      }
    }

    const wo = {};
    Object.entries(colMap).forEach(([colIdx, field]) => {
      let val = row[colIdx];
      if (val == null || val === '') return;

      // Parse Excel serial dates
      if (field === 'created_at' && typeof val === 'number') {
        val = _excelSerialToDate(val);
      }

      wo[field] = String(val).trim();
    });

    if (wo.wo_number) {
      wo.is_active = 1;
      wos.push(wo);
    }
  }

  console.log('[PARSE]   Total WOs extracted:', wos.length);
  return wos;
}

function _excelSerialToDate(serial) {
  // Excel epoch is 1899-12-30
  const epoch = new Date(1899, 11, 30);
  const days = Math.floor(serial);
  const fraction = serial - days;
  const ms = days * 86400000 + fraction * 86400000;
  const d = new Date(epoch.getTime() + ms);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

function findNewestExcel(folderPath) {
  if (!fs.existsSync(folderPath)) return null;
  const files = fs.readdirSync(folderPath)
    .filter(f => f.endsWith('.xlsx') || f.endsWith('.xlsm'))
    .map(f => ({
      name: f,
      path: path.join(folderPath, f),
      mtime: fs.statSync(path.join(folderPath, f)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return files[0]?.path || null;
}

module.exports = { parseFile, findNewestExcel };