import math


# Baseline survival values for the 4-variable KFRE.
# North American values: original model.
# Non-North American values: regional recalibration.
KFRE_BASELINE_SURVIVAL = {
    "north_american": {
        2: 0.9750,
        5: 0.9240
    },
    "non_north_american": {
        2: 0.9832,
        5: 0.9365
    }
}


def early_warning_score(
    age,
    gender,
    egfr,
    acr,
    bp_systolic,
    bp_diastolic,
    diabetes_diagnosed,
    region="non_north_american"
):
    """
    Calculate 2-year and 5-year kidney failure risk
    using the 4-variable KFRE.

    Required KFRE inputs:
        age: Age in years
        gender: Male or Female
        egfr: eGFR in mL/min/1.73 m²
        acr: Urine ACR in mg/g
        region: Calibration region

    BP and diabetes are accepted for compatibility
    with app.py but are not used in the 4-variable KFRE.
    """

    # Validate inputs
    if region not in KFRE_BASELINE_SURVIVAL:
        raise ValueError("Invalid KFRE region.")

    if not 18 <= float(age) <= 120:
        raise ValueError("Age must be between 18 and 120.")

    gender = str(gender).strip().lower()

    if gender not in ("male", "female"):
        raise ValueError("Gender must be Male or Female.")

    age = float(age)
    egfr = float(egfr)
    acr = float(acr)

    if not math.isfinite(egfr) or egfr <= 0:
        raise ValueError("eGFR must be a positive number.")

    if not math.isfinite(acr) or acr <= 0:
        raise ValueError("ACR must be a positive number.")

    # KFRE is intended for established CKD.
    # Return an explicit not-applicable result for eGFR >= 60.
    if egfr >= 60:
        return {
            "applicable": False,
            "risk_score": None,
            "risk_2_year": None,
            "risk_5_year": None,
            "message": (
                "The 4-variable KFRE is intended for "
                "patients with established CKD and "
                "eGFR below 60. Risk was not calculated."
            ),
            "region": region,
            "model": "4-variable KFRE"
        }

    # Published centered linear predictor
    male = 1 if gender == "male" else 0

    linear_predictor = (
        -0.2201 * (age / 10 - 7.036)
        + 0.2467 * (male - 0.5642)
        - 0.5567 * (egfr / 5 - 7.222)
        + 0.4510 * (math.log(acr) - 5.137)
    )

    # Convert linear predictor into relative hazard
    relative_hazard = math.exp(linear_predictor)

    # Calculate risk for each time horizon
    baseline = KFRE_BASELINE_SURVIVAL[region]

    risk_2_year = (
        1 - baseline[2] ** relative_hazard
    ) * 100

    risk_5_year = (
        1 - baseline[5] ** relative_hazard
    ) * 100

    return {
        "applicable": True,
        "risk_score": round(risk_5_year, 2),
        "risk_2_year": round(risk_2_year, 2),
        "risk_5_year": round(risk_5_year, 2),
        "region": region,
        "model": "4-variable KFRE",
        "message": (
            "Estimated kidney failure risk. "
            "This result is a clinical decision-support "
            "estimate, not a diagnosis."
        )
    }