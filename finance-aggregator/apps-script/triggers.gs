/**
 * Finance Aggregator - Trigger Management
 *
 * Functions for setting up and managing time-driven and event triggers
 */

// ============================================================================
// TRIGGER SETUP
// ============================================================================

/**
 * Sets up all required triggers
 * Run this once after initial setup
 */
function setupAllTriggers() {
  // Remove existing triggers first to avoid duplicates
  removeAllTriggers();

  const ui = SpreadsheetApp.getUi();

  // Daily balance refresh (6 AM)
  ScriptApp.newTrigger('scheduledRefresh')
    .timeBased()
    .atHour(6)
    .everyDays(1)
    .create();

  // Weekly stale account check (Monday 9 AM)
  ScriptApp.newTrigger('scheduledStaleCheck')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();

  // Weekly summary email (Sunday 8 PM)
  ScriptApp.newTrigger('sendWeeklySummary')
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(20)
    .create();

  logActivity('TRIGGERS', 'All triggers set up successfully');

  ui.alert(
    'Triggers Configured',
    'The following triggers have been set up:\n\n' +
    '- Daily refresh at 6 AM\n' +
    '- Weekly stale check on Monday at 9 AM\n' +
    '- Weekly summary email on Sunday at 8 PM',
    ui.ButtonSet.OK
  );
}

/**
 * Removes all existing triggers for this script
 */
function removeAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();

  triggers.forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });

  logActivity('TRIGGERS', `Removed ${triggers.length} existing trigger(s)`);
}

/**
 * Lists all current triggers
 */
function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  const ui = SpreadsheetApp.getUi();

  if (triggers.length === 0) {
    ui.alert('No triggers are currently configured.');
    return;
  }

  const triggerInfo = triggers.map(trigger => {
    return `- ${trigger.getHandlerFunction()}: ${trigger.getEventType()}`;
  }).join('\n');

  ui.alert(
    'Current Triggers',
    `${triggers.length} trigger(s) configured:\n\n${triggerInfo}`,
    ui.ButtonSet.OK
  );
}

// ============================================================================
// SCHEDULED FUNCTIONS
// ============================================================================

/**
 * Scheduled daily refresh function
 * Called by time-driven trigger
 */
function scheduledRefresh() {
  const config = getConfig();

  // Check if auto-refresh is enabled
  if (config.AUTO_REFRESH_ENABLED !== 'TRUE' && config.AUTO_REFRESH_ENABLED !== true) {
    console.log('Auto-refresh is disabled, skipping scheduled refresh');
    return;
  }

  console.log('Starting scheduled refresh...');
  const errors = [];
  const results = [];

  try {
    // Fetch SimpleFIN balances if configured
    if (isSimpleFINConfigured()) {
      console.log('Fetching SimpleFIN balances...');
      const simplefinResults = fetchAllSimpleFINBalances();

      if (simplefinResults.success) {
        results.push(`SimpleFIN: Fetched ${simplefinResults.fetched.length} account(s)`);
      } else {
        errors.push(`SimpleFIN: ${simplefinResults.error || 'Unknown error'}`);
      }

      // Add any SimpleFIN-specific errors
      if (simplefinResults.errors && simplefinResults.errors.length > 0) {
        simplefinResults.errors.forEach(e => errors.push(`SimpleFIN: ${e.error}`));
      }
    }

    updateLastRefreshTime();
    logActivity('SCHEDULED_REFRESH', `Daily refresh completed. ${results.join('; ')}`);

  } catch (error) {
    errors.push(error.message);
    logError('scheduledRefresh', error);
  }

  // Send alert if there were errors
  if (errors.length > 0) {
    sendRefreshFailureAlert(errors);
  }
}

// ============================================================================
// DRIVE TRIGGER (for CSV imports - Phase 1+)
// ============================================================================

/**
 * Sets up a Drive trigger to watch for new files in the import folder
 * Phase 1+ feature
 */
function setupDriveTrigger() {
  const config = getConfig();
  const folderId = config.IMPORT_FOLDER_ID;

  if (!folderId) {
    SpreadsheetApp.getUi().alert(
      'Configuration Required',
      'Please set IMPORT_FOLDER_ID in the Config tab first.',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  // Note: Google Apps Script doesn't have direct Drive change triggers
  // We use a time-based trigger to check for new files periodically
  ScriptApp.newTrigger('checkForNewImports')
    .timeBased()
    .everyHours(1)
    .create();

  logActivity('TRIGGERS', 'Drive import check trigger set up (hourly)');

  SpreadsheetApp.getUi().alert(
    'Import Trigger Set',
    'The system will check for new CSV files every hour.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Checks for new files in the import folder
 * Phase 1+ feature
 */
function checkForNewImports() {
  const config = getConfig();
  const folderId = config.IMPORT_FOLDER_ID;

  if (!folderId) {
    console.log('No import folder configured, skipping check');
    return;
  }

  try {
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    let processedCount = 0;

    while (files.hasNext()) {
      const file = files.next();
      const fileName = file.getName();

      // Only process CSV files that haven't been processed
      if (fileName.endsWith('.csv') && !fileName.startsWith('_processed_')) {
        // Process the file (Phase 1 implementation)
        // processCSVFile(file);

        // Rename to mark as processed
        file.setName('_processed_' + fileName);
        processedCount++;
      }
    }

    if (processedCount > 0) {
      logActivity('CSV_IMPORT', `Processed ${processedCount} new file(s)`);
    }

  } catch (error) {
    logError('checkForNewImports', error);
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets remaining daily quota for triggers
 */
function getTriggerQuotaInfo() {
  // Apps Script doesn't expose quota directly, but we can track usage
  const triggers = ScriptApp.getProjectTriggers();

  return {
    currentTriggers: triggers.length,
    maxTriggers: 20, // Apps Script limit
    available: 20 - triggers.length
  };
}

/**
 * Validates that required triggers are set up
 */
function validateTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  const handlerFunctions = triggers.map(t => t.getHandlerFunction());

  const required = ['scheduledRefresh', 'scheduledStaleCheck'];
  const missing = required.filter(fn => !handlerFunctions.includes(fn));

  return {
    isValid: missing.length === 0,
    missing: missing,
    configured: handlerFunctions
  };
}
