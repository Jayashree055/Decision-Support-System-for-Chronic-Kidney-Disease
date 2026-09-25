"""Module 3 — Early Warning Risk Score.

Built from published, externally validated clinical tools rather than a model
trained on this project's data:

- KDIGO 2012 GFR (G) and albuminuria (A) categories and the KDIGO risk heat map.
- Kidney Failure Risk Equation (KFRE), 4-variable version
  (Tangri et al., JAMA 2016;315(2):164-174), which gives the probability of
  kidney failure (dialysis or transplant) within 2 and 5 years.
- KDIGO 2024 action thresholds for KFRE.

Every result carries an explanation of which inputs drove it.
"""

import math

LEVEL_LABELS = {
    "low": "Low",
    "moderate": "Moderate",
    "high": "High",
    "very_high": "Very high",
}

# (lower eGFR bound, code, description)
G_CATEGORIES = [
    (90, "G1", "Normal or high"),
    (60, "G2", "Mildly decreased"),
    (45, "G3a", "Mildly to moderately decreased"),
    (30, "G3b", "Moderately to severely decreased"),
    (15, "G4", "Severely decreased"),
    (0, "G5", "Kidney failure"),
]

A_DESCRIPTIONS = {
    "A1": "Normal to mildly increased",
    "A2": "Moderately increased",
    "A3": "Severely increased",
}

# KDIGO 2012 heat map: risk level per (G, A) cell, indexed A1, A2, A3.
HEAT_MAP = {
    "G1": ("low", "moderate", "high"),
    "G2": ("low", "moderate", "high"),
    "G3a": ("moderate", "high", "very_high"),
    "G3b": ("high", "very_high", "very_high"),
    "G4": ("very_high", "very_high", "very_high"),
    "G5": ("very_high", "very_high", "very_high"),
}

# KDIGO 2012 suggested number of eGFR/ACR checks per year, indexed A1, A2, A3.
# None for G1/G2 A1: monitor yearly only if CKD is confirmed by other markers.
MONITORING_PER_YEAR = {
    "G1": (None, 1, 2),
    "G2": (None, 1, 2),
    "G3a": (1, 2, 3),
    "G3b": (2, 3, 3),
    "G4": (3, 3, 4),
    "G5": (4, 4, 4),
}

# KFRE 4-variable: coefficients and centring values from the development cohort.
KFRE_TERMS = {
    "age": {"coef": -0.2201, "mean": 7.036},       # age / 10
    "male": {"coef": 0.2467, "mean": 0.5642},      # 1 if male
    "egfr": {"coef": -0.5567, "mean": 7.222},      # eGFR / 5
    "log_acr": {"coef": 0.4510, "mean": 5.137},    # ln(ACR in mg/g)
}

KFRE_BASELINE_SURVIVAL = {
    "north_american": {2: 0.9750, 5: 0.9240},
    "non_north_american": {2: 0.9832, 5: 0.9365},
}

# KDIGO 2024 KFRE action thresholds (fractions, not percent).
KFRE_REFERRAL_5Y = 0.05
KFRE_MULTIDISCIPLINARY_2Y = 0.10
KFRE_KRT_PLANNING_2Y = 0.40


def gfr_category(egfr):
    for lower, code, description in G_CATEGORIES:
        if egfr >= lower:
            return {"code": code, "description": description}
    return {"code": "G5", "description": "Kidney failure"}


def albuminuria_category(acr):
    if acr < 30:
        code = "A1"
    elif acr <= 300:
        code = "A2"
    else:
        code = "A3"
    return {"code": code, "description": A_DESCRIPTIONS[code]}


def kdigo_assessment(egfr, acr):
    g = gfr_category(egfr)
    a = albuminuria_category(acr)
    a_index = int(a["code"][1]) - 1

    level = HEAT_MAP[g["code"]][a_index]
    monitoring = MONITORING_PER_YEAR[g["code"]][a_index]

    reasons = [
        f"eGFR {egfr:g} mL/min/1.73 m² is category {g['code']} ({g['description'].lower()}).",
        f"ACR {acr:g} mg/g is category {a['code']} ({a['description'].lower()}).",
    ]
    if level == "low":
        reasons.append(
            "eGFR and ACR alone do not meet CKD criteria; CKD would need "
            "another marker of kidney damage."
        )

    return {
        "gfr_category": g,
        "albuminuria_category": a,
        "level": level,
        "monitoring_per_year": monitoring,
        "reasons": reasons,
    }


def kfre(age, gender, egfr, acr, region="non_north_american"):
    """4-variable KFRE with a per-factor explanation.

    Each factor's contribution is coef * (value - cohort mean), so the
    contributions sum exactly to the model's linear predictor. exp(contribution)
    is the hazard ratio versus an average patient in the KFRE cohort.
    """
    if egfr >= 60:
        return {
            "applicable": False,
            "reason": "KFRE is validated only for eGFR below 60 (CKD G3–G5).",
        }

    is_male = 1 if gender.lower() == "male" else 0
    values = {
        "age": age / 10,
        "male": is_male,
        "egfr": egfr / 5,
        "log_acr": math.log(acr),
    }

    contributions = []
    linear_predictor = 0.0
    for name, term in KFRE_TERMS.items():
        contribution = term["coef"] * (values[name] - term["mean"])
        linear_predictor += contribution
        contributions.append(_describe_kfre_factor(
            name, age, is_male, egfr, acr, contribution
        ))

    contributions.sort(key=lambda c: abs(c["contribution"]), reverse=True)

    baseline = KFRE_BASELINE_SURVIVAL[region]
    risk = {
        years: 1 - survival ** math.exp(linear_predictor)
        for years, survival in baseline.items()
    }

    return {
        "applicable": True,
        "region": region,
        "risk_2_year": round(risk[2] * 100, 2),
        "risk_5_year": round(risk[5] * 100, 2),
        "linear_predictor": round(linear_predictor, 4),
        "contributions": contributions,
    }


def _describe_kfre_factor(name, age, is_male, egfr, acr, contribution):
    hazard_ratio = math.exp(contribution)
    direction = "increases" if contribution > 0 else "decreases"

    if name == "age":
        # Younger patients have more remaining years in which to progress.
        label, value = "Age", f"{age:g} years"
        detail = f"compared with the cohort average of {KFRE_TERMS['age']['mean'] * 10:.0f} years"
    elif name == "male":
        label, value = "Sex", "Male" if is_male else "Female"
        detail = "male sex carries higher risk in KFRE"
    elif name == "egfr":
        label, value = "eGFR", f"{egfr:g} mL/min/1.73 m²"
        detail = f"compared with the cohort average of {KFRE_TERMS['egfr']['mean'] * 5:.0f}"
    else:
        label, value = "Albumin-creatinine ratio", f"{acr:g} mg/g"
        detail = f"compared with the cohort average of {math.exp(KFRE_TERMS['log_acr']['mean']):.0f} mg/g"

    return {
        "feature": name,
        "label": label,
        "value": value,
        "contribution": round(contribution, 4),
        "hazard_ratio": round(hazard_ratio, 2),
        "direction": direction,
        "explanation": f"{label} of {value} {direction} risk ×{hazard_ratio:.2f} ({detail}).",
    }


def blood_pressure_flags(systolic, diastolic):
    if systolic >= 180 or diastolic >= 120:
        return [{
            "severity": "urgent",
            "message": f"Blood pressure {systolic:g}/{diastolic:g} mmHg is severely "
                       "elevated and needs same-day clinical review.",
        }]
    if systolic >= 140 or diastolic >= 90:
        return [{
            "severity": "warning",
            "message": f"Blood pressure {systolic:g}/{diastolic:g} mmHg is in the "
                       "hypertensive range and accelerates CKD progression.",
        }]
    if systolic >= 120:
        return [{
            "severity": "info",
            "message": f"Systolic pressure {systolic:g} mmHg is above the KDIGO 2021 "
                       "target of under 120 mmHg (where tolerated).",
        }]
    return []


def early_warning_score(age, gender, egfr, acr, bp_systolic, bp_diastolic,
                        diabetes_diagnosed, region="non_north_american"):
    kdigo = kdigo_assessment(egfr, acr)
    kidney_failure = kfre(age, gender, egfr, acr, region)

    # The level comes from the KDIGO heat map. Any patient whose KFRE crosses an
    # action threshold is already high or very high there, so KFRE refines the
    # actions rather than the level.
    level = kdigo["level"]
    drivers = [f"KDIGO heat map ({kdigo['gfr_category']['code']}"
               f"{kdigo['albuminuria_category']['code']}): {LEVEL_LABELS[level].lower()} risk."]
    actions = []

    if kidney_failure["applicable"]:
        risk_2y = kidney_failure["risk_2_year"] / 100
        risk_5y = kidney_failure["risk_5_year"] / 100
        drivers.append(f"KFRE: {risk_2y:.1%} risk of kidney failure in 2 years, "
                       f"{risk_5y:.1%} in 5 years.")

        if risk_5y >= KFRE_REFERRAL_5Y:
            actions.append("Refer to nephrology (KFRE 5-year risk ≥ 5%).")
        if risk_2y >= KFRE_MULTIDISCIPLINARY_2Y:
            actions.append("Arrange multidisciplinary CKD care (KFRE 2-year risk ≥ 10%).")
        if risk_2y >= KFRE_KRT_PLANNING_2Y:
            actions.append("Begin planning for kidney replacement therapy "
                           "(KFRE 2-year risk ≥ 40%).")

    if egfr < 30 and not any("nephrology" in a for a in actions):
        actions.append("Refer to nephrology (eGFR below 30).")
    if acr > 300 and not any("nephrology" in a for a in actions):
        actions.append("Refer to nephrology (ACR above 300 mg/g).")
    if kdigo["monitoring_per_year"]:
        actions.append(f"Check eGFR and ACR {kdigo['monitoring_per_year']}× per year.")

    flags = blood_pressure_flags(bp_systolic, bp_diastolic)
    if diabetes_diagnosed:
        flags.append({
            "severity": "info",
            "message": "Diabetes is the leading cause of CKD; yearly eGFR and "
                       "ACR screening is recommended even when results are normal.",
        })

    return {
        "level": level,
        "level_label": LEVEL_LABELS[level],
        "egfr": round(egfr, 2),
        "kdigo": kdigo,
        "kfre": kidney_failure,
        "drivers": drivers,
        "flags": flags,
        "actions": actions,
        "disclaimer": (
            "Decision support only, not a diagnosis. CKD requires abnormal "
            "results persisting for more than 3 months."
        ),
    }
