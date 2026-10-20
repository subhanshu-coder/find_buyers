/**
 * HomeScout Sent Email → Google Sheet logger.
 * Bound to the user's spreadsheet. Logs only messages sent from the connected
 * Gmail account whose subject starts with the HomeScout draft pattern.
 */
const HOMESCOUT_SPREADSHEET_ID = '1TpqpbO9_cYFGDcFqIVidmvJR2lm5ply4ok-TFmP6H_I';
const HOMESCOUT_TARGET_SHEET_ID = 1211719026;
const HOMESCOUT_TARGET_TAB_URL = 'https://docs.google.com/spreadsheets/d/' + HOMESCOUT_SPREADSHEET_ID + '/edit?gid=' + HOMESCOUT_TARGET_SHEET_ID;
const HOMESCOUT_HEADERS = ['PRODUCT NAME', 'DATE', 'NAME OF THE COMPANY'];
const HOMESCOUT_EMAIL_HEADERS = ['EMAIL', 'EMAIL ADDRESS'];
const HOMESCOUT_PRODUCTS = [
  'Decorative glassware and home decor',
  'Crystal candle holders',
  'Votive candle holders',
  'Singing bowls',
  'Candle holders'
];
const HOMESCOUT_SUBJECT_PREFIX = 'A thoughtful fit for ';
const HOMESCOUT_SYNC_KEY_HEADER = '_HOMESCOUT_GMAIL_MESSAGE_RECIPIENT';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('HomeScout')
    .addItem('Set up automatic sent-email logging', 'setupHomeScoutSentLogger')
    .addItem('Sync sent emails now', 'syncHomeScoutSentEmails')
    .addToUi();
}

function setupHomeScoutSentLogger() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Open this bound script from the target Google Sheet first.');
  if (spreadsheet.getId() !== HOMESCOUT_SPREADSHEET_ID) {
    throw new Error('Open the script from the target spreadsheet: ' + HOMESCOUT_TARGET_TAB_URL);
  }
  const sheet = getHomeScoutTargetSheet_(spreadsheet);
  if (!sheet) throw new Error('Could not find the target tab (gid ' + HOMESCOUT_TARGET_SHEET_ID + ').');
  verifyHomeScoutHeaders_(sheet);

  const properties = PropertiesService.getScriptProperties();
  properties.setProperty('HOMESCOUT_SPREADSHEET_ID', HOMESCOUT_SPREADSHEET_ID);
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === 'syncHomeScoutSentEmails')
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger('syncHomeScoutSentEmails').timeBased().everyMinutes(5).create();

  const result = syncHomeScoutSentEmails();
  SpreadsheetApp.getUi().alert(
    'HomeScout sync is installed. Matching messages in Gmail Sent will be checked every five minutes.\n\n' +
    'Added now: ' + result.added + '\nAlready recorded or not a new row: ' + result.skipped
  );
}

function syncHomeScoutSentEmails() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return syncHomeScoutSentEmailsLocked_();
  } finally {
    lock.releaseLock();
  }
}

function syncHomeScoutSentEmailsLocked_() {
  const spreadsheetId = PropertiesService.getScriptProperties().getProperty('HOMESCOUT_SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('Run setupHomeScoutSentLogger from the spreadsheet first.');
  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheet = getHomeScoutTargetSheet_(spreadsheet);
  if (!sheet) throw new Error('Could not find the target tab (gid ' + HOMESCOUT_TARGET_SHEET_ID + ').');
  verifyHomeScoutHeaders_(sheet);

  const syncColumn = getHomeScoutSyncColumn_(sheet);
  const lastRow = sheet.getLastRow();
  const existingRows = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 4).getValues() : [];
  const syncValues = lastRow > 1 ? sheet.getRange(2, syncColumn, lastRow - 1, 1).getValues() : [];
  const seenKeys = new Set();
  const existingByRowKey = new Map();
  const timeZone = spreadsheet.getSpreadsheetTimeZone() || 'Asia/Kolkata';

  existingRows.forEach((row, index) => {
    const syncKey = String(syncValues[index]?.[0] || '');
    if (syncKey) seenKeys.add(syncKey);
    const key = makeHomeScoutRowKey_(row[0], row[1], row[2], row[3], timeZone);
    if (key) {
      if (!existingByRowKey.has(key)) existingByRowKey.set(key, []);
      existingByRowKey.get(key).push(index);
    }
  });

  const ownAddresses = new Set([
    Session.getEffectiveUser().getEmail(),
    ...GmailApp.getAliases()
  ].map(value => String(value || '').toLowerCase()).filter(Boolean));
  const threads = GmailApp.search('in:sent subject:"A thoughtful fit for"', 0, 500);
  const rowsToAppend = [];
  const idsToAppend = [];
  const updatedSyncValues = syncValues.map(value => [value[0] || '']);
  let skipped = 0;

  threads.forEach(thread => thread.getMessages().forEach(message => {
    const from = extractHomeScoutEmails_(message.getFrom())[0]?.toLowerCase() || '';
    if (!ownAddresses.has(from)) return;
    const parsed = parseHomeScoutSubject_(message.getSubject());
    if (!parsed) return;
    const recipients = extractHomeScoutEmails_(message.getTo());
    if (!recipients.length) return;

    recipients.forEach(email => {
      const syncKey = message.getId() + '|' + email.toLowerCase();
      if (seenKeys.has(syncKey)) { skipped++; return; }
      const date = message.getDate();
      const rowKey = makeHomeScoutRowKey_(parsed.product, date, parsed.company, email, timeZone);
      const matchingRows = existingByRowKey.get(rowKey) || [];
      const unusedMatch = matchingRows.find(index => !updatedSyncValues[index]?.[0]);
      if (unusedMatch !== undefined) {
        updatedSyncValues[unusedMatch][0] = syncKey;
        seenKeys.add(syncKey);
        skipped++;
        return;
      }
      rowsToAppend.push([parsed.product, date, parsed.company, email]);
      idsToAppend.push([syncKey]);
      seenKeys.add(syncKey);
    });
  }));

  if (updatedSyncValues.length) sheet.getRange(2, syncColumn, updatedSyncValues.length, 1).setValues(updatedSyncValues);
  if (rowsToAppend.length) {
    const firstNewRow = sheet.getLastRow() + 1;
    sheet.getRange(firstNewRow, 1, rowsToAppend.length, 4).setValues(rowsToAppend);
    sheet.getRange(firstNewRow, 2, rowsToAppend.length, 1).setNumberFormat('dd-MM-yyyy');
    sheet.getRange(firstNewRow, syncColumn, idsToAppend.length, 1).setValues(idsToAppend);
  }
  return { added: rowsToAppend.length, skipped: skipped };
}

function verifyHomeScoutHeaders_(sheet) {
  const actual = sheet.getRange(1, 1, 1, 4).getDisplayValues()[0]
    .map(value => String(value || '').trim().toUpperCase());
  const emailHeaderOkay = HOMESCOUT_EMAIL_HEADERS.includes(actual[3]);
  if (actual.slice(0, 3).join('|') !== HOMESCOUT_HEADERS.join('|') || !emailHeaderOkay) {
    throw new Error('Expected columns PRODUCT NAME, DATE, NAME OF THE COMPANY, and EMAIL ADDRESS (or EMAIL) on the target tab. Found: ' + actual.join(', '));
  }
}

function getHomeScoutTargetSheet_(spreadsheet) {
  return spreadsheet.getSheets().find(sheet => sheet.getSheetId() === HOMESCOUT_TARGET_SHEET_ID) || null;
}

function getHomeScoutSyncColumn_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 4);
  const headings = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  const existing = headings.findIndex(value => String(value || '').trim() === HOMESCOUT_SYNC_KEY_HEADER);
  if (existing >= 0) return existing + 1;
  const column = lastColumn + 1;
  sheet.getRange(1, column).setValue(HOMESCOUT_SYNC_KEY_HEADER);
  sheet.hideColumns(column);
  return column;
}

function parseHomeScoutSubject_(subject) {
  const normalized = String(subject || '').replace(/^(re:\s*)+/i, '').trim();
  if (!normalized.toLowerCase().startsWith(HOMESCOUT_SUBJECT_PREFIX.toLowerCase())) return null;
  const rest = normalized.slice(HOMESCOUT_SUBJECT_PREFIX.length).trim();
  const product = HOMESCOUT_PRODUCTS.find(name => rest.toLowerCase().startsWith(name.toLowerCase()));
  if (!product) return null;
  const company = rest.slice(product.length).replace(/^\s*[—–-]\s*/, '').trim();
  return { product: product, company: company };
}

function extractHomeScoutEmails_(value) {
  return String(value || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
}

function makeHomeScoutRowKey_(product, date, company, email, timeZone) {
  if (!product || !date || !email) return '';
  let parsedDate = date;
  if (!(parsedDate instanceof Date)) {
    const text = String(parsedDate).trim();
    const dmy = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    parsedDate = dmy ? new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])) : new Date(text);
  }
  if (!(parsedDate instanceof Date) || Number.isNaN(parsedDate.getTime())) return '';
  const dateKey = Utilities.formatDate(parsedDate, timeZone, 'yyyy-MM-dd');
  return [product, dateKey, company, email].map(value => String(value || '').trim().toLowerCase()).join('|');
}
