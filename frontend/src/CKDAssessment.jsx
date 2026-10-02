import { useState } from "react";
import axios from "axios";
import RiskScorePanel, {
    ScreeningExplanation
} from "../components/RiskScorePanel";

import "./CKDAssessment.css";


const API_URL = "http://localhost:5000/api";


function describeError(err) {

    const data = err.response?.data;

    if (data?.fields) {

        return Object.entries(data.fields)
            .map(
                ([field, message]) =>
                    `${field}: ${message}`
            )
            .join(" ");

    }

    return (
        data?.message ||
        data?.error ||
        "Unable to reach the server. Please make sure the backend servers are running."
    );
}


function CKDAssessment() {
    console.log("🔥 NEW CKD ASSESSMENT FILE IS RUNNING");


    // =========================================================
    // FORM DATA
    // =========================================================

    const [formData, setFormData] = useState({

        age: "",

        gender: "",

        bp_systolic: "",

        bp_diastolic: "",

        serum_creatinine: "",

        albumin_creatinine_ratio: "",

        diabetes_diagnosed: ""

    });


    // =========================================================
    // RESULTS
    // =========================================================

    const [result, setResult] =
        useState(null);

    const [risk, setRisk] =
        useState(null);


    // =========================================================
    // STATES
    // =========================================================

    const [screeningError, setScreeningError] =
        useState("");

    const [loading, setLoading] =
        useState(false);

    const [error, setError] =
        useState("");


    // =========================================================
    // HANDLE FORM CHANGE
    // =========================================================

    const handleChange = (e) => {

        setFormData({

            ...formData,

            [e.target.name]:
                e.target.value

        });

    };


    // =========================================================
    // SUBMIT ASSESSMENT
    // =========================================================

    const handleSubmit = async (e) => {

        e.preventDefault();

        setLoading(true);

        setError("");

        setScreeningError("");

        setResult(null);

        setRisk(null);


        // -----------------------------------------------------
        // Prepare payload
        // -----------------------------------------------------

        const payload = {

            age:
                Number(
                    formData.age
                ),

            gender:
                formData.gender,

            bp_systolic:
                Number(
                    formData.bp_systolic
                ),

            bp_diastolic:
                Number(
                    formData.bp_diastolic
                ),

            serum_creatinine:
                Number(
                    formData.serum_creatinine
                ),

            albumin_creatinine_ratio:
                Number(
                    formData.albumin_creatinine_ratio
                ),

            diabetes_diagnosed:
                Number(
                    formData.diabetes_diagnosed
                )

        };


        try {

            // -------------------------------------------------
            // Run CKD Screening + Risk Score together
            // -------------------------------------------------

            const [
                screening,
                riskScore
            ] = await Promise.allSettled([

                axios.post(
                    `${API_URL}/predict-ckd`,
                    payload
                ),

                axios.post(
                    `${API_URL}/risk-score`,
                    payload
                )

            ]);


            // -------------------------------------------------
            // CKD SCREENING RESULT
            // -------------------------------------------------

            if (
                screening.status ===
                "fulfilled"
            ) {

                const screeningData = screening.value.data;

                setResult(screeningData);

                // Initialize final eGFR with calculated eGFR
                setFinalEGFR(screeningData.egfr);

            } else {

                setScreeningError(
                    describeError(
                        screening.reason
                    )
                );

            }


            // -------------------------------------------------
            // RISK SCORE RESULT
            // -------------------------------------------------

            if (
                riskScore.status ===
                "fulfilled"
            ) {

                setRisk(
                    riskScore.value.data
                );

            } else {

                setError(
                    describeError(
                        riskScore.reason
                    )
                );

            }

        } catch (err) {

            console.error(
                "Assessment error:",
                err
            );

            setError(
                describeError(err)
            );

        } finally {

            setLoading(false);

        }

    };


    // =========================================================
    // UI
    // =========================================================

    return (

        <div className="ckd-assessment-page">


            {/* =================================================
                PAGE HEADER
            ================================================= */}

            <div className="assessment-header">

                <p className="eyebrow">
                    CLINICAL ASSESSMENT
                </p>

                <h1>
                    CKD Assessment
                </h1>

                <p className="assessment-description">

                    Enter the patient's clinical
                    information to assess potential
                    CKD indicators and calculate the
                    early warning risk score.

                </p>

            </div>


            {/* =================================================
                INPUT FORM
            ================================================= */}

            <section className="assessment-panel">

                <div className="section-title">

                    <h2>
                        Clinical Information
                    </h2>

                    <p>
                        Enter the patient's current
                        clinical measurements.
                    </p>

                </div>


                <form
                    onSubmit={handleSubmit}
                    className="assessment-form"
                >


                    {/* =========================================
                        AGE
                    ========================================= */}

                    <div className="form-field">

                        <label>
                            Age
                        </label>

                        <input
                            type="number"
                            name="age"
                            min="18"
                            max="120"
                            value={
                                formData.age
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="Enter age"
                            required
                        />

                    </div>


                    {/* =========================================
                        GENDER
                    ========================================= */}

                    <div className="form-field">

                        <label>
                            Gender
                        </label>

                        <select
                            name="gender"
                            value={
                                formData.gender
                            }
                            onChange={
                                handleChange
                            }
                            required
                        >

                            <option value="">
                                Select Gender
                            </option>

                            <option value="Male">
                                Male
                            </option>

                            <option value="Female">
                                Female
                            </option>

                        </select>

                    </div>


                    {/* =========================================
                        SYSTOLIC BP
                    ========================================= */}

                    <div className="form-field">

                        <label>
                            Systolic Blood Pressure
                            <span>
                                {" "} (mmHg)
                            </span>
                        </label>

                        <input
                            type="number"
                            name="bp_systolic"
                            min="50"
                            max="300"
                            value={
                                formData.bp_systolic
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="e.g. 120"
                            required
                        />

                    </div>


                    {/* =========================================
                        DIASTOLIC BP
                    ========================================= */}

                    <div className="form-field">

                        <label>
                            Diastolic Blood Pressure
                            <span>
                                {" "} (mmHg)
                            </span>
                        </label>

                        <input
                            type="number"
                            name="bp_diastolic"
                            min="30"
                            max="200"
                            value={
                                formData.bp_diastolic
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="e.g. 80"
                            required
                        />

                    </div>


                    {/* =========================================
                        SERUM CREATININE
                    ========================================= */}

                    <div className="form-field">

                        <label>
                            Serum Creatinine
                            <span>
                                {" "} (mg/dL)
                            </span>
                        </label>

                        <input
                            type="number"
                            step="0.01"
                            name="serum_creatinine"
                            min="0.1"
                            max="20"
                            value={
                                formData.serum_creatinine
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="e.g. 1.20"
                            required
                        />

                    </div>


                    {/* =========================================
                        UACR
                    ========================================= */}

                    <div className="form-field">

                        <label>
                            Albumin-Creatinine Ratio
                            <span>
                                {" "} (mg/g)
                            </span>
                        </label>

                        <input
                            type="number"
                            step="0.01"
                            name="albumin_creatinine_ratio"
                            min="0.1"
                            max="10000"
                            value={
                                formData.albumin_creatinine_ratio
                            }
                            onChange={
                                handleChange
                            }
                            placeholder="e.g. 30"
                            required
                        />

                    </div>


                    {/* =========================================
                        DIABETES
                    ========================================= */}

                    <div className="form-field">

                        <label>
                            Diabetes Diagnosed?
                        </label>

                        <select
                            name="diabetes_diagnosed"
                            value={
                                formData.diabetes_diagnosed
                            }
                            onChange={
                                handleChange
                            }
                            required
                        >

                            <option value="">
                                Select
                            </option>

                            <option value="1">
                                Yes
                            </option>

                            <option value="0">
                                No
                            </option>

                        </select>

                    </div>


                    {/* =========================================
                        SUBMIT
                    ========================================= */}

                    <div className="assessment-action">

                        <button
                            type="submit"
                            className="primary-button"
                            disabled={loading}
                        >

                            {loading
                                ? "Analyzing..."
                                : "Run CKD Assessment"}

                        </button>

                    </div>

                </form>

            </section>


            {/* =================================================
                GENERAL ERROR
            ================================================= */}

            {error && (

                <div className="error-message">

                    {error}

                </div>

            )}


            {/* =================================================
                SCREENING ERROR
            ================================================= */}

            {screeningError && (

                <div className="error-message">

                    <strong>
                        Screening model:
                    </strong>

                    {" "}

                    {screeningError}

                </div>

            )}


            {/* =================================================
                CKD ASSESSMENT RESULT
            ================================================= */}

            {result && (

                <section className="result-card">


                    <div className="result-content">

                        <span className="card-label">
                            ASSESSMENT RESULT
                        </span>


                        <h2>

                            {result.prediction === 1

                                ? "Potential CKD indicators detected"

                                : "No CKD indicators detected by the model"

                            }

                        </h2>


                        <p className="model-score">

                            Model score:

                            {" "}

                            <strong>
                                {result.probability}%
                            </strong>

                        </p>

                    </div>


                    {/* =========================================
                        eGFR
                    ========================================= */}

                    <div className="egfr-result">

                        <span className="card-label">
                            KIDNEY FUNCTION ESTIMATE
                        </span>


                        <div className="egfr-value">

                            {result.egfr}

                        </div>


                        <p>
                            mL/min/1.73 m²
                        </p>


                        <small>

                            eGFR is an estimate of
                            kidney function calculated
                            from age, sex, and serum
                            creatinine.

                        </small>

                    </div>


                    {/* =========================================
                        SCREENING EXPLANATION
                    ========================================= */}

                    <ScreeningExplanation
                        explanation={
                            result.explanation
                        }
                    />

                </section>

            )}


            {/* =================================================
                RISK SCORE PANEL
                This is intentionally BELOW the CKD result.
            ================================================= */}

            {risk && (

                <section className="risk-score-section">

                    <RiskScorePanel
                        risk={risk}
                    />

                </section>

            )}


        </div>

    );

}


export default CKDAssessment;