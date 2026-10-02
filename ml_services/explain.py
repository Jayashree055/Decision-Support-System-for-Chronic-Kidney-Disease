import numpy as np


def shap_available():
    """Check whether SHAP can be imported."""
    try:
        import shap
        return True
    except Exception:
        return False


def _to_dense(data):
    """Convert sparse or dense input to a NumPy array."""
    if hasattr(data, "toarray"):
        data = data.toarray()

    return np.asarray(data)


def _get_feature_names(preprocessor, patient_df, feature_count):
    """Get feature names after preprocessing."""
    try:
        names = preprocessor.get_feature_names_out(
            input_features=list(patient_df.columns)
        )
        names = [str(name) for name in names]

        if len(names) == feature_count:
            return names

    except Exception:
        pass

    try:
        names = [
            str(name)
            for name in preprocessor.get_feature_names_out()
        ]

        if len(names) == feature_count:
            return names

    except Exception:
        pass

    return [
        f"feature_{index}"
        for index in range(feature_count)
    ]


def explain_prediction(model, preprocessor, patient_df):
    """
    Generate a SHAP explanation for one CKD prediction.

    Returns feature contributions for the model's positive class.
    """

    import shap

    # Apply the same preprocessing used for prediction.
    processed = preprocessor.transform(patient_df)
    X = _to_dense(processed)

    if X.ndim == 1:
        X = X.reshape(1, -1)

    if X.shape[0] != 1:
        raise ValueError(
            "SHAP explanation expects exactly one patient."
        )

    # Get feature names after preprocessing.
    feature_names = _get_feature_names(
        preprocessor,
        patient_df,
        X.shape[1]
    )

    # Create the SHAP explainer for the tree-based model.
    explainer = shap.TreeExplainer(model)

    shap_values = explainer.shap_values(X)

    # Identify the positive class (CKD = 1).
    classes = getattr(model, "classes_", [0, 1])
    class_index = (
        list(classes).index(1)
        if 1 in classes
        else len(classes) - 1
    )

    # Handle SHAP output formats from different versions.
    if isinstance(shap_values, list):
        values = np.asarray(shap_values[class_index])
        values = values[0]

    else:
        values = np.asarray(shap_values)

        if values.ndim == 3:
            # Newer SHAP versions may return:
            # samples x features x classes
            if values.shape[-1] > class_index:
                values = values[0, :, class_index]
            else:
                raise ValueError(
                    "Unexpected SHAP output shape."
                )

        elif values.ndim == 2:
            values = values[0]

        else:
            raise ValueError(
                f"Unexpected SHAP output dimensions: {values.shape}"
            )

    # Get the expected/base value for the positive class.
    base_value = np.asarray(
        explainer.expected_value
    )

    if base_value.ndim == 0:
        base = float(base_value)

    else:
        base_value = base_value.flatten()

        if len(base_value) > class_index:
            base = float(base_value[class_index])
        else:
            base = float(base_value[0])

    # Prepare JSON-friendly feature contributions.
    contributions = []

    for index, shap_value in enumerate(values):
        contributions.append({
            "feature": feature_names[index],
            "value": float(X[0, index]),
            "shap_value": round(float(shap_value), 6),
            "impact": (
                "increases_model_output"
                if shap_value > 0
                else "decreases_model_output"
                if shap_value < 0
                else "no_effect"
            )
        })

    # Sort by absolute contribution, largest first.
    contributions.sort(
        key=lambda item: abs(item["shap_value"]),
        reverse=True
    )

    return {
        "method": "SHAP",
        "base_value": round(base, 6),
        "features": contributions
    }