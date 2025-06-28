// client/src/pages/received/ReceivedOrderBillsPage.jsx

import React, { useEffect, useState } from "react";
import { getReceivedBills } from "../../api/receivedService";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const ReceivedOrderBillsPage = () => {
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [bills, setBills]         = useState([]);
  const [entries, setEntries]     = useState([]);
  const [items, setItems]         = useState([]);

  const [filterShop, setFilterShop]       = useState("All");
  const [filterSeries, setFilterSeries]   = useState("All");
  const [filterReceive, setFilterReceive] = useState("");
  const [expanded, setExpanded]           = useState({});

  useEffect(() => {
    // Fetch both bills (for pricing) and entries (for series_name) in parallel
    Promise.all([
      getReceivedBills(),
      fetch("/api/received/received-entries/all/all").then(res => {
        if (!res.ok) throw new Error("Failed to load received entries");
        return res.json();
      })
    ])
    .then(([billsData, entriesData]) => {
      setBills(billsData);
      setEntries(entriesData);

      // Build receive_number → series_name map
      const seriesMap = {};
      entriesData.forEach(r => {
        if (!seriesMap[r.receive_number]) {
          seriesMap[r.receive_number] = r.series_name;
        }
      });

      // Enrich each bill line with series_name
      const enriched = billsData.map(b => ({
        ...b,
        series_name: seriesMap[b.receive_number] || ""
      }));
      setItems(enriched);
    })
    .catch(err => {
      console.error("❌ Error loading data:", err);
      setError("Failed to load invoices.");
    })
    .finally(() => setLoading(false));
  }, []);

  // Helper: total for a line = qty × price × 12
  const lineTotal = ({ quantity, price }) =>
    (Number(quantity) || 0) * (Number(price) || 0) * 12;

  // Toggle expand/collapse per invoice
  const toggle = rn =>
    setExpanded(e => ({ ...e, [rn]: !e[rn] }));

  // PDF export
  const exportPDF = rn => {
    const dom = document.getElementById(`bill-${rn}`);
    if (!dom) return;
    html2canvas(dom, { scale: 2 }).then(canvas => {
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "pt", "a4");
      const w   = pdf.internal.pageSize.getWidth();
      const h   = (canvas.height * w) / canvas.width;
      pdf.addImage(img, "PNG", 0, 0, w, h);
      pdf.save(`invoice_${rn}.pdf`);
    });
  };

  if (loading) return <p className="p-6">Loading invoices…</p>;
  if (error)   return <p className="p-6 text-red-600">{error}</p>;
  if (!items.length)
    return <p className="p-6">No received invoices to display.</p>;

  // Prepare filter dropdown options
  const shopsList   = ["All", ...new Set(items.map(i => i.supplier))];
  const seriesList  = ["All", ...new Set(items.map(i => i.series_name))];

  // Apply filters
  const filtered = items.filter(i => {
    const byShop   = filterShop   === "All" || i.supplier    === filterShop;
    const bySeries = filterSeries === "All" || i.series_name === filterSeries;
    const byRecv   = i.receive_number
                      .toLowerCase()
                      .includes(filterReceive.toLowerCase());
    return byShop && bySeries && byRecv;
  });

  // Group by receive_number
  const grouped = filtered.reduce((acc, row) => {
    (acc[row.receive_number] ||= []).push(row);
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">🧾 Received Order Invoices</h1>

      {/* Filters */}
      <div className="flex space-x-4 mb-4">
        <select
          className="border rounded px-3 py-2"
          value={filterShop}
          onChange={e => setFilterShop(e.target.value)}
        >
          {shopsList.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          className="border rounded px-3 py-2"
          value={filterSeries}
          onChange={e => setFilterSeries(e.target.value)}
        >
          {seriesList.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Filter by Received #"
          className="border rounded px-3 py-2 flex-1"
          value={filterReceive}
          onChange={e => setFilterReceive(e.target.value)}
        />
      </div>

      {/* Invoice Cards */}
      {Object.entries(grouped).map(([rn, lines]) => {
        const head     = lines[0];
        const subtotal = lines.reduce((sum, li) => sum + lineTotal(li), 0);

        // Consolidate by product_number, merging colors
        const products = Object.values(
          lines.reduce((map, li) => {
            if (!map[li.product_number]) {
              map[li.product_number] = {
                product: li.product_number,
                price:   li.price,
                colors: {}
              };
            }
            map[li.product_number].colors[li.color] = li.quantity;
            return map;
          }, {})
        );

        return (
          <div
            key={rn}
            id={`bill-${rn}`}
            className="bg-white border rounded-lg shadow p-6 space-y-4"
          >
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-semibold">
                  Invoice: <span className="text-blue-700">{rn}</span>
                </h2>
                <p className="mt-1 text-gray-600">
                  Shop: <strong>{head.supplier}</strong> | Series: <strong>{head.series_name}</strong>
                </p>
                <p className="text-gray-600">
                  Receive Date: {new Date(head.received_date).toLocaleDateString()}
                </p>
                <p className="text-gray-600">
                  Dispatch Date:{" "}
                  {head.dispatch_date
                    ? new Date(head.dispatch_date).toLocaleDateString()
                    : "—"}{" "}
                  | Mode: {head.mode_of_transport || "—"}
                </p>
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => toggle(rn)}
                  className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                >
                  {expanded[rn] ? "Collapse" : "Expand"}
                </button>
                <button
                  onClick={() => exportPDF(rn)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Download PDF
                </button>
              </div>
            </div>

            {/* Details (collapsed by default) */}
            {expanded[rn] && (
              <div>
                <table className="w-full text-sm border-collapse mb-4">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border px-3 py-2 text-left">Product</th>
                      <th className="border px-3 py-2 text-left">Colors</th>
                      <th className="border px-3 py-2 text-right">Qty</th>
                      <th className="border px-3 py-2 text-right">Price</th>
                      <th className="border px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p, idx) => {
                      const qty = Object.values(p.colors).reduce((a, b) => a + b, 0);
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="border px-3 py-2">{p.product}</td>
                          <td className="border px-3 py-2">
                            {Object.entries(p.colors)
                              .map(([c, q]) => `${c}: ${q}`)
                              .join(", ")}
                          </td>
                          <td className="border px-3 py-2 text-right">{qty}</td>
                          <td className="border px-3 py-2 text-right">{p.price}</td>
                          <td className="border px-3 py-2 text-right font-medium text-green-700">
                            {(qty * p.price * 12).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="text-right text-lg font-semibold">
                  Grand Total: <span className="text-green-700">{subtotal.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ReceivedOrderBillsPage;
