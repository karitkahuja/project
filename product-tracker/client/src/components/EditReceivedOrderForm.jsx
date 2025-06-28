// src/components/EditReceivedOrderForm.jsx

import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { updateReceive } from "../api/receivedService";

const API_BASE = "http://localhost:5000";

export default function EditReceivedOrderForm() {
  const { receiveNumber } = useParams();
  const navigate = useNavigate();

  // ─── Metadata ────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState("");
  const [shopNumber, setShopNumber] = useState("");
  const [seriesName, setSeriesName] = useState("");
  const [seriesId, setSeriesId] = useState(null);
  const [receivedDate, setReceivedDate] = useState(new Date());
  const [dispatchDate, setDispatchDate] = useState(null);
  const [estimatedArrivalDate, setEstimatedArrivalDate] = useState(null);
  const [modeOfTransport, setModeOfTransport] = useState("");
  const [cartonCount, setCartonCount] = useState("");

  // ─── Products & Lines ────────────────────────────────────────────
  const [allProducts, setAllProducts] = useState([]); 
  // grouped: { [pn]: { colors: { [color]: qty } } }
  const [grouped, setGrouped] = useState({}); 

  // ─── Modal state ─────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  // modalSelections: { [pn]: { colors: { [color]:qty }, generic: [ { color, qty } ] } }
  const [modalSelections, setModalSelections] = useState({});

  // ─── Helpers ──────────────────────────────────────────────────────
  const handleImgError = e => {
    const src = e.target.src;
    if (/\.jpe?g$/i.test(src)) {
      e.target.src = src.replace(/\.jpe?g$/i, ".png");
    } else {
      e.target.src = "/images/default-product.jpg";
    }
  };

  const sortPN = (a, b) => a.localeCompare(b, undefined, { numeric: true });

  // ─── Load existing order ──────────────────────────────────────────
  useEffect(() => {
    async function fetchData() {
      try {
        // 1) load all lines for this receiveNumber
        const resp1 = await fetch(
          `${API_BASE}/api/received/received-entries/all/all`
        );
        const rows = await resp1.json();
        const mine = rows.filter(r => r.receive_number === receiveNumber);
        if (!mine.length) throw new Error("No data for " + receiveNumber);

        const meta = mine[0];
        setShopId(String(meta.shop_id));
        setSeriesName(meta.series_name);
        setSeriesId(meta.series_id);
        setReceivedDate(new Date(meta.actual_arrival_date));
        setDispatchDate(meta.dispatch_date ? new Date(meta.dispatch_date) : null);
        setEstimatedArrivalDate(
          meta.estimated_arrival_date ? new Date(meta.estimated_arrival_date) : null
        );
        setModeOfTransport(meta.mode_of_transport || "");
        setCartonCount(String(meta.notes || ""));

        // 2) map shop_id → shop_number
        const respSh = await fetch(`${API_BASE}/api/shops-with-series`);
        const shopsList = await respSh.json();
        const shopEntry = shopsList.find(s => s.shop_id === meta.shop_id);
        setShopNumber(shopEntry?.shop_number || meta.shop_id);

        // 3) load all products (for modal + img)
        const respP = await fetch(
          `${API_BASE}/api/products/shop/${meta.shop_id}/series/${encodeURIComponent(meta.series_name)}`
        );
        const prods = await respP.json();
        setAllProducts(
          prods.map(p => ({
            productNumber: p.product_number,
            colors:        p.colors || [],
            isActive:      !!p.is_active,
            shop_id:       p.shop_id,
            series_id:     p.series_id,
          }))
        );

        // 4) build grouped + prefill generic rows
        const grp = {};
        mine.forEach(r => {
          const pn = r.product_number;
          grp[pn] = grp[pn] || { colors: {} };
          grp[pn].colors[r.color] = r.quantity;
        });
        setGrouped(grp);

      } catch (err) {
        console.error("❌ Error loading:", err);
        alert("Failed to load received order.");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [receiveNumber]);

  // ─── Handlers for existing lines ─────────────────────────────────
  const handleQtyChange = (pn, color, v) => {
    const q = parseInt(v, 10) || 0;
    setGrouped(g => ({
      ...g,
      [pn]: { colors: { ...g[pn].colors, [color]: q } }
    }));
  };
  const handleRemove = pn => {
    setGrouped(g => {
      const nxt = { ...g };
      delete nxt[pn];
      return nxt;
    });
  };

  // ─── Modal open/close & search ────────────────────────────────────
  const openModal = () => {
    setSearchTerm("");
    // seed modalSelections with any already‐added grouped items
    const seed = {};
    Object.entries(grouped).forEach(([pn, { colors }]) => {
      seed[pn] = {
        colors: { ...colors },
        generic: []  // we'll add new generic rows below
      };
    });
    setModalSelections(seed);
    setShowModal(true);
  };
  const closeModal = () => setShowModal(false);

  // ─── Modal quantity change ───────────────────────────────────────
  const handleModalQty = (pn, color, v) => {
    setModalSelections(ms => {
      const entry = ms[pn] || { colors: {}, generic: [] };
      const q = parseInt(v, 10) || 0;
      return {
        ...ms,
        [pn]: { ...entry, colors: { ...entry.colors, [color]: q } }
      };
    });
  };

  // ─── Modal generic row add/edit/remove ──────────────────────────
  const addGenericRow = pn => {
    setModalSelections(ms => {
      const entry = ms[pn] || { colors: {}, generic: [] };
      return {
        ...ms,
        [pn]: {
          ...entry,
          generic: [...entry.generic, { color: "", qty: "" }]
        }
      };
    });
  };
  const handleGenericChange = (pn, idx, field, v) => {
    setModalSelections(ms => {
      const entry = ms[pn];
      const gen = entry.generic.map((r,i)=> i===idx ? { ...r, [field]: v } : r);
      return { ...ms, [pn]: { ...entry, generic: gen } };
    });
  };
  const removeGenericRow = (pn, idx) => {
    setModalSelections(ms => {
      const entry = ms[pn];
      const gen = entry.generic.filter((_,i)=>i!==idx);
      return { ...ms, [pn]: { ...entry, generic: gen } };
    });
  };

  // ─── Confirm additions from modal ─────────────────────────────────
  const handleAddConfirm = () => {
    // merge modalSelections into grouped
    setGrouped(g => {
      const out = { ...g };
      Object.entries(modalSelections).forEach(([pn, { colors, generic }]) => {
        // collect only positive quantities
        const qmap = {};
        Object.entries(colors).forEach(([c,q])=>{ if(q>0) qmap[c]=q; });
        generic.forEach(r => {
          const c=r.color.trim(), q=parseInt(r.qty,10)||0;
          if (c&&q>0) qmap[c]=q;
        });
        if (Object.keys(qmap).length) {
          out[pn] = { colors: qmap };
        } else {
          delete out[pn];
        }
      });
      return out;
    });
    closeModal();
  };

  // ─── Save back to server ─────────────────────────────────────────
  const handleSave = async () => {
    const entries = [];
    Object.entries(grouped).forEach(([pn,{colors}])=>{
      Object.entries(colors).forEach(([c,q])=>{
        entries.push({
          product_number: pn,
          color:          c,
          quantity:       q,
          received_date:  receivedDate.toISOString().slice(0,10)
        });
      });
    });
    const payload = {
      dispatch_date:           dispatchDate?.toISOString().slice(0,10) || null,
      estimated_arrival_date:  estimatedArrivalDate?.toISOString().slice(0,10) || null,
      mode_of_transport:       modeOfTransport || null,
      notes:                   cartonCount || null,
      entries
    };
    try {
      await updateReceive(receiveNumber, payload);
      alert("✅ Received order updated");
      navigate("/view-received-orders");
    } catch (err) {
      console.error("❌ Update failed:", err);
      alert(err.message || "Save failed");
    }
  };

  // ─── Render ──────────────────────────────────────────────────────
  if (loading) {
    return <p className="p-6 text-gray-500">Loading…</p>;
  }

  // products we can still add
  const existingPN = new Set(Object.keys(grouped));
  const available = allProducts
    .filter(p=>!existingPN.has(p.productNumber))
    .filter(p=>p.productNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a,b)=>sortPN(a.productNumber,b.productNumber));

  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-6">
        ✏️ Edit Received Order {receiveNumber}
      </h2>

      {/* Meta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {[{label:"Shop",value:shopNumber},{label:"Series",value:seriesName}].map(f=>(
          <div key={f.label}>
            <label className="block text-sm font-medium text-gray-700">{f.label}</label>
            <input readOnly value={f.value}
              className="mt-1 block w-full border px-3 py-2 rounded bg-gray-100"
            />
          </div>
        ))}
        <div>
          <label className="block text-sm font-medium text-gray-700">Received Date</label>
          <DatePicker
            selected={receivedDate}
            onChange={setReceivedDate}
            dateFormat="yyyy-MM-dd"
            className="mt-1 block w-full border px-3 py-2 rounded bg-white"
          />
        </div>
      </div>

      {/* More metadata */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Dispatch Date</label>
          <DatePicker
            selected={dispatchDate}
            onChange={setDispatchDate}
            dateFormat="yyyy-MM-dd"
            className="mt-1 block w-full border px-3 py-2 rounded bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Estimated Arrival</label>
          <DatePicker
            selected={estimatedArrivalDate}
            onChange={setEstimatedArrivalDate}
            dateFormat="yyyy-MM-dd"
            className="mt-1 block w-full border px-3 py-2 rounded bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mode of Transport</label>
          <select
            value={modeOfTransport}
            onChange={e=>setModeOfTransport(e.target.value)}
            className="mt-1 block w-full border px-3 py-2 rounded bg-white"
          >
            <option value="">-- Select --</option>
            <option value="AIR">Air</option>
            <option value="SEA">Sea</option>
          </select>
        </div>
        <div className="col-span-full">
          <label className="block text-sm font-medium text-gray-700">No. of Cartons</label>
          <input
            type="number"
            min="0"
            value={cartonCount}
            onChange={e=>setCartonCount(e.target.value)}
            className="mt-1 block w-full border px-3 py-2 rounded bg-white"
          />
        </div>
      </div>

      {/* Existing lines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Object.keys(grouped).sort(sortPN).map(pn => {
          const prod = allProducts.find(p=>p.productNumber===pn);
          const img  = `/images/shop-${prod.shop_id}/series-${prod.series_id}/${pn}.jpg`;
          return (
            <div key={pn} className="relative bg-white border rounded-lg p-4 shadow">
              <button
                onClick={()=>handleRemove(pn)}
                className="absolute top-2 right-2 text-red-500 hover:scale-110"
              >✕</button>
              <img
                src={img}
                alt={pn}
                onError={handleImgError}
                className="w-full h-32 object-contain mb-2"
              />
              <div className="font-semibold text-center mb-2">{pn}</div>
              {Object.entries(grouped[pn].colors).map(([c,q])=>(
                <div key={c} className="mb-2">
                  <label className="block text-xs text-gray-600">{c}</label>
                  <input
                    type="number"
                    min="0"
                    value={q}
                    onChange={e=>handleQtyChange(pn,c,e.target.value)}
                    className="w-full border px-2 py-1 rounded text-sm"
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex justify-between mt-6">
        <button
          onClick={openModal}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >+ Add Product</button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >💾 Save Changes</button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow-lg w-11/12 md:w-3/4 lg:w-1/2">
            <h3 className="text-xl font-semibold mb-4">Add / Edit Products</h3>
            <input
              type="search"
              placeholder="Search product…"
              value={searchTerm}
              onChange={e=>setSearchTerm(e.target.value)}
              className="w-full mb-4 border px-3 py-2 rounded"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-80 overflow-y-auto">
              {available.map(p=>{
                const img = `/images/shop-${p.shop_id}/series-${p.series_id}/${p.productNumber}.jpg`;
                const entry = modalSelections[p.productNumber] || { colors: {}, generic: [] };
                return (
                  <div key={p.productNumber} className="border rounded p-4 flex flex-col items-center">
                    <img
                      src={img}
                      alt={p.productNumber}
                      onError={handleImgError}
                      className="w-24 h-24 object-contain mb-2"
                    />
                    <div className="font-medium mb-1">{p.productNumber}</div>
                    <div className={`text-xs mb-2 ${p.isActive?"text-green-600":"text-red-600"}`}>
                      {p.isActive?"Active":"Inactive"}
                    </div>

                    {/* fixed colors */}
                    {p.colors.length>0 && p.colors.map(c=>(
                      <input key={c}
                        type="number" min="0"
                        placeholder={c}
                        value={entry.colors[c]||""}
                        onChange={e=>handleModalQty(p.productNumber,c,e.target.value)}
                        className="w-full text-xs border px-2 py-1 rounded mb-1"
                      />
                    ))}

                    {/* generic */}
                    {p.colors.length===0 && (
                      <>
                        {entry.generic.map((r,idx)=>(
                          <div key={idx} className="border rounded p-2 w-full mb-2">
                            <input
                              type="text"
                              placeholder="Color"
                              value={r.color}
                              onChange={e=>handleGenericChange(p.productNumber,idx,"color",e.target.value)}
                              className="w-full text-xs border px-2 py-1 rounded mb-1"
                            />
                            <input
                              type="number" min="0"
                              placeholder="Qty"
                              value={r.qty}
                              onChange={e=>handleGenericChange(p.productNumber,idx,"qty",e.target.value)}
                              className="w-full text-xs border px-2 py-1 rounded mb-1"
                            />
                            <button
                              onClick={()=>removeGenericRow(p.productNumber,idx)}
                              className="text-red-600 text-xs hover:underline"
                            >✕ Remove</button>
                          </div>
                        ))}
                        <button
                          onClick={()=>addGenericRow(p.productNumber)}
                          className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded"
                        >+ Add Color</button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={closeModal}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded"
              >Cancel</button>
              <button
                onClick={handleAddConfirm}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >Add Selected</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
