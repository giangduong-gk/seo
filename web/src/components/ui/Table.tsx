import type { ReactNode } from "react";
import s from "./Table.module.css";

export function Table({ columns, rows, minWidth }: { columns: string[]; rows: ReactNode[][]; minWidth?: number }) {
  return (
    <div className={s.scroll}>
      <table className={s.table} style={minWidth ? { minWidth } : undefined}>
        <thead><tr>{columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
