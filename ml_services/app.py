from pathlib import Path
import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request
from receipt_parser import parse_medical_receipt
from report_generator import generate_pdf_report
from flask import send_file
import io
from explain import explain_prediction, shap_available
from recommendation_engine import generate_recommendations



from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)



CORS(
    app,
    resources={r"/*": {"origins": [
        "http://localhost:5173",
        "http://localhost:5174"
    ]}},
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"]
)

# ---------------------------------------------------------------------
# MODEL DIRECTORY AND MODEL LOADING
# ---------------------------------------------------------------------

MODEL_DIR = Path(__file__).resolve().parent / "model"

# Load the screening model. If loading fails, the Flask service can still
# start, and the health endpoint will report the problem.
try:
    ckd_model = joblib.load(
        MODEL_DIR / "gradient_boosting_rural_model.pkl"
    )
    ckd_preprocessor = joblib.load(
        MODEL_DIR / "rural_preprocessor.pkl"
    )
    model_error = None
except Exception as error:
    ckd_model = None
    ckd_preprocessor = None
    model_error = f"{type(error).__name__}: {error}"
    print(f"WARNING: screening model not loaded ({model_error})")

# The progression artifact is expected to be a dictionary containing
# "model" and "feature_cols", as saved by the training script.
try:
    progression_artifact = joblib.load(
        MODEL_DIR / "ckd_progression_model.pkl"
    )
    progression_model = progression_artifact["model"]
    progression_feature_cols = progression_artifact["feature_cols"]
    progression_model_error = None
except Exception as error:
    progression_model = None
    progression_feature_cols = []
    progression_model_error = f"{type(error).__name__}: {error}"
    print(f"WARNING: progression model not loaded ({progression_model_error})")


# ---------------------------------------------------------------------
# INPUT VALIDATION
# ---------------------------------------------------------------------

# (field, minimum, maximum)
NUMERIC_FIELDS = [
    ("age", 18, 120),
    ("bp_systolic", 50, 300),
    ("bp_diastolic", 30, 200),
    ("serum_creatinine", 0.1, 20),
    ("albumin_creatinine_ratio", 0.1, 10000),
]


def parse_patient(data):
    """Validate the request body and return (patient, errors)."""
    if not isinstance(data, dict):
        return None, {"body": "Expected a JSON object."}

    patient = {}
    errors = {}

    for field, low, high in NUMERIC_FIELDS:
        try:
            value = float(data[field])
        except KeyError:
            errors[field] = "Required."
            continue
        except (TypeError, ValueError):
            errors[field] = "Must be a number."
            continue

        if not np.isfinite(value):
            errors[field] = "Must be a finite number."
        elif not low <= value <= high:
            errors[field] = f"Must be between {low:g} and {high:g}."

        patient[field] = value

    gender = str(data.get("gender", "")).strip().capitalize()
    if gender not in ("Male", "Female"):
        errors["gender"] = "Must be Male or Female."
    patient["gender"] = gender

    diabetes = str(data.get("diabetes_diagnosed", "")).strip()
    if diabetes not in ("0", "1", "0.0", "1.0"):
        errors["diabetes_diagnosed"] = "Must be 0 or 1."
    else:
        patient["diabetes_diagnosed"] = int(float(diabetes))

    # Only compare values when both were parsed successfully.
    systolic = patient.get("bp_systolic")
    diastolic = patient.get("bp_diastolic")
    if systolic is not None and diastolic is not None and diastolic >= systolic:
        errors["bp_diastolic"] = "Must be lower than systolic pressure."

    return patient, errors


def validation_error(errors):
    return jsonify({
        "error": "Invalid patient data",
        "fields": errors,
    }), 400


# ---------------------------------------------------------------------
# eGFR CALCULATION
# ---------------------------------------------------------------------

def calculate_egfr(age, gender, creatinine):
    """
    Calculate eGFR using the 2021 CKD-EPI creatinine equation
    without the race coefficient.
    """
    if str(gender).lower() == "female":
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
    return round(float(egfr), 2)


# ---------------------------------------------------------------------
# HEALTH CHECK
# ---------------------------------------------------------------------

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "status": "running",
        "service": "CKD ML Service",
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "screening_model_loaded": ckd_model is not None,
        "screening_model_error": model_error,
        "progression_model_loaded": progression_model is not None,
        "progression_model_error": progression_model_error,
        "shap_available": shap_available(),
    })


# ---------------------------------------------------------------------
# CKD SCREENING
# ---------------------------------------------------------------------

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True)
    patient, errors = parse_patient(data)
    
    if errors:
        return validation_error(errors)

    if ckd_model is None or ckd_preprocessor is None:
        return jsonify({
            "error": "Screening model is unavailable",
            "detail": model_error,
        }), 503

    try:
        egfr = calculate_egfr(
            patient["age"],
            patient["gender"],
            patient["serum_creatinine"],
        )

        patient_df = pd.DataFrame([{
            "age": patient["age"],
            "gender": patient["gender"],
            "bp_systolic": patient["bp_systolic"],
            "bp_diastolic": patient["bp_diastolic"],
            "serum_creatinine": patient["serum_creatinine"],
            "albumin_creatinine_ratio": patient["albumin_creatinine_ratio"],
            "diabetes_diagnosed": patient["diabetes_diagnosed"],
        }])

        patient_processed = ckd_preprocessor.transform(patient_df)
        prediction = int(ckd_model.predict(patient_processed)[0])
        probability = float(ckd_model.predict_proba(patient_processed)[0][1])

        try:
            explanation = explain_prediction(
                ckd_model,
                ckd_preprocessor,
                patient_df,
            )
        except Exception as explanation_error:
            app.logger.exception("Explanation generation failed")
            explanation = None

        return jsonify({
            "prediction": prediction,
            "probability": round(probability * 100, 2),
            "egfr": egfr,
            "explanation": explanation,
        })

    except Exception as error:
        app.logger.exception("CKD prediction failed")
        return jsonify({"error": str(error)}), 500


# ---------------------------------------------------------------------
# PROGRESSION FEATURE ENGINEERING
# ---------------------------------------------------------------------

def create_progression_features(
    egfr_baseline,
    egfr_w3,
    egfr_w13,
    egfr_w26,
):
    """Create the same 16 historical features used during training."""
    values = [
        egfr_baseline,
        egfr_w3,
        egfr_w13,
        egfr_w26,
    ]

    egfr_change = egfr_w26 - egfr_baseline
    recent_change = egfr_w26 - egfr_w13

    mean_egfr = float(np.mean(values))
    min_egfr = float(np.min(values))
    max_egfr = float(np.max(values))
    egfr_std = float(np.std(values, ddof=1))

    slope_0_3 = (egfr_w3 - egfr_baseline) / 3
    slope_3_13 = (egfr_w13 - egfr_w3) / 10
    slope_13_26 = (egfr_w26 - egfr_w13) / 13
    overall_slope = (egfr_w26 - egfr_baseline) / 26
    recent_slope = (egfr_w26 - egfr_w13) / 13
    slope_change_recent = recent_slope - slope_3_13

    return {
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
        "slope_change_recent": slope_change_recent,
    }


# ---------------------------------------------------------------------
# PERSONALIZED CKD PROGRESSION PREDICTION
# ---------------------------------------------------------------------

@app.route("/predict-progression", methods=["POST"])
def predict_progression():
    if progression_model is None:
        return jsonify({
            "error": "Progression model is unavailable",
            "detail": progression_model_error,
        }), 503

    try:
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return jsonify({"error": "Expected a JSON object."}), 400

        required = [
            "egfr_baseline",
            "egfr_w3",
            "egfr_w13",
            "egfr_w26",
        ]

        missing = [field for field in required if field not in data]
        if missing:
            return jsonify({
                "error": "Missing required historical measurements",
                "fields": missing,
            }), 400

        try:
            egfr_values = {field: float(data[field]) for field in required}
        except (TypeError, ValueError):
            return jsonify({
                "error": "All eGFR measurements must be numeric.",
            }), 400

        if not all(np.isfinite(value) and value > 0 for value in egfr_values.values()):
            return jsonify({
                "error": "All eGFR measurements must be finite positive numbers.",
            }), 400

        features = create_progression_features(
            egfr_values["egfr_baseline"],
            egfr_values["egfr_w3"],
            egfr_values["egfr_w13"],
            egfr_values["egfr_w26"],
        )

        # Preserve the feature order stored with the trained model.
        X = pd.DataFrame([features], columns=progression_feature_cols)
        prediction = int(progression_model.predict(X)[0])
        probability = float(progression_model.predict_proba(X)[0][1])

        outlook = (
            "Higher likelihood of persistent decline"
            if prediction == 1
            else "Lower likelihood of persistent decline"
        )

        baseline = egfr_values["egfr_baseline"]
        latest = egfr_values["egfr_w26"]
        if latest < baseline:
            observed_trend = "Declining"
        elif latest > baseline:
            observed_trend = "Improving"
        else:
            observed_trend = "Stable"

        return jsonify({
            "prediction": prediction,
            "persistent_decline": bool(prediction),
            "probability": round(probability * 100, 2),
            "outlook": outlook,
            "observed_trend": observed_trend,
            "egfr": {
                "baseline": baseline,
                "week3": egfr_values["egfr_w3"],
                "week13": egfr_values["egfr_w13"],
                "week26": latest,
            },
            "notice": (
                "Model-based progression outlook only; it is not a diagnosis. "
                "The persistent-decline threshold is project-defined."
            ),
        })

    except Exception as error:
        app.logger.exception("Progression prediction failed")
        return jsonify({"error": str(error)}), 500


# ---------------------------------------------------------------------
# PERSONALIZED RECOMMENDATIONS
# ---------------------------------------------------------------------

def get_egfr_category(egfr):
    """
    Derive the eGFR G category.
    This is an eGFR category, not independent confirmation of CKD.
    """
    if egfr is None:
        return None

    egfr = float(egfr)

    if egfr >= 90:
        return "G1"
    elif egfr >= 60:
        return "G2"
    elif egfr >= 45:
        return "G3a"
    elif egfr >= 30:
        return "G3b"
    elif egfr >= 15:
        return "G4"
    else:
        return "G5"


@app.route("/recommendations", methods=["POST"])
def recommendations():
    try:
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "error": "Request body must be a JSON object."
            }), 400

        patient_data = data.get("patient_data", {})
        prediction_result = data.get("prediction_result", {})

        if not isinstance(patient_data, dict):
            return jsonify({
                "error": "patient_data must be a JSON object."
            }), 400

        if not isinstance(prediction_result, dict):
            return jsonify({
                "error": "prediction_result must be a JSON object."
            }), 400

        # Use the eGFR saved with the visit.
        # Prefer final eGFR because the clinician may have edited it.
        egfr = patient_data.get(
            "eGFR",
            patient_data.get(
                "egfr",
                prediction_result.get("egfr")
            )
        )

        if egfr is not None:
            try:
                egfr = float(egfr)

                if not np.isfinite(egfr) or egfr <= 0:
                    raise ValueError()

            except (TypeError, ValueError):
                return jsonify({
                    "error": "A valid positive eGFR is required."
                }), 400

            patient_data["eGFR"] = egfr

            # Add the eGFR category only if one was not already supplied.
            if not prediction_result.get("kdigo_stage"):
                category = get_egfr_category(egfr)

                prediction_result["kdigo_stage"] = {
                    "stage": category
                }

        # Preserve the CKD prediction saved during the first assessment.
        # Do NOT run the CKD model again here.
        result = generate_recommendations(
            patient_data,
            prediction_result
        )

        return jsonify(result), 200

    except Exception as error:
        app.logger.exception(
            "Recommendation generation failed"
        )

        return jsonify({
            "error": str(error)
        }), 500
@app.route("/parse-report", methods=["POST"])
def parse_report():
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]

    if not file.filename:
        return jsonify({"error": "No file selected"}), 400

    if not file.filename.lower().endswith((".pdf", ".txt", ".csv")):
        return jsonify({"error": "Only PDF, TXT, and CSV files are supported"}), 400

    try:
        result = parse_medical_receipt(
            file.read(),
            file.filename
        )
        return jsonify(result), 200

    except Exception as error:
        app.logger.exception("Report parsing failed")
        return jsonify({"error": str(error)}), 500

@app.route("/generate-report", methods=["POST"])
def generate_report():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Expected JSON report data"}), 400

    try:
        pdf_bytes = generate_pdf_report(data)

        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype="application/pdf",
            as_attachment=True,
            download_name="ckd_report.pdf"
        )

    except Exception as error:
        app.logger.exception("PDF generation failed")
        return jsonify({"error": str(error)}), 500
# ---------------------------------------------------------------------
# RUN FLASK SERVICE
# ---------------------------------------------------------------------

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5001,
        debug=False,
    )
