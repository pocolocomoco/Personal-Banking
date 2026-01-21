# Apple Card Integration Guide

Apple Card (issued by Goldman Sachs) has limited integration options compared to traditional banks. This document details your options.

## Why Apple Card Is Different

| Feature | Traditional Banks | Apple Card |
|---------|-------------------|------------|
| Plaid Support | Yes | No |
| Direct API | Sometimes | No |
| CSV Export | Yes | Limited |
| OFX/QFX Export | Yes | No |
| Screen Scraping | Possible (violates ToS) | Blocked |

**Root Cause:** Apple Card data is managed entirely within Apple's ecosystem. Goldman Sachs does not participate in aggregation networks like Plaid, Yodlee, or MX.

## Available Options

### Option 1: Manual Entry (Recommended)

**Effort:** Low
**Frequency:** Weekly or Monthly
**Accuracy:** High (you verify the number)

**Process:**
1. Open **Wallet** app on iPhone
2. Tap **Apple Card**
3. View **Card Balance** at top
4. In Finance Aggregator: **Finance Aggregator > Add Manual Entry**
5. Select your Apple Card account
6. Enter the balance shown
7. Add note: "From Wallet app"

**Tips:**
- Set a weekly reminder (e.g., Sunday evening)
- Enter balance after making payments for accuracy
- Track both "Current Balance" and "Statement Balance" if desired

### Option 2: CSV Transaction Export

**Effort:** Low-Medium
**Frequency:** Monthly
**Accuracy:** Medium (sum of transactions, not current balance)

**Availability:** This feature may not be available in all regions or may require iOS updates.

**Process (if available):**
1. Open **Wallet** app
2. Tap **Apple Card**
3. Scroll to **Transactions**
4. Look for export/share option
5. Export as CSV
6. Upload to Finance Imports folder in Google Drive

**Limitations:**
- Exports transactions, not current balance
- You may need to calculate balance manually
- Format may vary

### Option 3: Monthly Statement PDF

**Effort:** Medium
**Frequency:** Monthly
**Accuracy:** High (official statement balance)

**Process:**
1. Wait for monthly statement (arrives in Wallet app)
2. Open statement in Wallet
3. Share/Export as PDF
4. Upload to Google Drive
5. (Phase 3) Automated PDF parsing extracts balance

**PDF Parsing Details:**

Apple Card statements follow a consistent format:

```
Previous Balance          $X,XXX.XX
Payments                 -$X,XXX.XX
Other Credits            -$X.XX
Purchases                +$X,XXX.XX
Interest Charged         +$X.XX
Fees Charged             +$0.00
─────────────────────────────────
New Balance               $X,XXX.XX    <-- This is what we extract
```

**Parser Code (Phase 3):**
```javascript
function parseAppleCardPDF(fileId) {
  // Convert PDF to text
  const text = extractPDFText(fileId);

  // Look for "New Balance" pattern
  const patterns = [
    /New Balance\s*\$?([\d,]+\.?\d*)/i,
    /Total Balance\s*\$?([\d,]+\.?\d*)/i,
    /Amount Due\s*\$?([\d,]+\.?\d*)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseFloat(match[1].replace(/,/g, ''));
    }
  }

  return null; // Manual entry needed
}
```

### Option 4: Apple Shortcuts (Advanced)

**Effort:** High
**Frequency:** On-demand
**Accuracy:** Varies
**Stability:** Fragile

**Concept:**
Use iOS Shortcuts app to automate data capture from Wallet.

**Limitations:**
- Shortcuts cannot directly access Apple Card balance
- Workarounds involve screenshots + OCR
- Breaks with iOS updates
- Not recommended for reliability

**If you want to try:**
1. Create Shortcut that screenshots Wallet
2. Use "Extract Text from Image" action
3. Parse for balance
4. Save to Notes or share to Google Drive

## Recommended Approach

For most users, **Option 1 (Manual Entry)** is the best balance of effort and accuracy.

**Weekly Routine:**
```
Every Sunday:
1. Open Wallet app
2. Note Apple Card balance
3. Open Finance Aggregator sheet
4. Finance Aggregator > Add Manual Entry
5. Enter balance
6. Done (~30 seconds)
```

## Tracking Both Balances

Apple Card shows two balance figures:
- **Current Balance:** All charges to date
- **Statement Balance:** Balance from last statement (what's due)

If you want to track both:

1. Create two entries in Accounts tab:
```
apple_credit_current | Apple Card | Current Balance | credit | FALSE | manual | TRUE
apple_credit_statement | Apple Card | Statement Balance | credit | FALSE | manual | TRUE
```

2. Update both monthly:
   - Current Balance: Update weekly
   - Statement Balance: Update when statement arrives

3. Dashboard will sum both (you may want to adjust to avoid double-counting)

## Interest and Fees Tracking

If you want to track interest charges:

1. Create a separate "account" for tracking:
```
apple_credit_interest | Apple Card | Interest Charges | other | FALSE | manual | TRUE
```

2. Enter the interest amount from each statement
3. This gives you visibility into financing costs

## Future Possibilities

**What might change:**
- Apple could add Plaid support (unlikely in near term)
- Goldman Sachs could join aggregation networks
- Apple could add better export options in iOS updates
- Third-party apps might find workarounds (with associated risks)

**What to watch:**
- iOS release notes mentioning Wallet exports
- Plaid blog for new institution support
- Apple Card terms of service changes

## Summary

| Option | Recommended? | When to Use |
|--------|--------------|-------------|
| Manual Entry | Yes | Default approach |
| CSV Export | Maybe | If available and convenient |
| PDF Parsing | Future | After Phase 3 implementation |
| Shortcuts | No | Only for tinkerers |

**Bottom Line:** Accept that Apple Card requires manual updates. Set a weekly reminder, spend 30 seconds updating, and move on. The time spent trying to automate this is better spent elsewhere.
