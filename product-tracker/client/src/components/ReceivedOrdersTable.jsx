import React from "react";

export default function ReceivedOrdersTable({ rows, onQtyChange }) {
  return (
    <table className="w-full text-sm border-collapse border border-gray-300 mb-6">
      <thead className="bg-gray-100">
        <tr>
          <th className="border px-3 py-2">Product</th>
          <th className="border px-3 py-2">Color</th>
          <th className="border px-3 py-2">Pending Qty</th>
          <th className="border px-3 py-2">Receive Now</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.product_number}-${r.color}-${i}`} className="hover:bg-gray-50">
            <td className="border px-3 py-2">{r.product_number}</td>
            <td className="border px-3 py-2">{r.color}</td>
            <td className="border px-3 py-2 text-center">{r.pending_qty}</td>
            <td className="border px-3 py-2 text-center">
              <input
                type="number"
                min="0"
                max={r.pending_qty}
                className="w-20 border rounded px-2 py-1"
                value={r.receiveNow || ""}
                onChange={e => onQtyChange(i, Number(e.target.value))}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
