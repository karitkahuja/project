// client/src/pages/received/EditReceivedOrderPage.jsx

import React from "react";
import { useParams } from "react-router-dom";
import EditReceivedOrderForm from "../../components/EditReceivedOrderForm";

export default function EditReceivedOrderPage() {
  const { receiveNumber } = useParams();

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">
        ✏️ Edit Received Order {receiveNumber}
      </h1>
      <EditReceivedOrderForm />
    </div>
  );
}
