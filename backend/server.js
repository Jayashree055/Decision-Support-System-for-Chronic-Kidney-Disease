const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const patientRoutes = require("./routes/patients");

const app = express();


// ============================================
// MIDDLEWARE
// ============================================

app.use(cors());
app.use(express.json());


// ============================================
// MONGODB CONNECTION
// ============================================

mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully");
    })
    .catch((error) => {
        console.error(
            "MongoDB connection error:",
            error
        );
    });


// ============================================
// PATIENT ROUTES
// ============================================

app.use(
    "/api/patients",
    patientRoutes
);


// ============================================
// CKD PREDICTION
// ============================================

// ============================================
// CKD PREDICTION
// ============================================

app.post("/api/predict-ckd", async (req, res) => {
    try {
        console.log("CKD prediction request:", req.body);

        const response = await axios.post(
            "http://localhost:5001/predict",
            req.body
        );

        console.log("Flask prediction response:", response.data);

        res.status(response.status).json(response.data);

    } catch (error) {
        console.error("CKD prediction error:", error.message);

        if (error.response) {
            console.error(
                "Flask status:",
                error.response.status
            );

            console.error(
                "Flask error response:",
                error.response.data
            );

            return res
                .status(error.response.status)
                .json(error.response.data);
        }

        res.status(503).json({
            error: "Unable to connect to the CKD prediction service.",
            details: error.message
        });
    }
});

// ============================================
// PROGRESSION PREDICTION
// ============================================

app.post(
    "/api/predict-progression",
    async (req, res) => {

        try {

            const response =
                await axios.post(
                    "http://localhost:5001/predict-progression",
                    req.body
                );

            res.json(response.data);

        } catch (error) {

            console.error(
                "Progression prediction error:",
                error.message
            );

            res.status(500).json({
                error:
                    "Progression prediction service unavailable"
            });

        }

    }
);


// ============================================
// SERVER
// ============================================

app.listen(
    5000,
    () => {
        console.log(
            "Node backend running on port 5000"
        );
    }
);