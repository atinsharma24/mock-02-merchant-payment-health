/**
 * Lightweight, robust RFC-4180 compliant CSV parser with structural validation.
 * Supports quoted fields, escaped quotes (""), embedded newlines within quotes, and CRLF/LF line breaks.
 * Tracks source row line numbers and identifies malformed quoting syntax.
 */

export interface CSVRowRecord {
  line: number;
  fields: string[];
  malformedQuotes: boolean;
  malformedReason?: string;
}

export function parseCSVRecords(content: string): CSVRowRecord[] {
  const records: CSVRowRecord[] = [];
  let currentRowFields: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  let quoteOpened = false;
  let fieldHadQuotes = false;
  let rowStartLine = 1;
  let currentLine = 1;
  let rowMalformedQuotes = false;
  let rowMalformedReason: string | undefined;

  let i = 0;
  const len = content.length;

  while (i < len) {
    const char = content[i];

    if (insideQuotes) {
      if (char === '"') {
        if (i + 1 < len && content[i + 1] === '"') {
          // Escaped double quote ("")
          currentField += '"';
          i += 2;
          continue;
        } else {
          // Closing quote
          insideQuotes = false;
          quoteOpened = false;
          i++;
          // Check for trailing characters after closing quote before separator
          if (i < len && content[i] !== ',' && content[i] !== '\r' && content[i] !== '\n') {
            rowMalformedQuotes = true;
            rowMalformedReason = `Unexpected characters after closing quote at line ${currentLine}`;
          }
          continue;
        }
      } else if (char === '\n') {
        currentField += char;
        currentLine++;
        i++;
        continue;
      } else if (char === '\r') {
        currentField += char;
        if (i + 1 < len && content[i + 1] === '\n') {
          currentField += content[i + 1];
          i++;
        }
        currentLine++;
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    } else {
      // Outside quotes
      if (char === '"') {
        if (currentField.length === 0) {
          insideQuotes = true;
          quoteOpened = true;
          fieldHadQuotes = true;
          i++;
          continue;
        } else {
          // Quote appearing inside unquoted field
          rowMalformedQuotes = true;
          rowMalformedReason = `Misplaced quote inside unquoted field at line ${currentLine}`;
          currentField += char;
          i++;
          continue;
        }
      } else if (char === ',') {
        currentRowFields.push(currentField);
        currentField = '';
        fieldHadQuotes = false;
        i++;
        continue;
      } else if (char === '\r') {
        if (i + 1 < len && content[i + 1] === '\n') {
          i++;
        }
        currentRowFields.push(currentField);
        records.push({
          line: rowStartLine,
          fields: currentRowFields,
          malformedQuotes: rowMalformedQuotes,
          malformedReason: rowMalformedReason,
        });
        currentLine++;
        rowStartLine = currentLine;
        currentRowFields = [];
        currentField = '';
        fieldHadQuotes = false;
        rowMalformedQuotes = false;
        rowMalformedReason = undefined;
        i++;
        continue;
      } else if (char === '\n') {
        currentRowFields.push(currentField);
        records.push({
          line: rowStartLine,
          fields: currentRowFields,
          malformedQuotes: rowMalformedQuotes,
          malformedReason: rowMalformedReason,
        });
        currentLine++;
        rowStartLine = currentLine;
        currentRowFields = [];
        currentField = '';
        fieldHadQuotes = false;
        rowMalformedQuotes = false;
        rowMalformedReason = undefined;
        i++;
        continue;
      } else {
        currentField += char;
        i++;
        continue;
      }
    }
  }

  // Handle EOF inside quotes
  if (insideQuotes) {
    rowMalformedQuotes = true;
    rowMalformedReason = `Unclosed quote at end of file starting at line ${rowStartLine}`;
  }

  // Handle final field and row if any
  if (currentField.length > 0 || currentRowFields.length > 0) {
    currentRowFields.push(currentField);
    records.push({
      line: rowStartLine,
      fields: currentRowFields,
      malformedQuotes: rowMalformedQuotes,
      malformedReason: rowMalformedReason,
    });
  }

  // Remove trailing empty lines
  while (records.length > 0 && records[records.length - 1].fields.every((f) => f.trim() === '')) {
    records.pop();
  }

  return records;
}

/**
 * Validates that the actual parsed header matches the expected data contract schema exactly.
 */
export function validateHeaders(
  actualHeader: string[],
  expectedHeader: string[]
): { valid: boolean; error?: string } {
  if (actualHeader.length !== expectedHeader.length) {
    return {
      valid: false,
      error: `Header column count mismatch: expected ${expectedHeader.length} columns (${expectedHeader.join(', ')}), but found ${actualHeader.length} columns (${actualHeader.join(', ')})`,
    };
  }

  for (let i = 0; i < expectedHeader.length; i++) {
    if (actualHeader[i].trim() !== expectedHeader[i]) {
      return {
        valid: false,
        error: `Header column ${i + 1} mismatch: expected "${expectedHeader[i]}", but found "${actualHeader[i]}"`,
      };
    }
  }

  return { valid: true };
}

/**
 * Legacy compatibility helper returning string[][] for raw data inspection
 */
export function parseCSV(content: string): string[][] {
  return parseCSVRecords(content).map((r) => r.fields);
}
