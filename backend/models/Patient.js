const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
    {
        patientCode: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },

        name: {
            type: String,
            required: true,
            trim: true
        },

        age: {
            type: Number,
            required: true,
            min: 0,
            max: 120
        },

        gender: {
            type: String,
            required: true,
            enum: ["Male", "Female"]
        }
    },
    {
        timestamps: true
    }
);


module.exports = mongoose.model(
    "Patient",
    patientSchema
);
