import { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useParams } from "react-router-dom";
import "./RecommendationPages.css";

// Converts model feature names into readable labels and explains their role.
const SHAP_FEATURE_INFO = {
    serumcreatinine: { label: "Serum Creatinine", role: "A waste product filtered by the kidneys; its level helps assess kidney function." },
    albumincreatinineratio: { label: "UACR", role: "Measures albumin in urine and helps identify possible kidney damage." },
    uacr: { label: "UACR", role: "Measures albumin in urine and helps identify possible kidney damage." },
    age: { label: "Age", role: "The patient's age, which is relevant to kidney function and CKD risk." },
    bpsystolic: { label: "Systolic Blood Pressure", role: "Measures blood pressure when the heart contracts." },
    systolicbloodpressure: { label: "Systolic Blood Pressure", role: "Measures blood pressure when the heart contracts." },
    bpdiastolic: { label: "Diastolic Blood Pressure", role: "Measures blood pressure when the heart rests between beats." },
    diastolicbloodpressure: { label: "Diastolic Blood Pressure", role: "Measures blood pressure when the heart rests between beats." },
    diabetes: { label: "Diabetes", role: "Indicates whether the patient has diagnosed diabetes, a CKD risk factor." },
    diabetesdiagnosed: { label: "Diabetes", role: "Indicates whether the patient has diagnosed diabetes, a CKD risk factor." },
    genderfemale: { label: "Gender: Female", role: "A demographic input used by the prediction model." },
    gendermale: { label: "Gender: Male", role: "A demographic input used by the prediction model." },
};

function getShapFeatureInfo(name) {
    const key = String(name || "").toLowerCase().replace(/^.*__/, "").replace(/[^a-z0-9]/g, "");
    return SHAP_FEATURE_INFO[key] || {
        label: String(name || "Unknown feature").replace(/^.*__/, "").replace(/_/g, " "),
        role: "Input feature used by the CKD prediction model.",
    };
}

function ShapExplanationTable({ explanation }) {
    const features = Array.isArray(explanation?.features) ? explanation.features : [];
    if (!features.length) return null;

    return (
        <>
            <style>{`
                .shap-explanation { margin: 24px 0; padding: 26px 28px; background: #fff; border: 1px solid #dce4f0; border-radius: 14px; box-shadow: 0 4px 14px rgba(30,55,90,.04); }
                .shap-explanation h2 { margin: 0 0 8px; text-align: center; color: #172554; font-size: 23px; }
                .shap-description { margin: 0 0 20px; text-align: center; color: #64748b; font-size: 14px; line-height: 1.6; }
                .shap-table-wrapper { width: 100%; overflow-x: auto; }
                .shap-table { width: 100%; min-width: 760px; border-collapse: collapse; table-layout: fixed; color: #1e293b; font-size: 14px; }
                .shap-table th { padding: 13px 14px; background: #f8fafc; color: #334155; text-align: left; font-weight: 700; border-bottom: 1px solid #dce4f0; }
                .shap-table td { padding: 14px; vertical-align: top; line-height: 1.55; border-bottom: 1px solid #e2e8f0; overflow-wrap: anywhere; }
                .shap-table tbody tr:last-child td { border-bottom: 0; }
                .shap-table th:nth-child(1) { width: 18%; } .shap-table th:nth-child(2) { width: 12%; } .shap-table th:nth-child(3) { width: 16%; } .shap-table th:nth-child(4) { width: 34%; } .shap-table th:nth-child(5) { width: 20%; }
                .shap-feature-name { font-weight: 700; } .shap-value { font-variant-numeric: tabular-nums; white-space: nowrap; }
                .shap-effect-positive { color: #c2410c; font-weight: 600; } .shap-effect-negative { color: #15803d; font-weight: 600; }
                .shap-note { margin: 14px 0 0; color: #64748b; font-size: 12px; line-height: 1.5; }
                @media (max-width: 650px) { .shap-explanation { padding: 20px 14px; } .shap-explanation h2 { font-size: 20px; } }
            `}</style>
            <section className="shap-explanation">
                <h2>SHAP Explainability</h2>
                <p className="shap-description">This table shows how each input influenced the model's CKD prediction. It explains model behavior, not medical causation.</p>
                <div className="shap-table-wrapper">
                    <table className="shap-table">
                        <thead><tr><th>Feature</th><th>Patient Value</th><th>SHAP Contribution</th><th>Feature Role</th><th>Effect on CKD Prediction</th></tr></thead>
                        <tbody>
                            {features.map((item, index) => {
                                const value = Number(item.shap_value);
                                const valid = Number.isFinite(value);
                                const info = getShapFeatureInfo(item.feature);
                                return (
                                    <tr key={`${item.feature}-${index}`}>
                                        <td className="shap-feature-name">{info.label}</td>
                                        <td>{item.value ?? "—"}</td>
                                        <td className="shap-value">{valid ? `${value > 0 ? "+" : ""}${value.toFixed(4)}` : "—"}</td>
                                        <td>{info.role}</td>
                                        <td><span className={valid ? (value >= 0 ? "shap-effect-positive" : "shap-effect-negative") : ""}>{valid ? (value >= 0 ? "Pushes toward CKD" : "Pushes away from CKD") : "Unavailable"}</span></td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <p className="shap-note">A positive SHAP contribution moves the model output toward the CKD class; a negative contribution moves it away. Contributions are in the model's output scale, not percentages.</p>
            </section>
        </>
    );
}

function CKDAssessment() {
    const { id } = useParams();
    const navigate = useNavigate();

    // Patient information
    const [patient, setPatient] = useState(null);
    const [history, setHistory] = useState([]);

    // CKD assessment form
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split("T")[0],
        bp_systolic: "",
        bp_diastolic: "",
        serum_creatinine: "",
        albumin_creatinine_ratio: "",
        diabetes_diagnosed: "",
    });

    // Assessment result
    const [result, setResult] = useState(null);
    const [finalEGFR, setFinalEGFR] = useState("");
    const [editingEGFR, setEditingEGFR] = useState(false);

    // Saved visit
    const [savedMeasurementId, setSavedMeasurementId] = useState(null);

    // Optional recommendation parameters
    const [recommendationData, setRecommendationData] = useState({
        potassium: "",
        phosphorus: "",
        hemoglobin: "",
        bun: "",
        edema: "",
        fatigueLevel: "",
        physicalActivity: "",
        dietQuality: "",
        notes: "",
    });

    // Recommendation form and request state
    const [showRecommendationForm, setShowRecommendationForm] =
        useState(false);
    const [recommendationLoading, setRecommendationLoading] =
        useState(false);
    const [recommendationError, setRecommendationError] = useState("");

    // Age editing
    const [editingAge, setEditingAge] = useState(false);
    const [ageInput, setAgeInput] = useState("");

    // Loading and messages
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [loadingPatient, setLoadingPatient] = useState(true);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");

    const [uploading, setUploading] = useState(false);
    const [uploadMessage, setUploadMessage] = useState("");

    // Load patient and history
    const loadPatientData = async () => {
        try {
            setLoadingPatient(true);
            setError("");

            const [patientResponse, historyResponse] = await Promise.all([
                axios.get(`http://localhost:5000/api/patients/${id}`),
                axios.get(`http://localhost:5000/api/patients/${id}/history`),
            ]);

            const patientData = patientResponse.data;
            const historyData = Array.isArray(historyResponse.data)
                ? historyResponse.data
                : [];

            setPatient(patientData);
            setHistory(historyData);
            setAgeInput(patientData.age ?? "");
        } catch (err) {
            console.error("Unable to load patient:", err);
            setError(
                err.response?.data?.error ||
                    "Unable to load patient information."
            );
        } finally {
            setLoadingPatient(false);
        }
    };

    useEffect(() => {
        loadPatientData();
    }, [id]);

    // CKD assessment input handler
    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    // Optional recommendation input handler
    const handleRecommendationChange = (e) => {
        const { name, value } = e.target;

        setRecommendationData((previous) => ({
            ...previous,
            [name]: value,
        }));
    };

    // Save edited patient age
    const handleSaveAge = async () => {
        const age = Number(ageInput);

        if (!Number.isFinite(age) || age < 0 || age > 120) {
            setError("Please enter a valid age.");
            return;
        }

        try {
            setError("");

            const response = await axios.put(
                `http://localhost:5000/api/patients/${id}`,
                { age }
            );

            setPatient(response.data);
            setAgeInput(response.data.age);
            setEditingAge(false);
            setSuccessMessage("Patient age updated successfully.");

            setTimeout(() => {
                setSuccessMessage("");
            }, 2500);
        } catch (err) {
            console.error("Unable to update age:", err);
            setError(
                err.response?.data?.error ||
                    "Unable to update patient age."
            );
        }
    };
    const handleReportUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setUploadMessage("");

        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await axios.post(
                "http://localhost:5001/parse-report",
                formData
            );

            const extracted = response.data.extracted_values || {};
            // Fill CKD assessment fields
            setFormData((prev) => ({
                ...prev,
                bp_systolic: extracted.SystolicBP ?? prev.bp_systolic,
                bp_diastolic: extracted.DiastolicBP ?? prev.bp_diastolic,
                serum_creatinine: extracted.SerumCreatinine ?? prev.serum_creatinine,
                albumin_creatinine_ratio: extracted.ACR ?? prev.albumin_creatinine_ratio,
                diabetes_diagnosed:
                    extracted.DiabetesDiagnosed ?? prev.diabetes_diagnosed,
            }));

            // Fill additional recommendation fields
            setRecommendationData((prev) => ({
                ...prev,
                bun: extracted.BUNLevels ?? prev.bun,
                hemoglobin: extracted.HemoglobinLevels ?? prev.hemoglobin,
                potassium: extracted.SerumElectrolytesPotassium ?? prev.potassium,
                phosphorus: extracted.SerumElectrolytesPhosphorus ?? prev.phosphorus,
            }));

            if (extracted.Age != null) {
                setAgeInput(String(extracted.Age));
                setEditingAge(true);
            }

            setUploadMessage(
                `Extracted ${response.data.matched_count} fields. Please verify them before assessment.`
            );
        }catch (err) {
        console.error("Report upload error:", err);
        console.error("Response:", err.response?.data);

        setUploadMessage(
            err.response?.data?.error ||
            err.response?.data?.detail ||
            "Unable to parse the report."
        );
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    };
    // Run CKD prediction using the seven features
    const handleAssessment = async (e) => {
        e.preventDefault();

        if (
            !formData.bp_systolic ||
            !formData.bp_diastolic ||
            !formData.serum_creatinine ||
            !formData.albumin_creatinine_ratio ||
            formData.diabetes_diagnosed === ""
        ) {
            setError("Please fill in all required clinical fields.");
            return;
        }

        setLoading(true);
        setError("");
        setSuccessMessage("");
        setResult(null);
        setSavedMeasurementId(null);
        setShowRecommendationForm(false);
        setRecommendationError("");

        try {
            const predictionResponse = await axios.post(
                "http://localhost:5000/api/predict-ckd",
                {
                    age: Number(patient.age),
                    gender: patient.gender,
                    bp_systolic: Number(formData.bp_systolic),
                    bp_diastolic: Number(formData.bp_diastolic),
                    serum_creatinine: Number(formData.serum_creatinine),
                    albumin_creatinine_ratio: Number(
                        formData.albumin_creatinine_ratio
                    ),
                    diabetes_diagnosed: Number(
                        formData.diabetes_diagnosed
                    ),
                }
            );

            const prediction = predictionResponse.data;

            setResult(prediction);
            setFinalEGFR(prediction.egfr);
            setEditingEGFR(false);
        } catch (err) {
            console.error("CKD assessment failed:", err);
            setError(
                err.response?.data?.error ||
                    "Unable to complete CKD assessment."
            );
        } finally {
            setLoading(false);
        }
    };

    // Save the assessment as a visit
    const handleSaveMeasurement = async () => {
        if (!result) {
            setError("Run the CKD assessment first.");
            return;
        }

        const finalValue = Number(finalEGFR);

        if (!Number.isFinite(finalValue) || finalValue < 0) {
            setError("Please enter a valid final eGFR.");
            return;
        }

        setSaving(true);
        setError("");
        setSuccessMessage("");
        setRecommendationError("");

        try {
            const response = await axios.post(
                `http://localhost:5000/api/patients/${id}/measurements`,
                {
                    date: formData.date,
                    calculatedEGFR: Number(result.egfr),
                    finalEGFR: finalValue,
                    serumCreatinine: Number(formData.serum_creatinine),
                    UACR: Number(formData.albumin_creatinine_ratio),
                    systolicBP: Number(formData.bp_systolic),
                    diastolicBP: Number(formData.bp_diastolic),
                    diabetes: Number(formData.diabetes_diagnosed),
                    ckdPrediction: result.prediction,
                    ckdProbability: result.probability,
                    shapExplanation: result.explanation || null,
                }
            );

            // Refresh patient history
            const historyResponse = await axios.get(
                `http://localhost:5000/api/patients/${id}/history`
            );

            const updatedHistory = Array.isArray(historyResponse.data)
                ? historyResponse.data
                : [];

            setHistory(updatedHistory);

            // Find the newly saved visit
            const savedVisitNumber = response.data.visitNumber;

            const savedMeasurement =
                updatedHistory.find(
                    (item) =>
                        String(item.visitNumber) ===
                        String(savedVisitNumber)
                ) ||
                [...updatedHistory].sort(
                    (a, b) =>
                        Number(b.visitNumber) - Number(a.visitNumber)
                )[0];

            const measurementId =
                response.data.measurement?._id ||
                response.data.measurementId ||
                response.data._id ||
                savedMeasurement?._id;

            if (!measurementId) {
                throw new Error(
                    "The visit was saved, but its measurement ID was not returned."
                );
            }

            setSavedMeasurementId(measurementId);

            setSuccessMessage(
                `Visit ${savedVisitNumber ?? ""} saved successfully. You can now generate personalized recommendations.`
            );
        } catch (err) {
            console.error("Save measurement error:", err);
            setError(
                err.response?.data?.error ||
                    err.message ||
                    "Unable to save measurement."
            );
        } finally {
            setSaving(false);
        }
    };

    // Save optional data and generate recommendations
    const handleGenerateRecommendations = async (e) => {
        e.preventDefault();

        if (!savedMeasurementId) {
            setRecommendationError(
                "Please save the visit before generating recommendations."
            );
            return;
        }

        setRecommendationLoading(true);
        setRecommendationError("");

        const dataToSave = { ...recommendationData };

        const numericFields = [
            "potassium",
            "phosphorus",
            "hemoglobin",
            "bun",
            "fatigueLevel",
            "physicalActivity",
        ];

        numericFields.forEach((key) => {
            dataToSave[key] =
                dataToSave[key] === "" || dataToSave[key] == null
                    ? null
                    : Number(dataToSave[key]);
        });

        dataToSave.edema =
            dataToSave.edema === "" || dataToSave.edema == null
                ? null
                : dataToSave.edema === "true";

        dataToSave.dietQuality = dataToSave.dietQuality || null;
        dataToSave.notes = dataToSave.notes.trim() || null;

        try {
            // Save optional parameters against this visit
            await axios.put(
                `http://localhost:5000/api/patients/${id}/measurements/${savedMeasurementId}/recommendation-data`,
                {
                    recommendationData: dataToSave,
                }
            );

            // Generate recommendations for this visit
            const response = await axios.post(
                `http://localhost:5000/api/patients/${id}/measurements/${savedMeasurementId}/recommendations`
            );

            // Open the separate results page
            navigate(
    `/patients/${id}/recommendations/${savedMeasurementId}/results`,
    {
        state: {
            recommendations: response.data,
            clinicalInformation: {
                age: patient.age,
                gender: patient.gender,
                bp_systolic: Number(formData.bp_systolic),
                bp_diastolic: Number(formData.bp_diastolic),
                serum_creatinine: Number(formData.serum_creatinine),
                albumin_creatinine_ratio: Number(
                    formData.albumin_creatinine_ratio
                ),
                diabetes_diagnosed: Number(
                    formData.diabetes_diagnosed
                ),
                calculatedEGFR: Number(result.egfr),
                finalEGFR: Number(finalEGFR),
                status: result.prediction === 1
                    ? "Potential CKD indicators detected"
                    : "No CKD indicators detected by the model",
                prediction: result.prediction,
                modelScore: result.probability,
                ...dataToSave,
            },
        },
    }
);
        } catch (err) {
            console.error(
                "Recommendation generation failed:",
                err.response?.data || err
            );

            setRecommendationError(
                err.response?.data?.error ||
                    err.response?.data?.message ||
                    "Unable to save the optional measurements or generate recommendations."
            );
        } finally {
            setRecommendationLoading(false);
        }
    };

    const nextVisitNumber = history.length + 1;

    // Loading screen
    if (loadingPatient) {
        return (
            <div className="main-content">
                <div className="panel">
                    <h2>Loading patient information...</h2>
                </div>
            </div>
        );
    }

    // Patient not found
    if (!patient) {
        return (
            <div className="main-content">
                <div className="panel">
                    <h2>Patient not found</h2>
                    <Link to="/patients">Back to Patients</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="app-layout">
            {/* Sidebar */}
            <aside className="sidebar">
                <h2>NefroAI</h2>
                <p className="sidebar-subtitle">
                    Clinical Decision Support
                </p>

                <nav>
                    <Link to="/">Dashboard</Link>
                    <Link to="/patients">Patients</Link>
                </nav>
            </aside>

            {/* Main content */}
            <main className="main-content">
                {/* Page header */}
                <div className="page-header">
                    <div>
                        <Link to={`/patients/${id}`}>
                            ← Back to Patient
                        </Link>

                        <p className="eyebrow">
                            CLINICAL ASSESSMENT
                        </p>

                        <h1>CKD Assessment</h1>

                        <p>
                            Record the patient's clinical measurements
                            for this visit.
                        </p>
                    </div>
                </div>
                <section className="panel">
                    <div className="section-title">
                        <h2>Upload Medical Report</h2>
                    </div>

                    <p>
                        Upload a PDF, TXT, or CSV lab report to extract available
                        clinical measurements.
                    </p>

                    <input
                        type="file"
                        accept=".pdf,.txt,.csv"
                        onChange={handleReportUpload}
                        disabled={uploading}
                    />

                    {uploading && <p>Extracting report data...</p>}

                    {uploadMessage && (
                        <p role="status">{uploadMessage}</p>
                    )}
                </section>
                {/* Patient information */}
                <section className="panel">
                    <div className="section-title">
                        <h2>Patient Information</h2>
                    </div>

                    <div className="form-grid">
                        {/* Age */}
                        <div className="form-field">
                            <label>Age</label>

                            {!editingAge ? (
                                <div
                                    style={{
                                        display: "flex",
                                        gap: "10px",
                                        alignItems: "center",
                                    }}
                                >
                                    <input
                                        type="number"
                                        value={patient.age ?? ""}
                                        readOnly
                                    />

                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() => {
                                            setAgeInput(patient.age ?? "");
                                            setEditingAge(true);
                                        }}
                                    >
                                        Edit
                                    </button>
                                </div>
                            ) : (
                                <div
                                    style={{
                                        display: "flex",
                                        gap: "10px",
                                        alignItems: "center",
                                    }}
                                >
                                    <input
                                        type="number"
                                        min="0"
                                        max="120"
                                        value={ageInput}
                                        onChange={(e) =>
                                            setAgeInput(e.target.value)
                                        }
                                    />

                                    <button
                                        type="button"
                                        className="primary-button"
                                        onClick={handleSaveAge}
                                    >
                                        Save
                                    </button>

                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() => {
                                            setAgeInput(patient.age ?? "");
                                            setEditingAge(false);
                                        }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Gender */}
                        <div className="form-field">
                            <label>Gender</label>
                            <input
                                type="text"
                                value={patient.gender ?? ""}
                                readOnly
                            />
                        </div>
                    </div>
                </section>

                {/* Visit information */}
                <section className="panel">
                    <div className="section-title">
                        <h2>Visit Information</h2>
                    </div>

                    <div className="form-grid">
                        <div className="form-field">
                            <label>Visit Number</label>
                            <input
                                type="text"
                                value={`Visit ${nextVisitNumber}`}
                                readOnly
                            />
                        </div>

                        <div className="form-field">
                            <label>Measurement Date</label>
                            <input
                                type="date"
                                name="date"
                                value={formData.date}
                                onChange={handleChange}
                                required
                            />
                        </div>
                    </div>
                </section>

                {/* Clinical information */}
                <section className="panel">
                    <div className="section-title">
                        <h2>Clinical Information</h2>
                    </div>

                    <form onSubmit={handleAssessment}>
                        <div className="form-grid">
                            <div className="form-field">
                                <label>Systolic BP</label>
                                <input
                                    type="number"
                                    name="bp_systolic"
                                    value={formData.bp_systolic}
                                    onChange={handleChange}
                                    placeholder="mmHg"
                                    required
                                />
                            </div>

                            <div className="form-field">
                                <label>Diastolic BP</label>
                                <input
                                    type="number"
                                    name="bp_diastolic"
                                    value={formData.bp_diastolic}
                                    onChange={handleChange}
                                    placeholder="mmHg"
                                    required
                                />
                            </div>

                            <div className="form-field">
                                <label>Serum Creatinine</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="serum_creatinine"
                                    value={formData.serum_creatinine}
                                    onChange={handleChange}
                                    placeholder="mg/dL"
                                    required
                                />
                            </div>

                            <div className="form-field">
                                <label>UACR</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="albumin_creatinine_ratio"
                                    value={formData.albumin_creatinine_ratio}
                                    onChange={handleChange}
                                    placeholder="mg/g"
                                    required
                                />
                            </div>

                            <div className="form-field">
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
                        </div>

                        <button
                            type="submit"
                            className="primary-button"
                            disabled={loading}
                        >
                            {loading
                                ? "Analyzing..."
                                : "Run CKD Assessment"}
                        </button>
                    </form>
                </section>

                {/* Assessment result and Save Visit */}
                {result && (
                    <section className="result-card ckd-result-card">
                        <div>
                            <span className="card-label">
                                ASSESSMENT RESULT
                            </span>

                            <h2>
                                {result.prediction === 1
                                    ? "Potential CKD indicators detected"
                                    : "No CKD indicators detected by the model"}
                            </h2>

                            <p>
                                Model score:{" "}
                                <strong>{result.probability}%</strong>
                            </p>
                        </div>

                        <div className="egfr-result ckd-egfr-result">
                            <label>Calculated eGFR</label>

                            <strong className="calculated-egfr">
                                {result.egfr} mL/min/1.73 m²
                            </strong>

                            <label>Final eGFR</label>

                            <div className="final-egfr-row">
                                <input
                                    type="number"
                                    step="0.01"
                                    className="final-egfr-input"
                                    value={finalEGFR}
                                    readOnly={!editingEGFR}
                                    onChange={(e) =>
                                        setFinalEGFR(e.target.value)
                                    }
                                />

                                {!editingEGFR ? (
                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() =>
                                            setEditingEGFR(true)
                                        }
                                    >
                                        Edit
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="primary-button"
                                        onClick={() =>
                                            setEditingEGFR(false)
                                        }
                                    >
                                        Done
                                    </button>
                                )}
                            </div>

                            <small>
                                This is the clinician-confirmed value
                                that will be stored in patient history.
                            </small>
                        </div>

                        <div>
                            <button
                                type="button"
                                className="primary-button"
                                onClick={handleSaveMeasurement}
                                disabled={saving || !!savedMeasurementId}
                            >
                                {saving
                                    ? "Saving..."
                                    : savedMeasurementId
                                      ? "Visit Saved"
                                      : `Save Visit ${nextVisitNumber}`}
                            </button>
                        </div>
                    </section>
                )}

                {result && (
                    <ShapExplanationTable explanation={result.explanation} />
                )}

                {/* Personalized recommendations button */}
                {result && (
                    <section className="recommendation-launch-card">
                        <div>
                            <h2>Personalized Recommendations</h2>
                            <p>
                                Add optional clinical information for this visit. Save the visit first, then generate recommendations on a separate page.
                            </p>
                        </div>

                        <button
                            type="button"
                            className="recommendation-launch-button"
                            onClick={() => {
                                setShowRecommendationForm((previous) => !previous);
                                setRecommendationError("");
                            }}
                        >
                            {showRecommendationForm
                                ? "Hide Optional Parameters"
                                : "Get Personalized Recommendations →"}
                        </button>
                    </section>
                )}

                {/* Optional parameters appear on this page */}
                {showRecommendationForm && result && (
                    <section className="recommendation-panel">
                        <div className="recommendation-section-heading">
                            <div>
                                <h2>Additional Clinical Information</h2>
                                <p>
                                    Enter any additional available clinical
                                    information. Leave fields blank if the
                                    information is unavailable.
                                </p>
                            </div>

                            <span className="optional-badge">
                                Optional
                            </span>
                        </div>

                        {recommendationError && (
                            <div
                                className="recommendation-error"
                                role="alert"
                            >
                                {recommendationError}
                            </div>
                        )}

                        <form onSubmit={handleGenerateRecommendations}>
                            <div className="recommendation-form-grid">
                                <label className="recommendation-field">
                                    <span>
                                        Potassium <small>(mmol/L)</small>
                                    </span>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        name="potassium"
                                        value={recommendationData.potassium}
                                        onChange={handleRecommendationChange}
                                        placeholder="Not provided"
                                    />
                                </label>

                                <label className="recommendation-field">
                                    <span>
                                        Phosphorus <small>(mg/dL)</small>
                                    </span>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        name="phosphorus"
                                        value={recommendationData.phosphorus}
                                        onChange={handleRecommendationChange}
                                        placeholder="Not provided"
                                    />
                                </label>

                                <label className="recommendation-field">
                                    <span>
                                        Hemoglobin <small>(g/dL)</small>
                                    </span>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        name="hemoglobin"
                                        value={recommendationData.hemoglobin}
                                        onChange={handleRecommendationChange}
                                        placeholder="Not provided"
                                    />
                                </label>

                                <label className="recommendation-field">
                                    <span>
                                        Blood Urea Nitrogen (BUN)
                                        <small>(mg/dL)</small>
                                    </span>
                                    <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        name="bun"
                                        value={recommendationData.bun}
                                        onChange={handleRecommendationChange}
                                        placeholder="Not provided"
                                    />
                                </label>

                                <label className="recommendation-field">
                                    <span>Edema</span>
                                    <select
                                        name="edema"
                                        value={recommendationData.edema}
                                        onChange={handleRecommendationChange}
                                    >
                                        <option value="">
                                            Unknown / Not provided
                                        </option>
                                        <option value="true">Present</option>
                                        <option value="false">Absent</option>
                                    </select>
                                </label>

                                <label className="recommendation-field">
                                    <span>Fatigue Level</span>
                                    <select
                                        name="fatigueLevel"
                                        value={recommendationData.fatigueLevel}
                                        onChange={handleRecommendationChange}
                                    >
                                        <option value="">Not provided</option>
                                        <option value="0">None</option>
                                        <option value="1">Mild</option>
                                        <option value="2">Moderate</option>
                                        <option value="3">Severe</option>
                                    </select>
                                </label>

                                <label className="recommendation-field">
                                    <span>Physical Activity</span>
                                    <select
                                        name="physicalActivity"
                                        value={recommendationData.physicalActivity}
                                        onChange={handleRecommendationChange}
                                    >
                                        <option value="">Not provided</option>
                                        <option value="0">Sedentary</option>
                                        <option value="1">Light</option>
                                        <option value="2">Moderate</option>
                                        <option value="3">High</option>
                                    </select>
                                </label>

                                <label className="recommendation-field">
                                    <span>Diet Quality</span>
                                    <select
                                        name="dietQuality"
                                        value={recommendationData.dietQuality}
                                        onChange={handleRecommendationChange}
                                    >
                                        <option value="">Not provided</option>
                                        <option value="Poor">Poor</option>
                                        <option value="Moderate">Moderate</option>
                                        <option value="Good">Good</option>
                                    </select>
                                </label>

                                <label className="recommendation-field recommendation-field-wide">
                                    <span>
                                        Additional Notes <small>Optional</small>
                                    </span>
                                    <textarea
                                        name="notes"
                                        rows="4"
                                        value={recommendationData.notes}
                                        onChange={handleRecommendationChange}
                                        placeholder="Enter any additional relevant information..."
                                    />
                                </label>
                            </div>

                            <div className="recommendation-form-footer">
                                <p>
                                    Only the information provided will be submitted. Blank measurements remain unspecified. Save the visit before generating recommendations.
                                </p>

                                <button
                                    type="submit"
                                    className="recommendation-submit"
                                    disabled={recommendationLoading}
                                >
                                    {recommendationLoading
                                        ? "Generating..."
                                        : "Generate Recommendations →"}
                                </button>
                            </div>
                        </form>
                    </section>
                )}

                {/* Messages */}
                {successMessage && (
                    <div
                        className="success-message"
                        style={{ marginTop: "16px" }}
                    >
                        {successMessage}
                    </div>
                )}

                {error && (
                    <div
                        className="error-message"
                        style={{ marginTop: "16px" }}
                    >
                        {error}
                    </div>
                )}

                {/* Patient history */}
                <div style={{ marginTop: "20px" }}>
                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() => navigate(`/patients/${id}`)}
                    >
                        View Patient History
                    </button>
                </div>
            </main>
        </div>
    );
}

export default CKDAssessment;