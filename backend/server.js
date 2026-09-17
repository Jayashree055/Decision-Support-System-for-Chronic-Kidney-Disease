const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.post("/api/predict-ckd", async (req, res) => {
    try {
        const patientData = req.body;

        console.log("Received patient data:", patientData);

        // Send patient data to Flask ML API
        const response = await axios.post(
            "http://127.0.0.1:5001/predict",
            patientData
        );

        console.log("ML response:", response.data);

        // Send ML result back to frontend
        res.json({
            success: true,
            prediction: response.data.prediction,
            probability: response.data.probability,
            egfr: response.data.egfr
        });

    } catch (error) {
        console.error("ML API Error:", error.message);

        res.status(500).json({
            success: false,
            message: "Unable to get prediction from ML service"
        });
    }
});
app.listen(5000, () => {
    console.log("Node server running on http://localhost:5000");
});