// client/src/App.jsx

import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

// 🧱 Layout
import Sidebar from "./components/Sidebar";
import Navbar  from "./components/Navbar";

// 📊 Dashboard
import DashboardPage from "./pages/dashboard/DashboardPage";

// 📦 Products
import ProductsPage       from "./pages/products/ProductsPage";
import ProductDetailsPage from "./pages/products/ProductDetailsPage";
import AddProductPage     from "./pages/products/AddProductPage";
import EditProductPage    from "./pages/products/EditProductPage";

// 🏬 Shops
import ViewShopsPage from "./pages/shops/ViewShopsPage";
import AddShopPage   from "./pages/shops/AddShopPage";
import EditShopPage  from "./pages/shops/EditShopPage";

// 🧬 Series
import AddSeriesPage  from "./pages/series/AddSeriesPage";
import EditSeriesPage from "./pages/series/EditSeriesPage";
import ViewSeriesPage from "./pages/series/ViewSeriesPage";

// 📑 Orders
import ViewOrdersPage       from "./pages/orders/ViewOrdersPage";
import ViewOrdersByShopPage from "./pages/orders/ViewOrdersByShopPage";
import AddOrderPage         from "./pages/orders/AddOrderPage";
import EditOrderPage        from "./pages/orders/EditOrderPage";

// 📥 Received Orders
import ViewReceivedPage       from "./pages/received/ViewReceivedPage";
import AddReceivedOrderPage   from "./pages/received/AddReceivedOrderPage";
import EditReceivedOrderPage  from "./pages/received/EditReceivedOrderPage";
import DeleteReceivedPage     from "./pages/received/DeleteReceivedOrderPage";
import ReceivedOrderBillsPage from "./pages/received/ReceivedOrderBillsPage";

// ⏳ Pending Orders
import PendingProductsPage from "./pages/pending/PendingProductsPage";
import InTransitPage       from "./pages/pending/InTransitPage";
import TotalPendingPage    from "./pages/pending/TotalPendingPage";

// 📊 Stock
import StockPage from "./pages/stock/StockPage";

// 💰 Sales
import SalesRecordsPage from "./pages/sales/SalesRecordsPage";
import SalesPage        from "./pages/sales/SalesPage";

// 📡 Initial Load
import { getAllShopsWithSeries } from "./api/shopService";

function App() {
  const [shops, setShops]                   = useState([]);
  const [selectedSeries, setSelectedSeries] = useState(null);

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const data = await getAllShopsWithSeries();
        setShops(data);
        if (data.length > 0 && data[0].series_list.length > 0) {
          const firstShop   = data[0];
          const firstSeries = firstShop.series_list[0];
          setSelectedSeries({
            shop_id:     firstShop.shop_id,
            shop_number: firstShop.shop_number,
            series_id:   firstSeries.series_id,
            series_name: firstSeries.series_name,
          });
        }
      } catch (err) {
        console.error("❌ Failed to load initial shop/series:", err.message);
      }
    };
    fetchInitial();
  }, []);

  return (
    <Router>
      <div className="flex min-h-screen">
        <Sidebar
          selectedSeries={selectedSeries}
          onSelectSeries={setSelectedSeries}
        />
        <div className="flex-1 flex flex-col">
          <Navbar />
          <main className="p-4">
            <Routes>
              {/* Dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Products */}
              <Route
                path="/view-products"
                element={<ProductsPage selectedSeries={selectedSeries} />}
              />
              <Route path="/product/:id" element={<ProductDetailsPage />} />
              <Route path="/add-product" element={<AddProductPage />} />
              <Route path="/edit-product/:productId" element={<EditProductPage />} />

              {/* Shops */}
              <Route path="/view-shops" element={<ViewShopsPage />} />
              <Route path="/add-shop" element={<AddShopPage />} />
              <Route path="/edit-shop/:shopId" element={<EditShopPage />} />

              {/* Series */}
              <Route path="/add-series" element={<AddSeriesPage />} />
              <Route path="/edit-series/:seriesId" element={<EditSeriesPage />} />
              <Route path="/view-series" element={<ViewSeriesPage />} />

              {/* Orders */}
              <Route path="/view-orders" element={<ViewOrdersPage />} />
              <Route
                path="/view-orders-by-shop/:shopId/:seriesName"
                element={<ViewOrdersByShopPage />}
              />
              <Route path="/add-order" element={<AddOrderPage />} />
              <Route path="/edit-order/:orderNumber" element={<EditOrderPage />} />

              {/* Received Orders */}
              <Route
                path="/view-received-orders"
                element={<ViewReceivedPage />}
              />
              <Route
                path="/add-received-order"
                element={<AddReceivedOrderPage />}
              />
              <Route
                path="/edit-received-order/:receiveNumber"
                element={<EditReceivedOrderPage />}
              />
              <Route
                path="/delete-received-order/:receiveNumber"
                element={<DeleteReceivedPage />}
              />
              <Route
                path="/received-order-bills"
                element={<ReceivedOrderBillsPage />}
              />

              {/* Pending Orders */}
              <Route
                path="/pending/products"
                element={<PendingProductsPage />}
              />
              <Route
                path="/pending/in-transit"
                element={<InTransitPage />}
              />
              <Route
                path="/pending/total-pending"
                element={<TotalPendingPage />}
              />

              {/* Stock */}
              <Route path="/stock" element={<StockPage />} />

              {/* Sales */}
              <Route path="/sales"   element={<SalesRecordsPage />} />
              <Route path="/add-sales" element={<SalesPage />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;
