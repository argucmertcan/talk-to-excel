export type CellValue = number | string | Date | null;
export type Row = Record<string, CellValue>;
export type ColumnType = "number" | "date" | "text";
export type ColumnKind = "currency" | "percent" | "plain";

export interface Column {
  name: string;
  type: ColumnType;
  kind: ColumnKind;
}

export interface Sheet {
  name: string;
  columns: Column[];
  rows: Row[];
}

export interface Workbook {
  fileName: string;
  sheets: Sheet[];
}
