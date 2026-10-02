const mongoose = require("mongoose");

const measurementSchema = new mongoose.Schema(
    {
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Patient",
            required: true
        },

        visitNumber: {
            type: Number,
            required: true
        },

        date: {
            type: Date,
            required: true
        },

        calculatedEGFR: {
            type: Number,
            required: true
        },

        finalEGFR: {
            type: Number,
            required: true
        },

        serumCreatinine: {
            type: Number,
            required: true
        },

        UACR: {
            type: Number,
            required: true
        },

        systolicBP: {
            type: Number,
            required: true
        },

        diastolicBP: {
            type: Number,
            required: true
        },

        diabetes: {
            type: Number,
            required: true
        },

        ckdPrediction: {
            type: Number
        },

        ckdProbability: {
            type: Number
        },
        shapExplanation: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        // Optional information for personalized recommendations
        recommendationData: {
            // Blood tests and measurements
            potassium: {
                type: Number,
                default: null
            },

            phosphorus: {
                type: Number,
                default: null
            },

            hemoglobin: {
                type: Number,
                default: null
            },

            bun: {
                type: Number,
                default: null
            },

            bodyWeight: {
                type: Number,
                default: null
            },

            serumAlbumin: {
                type: Number,
                default: null
            },

            bicarbonate: {
                type: Number,
                default: null
            },

            urineOutput: {
                type: Number,
                default: null
            },

            // Clinical information
            dialysisStatus: {
                type: String,
                enum: ["yes", "no", null],
                default: null
            },

            edema: {
                type: Boolean,
                default: null
            },

            // Lifestyle information
            fatigueLevel: {
                type: Number,
                default: null
            },

            physicalActivity: {
                type: Number,
                default: null
            },

            dietQuality: {
                type: String,
                default: null
            },

            notes: {
                type: String,
                default: null
            }
        }
    },
    {
        timestamps: true
    }
);

// One visit number per patient
measurementSchema.index(
    {
        patientId: 1,
        visitNumber: 1
    },
    {
        unique: true
    }
);

module.exports = mongoose.model(
    "Measurement",
    measurementSchema
);