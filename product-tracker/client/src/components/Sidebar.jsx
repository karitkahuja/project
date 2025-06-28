// src/components/Sidebar.jsx

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllShopsWithSeries } from "../api/shopService";
import Loading from "./Loading";

/**
 * Sidebar for listing shops and their series.
 * When you click a series, it
 * 1️⃣ calls onSelectSeries to update App’s state,
 * 2️⃣ navigates to /view-products?shopId=…&seriesId=…
 */
export default function Sidebar({ selectedSeries, onSelectSeries }) {
  const [shops, setShops]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [expandedShopId, setExpandedShopId] = useState(null);
  const navigate = useNavigate();

  // Load all active shops with their series
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const all = await getAllShopsWithSeries();
        if (!mounted) return;
        setShops(all.filter(s => s.is_active !== false));
      } catch (err) {
        console.error("❌ Failed to load shops:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return <Loading message="Loading shops…" />;

  return (
    <aside className="w-64 bg-gray-100 p-4 shadow-md overflow-y-auto h-screen">
      <h2 className="text-xl font-bold mb-4">🏬 Shops</h2>
      {shops.length === 0 ? (
        <p className="text-sm text-gray-500">No active shops found.</p>
      ) : (
        shops.map(shop => {
          const isExpanded = expandedShopId === shop.shop_id;
          return (
            <div key={shop.shop_id} className="mb-4">
              <button
                className="w-full text-left font-semibold text-blue-600 hover:underline"
                onClick={() =>
                  setExpandedShopId(isExpanded ? null : shop.shop_id)
                }
              >
                Shop {shop.shop_number}
              </button>

              {isExpanded && (
                <div className="mt-2 ml-3 space-y-1">
                  {shop.series_list?.length > 0 ? (
                    shop.series_list.map(series => {
                      const isSelected =
                        selectedSeries?.shop_id === shop.shop_id &&
                        selectedSeries?.series_id === series.series_id;

                      return (
                        <button
                          key={series.series_id}
                          className={`block w-full text-left px-3 py-1 rounded-md ${
                            isSelected
                              ? "bg-blue-500 text-white"
                              : "hover:bg-gray-200"
                          }`}
                          onClick={() => {
                            // 1️⃣ Update App state
                            onSelectSeries({
                              shop_id:     shop.shop_id,
                              shop_number: shop.shop_number,
                              series_id:   series.series_id,
                              series_name: series.series_name,
                            });
                            // 2️⃣ Navigate into ProductsPage with filters
                            navigate(
                              `/view-products?shopId=${shop.shop_id}` +
                              `&seriesId=${series.series_id}`
                            );
                          }}
                        >
                          {series.series_name}
                        </button>
                      );
                    })
                  ) : (
                    <p className="text-sm text-gray-400 ml-2 italic">
                      No series available
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </aside>
  );
}
