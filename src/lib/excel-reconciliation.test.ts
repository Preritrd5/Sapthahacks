import { describe, it } from 'vitest';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import {
  createDefaultColumnMapping,
  detectFieldForHeader,
  parseRowsWithMapping,
  validateColumnMapping,
  type ColumnMappingState,
} from './column-mapping';

describe('Excel Reconciliation with Real File', () => {
  it('parses real uploaded file and reconciles all rows', () => {
    const filePath = 'C:\\Users\\Ananya\\Downloads\\SAPTHAHACKS_26_for_evaluators_first_half.xlsx';
    if (!fs.existsSync(filePath)) {
      console.log('Sample file not present on this machine, skipping local disk reconciliation test.');
      return;
    }
    const wb = xlsx.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]!];
    const raw = xlsx.utils.sheet_to_json<Record<string, string>>(sheet!, { defval: '' });

    console.log('--- RECONCILIATION REPORT ---');
    console.log('Total Raw Rows in Excel:', raw.length);

    const headers = Array.from(new Set(raw.flatMap((r) => Object.keys(r))));
    console.log('Detected Headers in File:', headers);

    const defaultMapping = createDefaultColumnMapping(headers);
    console.log('Auto Mapping:');
    for (const [h, m] of Object.entries(defaultMapping)) {
      console.log(`  "${h}" -> ${m.targetField} (selected: ${m.selected})`);
    }

    const validation = validateColumnMapping(defaultMapping);
    console.log('Validation:', {
      isValid: validation.isValid,
      missing: validation.missingRequiredFields.map((f) => f.id),
      conflicts: validation.duplicateFieldMappings,
      selectedCount: validation.selectedColumnCount,
    });

    const parsed = parseRowsWithMapping(raw, defaultMapping, []);
    console.log('\n--- PARSED ROWS SUMMARY ---');
    console.log('Total Parsed Rows:', parsed.length);

    const statusCounts: Record<string, number> = {};
    parsed.forEach((row, idx) => {
      statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
      if (row.status !== 'ready' || row.issues.length > 0) {
        console.log(`Row ${idx + 2} (${row.name}): status=${row.status}, issues=${JSON.stringify(row.issues)}, duplicateInSheet=${row.duplicateInSheet}`);
      }
    });

    console.log('\nStatus Breakdown:', statusCounts);

    console.log('\nAll 51 Rows Details:');
    parsed.forEach((r, idx) => {
      console.log(`Row ${idx + 2}: [${r.status}] Name: "${r.name}" | Members (${r.members.length}): ${r.members.map((m) => m.name).join(', ')} | Issues: ${r.issues.length ? r.issues.join('; ') : 'None'}`);
    });
  });
});
