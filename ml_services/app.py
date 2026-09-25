from pathlib import Path

from flask import Flask, request, jsonify
import pandas as pd
import joblib

from explain import explain_prediction, shap_available
from risk_score import early_warning_score, KFRE_BASELINE_SURVIVAL

app = Flask(__name__)

MODEL_DIR = Path(__file__).resolve().parent / "model"

# The risk score does not depend on the ML model, so a model that fails to
# load (e.g. a scikit-learn version mismatch) disables /predict only.
try:
    model = joblib.load(MODEL_DIR / "gradient_boosting_rural_corrected_model.pkl")
    preprocessor = joblib.load(MODEL_DIR / "rural_corrected_preprocessor.pkl")
    model_error = None
except Exception as error:
    model = preprocessor = None
    model_error = f"{type(error).__name__}: {error}"
    print(f"WARNING: screening model not loaded ({model_error})")


# (field, min, max) — plausible clinical ranges
NUMERIC_FIELDS = [
    ("age", 18, 120),
    ("bp_systolic", 50, 300),
    ("bp_diastolic", 30, 200),
    ("serum_creatinine", 0.1, 20),
    ("albumin_creatinine_ratio", 0.1, 10000),
]


def parse_patient(data):
    """Validate the request body; return (patient, errors)."""
    if not isinstance(data, dict):
        return None, {"body": "Expected a JSON object."}

    patient, errors = {}, {}

    for field, low, high in NUMERIC_FIELDS:
        try:
            value = float(data[field])
        except KeyError:
            errors[field] = "Required."
            continue
        except (TypeError, ValueError):
            errors[field] = "Must be a number."
            continue
        if not low <= value <= high:
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

    if patient.get("bp_diastolic", 0) >= patient.get("bp_systolic", float("inf")):
        errors.setdefault("bp_diastolic", "Must be lower than systolic pressure.")

    return patient, errors


def validation_error(errors):
    return jsonify({"error": "Invalid patient data", "fields": errors}), 400


# 2021 CKD-EPI creatinine equation
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


@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "screening_model_loaded": model is not None,
        "screening_model_error": model_error,
        "shap_available": shap_available(),
    })


@app.route("/predict", methods=["POST"])
def predict():

    patient, errors = parse_patient(request.get_json(silent=True))
    if errors:
        return validation_error(errors)

    if model is None:
        return jsonify({
            "error": "Screening model is unavailable",
            "detail": model_error,
        }), 503

    egfr = calculate_egfr(
        patient["age"],
        patient["gender"],
        patient["serum_creatinine"]
    )

    # Prepare data for existing ML model
    patient_df = pd.DataFrame([{
        "age": patient["age"],
        "gender": patient["gender"],
        "bp_systolic": patient["bp_systolic"],
        "bp_diastolic": patient["bp_diastolic"],
        "serum_creatinine": patient["serum_creatinine"],
        "albumin_creatinine_ratio": patient["albumin_creatinine_ratio"],
        "diabetes_diagnosed": patient["diabetes_diagnosed"]
    }])

    patient_processed = preprocessor.transform(patient_df)

    prediction = model.predict(patient_processed)[0]

    probability = model.predict_proba(
        patient_processed
    )[0][1]

    return jsonify({
        "prediction": int(prediction),
        "probability": round(float(probability) * 100, 2),
        "egfr": egfr,
        "explanation": explain_prediction(model, preprocessor, patient_df)
    })


@app.route("/risk-score", methods=["POST"])
def risk_score():

    data = request.get_json(silent=True)
    patient, errors = parse_patient(data)

    region = (data or {}).get("region", "non_north_american") if isinstance(data, dict) else None
    if region not in KFRE_BASELINE_SURVIVAL:
        errors["region"] = "Must be one of: " + ", ".join(KFRE_BASELINE_SURVIVAL)

    if errors:
        return validation_error(errors)

    egfr = calculate_egfr(
        patient["age"],
        patient["gender"],
        patient["serum_creatinine"]
    )

    return jsonify(early_warning_score(
        age=patient["age"],
        gender=patient["gender"],
        egfr=egfr,
        acr=patient["albumin_creatinine_ratio"],
        bp_systolic=patient["bp_systolic"],
        bp_diastolic=patient["bp_diastolic"],
        diabetes_diagnosed=patient["diabetes_diagnosed"],
        region=region,
    ))


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5001,
        debug=False
    )
