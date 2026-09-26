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

app.post(
    "/api/predict-ckd",
    async (req, res) => {

        try {

            const response =
                await axios.post(
                    "http://localhost:5001/predict",
                    req.body
                );

            res.json(response.data);

        } catch (error) {

            console.error(
                "CKD prediction error:",
                error.message
            );

            res.status(500).json({
                error:
                    "CKD prediction service unavailable"
            });

        }

    }
);


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