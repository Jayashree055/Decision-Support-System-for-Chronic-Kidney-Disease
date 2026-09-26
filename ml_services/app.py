from flask import Flask, request, jsonify
import pandas as pd
import numpy as np
import joblib

app = Flask(__name__)


# ============================================================
# LOAD CKD SCREENING MODEL
# ============================================================

ckd_model = joblib.load(
    "model/gradient_boosting_rural_corrected_model.pkl"
)

ckd_preprocessor = joblib.load(
    "model/rural_corrected_preprocessor.pkl"
)


# ============================================================
# LOAD CKD PROGRESSION MODEL
# ============================================================

progression_artifact = joblib.load(
    "model/ckd_progression_model.pkl"
)

progression_model = progression_artifact["model"]

progression_feature_cols = progression_artifact[
    "feature_cols"
]


# ============================================================
# eGFR CALCULATION
# ============================================================

def calculate_egfr(age, gender, creatinine):

    if gender.lower() == "female":
        kappa = 0.7
        alpha = -0.241
        sex_factor = 1.012
    else:
        kappa = 0.9
        alpha = -0.302
        sex_factor = 1.0

    egfr = (
        142
        * min(creatinine / kappa, 1) ** alpha
        * max(creatinine / kappa, 1) ** -1.200
        * (0.9938 ** age)
        * sex_factor
    )

    return round(egfr, 2)


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/", methods=["GET"])
def home():

    return jsonify({
        "status": "running",
        "service": "CKD ML Service"
    })


# ============================================================
# CKD SCREENING
# ============================================================

@app.route("/predict", methods=["POST"])
def predict():

    try:

        data = request.json

        age = float(data["age"])
        gender = data["gender"]
        creatinine = float(
            data["serum_creatinine"]
        )

        # ----------------------------------------------------
        # Calculate eGFR
        # ----------------------------------------------------

        egfr = calculate_egfr(
            age,
            gender,
            creatinine
        )

        # ----------------------------------------------------
        # Prepare patient data
        # ----------------------------------------------------

        patient = pd.DataFrame([{

            "age": age,

            "gender": gender,

            "bp_systolic": float(
                data["bp_systolic"]
            ),

            "bp_diastolic": float(
                data["bp_diastolic"]
            ),

            "serum_creatinine": creatinine,

            "albumin_creatinine_ratio": float(
                data["albumin_creatinine_ratio"]
            ),

            "diabetes_diagnosed": int(
                data["diabetes_diagnosed"]
            )

        }])

        # ----------------------------------------------------
        # Preprocess
        # ----------------------------------------------------

        patient_processed = ckd_preprocessor.transform(
            patient
        )

        # ----------------------------------------------------
        # Prediction
        # ----------------------------------------------------

        prediction = ckd_model.predict(
            patient_processed
        )[0]

        probability = ckd_model.predict_proba(
            patient_processed
        )[0][1]

        return jsonify({

            "prediction": int(prediction),

            "probability": round(
                float(probability) * 100,
                2
            ),

            "egfr": egfr

        })

    except Exception as e:

        return jsonify({
            "error": str(e)
        }), 500


# ============================================================
# PROGRESSION FEATURE ENGINEERING
# ============================================================

def create_progression_features(
    egfr_baseline,
    egfr_w3,
    egfr_w13,
    egfr_w26
):

    values = [
        egfr_baseline,
        egfr_w3,
        egfr_w13,
        egfr_w26
    ]

    egfr_change = (
        egfr_w26 -
        egfr_baseline
    )

    recent_change = (
        egfr_w26 -
        egfr_w13
    )

    mean_egfr = np.mean(values)

    min_egfr = np.min(values)

    max_egfr = np.max(values)

    # Same calculation used during training
    egfr_std = np.std(
        values,
        ddof=1
    )

    slope_0_3 = (
        egfr_w3 -
        egfr_baseline
    ) / 3

    slope_3_13 = (
        egfr_w13 -
        egfr_w3
    ) / 10

    slope_13_26 = (
        egfr_w26 -
        egfr_w13
    ) / 13

    overall_slope = (
        egfr_w26 -
        egfr_baseline
    ) / 26

    recent_slope = (
        egfr_w26 -
        egfr_w13
    ) / 13

    slope_change_recent = (
        recent_slope -
        slope_3_13
    )

    features = {

        "egfr_baseline": egfr_baseline,

        "egfr_w3": egfr_w3,

        "egfr_w13": egfr_w13,

        "egfr_w26": egfr_w26,

        "egfr_change": egfr_change,

        "recent_change": recent_change,

        "mean_egfr": mean_egfr,

        "min_egfr": min_egfr,

        "max_egfr": max_egfr,

        "egfr_std": egfr_std,

        "slope_0_3": slope_0_3,

        "slope_3_13": slope_3_13,

        "slope_13_26": slope_13_26,

        "overall_slope": overall_slope,

        "recent_slope": recent_slope,

        "slope_change_recent":
            slope_change_recent
    }

    return features


# ============================================================
# CKD PROGRESSION PREDICTION
# ============================================================

@app.route(
    "/predict-progression",
    methods=["POST"]
)
def predict_progression():

    try:

        data = request.json

        # ----------------------------------------------------
        # Required historical measurements
        # ----------------------------------------------------

        required = [
            "egfr_baseline",
            "egfr_w3",
            "egfr_w13",
            "egfr_w26"
        ]

        for field in required:

            if field not in data:

                return jsonify({
                    "error":
                        f"Missing required field: {field}"
                }), 400

        # ----------------------------------------------------
        # Read values
        # ----------------------------------------------------

        egfr_baseline = float(
            data["egfr_baseline"]
        )

        egfr_w3 = float(
            data["egfr_w3"]
        )

        egfr_w13 = float(
            data["egfr_w13"]
        )

        egfr_w26 = float(
            data["egfr_w26"]
        )

        # ----------------------------------------------------
        # Create same features used during training
        # ----------------------------------------------------

        features = create_progression_features(

            egfr_baseline,

            egfr_w3,

            egfr_w13,

            egfr_w26

        )

        # ----------------------------------------------------
        # Maintain exact training feature order
        # ----------------------------------------------------

        X = pd.DataFrame(
            [features],
            columns=progression_feature_cols
        )

        # ----------------------------------------------------
        # Prediction
        # ----------------------------------------------------

        prediction = int(
            progression_model.predict(X)[0]
        )

        probability = float(
            progression_model.predict_proba(X)[0][1]
        )

        # ----------------------------------------------------
        # Outlook
        # ----------------------------------------------------

        if prediction == 1:

            outlook = (
                "Higher likelihood of "
                "persistent decline"
            )

        else:

            outlook = (
                "Lower likelihood of "
                "persistent decline"
            )

        # ----------------------------------------------------
        # Observed historical trend
        # ----------------------------------------------------

        if egfr_w26 < egfr_baseline:

            observed_trend = "Declining"

        elif egfr_w26 > egfr_baseline:

            observed_trend = "Improving"

        else:

            observed_trend = "Stable"

        # ----------------------------------------------------
        # Response
        # ----------------------------------------------------

        return jsonify({

            "prediction": prediction,

            "persistent_decline":
                bool(prediction),

            "probability":
                round(probability * 100, 2),

            "outlook":
                outlook,

            "observed_trend":
                observed_trend,

            "egfr": {

                "baseline":
                    egfr_baseline,

                "week3":
                    egfr_w3,

                "week13":
                    egfr_w13,

                "week26":
                    egfr_w26

            }

        })

    except Exception as e:

        return jsonify({
            "error": str(e)
        }), 500


# ============================================================
# RUN SERVER
# ============================================================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5001,
        debug=False
    )