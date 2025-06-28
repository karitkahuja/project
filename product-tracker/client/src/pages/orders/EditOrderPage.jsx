// src/pages/orders/EditOrderPage.jsx

import React from "react";
import { useParams } from "react-router-dom";
import EditOrderForm from "../../components/EditOrderForm";

const EditOrderPage = () => {
  const { orderNumber } = useParams();
  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Edit Order {orderNumber}</h1>
      <EditOrderForm orderNumber={orderNumber} />
    </div>
  );
};

export default EditOrderPage;
