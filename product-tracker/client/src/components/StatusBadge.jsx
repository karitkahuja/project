// src/components/StatusBadge.jsx

import React from "react";

const StatusBadge = ({ status }) => {
  let color = "bg-gray-400";
  let label = "Unknown";

  switch (status) {
    case "pending":
      color = "bg-red-500";
      label = "Pending";
      break;
    case "partial":
      color = "bg-yellow-500";
      label = "Partially Received";
      break;
    case "received":
      color = "bg-green-600";
      label = "Fully Received";
      break;
    default:
      break;
  }

  return (
    <span className={`inline-block px-2 py-1 text-xs text-white rounded ${color}`}>
      {label}
    </span>
  );
};

export default StatusBadge;
