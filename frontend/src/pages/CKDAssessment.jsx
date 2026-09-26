import { useEffect, useState } from "react";
import axios from "axios";
import {
    Link,
    useParams,
    useNavigate
} from "react-router-dom";


function CKDAssessment() {

    const { id } = useParams();

    const navigate = useNavigate();


    // =========================================================
    // PATIENT
    // =========================================================

    const [patient, setPatient] =
        useState(null);

    const [history, setHistory] =
        useState([]);


    // =========================================================
    // FORM
    // =========================================================

    const [formData, setFormData] = useState({

        date:
            new Date()
                .toISOString()
                .split("T")[0],

        bp_systolic: "",
        bp_diastolic: "",
        serum_creatinine: "",
        albumin_creatinine_ratio: "",
        diabetes_diagnosed: ""

    });


    // =========================================================
    // RESULT
    // =========================================================

    const [result, setResult] =
        useState(null);

    const [finalEGFR, setFinalEGFR] =
        useState("");

    const [editingEGFR, setEditingEGFR] =
        useState(false);


    // =========================================================
    // AGE EDIT
    // =========================================================

    const [editingAge, setEditingAge] =
        useState(false);

    const [ageInput, setAgeInput] =
        useState("");


    // =========================================================
    // LOADING / ERROR
    // =========================================================

    const [loading, setLoading] =
        useState(false);

    const [saving, setSaving] =
        useState(false);

    const [loadingPatient, setLoadingPatient] =
        useState(true);

    const [error, setError] =
        useState("");

    const [successMessage, setSuccessMessage] =
        useState("");


    // =========================================================
    // LOAD PATIENT
    // =========================================================

    const loadPatientData = async () => {

        try {

            setLoadingPatient(true);
            setError("");


            const [
                patientResponse,
                historyResponse
            ] = await Promise.all([

                axios.get(
                    `http://localhost:5000/api/patients/${id}`
                ),

                axios.get(
                    `http://localhost:5000/api/patients/${id}/history`
                )

            ]);


            const patientData =
                patientResponse.data;


            const historyData =
                historyResponse.data;


            setPatient(patientData);

            setHistory(historyData);

            setAgeInput(
                patientData.age
            );


        } catch (err) {

            console.error(err);

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


    // =========================================================
    // FORM CHANGE
    // =========================================================

    const handleChange = (e) => {

        setFormData({

            ...formData,

            [e.target.name]:
                e.target.value

        });

    };


    // =========================================================
    // EDIT AGE
    // =========================================================

    const handleSaveAge = async () => {

        const age =
            Number(ageInput);


        if (
            !Number.isFinite(age) ||
            age < 0 ||
            age > 120
        ) {

            setError(
                "Please enter a valid age."
            );

            return;

        }


        try {

            const response =
                await axios.put(

                    `http://localhost:5000/api/patients/${id}`,

                    {
                        age: age
                    }

                );


            setPatient(
                response.data
            );


            setAgeInput(
                response.data.age
            );


            setEditingAge(false);

            setSuccessMessage(
                "Patient age updated successfully."
            );


            setTimeout(() => {
                setSuccessMessage("");
            }, 2500);


        } catch (err) {

            console.error(err);

            setError(
                err.response?.data?.error ||
                "Unable to update patient age."
            );

        }

    };


    // =========================================================
    // RUN CKD ASSESSMENT
    // =========================================================

    const handleAssessment = async (e) => {

        e.preventDefault();


        setLoading(true);

        setError("");

        setSuccessMessage("");

        setResult(null);


        try {

            const predictionResponse =
                await axios.post(

                    "http://localhost:5000/api/predict-ckd",

                    {

                        age:
                            Number(
                                patient.age
                            ),

                        gender:
                            patient.gender,

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

                    }

                );


            const prediction =
                predictionResponse.data;


            setResult(
                prediction
            );


            // IMPORTANT:
            // This only initializes the editable final eGFR.
            // It DOES NOT save anything yet.
            setFinalEGFR(
                prediction.egfr
            );


            setEditingEGFR(false);


        } catch (err) {

            console.error(err);

            setError(
                err.response?.data?.error ||
                "Unable to complete CKD assessment."
            );

        } finally {

            setLoading(false);

        }

    };


    // =========================================================
    // SAVE MEASUREMENT
    // =========================================================

    const handleSaveMeasurement = async () => {

        if (!result) {

            setError(
                "Run the CKD assessment first."
            );

            return;

        }


        const finalValue =
            Number(finalEGFR);


        if (
            !Number.isFinite(finalValue) ||
            finalValue < 0
        ) {

            setError(
                "Please enter a valid final eGFR."
            );

            return;

        }


        setSaving(true);

        setError("");

        setSuccessMessage("");


        try {

            const response =
                await axios.post(

                    `http://localhost:5000/api/patients/${id}/measurements`,

                    {

                        date:
                            formData.date,

                        calculatedEGFR:
                            Number(
                                result.egfr
                            ),

                        finalEGFR:
                            finalValue,

                        serumCreatinine:
                            Number(
                                formData.serum_creatinine
                            ),

                        UACR:
                            Number(
                                formData.albumin_creatinine_ratio
                            ),

                        systolicBP:
                            Number(
                                formData.bp_systolic
                            ),

                        diastolicBP:
                            Number(
                                formData.bp_diastolic
                            ),

                        diabetes:
                            Number(
                                formData.diabetes_diagnosed
                            ),

                        ckdPrediction:
                            result.prediction,

                        ckdProbability:
                            result.probability

                    }

                );


            // Refresh history so next visit number
            // is immediately correct.
            const historyResponse =
                await axios.get(

                    `http://localhost:5000/api/patients/${id}/history`

                );


            setHistory(
                historyResponse.data
            );


            setSuccessMessage(
                `Visit ${response.data.visitNumber} saved successfully.`
            );


            // Clear current result after save.
            setResult(null);

            setFinalEGFR("");

            setEditingEGFR(false);


        } catch (err) {

            console.error(err);

            setError(
                err.response?.data?.error ||
                "Unable to save measurement."
            );

        } finally {

            setSaving(false);

        }

    };


    // =========================================================
    // NEXT VISIT NUMBER
    // =========================================================

    const nextVisitNumber =
        history.length + 1;


    // =========================================================
    // LOADING
    // =========================================================

    if (loadingPatient) {

        return (

            <div className="main-content">

                <div className="panel">

                    <h2>
                        Loading patient information...
                    </h2>

                </div>

            </div>

        );

    }


    // =========================================================
    // PATIENT NOT FOUND
    // =========================================================

    if (!patient) {

        return (

            <div className="main-content">

                <div className="panel">

                    <h2>
                        Patient not found
                    </h2>

                    <Link to="/patients">
                        Back to Patients
                    </Link>

                </div>

            </div>

        );

    }


    // =========================================================
    // UI
    // =========================================================

    return (

        <div className="app-layout">


            {/* =================================================
                SIDEBAR
            ================================================= */}

            <aside className="sidebar">

                <h2>
                    NefroAI
                </h2>

                <p className="sidebar-subtitle">
                    Clinical Decision Support
                </p>


                <nav>

                    <Link to="/">
                        Dashboard
                    </Link>

                    <Link to="/patients">
                        Patients
                    </Link>

                </nav>

            </aside>


            {/* =================================================
                MAIN CONTENT
            ================================================= */}

            <main className="main-content">


                {/* PAGE HEADER */}

                <div className="page-header">

                    <div>

                        <Link
                            to={`/patients/${id}`}
                        >
                            ← Back to Patient
                        </Link>


                        <p className="eyebrow">
                            CLINICAL ASSESSMENT
                        </p>


                        <h1>
                            CKD Assessment
                        </h1>


                        <p>
                            Record the patient's
                            clinical measurements
                            for this visit.
                        </p>

                    </div>

                </div>


                {/* =================================================
                    PATIENT INFORMATION
                ================================================= */}

                <section className="panel">

                    <div className="section-title">

                        <h2>
                            Patient Information
                        </h2>

                    </div>


                    <div className="form-grid">


                        {/* AGE */}

                        <div className="form-field">

                            <label>
                                Age
                            </label>


                            {!editingAge ? (

                                <div
                                    style={{
                                        display: "flex",
                                        gap: "10px",
                                        alignItems: "center"
                                    }}
                                >

                                    <input
                                        type="number"
                                        value={
                                            patient.age
                                        }
                                        readOnly
                                    />


                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() => {

                                            setAgeInput(
                                                patient.age
                                            );

                                            setEditingAge(
                                                true
                                            );

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
                                        alignItems: "center"
                                    }}
                                >

                                    <input
                                        type="number"
                                        min="0"
                                        max="120"
                                        value={
                                            ageInput
                                        }
                                        onChange={(e) =>
                                            setAgeInput(
                                                e.target.value
                                            )
                                        }
                                    />


                                    <button
                                        type="button"
                                        className="primary-button"
                                        onClick={
                                            handleSaveAge
                                        }
                                    >
                                        Save
                                    </button>


                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() => {

                                            setAgeInput(
                                                patient.age
                                            );

                                            setEditingAge(
                                                false
                                            );

                                        }}
                                    >
                                        Cancel
                                    </button>

                                </div>

                            )}

                        </div>


                        {/* GENDER */}

                        <div className="form-field">

                            <label>
                                Gender
                            </label>

                            <input
                                type="text"
                                value={
                                    patient.gender
                                }
                                readOnly
                            />

                        </div>

                    </div>

                </section>


                {/* =================================================
                    VISIT INFORMATION
                ================================================= */}

                <section className="panel">

                    <div className="section-title">

                        <h2>
                            Visit Information
                        </h2>

                    </div>


                    <div className="form-grid">


                        <div className="form-field">

                            <label>
                                Visit Number
                            </label>

                            <input
                                type="text"
                                value={
                                    `Visit ${nextVisitNumber}`
                                }
                                readOnly
                            />

                        </div>


                        <div className="form-field">

                            <label>
                                Measurement Date
                            </label>

                            <input
                                type="date"
                                name="date"
                                value={
                                    formData.date
                                }
                                onChange={
                                    handleChange
                                }
                                required
                            />

                        </div>

                    </div>

                </section>


                {/* =================================================
                    CLINICAL INFORMATION
                ================================================= */}

                <section className="panel">

                    <div className="section-title">

                        <h2>
                            Clinical Information
                        </h2>

                    </div>


                    <div className="form-grid">


                        {/* SYSTOLIC */}

                        <div className="form-field">

                            <label>
                                Systolic BP
                            </label>

                            <input
                                type="number"
                                name="bp_systolic"
                                value={
                                    formData.bp_systolic
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder="mmHg"
                                required
                            />

                        </div>


                        {/* DIASTOLIC */}

                        <div className="form-field">

                            <label>
                                Diastolic BP
                            </label>

                            <input
                                type="number"
                                name="bp_diastolic"
                                value={
                                    formData.bp_diastolic
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder="mmHg"
                                required
                            />

                        </div>


                        {/* CREATININE */}

                        <div className="form-field">

                            <label>
                                Serum Creatinine
                            </label>

                            <input
                                type="number"
                                step="0.01"
                                name="serum_creatinine"
                                value={
                                    formData.serum_creatinine
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder="mg/dL"
                                required
                            />

                        </div>


                        {/* UACR */}

                        <div className="form-field">

                            <label>
                                UACR
                            </label>

                            <input
                                type="number"
                                step="0.01"
                                name="albumin_creatinine_ratio"
                                value={
                                    formData.albumin_creatinine_ratio
                                }
                                onChange={
                                    handleChange
                                }
                                placeholder="mg/g"
                                required
                            />

                        </div>


                        {/* DIABETES */}

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

                    </div>


                    <button
                        type="button"
                        className="primary-button"
                        onClick={
                            handleAssessment
                        }
                        disabled={
                            loading
                        }
                    >

                        {loading
                            ? "Analyzing..."
                            : "Run CKD Assessment"}

                    </button>

                </section>


                {/* =================================================
                    RESULT
                ================================================= */}

                {result && (

                    <section className="result-card">


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

                                <strong>
                                    {result.probability}%
                                </strong>

                            </p>

                        </div>


                        <div
                            className="egfr-result"
                            style={{
                                minWidth: "260px"
                            }}
                        >

                            <label>
                                Calculated eGFR
                            </label>


                            <strong
                                style={{
                                    display: "block",
                                    fontSize: "22px",
                                    marginBottom: "10px"
                                }}
                            >
                                {result.egfr}
                                {" "}
                                mL/min/1.73 m²
                            </strong>


                            <label>
                                Final eGFR
                            </label>


                            <div
                                style={{
                                    display: "flex",
                                    gap: "8px",
                                    alignItems: "center",
                                    marginTop: "5px"
                                }}
                            >

                                <input
                                    type="number"
                                    step="0.01"
                                    value={
                                        finalEGFR
                                    }
                                    readOnly={
                                        !editingEGFR
                                    }
                                    onChange={(e) =>
                                        setFinalEGFR(
                                            e.target.value
                                        )
                                    }
                                    style={{
                                        maxWidth: "130px"
                                    }}
                                />


                                {!editingEGFR ? (

                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() =>
                                            setEditingEGFR(
                                                true
                                            )
                                        }
                                    >
                                        Edit
                                    </button>

                                ) : (

                                    <button
                                        type="button"
                                        className="primary-button"
                                        onClick={() =>
                                            setEditingEGFR(
                                                false
                                            )
                                        }
                                    >
                                        Done
                                    </button>

                                )}

                            </div>


                            <small>
                                This is the clinician-confirmed
                                value that will be stored in
                                patient history.
                            </small>

                        </div>


                        {/* SAVE */}

                        <div>

                            <button
                                type="button"
                                className="primary-button"
                                onClick={
                                    handleSaveMeasurement
                                }
                                disabled={
                                    saving
                                }
                            >

                                {saving
                                    ? "Saving..."
                                    : `Save Visit ${nextVisitNumber}`}

                            </button>

                        </div>


                    </section>

                )}


                {/* =================================================
                    MESSAGES
                ================================================= */}

                {successMessage && (

                    <div
                        className="success-message"
                        style={{
                            marginTop: "16px"
                        }}
                    >
                        {successMessage}
                    </div>

                )}


                {error && (

                    <div
                        className="error-message"
                        style={{
                            marginTop: "16px"
                        }}
                    >
                        {error}
                    </div>

                )}


                {/* =================================================
                    HISTORY LINK
                ================================================= */}

                <div
                    style={{
                        marginTop: "20px"
                    }}
                >

                    <button
                        type="button"
                        className="secondary-button"
                        onClick={() =>
                            navigate(
                                `/patients/${id}`
                            )
                        }
                    >
                        View Patient History
                    </button>

                </div>


            </main>

        </div>

    );

}


export default CKDAssessment;
