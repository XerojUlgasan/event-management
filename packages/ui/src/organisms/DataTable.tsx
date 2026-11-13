import type { Key, ReactNode } from "react";

export type DataTableColumn<Row> = {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
};

export type DataTableProps<Row> = {
  label: string;
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => Key;
  emptyMessage?: ReactNode;
  minWidth?: number;
  className?: string;
};

export function DataTable<Row>({
  label,
  columns,
  rows,
  rowKey,
  emptyMessage = "No records to show.",
  minWidth = 720,
  className = "",
}: DataTableProps<Row>) {
  return (
    <div
      className={`ui-data-table-scroll${className ? ` ${className}` : ""}`}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      <table className="ui-data-table" aria-label={label} style={{ minWidth }}>
        <thead>
          <tr>
            {columns.map(column => <th key={column.key} scope="col">{column.header}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map(row => (
            <tr key={rowKey(row)}>
              {columns.map((column, index) => index === 0
                ? <th key={column.key} scope="row">{column.cell(row)}</th>
                : <td key={column.key}>{column.cell(row)}</td>)}
            </tr>
          )) : (
            <tr className="ui-data-table-empty">
              <td colSpan={columns.length}>{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
