// src/api/imageService.js
import { API_BASE_URL } from "../constants";

/**
 * Upload product image using FormData
 * Returns: { filename: string }
 */
export async function uploadProductImage(formData) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/products/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Upload failed with response:", errorText);
      throw new Error("Image upload failed");
    }

    const data = await response.json();
    console.log("✅ Image uploaded successfully:", data);
    return data;
  } catch (error) {
    console.error("❌ Error uploading product image:", error.message);
    throw error;
  }
}
