from flask import Flask, request, jsonify
import pandas as pd
import joblib

app = Flask(__name__)

model = joblib.load("model/gradient_boosting_rural_corrected_model.pkl")
preprocessor = joblib.load("model/rural_corrected_preprocessor.pkl")


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


@app.route("/predict", methods=["POST"])
def predict():

    data = request.json

    age = float(data["age"])
    gender = data["gender"]
    creatinine = float(data["serum_creatinine"])

    # Calculate eGFR
    egfr = calculate_egfr(
        age,
        gender,
        creatinine
    )

    # Prepare data for existing ML model
    patient = pd.DataFrame([{
        "age": age,
        "gender": gender,
        "bp_systolic": float(data["bp_systolic"]),
        "bp_diastolic": float(data["bp_diastolic"]),
        "serum_creatinine": creatinine,
        "albumin_creatinine_ratio": float(
            data["albumin_creatinine_ratio"]
        ),
        "diabetes_diagnosed": int(data["diabetes_diagnosed"])
    }])

    patient_processed = preprocessor.transform(patient)

    prediction = model.predict(patient_processed)[0]

    probability = model.predict_proba(
        patient_processed
    )[0][1]

    return jsonify({
        "prediction": int(prediction),
        "probability": round(float(probability) * 100, 2),
        "egfr": egfr
    })


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5001,
        debug=False
    )