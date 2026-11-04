// File-type checks kept apart from the parsers, so pages that only show file icons don't load the xlsx library.
const SPREADSHEET_EXT = /\.(xlsx|xls|csv)$/i;

export function isSpreadsheet(fileName) {
  return SPREADSHEET_EXT.test(fileName || '');
}
