const express = require("express");
const axios = require("axios");

const router = express.Router();

const Patient = require("../models/Patient");
const Measurement = require("../models/Measurement");


// ============================================================
// CREATE PATIENT
// ============================================================

router.post("/", async (req, res) => {

    try {

        const patient = await Patient.create({
            patientCode: req.body.patientCode,
            name: req.body.name,
            age: Number(req.body.age),
            gender: req.body.gender
        });

        res.status(201).json(patient);

    } catch (error) {

        console.error("Create patient error:", error);

        res.status(500).json({
            error: error.message
        });

    }

});


// ============================================================
// GET ALL PATIENTS
// ============================================================

router.get("/", async (req, res) => {

    try {

        const patients = await Patient.find()
            .sort({ createdAt: -1 });

        res.json(patients);

    } catch (error) {

        console.error("Get patients error:", error);

        res.status(500).json({
            error: error.message
        });

    }

});


// ============================================================
// GET ONE PATIENT
// ============================================================

router.get("/:id", async (req, res) => {

    try {

        const patient = await Patient.findById(
            req.params.id
        );

        if (!patient) {

            return res.status(404).json({
                error: "Patient not found"
            });

        }

        res.json(patient);

    } catch (error) {

        console.error("Get patient error:", error);

        res.status(500).json({
            error: error.message
        });

    }

});


// ============================================================
// UPDATE PATIENT AGE
// ============================================================

router.put("/:id", async (req, res) => {

    try {

        const updateData = {};

        if (req.body.age !== undefined) {
            updateData.age = Number(req.body.age);
        }

        if (req.body.name !== undefined) {
            updateData.name = req.body.name;
        }

        if (req.body.gender !== undefined) {
            updateData.gender = req.body.gender;
        }


        const patient =
            await Patient.findByIdAndUpdate(
                req.params.id,
                updateData,
                {
                    new: true,
                    runValidators: true
                }
            );


        if (!patient) {

            return res.status(404).json({
                error: "Patient not found"
            });

        }


        res.json(patient);

    } catch (error) {

        console.error("Update patient error:", error);

        res.status(500).json({
            error: error.message
        });

    }

});


// ============================================================
// GET PATIENT HISTORY
// ============================================================

router.get("/:id/history", async (req, res) => {

    try {

        const measurements =
            await Measurement.find({
                patientId: req.params.id
            })
            .sort({
                date: 1,
                createdAt: 1
            });


        // Compatibility with older records:
        // If an old measurement does not have visitNumber,
        // assign its position in the sorted history.
        const history = measurements.map(
            (measurement, index) => {

                const data =
                    measurement.toObject();

                return {
                    ...data,

                    visitNumber:
                        data.visitNumber ||
                        index + 1
                };

            }
        );


        res.json(history);

    } catch (error) {

        console.error("Get history error:", error);

        res.status(500).json({
            error: error.message
        });

    }

});


// ============================================================
// SAVE MEASUREMENT
// ============================================================

router.post("/:id/measurements", async (req, res) => {

    try {

        const patient =
            await Patient.findById(req.params.id);


        if (!patient) {

            return res.status(404).json({
                error: "Patient not found"
            });

        }


        // ------------------------------------------------------
        // Automatically calculate next visit number
        // ------------------------------------------------------

        const existingMeasurements =
            await Measurement.find({
                patientId: req.params.id
            })
            .sort({
                visitNumber: 1,
                date: 1,
                createdAt: 1
            });


        let nextVisitNumber =
            existingMeasurements.length + 1;


        // Protect against older records / gaps
        const visitNumbers =
            existingMeasurements
                .map(m => Number(m.visitNumber))
                .filter(n => Number.isFinite(n));


        if (visitNumbers.length > 0) {

            const highestVisit =
                Math.max(...visitNumbers);

            nextVisitNumber =
                Math.max(
                    nextVisitNumber,
                    highestVisit + 1
                );

        }


        // ------------------------------------------------------
        // Validate eGFR
        // ------------------------------------------------------

        const calculatedEGFR =
            Number(req.body.calculatedEGFR);

        const finalEGFR =
            Number(req.body.finalEGFR);


        if (
            !Number.isFinite(calculatedEGFR) ||
            !Number.isFinite(finalEGFR)
        ) {

            return res.status(400).json({
                error: "Valid calculated and final eGFR values are required."
            });

        }


        // ------------------------------------------------------
        // Create measurement
        // ------------------------------------------------------

        const measurement =
            await Measurement.create({

                patientId: req.params.id,

                visitNumber:
                    nextVisitNumber,

                date:
                    req.body.date,

                calculatedEGFR:
                    calculatedEGFR,

                finalEGFR:
                    finalEGFR,

                serumCreatinine:
                    Number(
                        req.body.serumCreatinine
                    ),

                UACR:
                    Number(
                        req.body.UACR
                    ),

                systolicBP:
                    Number(
                        req.body.systolicBP
                    ),

                diastolicBP:
                    Number(
                        req.body.diastolicBP
                    ),

                diabetes:
                    Number(
                        req.body.diabetes
                    ),

                ckdPrediction:
                    req.body.ckdPrediction,

                ckdProbability:
                    req.body.ckdProbability

            });


        res.status(201).json(measurement);

    } catch (error) {

        console.error(
            "Save measurement error:",
            error
        );


        // Duplicate visit protection
        if (error.code === 11000) {

            return res.status(409).json({
                error:
                    "A measurement already exists for this visit. Please try again."
            });

        }


        res.status(500).json({
            error: error.message
        });

    }

});


// ============================================================
// UPDATE FINAL eGFR
// ============================================================

router.put(
    "/:patientId/measurements/:measurementId",
    async (req, res) => {

        try {

            const finalEGFR =
                Number(req.body.finalEGFR);


            if (!Number.isFinite(finalEGFR)) {

                return res.status(400).json({
                    error:
                        "A valid final eGFR is required."
                });

            }


            const measurement =
                await Measurement.findOneAndUpdate(

                    {
                        _id:
                            req.params.measurementId,

                        patientId:
                            req.params.patientId
                    },

                    {
                        finalEGFR:
                            finalEGFR
                    },

                    {
                        new: true,
                        runValidators: true
                    }

                );


            if (!measurement) {

                return res.status(404).json({
                    error:
                        "Measurement not found"
                });

            }


            res.json(measurement);

        } catch (error) {

            console.error(
                "Update measurement error:",
                error
            );


            res.status(500).json({
                error: error.message
            });

        }

    }
);


// ============================================================
// PROGRESSION DATA
// ============================================================

router.get(
    "/:id/progression",
    async (req, res) => {

        try {

            const patient =
                await Patient.findById(
                    req.params.id
                );


            if (!patient) {

                return res.status(404).json({
                    error: "Patient not found"
                });

            }


            const measurements =
                await Measurement.find({
                    patientId: req.params.id
                })
                .sort({
                    date: 1,
                    createdAt: 1
                });


            const history =
                measurements.map(
                    (measurement, index) => {

                        const data =
                            measurement.toObject();

                        return {
                            ...data,
                            visitNumber:
                                data.visitNumber ||
                                index + 1
                        };

                    }
                );


            const validHistory =
                history.filter(
                    item =>
                        Number.isFinite(
                            Number(item.finalEGFR)
                        )
                );


            const count =
                validHistory.length;


            if (count === 0) {

                return res.json({
                    historyCount: 0,
                    currentEGFR: null,
                    message:
                        "No eGFR measurements available."
                });

            }


            const currentEGFR =
                Number(
                    validHistory[count - 1].finalEGFR
                );


            // ==================================================
            // ONE MEASUREMENT
            // ==================================================

            if (count === 1) {

                return res.json({

                    historyCount: 1,

                    currentEGFR:
                        currentEGFR,

                    observedTrend:
                        "Insufficient history",

                    message:
                        "One measurement is available. More measurements are needed to assess change over time."

                });

            }


            // ==================================================
            // TWO MEASUREMENTS
            // ==================================================

            if (count === 2) {

                const firstEGFR =
                    Number(
                        validHistory[0].finalEGFR
                    );

                const change =
                    currentEGFR -
                    firstEGFR;

                const percentageChange =
                    firstEGFR !== 0
                        ? (
                            (change / firstEGFR) *
                            100
                        )
                        : 0;


                let trend = "Stable";

                if (change < 0) {
                    trend = "Declining";
                } else if (change > 0) {
                    trend = "Improving";
                }


                return res.json({

                    historyCount: 2,

                    currentEGFR:
                        currentEGFR,

                    change:
                        Number(change.toFixed(2)),

                    percentageChange:
                        Number(
                            percentageChange.toFixed(2)
                        ),

                    observedTrend:
                        trend,

                    message:
                        "Observed change is available. More longitudinal measurements are needed for a stronger progression assessment."

                });

            }


            // ==================================================
            // THREE OR MORE MEASUREMENTS
            // ==================================================

            const firstEGFR =
                Number(
                    validHistory[0].finalEGFR
                );


            const change =
                currentEGFR -
                firstEGFR;


            const percentageChange =
                firstEGFR !== 0
                    ? (
                        (change / firstEGFR) *
                        100
                    )
                    : 0;


            // Use first and last observations
            // for a simple observed trajectory.
            let trend = "Stable";

            if (change < -0.5) {
                trend = "Declining";
            } else if (change > 0.5) {
                trend = "Improving";
            }


            // ==================================================
            // MODEL-READY AFTER 4 MEASUREMENTS
            // ==================================================

            let progressionModel = null;


            if (count >= 4) {

                const modelHistory =
                    validHistory
                        .slice(0, 4)
                        .map(
                            item =>
                                Number(
                                    item.finalEGFR
                                )
                        );


                // Try the existing Flask progression
                // endpoint. The payload contains several
                // compatible names so the ML service can
                // consume the historical eGFR values.
                try {

                    const mlResponse =
                        await axios.post(

                            "http://localhost:5001/predict-progression",

                            {
                                egfr_history:
                                    modelHistory,

                                history:
                                    modelHistory,

                                egfr_values:
                                    modelHistory,

                                historical_egfr:
                                    modelHistory,

                                egfr_baseline:
                                    modelHistory[0],

                                egfr_w3:
                                    modelHistory[1],

                                egfr_w13:
                                    modelHistory[2],

                                egfr_w26:
                                    modelHistory[3]
                            },

                            {
                                timeout: 10000
                            }

                        );


                    progressionModel =
                        mlResponse.data;

                } catch (modelError) {

                    console.error(
                        "Progression model error:",
                        modelError.message
                    );

                    progressionModel = {
                        available: false,
                        error:
                            "Progression model could not be reached."
                    };

                }

            }


            res.json({

                historyCount:
                    count,

                currentEGFR:
                    currentEGFR,

                change:
                    Number(
                        change.toFixed(2)
                    ),

                percentageChange:
                    Number(
                        percentageChange.toFixed(2)
                    ),

                observedTrend:
                    trend,

                progressionModel:
                    progressionModel

            });


        } catch (error) {

            console.error(
                "Progression error:",
                error
            );


            res.status(500).json({
                error:
                    error.message
            });

        }

    }
);


module.exports = router;
