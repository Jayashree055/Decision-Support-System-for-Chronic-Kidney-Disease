# An Explainable AI-assisted Clinical Decision Support System for Chronic Kidney Disease

## Modules

### Module 1 — CKD Screening
Uses NHANES 2021–2023 data and a Gradient Boosting classifier.

### Module 2 — Personalized CKD Progression
Uses longitudinal patient data to model future kidney-function trajectory.

### Module 3 — Early Warning Risk Score
Combines published, validated clinical tools, so it works without a trained model:

- **KDIGO 2012 G/A staging and risk heat map:** low / moderate / high / very high.
- **Kidney Failure Risk Equation (KFRE, 4-variable):** 2- and 5-year risk of
  kidney failure for eGFR < 60, using the non-North American calibration by default.
- **KDIGO 2024 KFRE action thresholds:** nephrology referral, multidisciplinary
  care, and kidney replacement therapy planning.
- Blood pressure and diabetes warnings.

Every result explains itself. KFRE factor contributions are exact, because the
equation is linear in its inputs. The Module 1 screening model is explained
with SHAP.

### Module 4 — Treatment Recommendation
Multi-agent recommendation engine.

## Architecture

React → Node.js/Express → Flask ML Service

## Module 1 Features

- Age
- Gender
- Systolic BP
- Diastolic BP
- Serum Creatinine
- UACR
- Diabetes

## Model

Gradient Boosting Classifier

## Dataset

CDC NHANES 2021–2023

## Running locally

The system runs as three services, each started in its own terminal.

**1. ML service (Flask, port 5001).** Needs Python 3.11 or older, because the
saved model only loads with scikit-learn 1.2.2.

```powershell
cd ml_services
py -3.11 -m venv venv
.\venv\Scripts\activate
pip install -r ..\requirements.txt
python app.py
```

`GET http://localhost:5001/health` shows whether the screening model and SHAP
loaded. If the model fails to load, `/risk-score` still works and `/predict`
returns 503.

**2. Backend (Express, port 5000):**

```powershell
cd backend
npm install
npm start
```

**3. Frontend (React, port 5173):**

```powershell
cd frontend
npm install
npm run dev
```

## API

| Endpoint | Description |
| --- | --- |
| `POST /api/predict-ckd` | Module 1 screening prediction, eGFR and SHAP explanation |
| `POST /api/risk-score` | Module 3 early warning score with explanations |

Both endpoints take the same body:

```json
{
  "age": 62, "gender": "Male", "bp_systolic": 150, "bp_diastolic": 88,
  "serum_creatinine": 2.1, "albumin_creatinine_ratio": 420, "diabetes_diagnosed": 1
}
```

`/api/risk-score` also accepts an optional
`"region": "north_american" | "non_north_american"`.

## Tests

```powershell
cd ml_services
python -m unittest discover -s tests
```
