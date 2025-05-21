'use client';
import React from 'react';
import './Table.module.css';

interface ColumnDef<T> {
  id: string;
  header: React.ReactNode;
  accessor: (row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  className?: string;
  'data-testid'?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  className = '',
  'data-testid': dataTestId = 'table',
}: TableProps<T>) {
  return (
    <table className={`table ${className}`} data-testid={dataTestId}>
      <thead>
        <tr>
          {columns.map((column: ColumnDef<T>) => (
            <th key={column.id}>{column.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row: T, rowIndex) => (
          <tr key={keyExtractor(row) || rowIndex}> {/* Use keyExtractor or rowIndex as fallback */}
            {columns.map((column: ColumnDef<T>) => (
              <td key={`${keyExtractor(row) || rowIndex}-${column.id}`}>
                {column.accessor(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
