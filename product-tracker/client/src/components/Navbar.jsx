// client/src/components/Navbar.jsx

import React, { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

const menuItems = [
  { label: "Dashboard",        path: "/dashboard" },
  { label: "Pending Orders",   path: "/pending-orders" }, // dropdown parent
  { label: "Orders",           path: "/view-orders" },
  { label: "Received Orders",  path: "/view-received-orders" },
  { label: "Stock",            path: "/stock" },
  { label: "Sales",            path: "/sales" },
  { label: "Bills",            path: "/received-order-bills" },
  { label: "Shops",            path: "/view-shops" },
  { label: "Series",           path: "/view-series" },
  { label: "Products",         path: "/view-products" }
];

export default function Navbar() {
  const location = useLocation();
  const [pendingOpen, setPendingOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Close dropdown if user clicks outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setPendingOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="bg-gray-800 text-white px-6 py-4 shadow-md z-50">
      <div className="flex flex-wrap items-center gap-6">
        {menuItems.map(item => {
          if (item.label === "Pending Orders") {
            const isActive = location.pathname.startsWith("/pending");
            return (
              <div key="pending-orders" className="relative" ref={wrapperRef}>
                <button
                  onClick={() => setPendingOpen(open => !open)}
                  className={`font-semibold hover:text-blue-400 focus:outline-none ${
                    isActive ? "text-blue-300" : ""
                  }`}
                >
                  {item.label} ▾
                </button>

                {pendingOpen && (
                  <div className="absolute left-0 mt-2 bg-white text-black rounded shadow-lg z-50">
                    <Link
                      to="/pending/products"
                      onClick={() => setPendingOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 ${
                        location.pathname === "/pending/products"
                          ? "bg-gray-200"
                          : ""
                      }`}
                    >
                      Pending Products
                    </Link>
                    <Link
                      to="/pending/in-transit"
                      onClick={() => setPendingOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 ${
                        location.pathname === "/pending/in-transit"
                          ? "bg-gray-200"
                          : ""
                      }`}
                    >
                      In Transit
                    </Link>
                    <Link
                      to="/pending/total-pending"
                      onClick={() => setPendingOpen(false)}
                      className={`block px-4 py-2 hover:bg-gray-100 ${
                        location.pathname === "/pending/total-pending"
                          ? "bg-gray-200"
                          : ""
                      }`}
                    >
                      Total Pending
                    </Link>
                  </div>
                )}
              </div>
            );
          }

          return (
            <Link
              key={item.label}
              to={item.path}
              className={`font-semibold hover:text-blue-400 ${
                location.pathname === item.path ? "text-blue-300" : ""
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
