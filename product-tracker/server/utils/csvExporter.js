// server/utils/csvExporter.js

const { Parser } = require("json2csv");

/**
 * Generates and sends a CSV file from JSON data.
 * @param {Object} res - Express response object
 * @param {Object[]} data - Array of JSON objects to convert
 * @param {Object[]} fields - Array of { label, value } mappings for CSV columns
 * @param {string} filename - Name for the downloaded CSV file
 */
function generateCsvResponse(res, data, fields, filename) {
  try {
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "No data found to export." });
    }

    const parser = new Parser({ fields });
    const csv = parser.parse(data);

    res.header("Content-Type", "text/csv");
    res.attachment(filename);
    return res.send(csv);
  } catch (err) {
    console.error("❌ CSV generation failed:", err.message);
    return res.status(500).json({ error: "Failed to generate CSV." });
  }
}

module.exports = {
  generateCsvResponse,
};
