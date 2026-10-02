import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./RecommendationPages.css";

const API = "http://localhost:5000/api/patients";

const emptyForm = {
    bodyWeight: "",
    serumAlbumin: "",
    bicarbonate: "",
    urineOutput: "",
    dialysisStatus: "",
    potassium: "",
    phosphorus: "",
    hemoglobin: "",
    bun: "",
    edema: "",
    fatigueLevel: "",
    physicalActivity: "",
    dietQuality: "",
    notes: ""
};

export default function RecommendationForm() {
    const { patientId, measurementId } = useParams();
    const navigate = useNavigate();

    const [form, setForm] = useState(emptyForm);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        const loadData = async () => {
            try {
                const response = await axios.get(
                    `${API}/${patientId}/recommendation-data`
                );

                if (!active) return;

                const saved = response.data?.recommendationData || {};

                setForm({
                    ...emptyForm,
                    ...saved,
                    bodyWeight: saved.bodyWeight ?? "",
                    serumAlbumin: saved.serumAlbumin ?? "",
                    bicarbonate: saved.bicarbonate ?? "",
                    urineOutput: saved.urineOutput ?? "",
                    dialysisStatus: saved.dialysisStatus ?? "",
                    potassium: saved.potassium ?? "",
                    phosphorus: saved.phosphorus ?? "",
                    hemoglobin: saved.hemoglobin ?? "",
                    bun: saved.bun ?? "",
                    edema:
                        saved.edema === true
                            ? "true"
                            : saved.edema === false
                                ? "false"
                                : "",
                    fatigueLevel: saved.fatigueLevel ?? "",
                    physicalActivity: saved.physicalActivity ?? "",
                    dietQuality: saved.dietQuality ?? "",
                    notes: saved.notes ?? ""
                });
            } catch (err) {
                if (active) {
                    setError(
                        err.response?.data?.error ||
                        "Could not load saved clinical information."
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        loadData();

        return () => {
            active = false;
        };
    }, [patientId]);

    const handleChange = (e) => {
        const { name, value } = e.target;

        setForm((previous) => ({
            ...previous,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        setSubmitting(true);
        setError("");

        const numericFields = [
            "bodyWeight",
            "serumAlbumin",
            "bicarbonate",
            "urineOutput",
            "potassium",
            "phosphorus",
            "hemoglobin",
            "bun",
            "fatigueLevel",
            "physicalActivity"
        ];

        const data = { ...form };

        for (const key of numericFields) {
            data[key] =
                data[key] === "" || data[key] == null
                    ? null
                    : Number(data[key]);
        }

        data.edema =
            data.edema === ""
                ? null
                : data.edema === "true";

        data.dialysisStatus = data.dialysisStatus || null;
        data.dietQuality = data.dietQuality || null;
        data.notes = data.notes.trim() || null;

        try {
            await axios.put(
                `${API}/${patientId}/measurements/${measurementId}/recommendation-data`,
                {
                    recommendationData: data
                }
            );

            const response = await axios.post(
                `${API}/${patientId}/measurements/${measurementId}/recommendations`
            );

            navigate(
                `/patients/${patientId}/recommendations/${measurementId}/results`,
                {
                    state: {
                        recommendations: response.data
                    }
                }
            );
        } catch (err) {
            console.error("Recommendation error:", err);

            setError(
                err.response?.data?.error ||
                err.response?.data?.message ||
                "Unable to save details or generate recommendations."
            );
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <main className="recommendation-page">
                <div className="recommendation-shell">
                    <div className="recommendation-panel">
                        Loading clinical information...
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="recommendation-page">
            <div className="recommendation-shell">

                <button
                    className="recommendation-back"
                    type="button"
                    onClick={() => navigate(-1)}
                >
                    ← Back to CKD assessment
                </button>

                <header className="recommendation-header">
                    <span className="recommendation-eyebrow">
                        PATIENT CARE · VISIT DETAILS
                    </span>

                    <h1>Personalized Recommendations</h1>

                    <p>
                        Enter any additional available clinical information.
                        Leave fields blank if they are unavailable.
                    </p>
                </header>

                {error && (
                    <div className="recommendation-error" role="alert">
                        {error}
                    </div>
                )}

                <form
                    className="recommendation-panel"
                    onSubmit={handleSubmit}
                >
                    <div className="recommendation-section-heading">
                        <div>
                            <h2>Patient Parameters</h2>
                            <p>
                                Additional information for personalized
                                kidney health guidance.
                            </p>
                        </div>

                        <span className="optional-badge">
                            All fields optional
                        </span>
                    </div>

                    {/* SECTION 1 */}
                    <section className="optional-section">
                        <h3>1. Body Measurements</h3>

                        <div className="recommendation-form-grid">
                            <label className="recommendation-field">
                                <span>Body Weight <small>(kg)</small></span>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    name="bodyWeight"
                                    value={form.bodyWeight}
                                    onChange={handleChange}
                                    placeholder="e.g. 68"
                                />
                            </label>
                        </div>
                    </section>

                    {/* SECTION 2 */}
                    <section className="optional-section">
                        <h3>2. Blood Test Results</h3>

                        <div className="recommendation-form-grid">
                            <label className="recommendation-field">
                                <span>Hemoglobin <small>(g/dL)</small></span>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    name="hemoglobin"
                                    value={form.hemoglobin}
                                    onChange={handleChange}
                                    placeholder="e.g. 11.4"
                                />
                            </label>

                            <label className="recommendation-field">
                                <span>Serum Albumin <small>(g/dL)</small></span>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    name="serumAlbumin"
                                    value={form.serumAlbumin}
                                    onChange={handleChange}
                                    placeholder="e.g. 3.8"
                                />
                            </label>

                            <label className="recommendation-field">
                                <span>Potassium <small>(mmol/L)</small></span>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    name="potassium"
                                    value={form.potassium}
                                    onChange={handleChange}
                                    placeholder="e.g. 4.5"
                                />
                            </label>

                            <label className="recommendation-field">
                                <span>Phosphorus <small>(mg/dL)</small></span>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    name="phosphorus"
                                    value={form.phosphorus}
                                    onChange={handleChange}
                                    placeholder="e.g. 4.0"
                                />
                            </label>

                            <label className="recommendation-field">
                                <span>BUN <small>(mg/dL)</small></span>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    name="bun"
                                    value={form.bun}
                                    onChange={handleChange}
                                    placeholder="e.g. 31.5"
                                />
                            </label>

                            <label className="recommendation-field">
                                <span>Bicarbonate <small>(mmol/L)</small></span>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    name="bicarbonate"
                                    value={form.bicarbonate}
                                    onChange={handleChange}
                                    placeholder="e.g. 24"
                                />
                            </label>
                        </div>
                    </section>

                    {/* SECTION 3 */}
                    <section className="optional-section">
                        <h3>3. Urine Output & Dialysis</h3>

                        <div className="recommendation-form-grid">
                            <label className="recommendation-field">
                                <span>
                                    24-Hour Urine Output <small>(mL/day)</small>
                                </span>
                                <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    name="urineOutput"
                                    value={form.urineOutput}
                                    onChange={handleChange}
                                    placeholder="e.g. 1200"
                                />
                            </label>

                            <label className="recommendation-field">
                                <span>Currently on Dialysis</span>
                                <select
                                    name="dialysisStatus"
                                    value={form.dialysisStatus}
                                    onChange={handleChange}
                                >
                                    <option value="">Not provided</option>
                                    <option value="no">No</option>
                                    <option value="yes">Yes</option>
                                </select>
                            </label>
                        </div>
                    </section>

                    {/* SECTION 4 */}
                    <section className="optional-section">
                        <h3>4. Lifestyle & Physical Symptoms</h3>

                        <div className="recommendation-form-grid">
                            <label className="recommendation-field">
                                <span>Edema / Swelling</span>
                                <select
                                    name="edema"
                                    value={form.edema}
                                    onChange={handleChange}
                                >
                                    <option value="">Not provided</option>
                                    <option value="true">Yes</option>
                                    <option value="false">No</option>
                                </select>
                            </label>

                            <label className="recommendation-field">
                                <span>Fatigue Level</span>
                                <select
                                    name="fatigueLevel"
                                    value={form.fatigueLevel}
                                    onChange={handleChange}
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
                                    value={form.physicalActivity}
                                    onChange={handleChange}
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
                                    value={form.dietQuality}
                                    onChange={handleChange}
                                >
                                    <option value="">Not provided</option>
                                    <option value="Poor">Poor</option>
                                    <option value="Moderate">Moderate</option>
                                    <option value="Good">Good</option>
                                </select>
                            </label>

                            <label className="recommendation-field recommendation-field-wide">
                                <span>Additional Notes</span>
                                <textarea
                                    name="notes"
                                    rows="3"
                                    value={form.notes}
                                    onChange={handleChange}
                                    placeholder="Optional clinical notes"
                                />
                            </label>
                        </div>
                    </section>

                    <div className="recommendation-form-footer">
                        <p>
                            Enter only known values. Missing information
                            will remain unspecified.
                        </p>

                        <button
                            className="recommendation-submit"
                            type="submit"
                            disabled={submitting}
                        >
                            {submitting
                                ? "Saving and generating..."
                                : "Generate Recommendations →"}
                        </button>
                    </div>
                </form>

                <p className="recommendation-safety">
                    This system provides decision-support information only.
                    A qualified healthcare professional should review
                    recommendations before clinical use.
                </p>
            </div>
        </main>
    );
}