// src/components/Loading.jsx

import React from "react";

const Loading = ({ message = "Loading..." }) => {
  return (
    <div className="flex items-center justify-center h-full py-10">
      <div className="text-center">
        <div className="loader mx-auto mb-4 border-4 border-t-4 border-gray-300 rounded-full w-12 h-12 animate-spin"></div>
        <p className="text-gray-600 text-lg font-medium">{message}</p>
      </div>
    </div>
  );
};

export default Loading;
