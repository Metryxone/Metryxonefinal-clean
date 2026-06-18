import React from 'react';

interface HeatMapCell {
  row: string;
  col: string;
  value: number;
}

interface HeatMapProps {
  rows: string[];
  cols: string[];
  cells: HeatMapCell[];
  maxValue?: number;
  colorHigh?: string;
  colorLow?: string;
  className?: string;
}

function interpolateColor(low: string, high: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1,3),16),
    parseInt(hex.slice(3,5),16),
    parseInt(hex.slice(5,7),16),
  ];
  const [lr,lg,lb] = parse(low);
  const [hr,hg,hb] = parse(high);
  const r = Math.round(lr + (hr-lr)*t);
  const g = Math.round(lg + (hg-lg)*t);
  const b = Math.round(lb + (hb-lb)*t);
  return `rgb(${r},${g},${b})`;
}

export function HeatMap({
  rows, cols, cells,
  maxValue = 100,
  colorLow = '#fef3c7',
  colorHigh = '#2A9D8F',
  className = '',
}: HeatMapProps) {
  const cellMap = new Map(cells.map(c => [`${c.row}|${c.col}`, c.value]));

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="text-[10px] border-collapse">
        <thead>
          <tr>
            <th className="w-24 p-1" />
            {cols.map(c => (
              <th key={c} className="p-1 text-gray-500 font-medium text-center whitespace-nowrap">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row}>
              <td className="p-1 text-gray-600 font-medium whitespace-nowrap pr-3">{row}</td>
              {cols.map(col => {
                const val = cellMap.get(`${row}|${col}`) ?? 0;
                const t = Math.min(1, val / maxValue);
                return (
                  <td key={col} className="p-0.5">
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center text-[9px] font-bold text-white"
                      style={{ backgroundColor: interpolateColor(colorLow, colorHigh, t) }}
                      title={`${row} × ${col}: ${val}`}
                    >
                      {val > 0 ? val : ''}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
