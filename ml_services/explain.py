"""SHAP explanations for the CKD screening model (Module 1)."""

try:
    import shap
except ImportError:
    shap = None

FEATURE_LABELS = {
    "age": "Age",
    "gender": "Sex",
    "bp_systolic": "Systolic BP",
    "bp_diastolic": "Diastolic BP",
    "serum_creatinine": "Serum creatinine",
    "albumin_creatinine_ratio": "Albumin-creatinine ratio",
    "diabetes_diagnosed": "Diabetes",
}

_explainers = {}


def shap_available():
    return shap is not None


def _original_feature(transformed_name, columns):
    # ColumnTransformer names look like "num__age" or "cat__gender_Male".
    name = transformed_name.split("__", 1)[-1]
    matches = [c for c in columns if name == c or name.startswith(c + "_")]
    return max(matches, key=len) if matches else name


def explain_prediction(model, preprocessor, patient):
    """Per-feature SHAP values (log-odds) for a single-row DataFrame.

    One-hot columns are summed back into their original feature so the
    explanation lines up with the form inputs.
    """
    if shap is None:
        return None

    explainer = _explainers.get(id(model))
    if explainer is None:
        explainer = shap.TreeExplainer(model)
        _explainers[id(model)] = explainer

    processed = preprocessor.transform(patient)
    values = explainer.shap_values(processed)
    if isinstance(values, list):  # older shap: one array per class
        values = values[1]
    row = values[0]

    base_value = explainer.expected_value
    if hasattr(base_value, "__len__"):
        base_value = base_value[-1]

    totals = {}
    for name, value in zip(preprocessor.get_feature_names_out(), row):
        feature = _original_feature(name, patient.columns)
        totals[feature] = totals.get(feature, 0.0) + float(value)

    contributions = [
        {
            "feature": feature,
            "label": FEATURE_LABELS.get(feature, feature),
            "value": patient.iloc[0][feature].item()
            if hasattr(patient.iloc[0][feature], "item")
            else patient.iloc[0][feature],
            "shap_value": round(total, 4),
            "direction": "increases" if total > 0 else "decreases" if total < 0 else "none",
        }
        for feature, total in totals.items()
    ]
    contributions.sort(key=lambda c: abs(c["shap_value"]), reverse=True)

    return {
        "method": "SHAP TreeExplainer (log-odds)",
        "base_value": round(float(base_value), 4),
        "contributions": contributions,
    }
