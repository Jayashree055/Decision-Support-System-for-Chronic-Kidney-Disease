const express = require("express");
const axios = require("axios");
const cors = require("cors");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:5001";
const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

// Forward the Flask status and body so validation errors (400) and an
// unavailable model (503) reach the frontend instead of a generic 500.
function sendMlError(res, error, fallbackMessage) {
    console.error("ML API Error:", error.message);

    if (error.response) {
        return res.status(error.response.status).json({
            success: false,
            message: error.response.data?.error || fallbackMessage,
            fields: error.response.data?.fields,
            detail: error.response.data?.detail
        });
    }

    res.status(502).json({
        success: false,
        message: "ML service is not reachable. Is it running on port 5001?"
    });
}

app.post("/api/predict-ckd", async (req, res) => {
    try {
        const patientData = req.body;

        console.log("Received patient data:", patientData);

        // Send patient data to Flask ML API
        const response = await axios.post(
            `${ML_SERVICE_URL}/predict`,
            patientData
        );

        console.log("ML response:", response.data);

        // Send ML result back to frontend
        res.json({
            success: true,
            prediction: response.data.prediction,
            probability: response.data.probability,
            egfr: response.data.egfr,
            explanation: response.data.explanation
        });

    } catch (error) {
        sendMlError(res, error, "Unable to get prediction from ML service");
    }
});

app.post("/api/risk-score", async (req, res) => {
    try {
        const response = await axios.post(
            `${ML_SERVICE_URL}/risk-score`,
            req.body
        );

        res.json({ success: true, ...response.data });

    } catch (error) {
        sendMlError(res, error, "Unable to calculate risk score");
    }
});

app.listen(PORT, () => {
    console.log(`Node server running on http://localhost:${PORT}`);
});
