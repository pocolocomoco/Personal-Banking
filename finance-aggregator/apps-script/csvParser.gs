/**
 * Finance Aggregator - CSV Parser
 *
 * Parses CSV exports from various financial institutions
 * Phase 1+ feature - stub implementation for Phase 0
 */

// ============================================================================
// MAIN PARSER INTERFACE
// ============================================================================

/**
 * Processes a CSV file and extracts balance information
 * @param {File} file - Google Drive file object
 * @returns {Object} Parsed balance data or error
 */
function processCSVFile(file) {
  const fileName = file.getName().toLowerCase();
  const content = file.getBlob().getDataAsString();

  try {
    let result;

    // Detect institution from filename or content
    if (fileName.includes('chase')) {
      result = parseChaseCSV(content);
    } else if (fileName.includes('wellsfargo') || fileName.includes('wells_fargo')) {
      result = parseWellsFargoCSV(content);
    } else if (fileName.includes('bofa') || fileName.includes('bankofamerica')) {
      result = parseBankOfAmericaCSV(content);
    } else if (fileName.includes('apple') || fileName.includes('goldman')) {
      result = parseAppleCardCSV(content);
    } else {
      // Try generic parsing
      result = parseGenericCSV(content);
    }

    if (result.success) {
      // Write to Balances sheet
      writeBalanceFromCSV(result.accountId, result.balance, result.date, file.getName());
      logActivity('CSV_IMPORT', `Imported ${fileName}: $${result.balance}`);
    }

    return result;

  } catch (error) {
    logError('processCSVFile', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// INSTITUTION-SPECIFIC PARSERS
// ============================================================================

/**
 * Parses Chase CSV export
 * Chase format: Transaction Date, Post Date, Description, Category, Type, Amount, Memo
 */
function parseChaseCSV(content) {
  const lines = parseCSVContent(content);

  if (lines.length < 2) {
    return { success: false, error: 'Empty or invalid CSV' };
  }

  // Chase credit card: sum all transactions to get balance change
  // For current balance, look for "Balance" in recent transactions or use running total
  const headers = lines[0].map(h => h.toLowerCase().trim());
  const amountIndex = headers.indexOf('amount');

  if (amountIndex === -1) {
    return { success: false, error: 'Could not find Amount column' };
  }

  // Sum amounts (negative = charges, positive = payments/credits)
  let runningTotal = 0;
  let latestDate = null;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length <= amountIndex) continue;

    const amount = parseFloat(row[amountIndex].replace(/[$,]/g, '')) || 0;
    runningTotal += amount;

    // Track latest date
    const dateStr = row[0];
    if (dateStr) {
      const date = new Date(dateStr);
      if (!latestDate || date > latestDate) {
        latestDate = date;
      }
    }
  }

  // Note: This gives transaction sum, not current balance
  // User needs to map this to the right account
  return {
    success: true,
    institution: 'Chase',
    balance: Math.abs(runningTotal),
    date: latestDate || new Date(),
    accountId: null, // User must specify
    note: 'Transaction sum - verify against statement balance'
  };
}

/**
 * Parses Wells Fargo CSV export
 */
function parseWellsFargoCSV(content) {
  const lines = parseCSVContent(content);

  if (lines.length < 2) {
    return { success: false, error: 'Empty or invalid CSV' };
  }

  // Wells Fargo checking/savings format varies
  // Common format: Date, Amount, *, *, Description
  const headers = lines[0].map(h => h.toLowerCase().trim());

  // Look for balance column or calculate from transactions
  let balance = 0;
  let latestDate = null;

  // Try to find ending balance row
  for (let i = lines.length - 1; i >= 1; i--) {
    const row = lines[i];
    const rowText = row.join(' ').toLowerCase();

    if (rowText.includes('ending balance') || rowText.includes('closing balance')) {
      // Extract balance from this row
      for (const cell of row) {
        const amount = parseFloat(cell.replace(/[$,]/g, ''));
        if (!isNaN(amount) && amount > 0) {
          balance = amount;
          break;
        }
      }
      break;
    }
  }

  return {
    success: balance > 0,
    institution: 'Wells Fargo',
    balance: balance,
    date: latestDate || new Date(),
    accountId: null,
    note: balance > 0 ? 'Extracted ending balance' : 'Could not find balance - manual entry needed'
  };
}

/**
 * Parses Bank of America CSV export
 */
function parseBankOfAmericaCSV(content) {
  const lines = parseCSVContent(content);

  if (lines.length < 2) {
    return { success: false, error: 'Empty or invalid CSV' };
  }

  // BoA format: Date, Description, Amount, Running Bal.
  const headers = lines[0].map(h => h.toLowerCase().trim());
  const balanceIndex = headers.findIndex(h =>
    h.includes('balance') || h.includes('running')
  );

  let balance = 0;
  let latestDate = null;

  if (balanceIndex !== -1 && lines.length > 1) {
    // Get the most recent (first data row usually) balance
    const firstDataRow = lines[1];
    if (firstDataRow.length > balanceIndex) {
      balance = parseFloat(firstDataRow[balanceIndex].replace(/[$,]/g, '')) || 0;
    }

    const dateStr = firstDataRow[0];
    if (dateStr) {
      latestDate = new Date(dateStr);
    }
  }

  return {
    success: balance > 0,
    institution: 'Bank of America',
    balance: balance,
    date: latestDate || new Date(),
    accountId: null,
    note: balance > 0 ? 'Extracted from Running Balance column' : 'Manual entry needed'
  };
}

/**
 * Parses Apple Card CSV export (if available)
 * Note: Apple Card CSV export is limited - may need manual entry
 */
function parseAppleCardCSV(content) {
  const lines = parseCSVContent(content);

  if (lines.length < 2) {
    return { success: false, error: 'Empty or invalid CSV' };
  }

  // Apple Card transaction format (when available):
  // Transaction Date, Clearing Date, Description, Merchant, Category, Type, Amount
  const headers = lines[0].map(h => h.toLowerCase().trim());
  const amountIndex = headers.findIndex(h => h.includes('amount'));

  if (amountIndex === -1) {
    return {
      success: false,
      error: 'Apple Card CSV format not recognized. Please use manual entry.'
    };
  }

  // Sum transactions (this won't give current balance, just period activity)
  let total = 0;
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length > amountIndex) {
      const amount = parseFloat(row[amountIndex].replace(/[$,]/g, '')) || 0;
      total += amount;
    }
  }

  return {
    success: true,
    institution: 'Apple Card',
    balance: Math.abs(total),
    date: new Date(),
    accountId: null,
    note: 'Transaction sum only - verify current balance in Apple Wallet app'
  };
}

/**
 * Generic CSV parser for unknown formats
 */
function parseGenericCSV(content) {
  const lines = parseCSVContent(content);

  if (lines.length < 2) {
    return { success: false, error: 'Empty or invalid CSV' };
  }

  const headers = lines[0].map(h => h.toLowerCase().trim());

  // Try to find any balance-related column
  const balanceIndex = headers.findIndex(h =>
    h.includes('balance') ||
    h.includes('total') ||
    h.includes('amount')
  );

  if (balanceIndex === -1) {
    return {
      success: false,
      error: 'Could not identify balance column. Please use manual entry.'
    };
  }

  // Get the first non-header value in that column
  let balance = 0;
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length > balanceIndex) {
      const val = parseFloat(row[balanceIndex].replace(/[$,]/g, ''));
      if (!isNaN(val)) {
        balance = Math.abs(val);
        break;
      }
    }
  }

  return {
    success: balance > 0,
    institution: 'Unknown',
    balance: balance,
    date: new Date(),
    accountId: null,
    note: 'Generic parse - verify balance is correct'
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parses CSV content into array of arrays
 */
function parseCSVContent(content) {
  // Simple CSV parsing - handles basic cases
  // For complex CSVs with quoted fields, use Utilities.parseCsv
  try {
    return Utilities.parseCsv(content);
  } catch (e) {
    // Fallback to simple split
    return content.split('\n').map(line => line.split(',').map(cell => cell.trim()));
  }
}

/**
 * Writes parsed balance to the Balances sheet
 */
function writeBalanceFromCSV(accountId, balance, date, sourceFile) {
  if (!accountId) {
    console.log('No account ID specified - balance not written');
    return false;
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Balances');

  if (!sheet) {
    console.error('Balances sheet not found');
    return false;
  }

  const balanceId = Utilities.getUuid();

  sheet.appendRow([
    balanceId,
    accountId,
    date || new Date(),
    balance,
    'csv',
    `Imported from: ${sourceFile}`,
    new Date()
  ]);

  updateAccountLastUpdated(accountId, date || new Date());

  return true;
}

// ============================================================================
// MANUAL CSV IMPORT
// ============================================================================

/**
 * Shows file picker for manual CSV import
 */
function showCSVImportPicker() {
  const html = HtmlService.createHtmlOutput(`
    <p>To import a CSV file:</p>
    <ol>
      <li>Upload your CSV to Google Drive</li>
      <li>Move it to the designated import folder</li>
      <li>The system will process it automatically</li>
    </ol>
    <p>Or enter the file URL below:</p>
    <input type="text" id="fileUrl" style="width: 100%; margin: 10px 0;">
    <button onclick="importFile()">Import</button>
    <script>
      function importFile() {
        const url = document.getElementById('fileUrl').value;
        google.script.run.importCSVFromUrl(url);
        google.script.host.close();
      }
    </script>
  `)
    .setWidth(400)
    .setHeight(200);

  SpreadsheetApp.getUi().showModalDialog(html, 'Import CSV');
}

/**
 * Imports a CSV from a Drive URL
 */
function importCSVFromUrl(url) {
  try {
    // Extract file ID from URL
    const match = url.match(/[-\w]{25,}/);
    if (!match) {
      throw new Error('Invalid Google Drive URL');
    }

    const fileId = match[0];
    const file = DriveApp.getFileById(fileId);

    const result = processCSVFile(file);

    if (result.success) {
      SpreadsheetApp.getUi().alert('Import Successful', `Imported balance: $${result.balance}`, SpreadsheetApp.getUi().ButtonSet.OK);
    } else {
      SpreadsheetApp.getUi().alert('Import Failed', result.error, SpreadsheetApp.getUi().ButtonSet.OK);
    }

  } catch (error) {
    logError('importCSVFromUrl', error);
    SpreadsheetApp.getUi().alert('Error', error.message, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}
