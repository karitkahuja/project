// client/src/pages/orders/AddOrderPage.jsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { getAllShopsWithSeries } from "../../api/shopService";
import {
  getNextOrderNumber,
  createOrder,
} from "../../api/orderService";
import Loading from "../../components/Loading";

export default function AddOrderPage() {
  const navigate = useNavigate();

  const [shops, setShops]             = useState([]);
  const [shopId, setShopId]           = useState("");
  const [seriesName, setSeriesName]   = useState("");
  const [seriesId, setSeriesId]       = useState(null);
  const [orderNumber, setOrderNumber] = useState("");

  const [products, setProducts]       = useState([]);
  const [selections, setSelections]   = useState({});
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState("");

  // 1️⃣ Load shops & next order number
  useEffect(() => {
    const init = async () => {
      try {
        const shopsData = await getAllShopsWithSeries();
        setShops(shopsData);
        const next = await getNextOrderNumber();
        setOrderNumber(next);
      } catch (err) {
        console.error("❌ Init failed:", err);
        setError("Could not load initial data.");
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // 2️⃣ Clear when shop changes
  useEffect(() => {
    setSeriesName("");
    setSeriesId(null);
    setProducts([]);
    setSelections({});
  }, [shopId]);

  // 3️⃣ When both shop + series selected, fetch products
  useEffect(() => {
    if (!shopId || !seriesName) return;

    setLoading(true);
    fetch(`/api/products/shop/${shopId}/series/${encodeURIComponent(seriesName)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load products: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setSeriesId(data[0].series_id);
        }
        data.sort((a, b) => {
          const aNum = parseInt(a.product_number.split("-")[1], 10);
          const bNum = parseInt(b.product_number.split("-")[1], 10);
          return aNum - bNum;
        });
        setProducts(data);
        setSelections({});
      })
      .catch((err) => {
        console.error("❌ Load products failed:", err);
        setError("Could not load products for that Series.");
      })
      .finally(() => setLoading(false));
  }, [shopId, seriesName]);

  // Toggle Add / Remove a product
  const toggleProduct = (prodNum, isGeneric) => {
    setSelections((prev) => {
      if (prev[prodNum]) {
        // un-select
        const { [prodNum]: _, ...rest } = prev;
        return rest;
      }
      // select
      return {
        ...prev,
        [prodNum]: isGeneric ? [] : {},
      };
    });
  };

  // Non-generic: handle per-color qty
  const handleQtyChange = (prodNum, colorKey, value) => {
    setSelections((prev) => ({
      ...prev,
      [prodNum]: {
        ...(prev[prodNum] || {}),
        [colorKey]: value,
      },
    }));
  };

  // Generic: add a new color+qty row
  const addGenericColorRow = (prodNum) => {
    setSelections((prev) => {
      const arr = prev[prodNum] || [];
      return {
        ...prev,
        [prodNum]: [...arr, { color: "", qty: "" }],
      };
    });
  };

  // Generic: update a row
  const handleGenericChange = (prodNum, idx, field, value) => {
    setSelections((prev) => {
      const arr = [...prev[prodNum]];
      arr[idx] = { ...arr[idx], [field]: value };
      return { ...prev, [prodNum]: arr };
    });
  };

  // Generic: remove a row
  const removeGenericColorRow = (prodNum, idx) => {
    setSelections((prev) => {
      const arr = prev[prodNum].filter((_, i) => i !== idx);
      return { ...prev, [prodNum]: arr };
    });
  };

  // 4️⃣ Submit new order
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!shopId || !seriesName) {
      return alert("Please select a Shop and Series before adding items.");
    }

    const lines = [];

    for (const [prodNum, data] of Object.entries(selections)) {
      const prod = products.find((p) => p.product_number === prodNum);
      if (!prod) continue;

      if (prod.colors.length > 0) {
        // Non-generic: data is { color → qty }
        for (const [color, qtyStr] of Object.entries(data)) {
          const qty = parseInt(qtyStr, 10) || 0;
          if (qty > 0) {
            lines.push({
              productNumber: prodNum,
              quantities:    { [color]: qty },
            });
          }
        }
      } else {
        // Generic: data is array of { color, qty }
        data.forEach(({ color, qty }) => {
          const q = parseInt(qty, 10) || 0;
          const c = (color || "").trim();
          if (c && q > 0) {
            lines.push({
              productNumber: prodNum,
              quantities:    { [c]: q },
            });
          }
        });
      }
    }

    if (lines.length === 0) {
      return alert("Please add at least one item with valid color & quantity.");
    }

    setSubmitting(true);
    try {
      await createOrder({
        order_number: orderNumber,
        shop_id:      Number(shopId),
        series_name:  seriesName,
        products:     lines,
      });
      alert("✅ Order successfully created!");
      navigate("/view-orders");
    } catch (err) {
      console.error("❌ Save order failed:", err);
      alert("Could not save order. Check console for details.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-6">Add New Order</h1>
      {error && <p className="text-red-600 mb-4">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Order Number */}
        <div>
          <label className="block mb-1 font-medium">Order Number</label>
          <input
            type="text"
            value={orderNumber}
            readOnly
            className="w-full border bg-gray-100 px-3 py-2 rounded text-gray-700"
          />
        </div>

        {/* Shop & Series */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 font-medium">Shop</label>
            <select
              value={shopId}
              onChange={(e) => setShopId(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              required
              disabled={submitting}
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
              value={seriesName}
              onChange={(e) => setSeriesName(e.target.value)}
              className="w-full border px-3 py-2 rounded"
              required
              disabled={!shopId || submitting}
            >
              <option value="">-- Select Series --</option>
              {shops
                .find((s) => s.shop_id === Number(shopId))
                ?.series_list.map((sr) => (
                  <option key={sr.series_id} value={sr.series_name}>
                    {sr.series_name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Product Grid */}
        {products.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {products.map((prod) => {
              const isGeneric   = prod.colors.length === 0;
              const isSelected  = Boolean(selections[prod.product_number]);

              return (
                <div
                  key={prod.product_number}
                  className="border rounded p-3 flex flex-col items-center"
                >
                  <img
                    src={`/images/shop-${shopId}/series-${seriesId}/${prod.product_number}.jpg`}
                    alt={prod.product_number}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = `/images/shop-${shopId}/series-${seriesId}/${prod.product_number}.png`;
                    }}
                    className="w-32 h-32 object-contain mb-2 bg-gray-100 rounded"
                  />

                  <div className="font-medium mb-1">
                    {prod.product_number}
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleProduct(prod.product_number, isGeneric)}
                    className="text-blue-600 text-xs hover:underline mb-2"
                    disabled={submitting}
                  >
                    {isSelected ? "Remove" : "Add"}
                  </button>

                  {isSelected && (
                    <div className="w-full space-y-3">
                      {isGeneric ? (
                        <>
                          <button
                            type="button"
                            onClick={() => addGenericColorRow(prod.product_number)}
                            className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded mb-1"
                            disabled={submitting}
                          >
                            + Add Color
                          </button>

                          {(selections[prod.product_number] || []).map((row, idx) => (
                            <div
                              key={idx}
                              className="border rounded p-2 bg-gray-50 space-y-2"
                            >
                              <div>
                                <label className="block text-xs font-medium text-gray-700">
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
                                  disabled={submitting}
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700">
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
                                  disabled={submitting}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => removeGenericColorRow(prod.product_number, idx)}
                                className="text-red-600 text-xs hover:underline"
                                disabled={submitting}
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
                              value={selections[prod.product_number]?.[color] || ""}
                              onChange={(e) =>
                                handleQtyChange(prod.product_number, color, e.target.value)
                              }
                              className="w-full border px-2 py-1 text-xs rounded"
                              disabled={submitting}
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
          className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded font-semibold disabled:opacity-50"
          disabled={submitting}
        >
          {submitting ? "Saving…" : "Save Order"}
        </button>
      </form>
    </div>
  );
}
