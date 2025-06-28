// client/src/pages/products/ProductsPage.jsx

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate, useLocation }      from "react-router-dom";
import { getAllProducts }                from "../../api/productService";
import { getAllShopsWithSeries }         from "../../api/shopService";

export default function ProductsPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);

  // 1️⃣ State, initialized from URL params
  const [selectedShop,   setSelectedShop]   = useState(params.get("shopId")   || "");
  const [selectedSeries, setSelectedSeries] = useState(params.get("seriesId") || "");
  const [searchText,     setSearchText]     = useState("");

  const [products, setProducts] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [shops,    setShops]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  // 2️⃣ Load products & shops on mount
  useEffect(() => {
    const loadAll = async () => {
      try {
        setLoading(true);
        const [prods, shopList] = await Promise.all([
          getAllProducts(),
          getAllShopsWithSeries()
        ]);
        setProducts(prods);
        setShops(shopList);
      } catch (e) {
        console.error(e);
        setError("Failed to load products or shops.");
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  // 3️⃣ Re-sync filters whenever URL’s query-string changes
  useEffect(() => {
    const p = new URLSearchParams(search);
    setSelectedShop(p.get("shopId")   || "");
    setSelectedSeries(p.get("seriesId") || "");
  }, [search]);

  // 4️⃣ Build series dropdown options based on selectedShop
  const seriesOptions = useMemo(() => {
    if (!selectedShop) {
      // all series across all shops
      const all = new Map();
      shops.forEach(s =>
        s.series_list.forEach(sr => all.set(sr.series_id, sr.series_name))
      );
      return Array.from(all, ([id, name]) => ({ series_id: id, series_name: name }))
                  .sort((a, b) => a.series_name.localeCompare(b.series_name));
    }
    // series for this shop
    const shop = shops.find(s => s.shop_id === +selectedShop);
    return (shop?.series_list || [])
      .map(sr => ({ series_id: sr.series_id, series_name: sr.series_name }))
      .sort((a, b) => a.series_name.localeCompare(b.series_name));
  }, [shops, selectedShop]);

  // 5️⃣ Apply all filters whenever inputs change
  useEffect(() => {
    let out = [...products];
    if (selectedShop)   out = out.filter(p => p.shop_id   === +selectedShop);
    if (selectedSeries) out = out.filter(p => p.series_id === +selectedSeries);
    if (searchText.trim()) {
      const txt = searchText.toLowerCase();
      out = out.filter(p => p.product_number.toLowerCase().includes(txt));
    }
    out.sort((a, b) =>
      a.product_number.localeCompare(b.product_number, undefined, { numeric: true })
    );
    setFiltered(out);
  }, [products, selectedShop, selectedSeries, searchText]);

  const getShopNo = id =>
    shops.find(s => s.shop_id === id)?.shop_number || id;

  if (loading) return <p className="p-6">Loading…</p>;
  if (error)   return <p className="p-6 text-red-600">{error}</p>;

  return (
    <div className="p-6 max-w-7xl mx-auto bg-white rounded shadow space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🧾 Products</h1>
        <button
          onClick={() => navigate("/add-product")}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          ➕ Add Product
        </button>
      </div>

      {/* ─── Filters ─────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {/* Shop */}
        <div>
          <label className="block mb-1 text-sm font-medium">
            Filter by Shop
          </label>
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={selectedShop}
            onChange={e => setSelectedShop(e.target.value)}
          >
            <option value="">All Shops</option>
            {shops.map(s => (
              <option key={s.shop_id} value={s.shop_id}>
                Shop {s.shop_number}
              </option>
            ))}
          </select>
        </div>

        {/* Series */}
        <div>
          <label className="block mb-1 text-sm font-medium">
            Filter by Series
          </label>
          <select
            className="w-full border rounded px-3 py-2 text-sm disabled:opacity-50"
            value={selectedSeries}
            onChange={e => setSelectedSeries(e.target.value)}
            disabled={!seriesOptions.length}
          >
            <option value="">All Series</option>
            {seriesOptions.map(s => (
              <option key={s.series_id} value={s.series_id}>
                {s.series_name}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="md:col-span-2 lg:col-span-1">
          <label className="block mb-1 text-sm font-medium">
            Search Product
          </label>
          <input
            type="text"
            placeholder="e.g. P-101"
            className="w-full border rounded px-3 py-2 text-sm"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
          />
        </div>
      </div>

      {/* ─── Product Grid ────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <p className="text-gray-500">No products match your criteria.</p>
      ) : (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map(p => {
            const imgFile = p.image_filename
              ? p.image_filename.replace(/\.[^/.]+$/, ext => ext.toLowerCase())
              : `${p.product_number}.jpg`;
            const imgSrc = `/images/shop-${p.shop_id}/series-${p.series_id}/${imgFile}`;

            return (
              <div
                key={p.id}
                onClick={() => navigate(`/product/${p.id}`)}
                className="cursor-pointer bg-white border rounded-lg shadow-sm hover:shadow-md"
              >
                <div className="h-48 bg-gray-100 flex items-center justify-center overflow-hidden">
                  <img
                    src={imgSrc}
                    alt={p.product_number}
                    className="max-h-full object-contain"
                    onError={e => {
                      e.target.onerror = null;
                      e.target.src = "/images/default-product.jpg";
                    }}
                  />
                </div>
                <div className="p-2 text-center">
                  <div className="font-semibold">{p.product_number}</div>
                  <div className="text-xs text-gray-500">
                    Shop {getShopNo(p.shop_id)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
