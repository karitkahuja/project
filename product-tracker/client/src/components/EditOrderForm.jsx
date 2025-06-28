// src/components/EditOrderForm.jsx

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams }            from "react-router-dom";
import DatePicker                           from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import { API_BASE_URL }          from "../constants";
import { getAllShopsWithSeries } from "../api/shopService";
import { getOrderForEdit, updateOrder } from "../api/orderService";

const EditOrderForm = () => {
  const { orderNumber } = useParams();
  const navigate        = useNavigate();

  // ─── State ────────────────────────────────────────────────────────
  const [loading, setLoading]             = useState(true);
  const [statusMessage, setStatusMessage] = useState("");
  const [shopsList, setShopsList]         = useState([]);
  const [shopId, setShopId]               = useState("");
  const [seriesList, setSeriesList]       = useState([]);
  const [seriesId, setSeriesId]           = useState(null);
  const [seriesName, setSeriesName]       = useState("");
  const [orderDate, setOrderDate]         = useState("");
  const [productLines, setProductLines]   = useState([]);
  const [allProducts, setAllProducts]     = useState([]);

  // Modal state
  const [showModal, setShowModal]         = useState(false);
  const [searchTerm, setSearchTerm]       = useState("");
  const [newSelections, setNewSelections] = useState({});
  const [newGenericRows, setNewGenericRows] = useState({});

  // ─── Helpers ──────────────────────────────────────────────────────
  const sortByNumber = (a, b) => {
    const na = parseInt((a.productNumber||"").replace(/\D/g,""), 10) || 0;
    const nb = parseInt((b.productNumber||"").replace(/\D/g,""), 10) || 0;
    return na - nb;
  };

  // ─── Load shops & series ─────────────────────────────────────────
  useEffect(() => {
    getAllShopsWithSeries()
      .then(d => setShopsList(d || []))
      .catch(e => {
        console.error(e);
        alert("Unable to load shops/series.");
      });
  }, []);

  // ─── When shop changes, update series list ───────────────────────
  useEffect(() => {
    if (!shopId) return setSeriesList([]);
    const shop = shopsList.find(s => String(s.shop_id) === String(shopId));
    setSeriesList(shop?.series_list || []);
  }, [shopId, shopsList]);

  // ─── Load order for editing ───────────────────────────────────────
  const loadOrder = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getOrderForEdit(orderNumber);
      setShopId(String(data.shop_id));
      setSeriesId(data.series_id);
      setSeriesName(data.series_name);
      setOrderDate(data.order_date);

      // Fetch catalog for this shop/series
      const resp = await fetch(
        `${API_BASE_URL}/api/products/shop/${data.shop_id}/series/${encodeURIComponent(data.series_name)}`
      );
      if (!resp.ok) throw new Error("Failed to load products");
      const catalog = await resp.json();

      const norm = (catalog || [])
        .map(r => ({
          productNumber: r.product_number,
          colors:        Array.isArray(r.colors) ? r.colors : [],
          isActive:      Boolean(r.is_active),
          series_id:     r.series_id
        }))
        .sort(sortByNumber);
      setAllProducts(norm);

      // Build existing order lines
      const map = {};
      (data.products || []).forEach(p => {
        map[p.productNumber] = p.quantities || {};
      });
      const lines = norm
        .filter(p => map[p.productNumber])
        .map(p => {
          const saved = map[p.productNumber];
          let cols = p.colors.slice();
          if (!cols.length) cols = Object.keys(saved); // generic
          const qtys = {};
          cols.forEach(c => (qtys[c] = saved[c] || 0));
          return {
            productNumber: p.productNumber,
            colors:        cols,
            isGeneric:     p.colors.length === 0,
            isActive:      p.isActive,
            quantities:    qtys
          };
        })
        .sort(sortByNumber);
      setProductLines(lines);
    } catch (err) {
      console.error(err);
      alert("Unable to load order.");
    } finally {
      setLoading(false);
    }
  }, [orderNumber]);

  useEffect(() => {
    if (orderNumber) loadOrder();
  }, [orderNumber, loadOrder]);

  // ─── Handlers for shop/series change ─────────────────────────────
  const handleShopChange = val => {
    if (productLines.length && !window.confirm("Changing shop clears products.")) return;
    setShopId(val);
    setSeriesId(null);
    setSeriesName("");
    setProductLines([]);
    setAllProducts([]);
  };
  const handleSeriesChange = val => {
    if (productLines.length && !window.confirm("Changing series clears products.")) return;
    setSeriesName(val);
    const s = seriesList.find(x => x.series_name === val);
    setSeriesId(s?.series_id || null);

    if (shopId && s) {
      setLoading(true);
      fetch(`${API_BASE_URL}/api/products/shop/${shopId}/series/${encodeURIComponent(val)}`)
        .then(r => r.ok ? r.json() : Promise.reject("Load failed"))
        .then(data => {
          const norm = (data||[])
            .map(r => ({
              productNumber: r.product_number,
              colors:        Array.isArray(r.colors) ? r.colors : [],
              isActive:      Boolean(r.is_active),
              series_id:     r.series_id
            }))
            .sort(sortByNumber);
          setAllProducts(norm);
        })
        .catch(() => {
          alert("Failed to load products for that series.");
          setAllProducts([]);
          setSeriesId(null);
          setSeriesName("");
        })
        .finally(() => setLoading(false));
    }
  };

  // ─── Modal open/close ─────────────────────────────────────────────
  const openModal  = () => setShowModal(true);
  const closeModal = () => {
    setShowModal(false);
    setSearchTerm("");
    setNewSelections({});
    setNewGenericRows({});
  };

  // ─── Non-generic select ───────────────────────────────────────────
  const handleSelect = (prod, qty, color) => {
    setNewSelections(prev => {
      const copy = { ...prev };
      if (!copy[prod]) copy[prod] = {};
      copy[prod][color] = qty;
      return copy;
    });
  };

  // ─── Generic rows management ──────────────────────────────────────
  const addGenericModalRow = prod => {
    setNewGenericRows(prev => {
      const arr = prev[prod] || [];
      return { ...prev, [prod]: [...arr, { color: "", qty: "" }] };
    });
  };
  const handleGenericModalChange = (prod, idx, field, val) => {
    setNewGenericRows(prev => {
      const arr = [...(prev[prod]||[])];
      arr[idx] = { ...arr[idx], [field]: val };
      return { ...prev, [prod]: arr };
    });
  };
  const removeGenericModalRow = (prod, idx) => {
    setNewGenericRows(prev => {
      const arr = [...(prev[prod]||[])];
      arr.splice(idx,1);
      return { ...prev, [prod]: arr };
    });
  };

  // ─── Commit modal selections ──────────────────────────────────────
  const handleAddSelections = () => {
    const additions = [];

    // Non-generic:
    Object.entries(newSelections).forEach(([prod, colorMap]) => {
      const meta = allProducts.find(p=>p.productNumber===prod);
      const active = Boolean(meta?.isActive);
      Object.entries(colorMap).forEach(([color, qRaw]) => {
        const q = parseInt(qRaw,10) || 0;
        if (q>0) additions.push({
          productNumber: prod,
          colors:        [color],
          isGeneric:     false,
          isActive:      active,
          quantities:    { [color]: q }
        });
      });
    });

    // Generic (for every product that has rows):
    Object.entries(newGenericRows).forEach(([prod, rows]) => {
      const meta   = allProducts.find(p=>p.productNumber===prod);
      const active = Boolean(meta?.isActive);
      rows.forEach(r => {
        const c = r.color.trim();
        const q = parseInt(r.qty,10) || 0;
        if (c && q>0) additions.push({
          productNumber: prod,
          colors:        [c],
          isGeneric:     true,
          isActive:      active,
          quantities:    { [c]: q }
        });
      });
    });

    setProductLines(pl => [...pl, ...additions].sort(sortByNumber));
    closeModal();
  };

  // ─── Edit-line handlers ───────────────────────────────────────────
  const handleRemoveLine = prod =>
    setProductLines(pl => pl.filter(l=>l.productNumber!==prod));
  const handleQuantityChange = (prod, color, val) =>
    setProductLines(pl =>
      pl.map(l=>
        l.productNumber!==prod
          ? l
          : { ...l, quantities: { ...l.quantities, [color]: val<0?0:val } }
      )
    );

  // ─── Save changes ─────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault();
    if (!shopId||!seriesId) return alert("Shop & Series required.");
    const payload = {
      shop_id:   Number(shopId),
      series_id: Number(seriesId),
      products:  productLines.map(l=>({
        productNumber: l.productNumber,
        quantities:    { ...l.quantities }
      }))
    };
    try {
      setLoading(true);
      await updateOrder(orderNumber, payload);
      navigate("/view-orders");
    } catch (err) {
      console.error(err);
      setStatusMessage("Error saving. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // ─── RENDER ───────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto p-6 bg-white rounded shadow">
      <h2 className="text-2xl font-bold mb-6">Edit Order {orderNumber}</h2>

      {loading ? (
        <p className="text-gray-500">Loading…</p>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Shop / Series / Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Shop</label>
              <select
                value={shopId}
                onChange={e=>handleShopChange(e.target.value)}
                className="mt-1 block w-full border px-3 py-2 rounded"
              >
                <option value="">-- Select Shop --</option>
                {shopsList.map(s=>(
                  <option key={s.shop_id} value={s.shop_id}>
                    {s.shop_number}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Series</label>
              <select
                value={seriesName}
                onChange={e=>handleSeriesChange(e.target.value)}
                className="mt-1 block w-full border px-3 py-2 rounded"
              >
                <option value="">-- Select Series --</option>
                {seriesList.map(sr=>(
                  <option key={sr.series_id} value={sr.series_name}>
                    {sr.series_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Order Date</label>
              <DatePicker
                selected={orderDate?new Date(orderDate):null}
                onChange={d=>setOrderDate(d.toISOString().slice(0,10))}
                dateFormat="yyyy-MM-dd"
                className="mt-1 block w-full border px-3 py-2 rounded bg-white"
              />
            </div>
          </div>

          {/* Existing product lines */}
          <div className="grid grid-cols-1 gap-4 mb-6">
            {productLines.map(l=>(
              <div key={l.productNumber}
                   className="border rounded-lg bg-white shadow-sm p-4 flex flex-col md:flex-row md:items-center">
                <div className="w-48 h-48 bg-gray-100 overflow-hidden flex-shrink-0">
                  <img
                    src={`/images/shop-${shopId}/series-${seriesId}/${l.productNumber}.jpg`}
                    alt={l.productNumber}
                    className="object-contain max-h-full mx-auto"
                    onError={e=>{
                      e.currentTarget.onerror=null;
                      e.currentTarget.src=`/images/shop-${shopId}/series-${seriesId}/${l.productNumber}.png`;
                    }}
                  />
                </div>
                <div className="flex-1 ml-4">
                  <div className="text-lg font-semibold">{l.productNumber}</div>
                  <div className={`text-sm ${l.isActive?"text-green-600":"text-red-600"}`}>
                    {l.isActive?"Active":"Inactive"}
                  </div>
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {l.colors.map(c=>(
                      <div key={`${l.productNumber}-${c}`}>
                        <label className="block text-xs font-medium text-gray-700">{c}</label>
                        <input
                          type="number"
                          min="0"
                          value={l.quantities[c]||0}
                          onChange={e=>handleQuantityChange(l.productNumber,c,Number(e.target.value))}
                          className="w-full border px-2 py-1 rounded"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={()=>handleRemoveLine(l.productNumber)}
                  className="text-red-500 hover:text-red-700 ml-auto mt-4 md:mt-0"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* Add / Save */}
          <div className="flex justify-between items-center">
            {statusMessage && <span className="text-red-600">{statusMessage}</span>}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={openModal}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
              >
                + Add Products
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                💾 Save Changes
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Add Products Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center">
          <div className="bg-white max-w-4xl w-full p-6 rounded shadow-lg overflow-auto">
            <h3 className="text-xl font-semibold mb-4">Add Products</h3>
            <input
              type="text"
              placeholder="Search products…"
              value={searchTerm}
              onChange={e=>setSearchTerm(e.target.value)}
              className="w-full border px-3 py-2 rounded mb-4"
            />

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {allProducts
                .filter(p=>
                  p.productNumber.toLowerCase().includes(searchTerm.toLowerCase()) &&
                  !productLines.some(l=>l.productNumber===p.productNumber)
                )
                .map(p=>(
                  <div key={p.productNumber}
                       className="w-56 flex-shrink-0 border rounded-lg bg-white shadow-sm p-4 flex flex-col items-center">
                    <div className="w-32 h-32 bg-gray-100 overflow-hidden mb-2">
                      <img
                        src={`/images/shop-${shopId}/series-${seriesId}/${p.productNumber}.jpg`}
                        alt={p.productNumber}
                        className="object-contain max-h-full mx-auto"
                        onError={e=>{
                          e.currentTarget.onerror=null;
                          e.currentTarget.src=`/images/shop-${shopId}/series-${seriesId}/${p.productNumber}.png`;
                        }}
                      />
                    </div>
                    <div className="font-semibold">{p.productNumber}</div>
                    <div className={`text-xs ${p.isActive?"text-green-600":"text-red-600"}`}>
                      {p.isActive?"Active":"Inactive"}
                    </div>

                    {p.colors.length>0 ? (
                      <div className="mt-2 w-full grid grid-cols-1 gap-2">
                        {p.colors.map(c=>(
                          <div key={c}>
                            <label className="block text-xs font-medium">{c}</label>
                            <input
                              type="number"
                              min="0"
                              value={newSelections[p.productNumber]?.[c]||""}
                              onChange={e=>handleSelect(p.productNumber,Number(e.target.value),c)}
                              className="w-full border px-2 py-1 rounded"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 w-full space-y-3">
                        <button
                          type="button"
                          onClick={()=>addGenericModalRow(p.productNumber)}
                          className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded"
                        >
                          + Add Color
                        </button>

                        {(newGenericRows[p.productNumber]||[]).map((row,idx)=>(
                          <div key={idx} className="w-full border rounded p-3 space-y-2">
                            <div>
                              <label className="block text-xs font-medium text-gray-700">Color</label>
                              <input
                                type="text"
                                placeholder="Color"
                                value={row.color}
                                onChange={e=>handleGenericModalChange(p.productNumber,idx,"color",e.target.value)}
                                className="w-full border px-2 py-1 text-xs rounded"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700">Qty</label>
                              <input
                                type="number"
                                min="0"
                                placeholder="Qty"
                                value={row.qty}
                                onChange={e=>handleGenericModalChange(p.productNumber,idx,"qty",e.target.value)}
                                className="w-full border px-2 py-1 text-xs rounded"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={()=>removeGenericModalRow(p.productNumber,idx)}
                              className="text-red-600 text-xs hover:underline"
                            >
                              × Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              }
            </div>

            <div className="flex justify-end gap-4 mt-6">
              <button
                onClick={closeModal}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSelections}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
              >
                Add Selected
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditOrderForm;
