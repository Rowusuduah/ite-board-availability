/**
 * USF ITE Board Availability — Google Apps Script Backend
 * =========================================================
 * SETUP INSTRUCTIONS:
 *
 * 1. Go to https://sheets.google.com and create a new Google Sheet.
 *    Name it something like "ITE Board Availability Responses".
 *
 * 2. In the sheet, go to Extensions > Apps Script.
 *
 * 3. Delete any existing code and paste the entire contents of this file.
 *
 * 4. Click Save (Ctrl+S), then click Deploy > New deployment.
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 *    Click Deploy. Authorize the permissions when prompted.
 *
 * 5. Copy the Web app URL that appears after deployment.
 *
 * 6. Open ite_board_availability_LIVE.html and replace:
 *       const GAS_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
 *    with:
 *       const GAS_URL = 'https://script.google.com/macros/s/YOUR_ID/exec';
 *
 * That's it! Responses will now appear in your Google Sheet automatically.
 *
 * NOTE: If you update this script later, go to Deploy > Manage deployments,
 * click the pencil icon, set Version to "New version", and click Deploy.
 * The URL stays the same across re-deployments.
 */

// Name of the sheet tab where responses are stored
const SHEET_NAME = 'Responses';

// ── Handle POST requests (form submissions) ───────────────────────────────────

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = getOrCreateSheet(ss);

    const entry = JSON.parse(e.postData.contents);
    validateEntry(entry); // throws if invalid

    const lastRow = sheet.getLastRow();
    let dupRow = -1;

    // Check for a duplicate email and update that row instead of adding a new one
    if (lastRow > 1) {
      const emails = sheet.getRange(2, 3, lastRow - 1, 1).getValues().flat();
      const idx = emails.indexOf(entry.email.toLowerCase().trim());
      if (idx >= 0) dupRow = idx + 2;
    }

    const rowData = [
      new Date(entry.timestamp),
      entry.name.trim(),
      entry.email.toLowerCase().trim(),
      (entry.slots || []).join('; '),
      (entry.slots || []).length,
      entry.notes || ''
    ];

    if (dupRow > 0) {
      sheet.getRange(dupRow, 1, 1, 6).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    return jsonResponse({ ok: true, updated: dupRow > 0 });

  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ── Handle GET requests (load all responses) ──────────────────────────────────

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet || sheet.getLastRow() <= 1) {
      return jsonResponse({ ok: true, responses: [] });
    }

    const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).getValues();

    const responses = data
      .filter(row => row[2]) // must have an email
      .map(row => ({
        timestamp: row[0] instanceof Date ? row[0].toISOString() : new Date().toISOString(),
        name:      String(row[1] || ''),
        email:     String(row[2] || ''),
        slots:     row[3] ? String(row[3]).split('; ').filter(Boolean) : [],
        notes:     String(row[5] || '')
      }));

    return jsonResponse({ ok: true, responses });

  } catch (err) {
    return jsonResponse({ ok: false, error: err.message, responses: [] });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOrCreateSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    const headers = ['Timestamp', 'Name', 'Email', 'Available Slots', '# Slots', 'Notes'];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setColumnWidths(1, 6, [160, 180, 220, 420, 70, 280]);
  }
  return sheet;
}

function validateEntry(entry) {
  if (!entry.name)  throw new Error('Name is required');
  if (!entry.email) throw new Error('Email is required');
  if (!entry.email.includes('@')) throw new Error('Invalid email');
  if (!Array.isArray(entry.slots) || entry.slots.length === 0) {
    throw new Error('At least one slot is required');
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
