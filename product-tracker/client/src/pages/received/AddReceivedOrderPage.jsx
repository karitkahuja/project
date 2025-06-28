// client/src/pages/received/AddReceivedOrderPage.jsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { getAllShopsWithSeries } from "../../api/shopService";
import { getProductsByShopAndSeries } from "../../api/productService";
import {
  getNextReceiveNumber,
  createReceive,
} from "../../api/receivedService";

export default function AddReceivedOrderPage() {
  const navigate = useNavigate();

  // — State —
  const [shops, setShops] = useState([]);
  const [shopId, setShopId] = useState("");
  const [seriesList, setSeriesList] = useState([]);
  const [seriesId, setSeriesId] = useState("");
  const [seriesName, setSeriesName] = useState("");
  const [products, setProducts] = useState([]);
  const [selections, setSelections] = useState({}); // either {} or [] per product
  const [receiveNumber, setReceiveNumber] = useState("");
  const [dispatchDate, setDispatchDate] = useState("");
  const [estimatedArrivalDate, setEstimatedArrivalDate] = useState("");
  const [modeOfTransport, setModeOfTransport] = useState("");
  const [notes, setNotes] = useState("");
  const [actualArrivalDate, setActualArrivalDate] = useState("");

  // — Init —
  useEffect(() => {
    getAllShopsWithSeries().then(setShops).catch(console.error);
    getNextReceiveNumber().then(setReceiveNumber).catch(console.error);
    setActualArrivalDate(new Date().toISOString().slice(0, 10));
  }, []);

  // — Shop → seriesList reset —
  useEffect(() => {
    if (!shopId) {
      setSeriesList([]);
      setSeriesId("");
      setSeriesName("");
    } else {
      const shop = shops.find((s) => s.shop_id === Number(shopId));
      setSeriesList(shop?.series_list || []);
      setSeriesId("");
      setSeriesName("");
    }
  }, [shopId, shops]);

  // — Series → products load —
  useEffect(() => {
    if (shopId && seriesName) {
      getProductsByShopAndSeries(Number(shopId), seriesName)
        .then((res) => {
          // sort by numeric suffix
          res.sort((a, b) => {
            const na = parseInt(a.product_number.split("-")[1], 10);
            const nb = parseInt(b.product_number.split("-")[1], 10);
            return na - nb;
          });
          setProducts(res);
          setSelections({});
        })
        .catch(console.error);
    } else {
      setProducts([]);
      setSelections({});
    }
  }, [shopId, seriesName]);

  // — Toggle product add/remove —
  const toggleProduct = (prodNum, isGeneric) => {
    setSelections((prev) => {
      if (prev[prodNum] != null) {
        const { [prodNum]: _, ...rest } = prev;
        return rest;
      } else {
        return {
          ...prev,
          [prodNum]: isGeneric ? [] : {},
        };
      }
    });
  };

  // — Non-generic qty change —
  const handleQtyChange = (prodNum, color, val) => {
    const q = parseInt(val, 10) || "";
    setSelections((prev) => ({
      ...prev,
      [prodNum]: {
        ...(prev[prodNum] || {}),
        [color]: q,
      },
    }));
  };

  // — Generic: add one color row —
  const addGenericRow = (prodNum) => {
    setSelections((prev) => {
      const arr = prev[prodNum] || [];
      return {
        ...prev,
        [prodNum]: [...arr, { color: "", qty: "" }],
      };
    });
  };

  // — Generic: change one row —
  const handleGenericChange = (prodNum, idx, field, val) => {
    setSelections((prev) => {
      const arr = prev[prodNum].map((r, i) =>
        i === idx ? { ...r, [field]: val } : r
      );
      return { ...prev, [prodNum]: arr };
    });
  };

  // — Generic: remove one row —
  const removeGenericRow = (prodNum, idx) => {
    setSelections((prev) => {
      const arr = prev[prodNum].filter((_, i) => i !== idx);
      return { ...prev, [prodNum]: arr };
    });
  };

  // — Save handler —
  const handleSave = async (e) => {
    e.preventDefault();
    if (!shopId || !seriesName) {
      return alert("❗ Select Shop and Series first");
    }

    // build lines
    const lines = [];
    for (const [prodNum, data] of Object.entries(selections)) {
      const prod = products.find((p) => p.product_number === prodNum);
      if (!prod) continue;
      const isGeneric = prod.colors.length === 0;

      if (isGeneric) {
        data.forEach(({ color, qty }) => {
          const q = parseInt(qty, 10) || 0;
          const c = (color || "").trim();
          if (c && q > 0) {
            lines.push({ product_number: prodNum, color: c, quantity: q });
          }
        });
      } else {
        for (const [color, qty] of Object.entries(data)) {
          const q = parseInt(qty, 10) || 0;
          if (q > 0) {
            lines.push({ product_number: prodNum, color, quantity: q });
          }
        }
      }
    }

    if (!lines.length) {
      return alert("❗ Add at least one color + qty");
    }

    try {
      await createReceive({
        receive_number: receiveNumber,
        shop_id: Number(shopId),
        series_name: seriesName,
        actual_arrival_date: actualArrivalDate,
        dispatch_date: dispatchDate || null,
        estimated_arrival_date: estimatedArrivalDate || null,
        mode_of_transport: modeOfTransport || null,
        notes: notes || null,
        lines,
      });

      // Redirect to View Received Orders
      navigate("/view-received-orders");
    } catch (err) {
      console.error(err);
      alert("❌ Save failed");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-6">Add Received Order</h1>
      <form onSubmit={handleSave} className="space-y-6">

        {/* Receive Number */}
        <div>
          <label className="block mb-1 font-medium">Receive Number</label>
          <input
            type="text"
            readOnly
            value={receiveNumber}
            className="w-full border bg-gray-100 px-3 py-2 rounded"
          />
        </div>

        {/* Shop & Series */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 font-medium">Shop</label>
            <select
              className="w-full border px-3 py-2 rounded"
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
            >
              <option value="">-- Select Shop --</option>
              {shops.map((s) => (
                <option key={s.shop_id} value={s.shop_id}>
                  Shop {s.shop_number}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 font-medium">Series</label>
            <select
              className="w-full border px-3 py-2 rounded"
              value={seriesId}
              onChange={(e) => {
                const sid = Number(e.target.value);
                const sel = seriesList.find(
                  (x) => (x.series_id ?? x.id) === sid
                );
                setSeriesId(sid);
                setSeriesName(sel?.series_name || "");
              }}
              disabled={!shopId}
            >
              <option value="">-- Select Series --</option>
              {seriesList.map((sr) => (
                <option key={sr.series_id ?? sr.id} value={sr.series_id ?? sr.id}>
                  {sr.series_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Dispatch, ETA, Mode, Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <label className="block mb-1 font-medium">Dispatch Date</label>
            <input
              type="date"
              value={dispatchDate}
              onChange={(e) => setDispatchDate(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">
              Estimated Arrival
            </label>
            <input
              type="date"
              value={estimatedArrivalDate}
              onChange={(e) => setEstimatedArrivalDate(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">
              Mode of Transport
            </label>
            <select
              className="w-full border px-3 py-2 rounded"
              value={modeOfTransport}
              onChange={(e) => setModeOfTransport(e.target.value)}
            >
              <option value="">-- Select --</option>
              <option value="AIR">Air</option>
              <option value="SEA">Sea</option>
            </select>
          </div>
          <div className="col-span-full">
            <label className="block mb-1 font-medium">
              Notes (e.g. carton count)
            </label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
        </div>

        {/* Products Grid */}
        {products.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {products.map((prod) => {
              const isGeneric = prod.colors.length === 0;
              const isSelected = selections[prod.product_number] != null;

              // build image path
              const fileName = prod.image_filename
                ? prod.image_filename.replace(/\.[^/.]+$/, (ext) =>
                    ext.toLowerCase()
                  )
                : `${prod.product_number}.jpg`;
              const imgSrc = `/images/shop-${shopId}/series-${seriesId}/${fileName}`;

              return (
                <div
                  key={prod.product_number}
                  className="border rounded p-3 flex flex-col items-center"
                >
                  <img
                    src={imgSrc}
                    alt={prod.product_number}
                    className="w-32 h-32 object-contain mb-2"
                    onError={(e) => (e.target.style.display = "none")}
                  />
                  <div className="font-medium mb-1">
                    {prod.product_number}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      toggleProduct(prod.product_number, isGeneric)
                    }
                    className="text-blue-600 text-xs hover:underline mb-2"
                  >
                    {isSelected ? "Remove" : "Add"}
                  </button>

                  {isSelected && (
                    <div className="w-full space-y-3">
                      {isGeneric ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              addGenericRow(prod.product_number)
                            }
                            className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded mb-1"
                          >
                            + Add Color
                          </button>
                          {selections[prod.product_number].map((row, idx) => (
                            <div
                              key={idx}
                              className="border rounded p-2 bg-gray-50 space-y-2"
                            >
                              <div>
                                <label className="block text-xs font-medium">
                                  Color
                                </label>
                                <input
                                  type="text"
                                  placeholder="Color"
                                  value={row.color}
                                  onChange={(e) =>
                                    handleGenericChange(
                                      prod.product_number,
                                      idx,
                                      "color",
                                      e.target.value
                                    )
                                  }
                                  className="w-full border px-2 py-1 text-xs rounded"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium">
                                  Qty
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  placeholder="Qty"
                                  value={row.qty}
                                  onChange={(e) =>
                                    handleGenericChange(
                                      prod.product_number,
                                      idx,
                                      "qty",
                                      e.target.value
                                    )
                                  }
                                  className="w-full border px-2 py-1 text-xs rounded"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  removeGenericRow(
                                    prod.product_number,
                                    idx
                                  )
                                }
                                className="text-red-600 text-xs hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </>
                      ) : (
                        prod.colors.map((color) => (
                          <div key={color}>
                            <label className="block text-xs font-medium">
                              {color}
                            </label>
                            <input
                              type="number"
                              min="0"
                              placeholder="Qty"
                              value={
                                selections[prod.product_number]?.[color] ||
                                ""
                              }
                              onChange={(e) =>
                                handleQtyChange(
                                  prod.product_number,
                                  color,
                                  e.target.value
                                )
                              }
                              className="w-full border px-2 py-1 text-xs rounded"
                            />
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded font-semibold"
        >
          Save Received Order
        </button>
      </form>
    </div>
  );
}
