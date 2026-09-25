import { useState } from "react";
import axios from "axios";
import RiskScorePanel, { ScreeningExplanation } from "./RiskScorePanel";

const API_URL = "http://localhost:5000/api";

function describeError(err) {
    const data = err.response?.data;

    if (data?.fields) {
        return Object.entries(data.fields)
            .map(([field, message]) => `${field}: ${message}`)
            .join(" ");
    }

    return data?.message ||
        "Unable to reach the server. Please make sure the backend servers are running.";
}

function CKDAssessment() {
    const [formData, setFormData] = useState({
        age: "",
        gender: "",
        bp_systolic: "",
        bp_diastolic: "",
        serum_creatinine: "",
        albumin_creatinine_ratio: "",
        diabetes_diagnosed: ""
    });

    const [result, setResult] = useState(null);
    const [risk, setRisk] = useState(null);
    const [screeningError, setScreeningError] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setLoading(true);
        setError("");
        setScreeningError("");
        setResult(null);
        setRisk(null);

        const payload = {
            age: Number(formData.age),
            gender: formData.gender,
            bp_systolic: Number(formData.bp_systolic),
            bp_diastolic: Number(formData.bp_diastolic),
            serum_creatinine: Number(formData.serum_creatinine),
            albumin_creatinine_ratio:
                Number(formData.albumin_creatinine_ratio),
            diabetes_diagnosed:
                Number(formData.diabetes_diagnosed)
        };

        // The risk score does not depend on the ML model, so show it even
        // when screening fails.
        try {
            const [screening, riskScore] = await Promise.allSettled([
                axios.post(`${API_URL}/predict-ckd`, payload),
                axios.post(`${API_URL}/risk-score`, payload)
            ]);

            if (screening.status === "fulfilled") {
                setResult(screening.value.data);
            } else {
                setScreeningError(describeError(screening.reason));
            }

            if (riskScore.status === "fulfilled") {
                setRisk(riskScore.value.data);
            } else {
                setError(describeError(riskScore.reason));
            }

        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h1>NefroAI</h1>
            <h2>CKD Assessment</h2>

            <p>
                Enter the patient's clinical information to assess
                potential CKD indicators.
            </p>

            <form onSubmit={handleSubmit}>

                <div>
                    <label>Age</label>
                    <input
                        type="number"
                        name="age"
                        value={formData.age}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div>
                    <label>Gender</label>
                    <select
                        name="gender"
                        value={formData.gender}
                        onChange={handleChange}
                        required
                    >
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                    </select>
                </div>

                <div>
                    <label>Systolic Blood Pressure (mmHg)</label>
                    <input
                        type="number"
                        name="bp_systolic"
                        value={formData.bp_systolic}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div>
                    <label>Diastolic Blood Pressure (mmHg)</label>
                    <input
                        type="number"
                        name="bp_diastolic"
                        value={formData.bp_diastolic}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div>
                    <label>Serum Creatinine (mg/dL)</label>
                    <input
                        type="number"
                        step="0.01"
                        name="serum_creatinine"
                        value={formData.serum_creatinine}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div>
                    <label>Albumin-Creatinine Ratio (mg/g)</label>
                    <input
                        type="number"
                        step="0.01"
                        name="albumin_creatinine_ratio"
                        value={formData.albumin_creatinine_ratio}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div>
                    <label>Diabetes Diagnosed?</label>
                    <select
                        name="diabetes_diagnosed"
                        value={formData.diabetes_diagnosed}
                        onChange={handleChange}
                        required
                    >
                        <option value="">Select</option>
                        <option value="1">Yes</option>
                        <option value="0">No</option>
                    </select>
                </div>

                <button type="submit" disabled={loading}>
                    {loading ? "Analyzing..." : "Predict CKD"}
                </button>

            </form>

            {error && (
                <p>{error}</p>
            )}

            {screeningError && (
                <p>Screening model: {screeningError}</p>
            )}

           {result && (
            <div>
                <h2>Assessment Result</h2>

                <p>
                    {result.prediction === 1
                        ? "Potential CKD indicators detected"
                        : "No CKD indicators detected by the model"}
                </p>

                <p>
                    Model score: {result.probability}%
                </p>

                <hr />

                <h3>Kidney Function Estimate</h3>

                <p>
                    Estimated GFR: <strong>{result.egfr}</strong>{" "}
                    mL/min/1.73 m²
                </p>

                <small>
                    eGFR is an estimate of kidney function calculated from
                    age, sex, and serum creatinine.
                </small>

                <ScreeningExplanation explanation={result.explanation} />
            </div>
        )}

            {risk && <RiskScorePanel risk={risk} />}
        </div>
    );
}

export default CKDAssessment;