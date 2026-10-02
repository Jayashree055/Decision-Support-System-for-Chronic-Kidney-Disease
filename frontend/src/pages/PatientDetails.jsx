import { Fragment, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
    Link,
    useNavigate,
    useParams
} from "react-router-dom";
import "./PatientDetailsHistory.css";


function PatientDetails() {

    const { id } = useParams();

    const navigate = useNavigate();


    // =========================================================
    // STATE
    // =========================================================

    const [patient, setPatient] =
        useState(null);

    const [history, setHistory] =
        useState([]);

    const [expandedVisitId, setExpandedVisitId] =
        useState(null);

    const [progression, setProgression] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [progressionLoading, setProgressionLoading] =
        useState(false);

    const [error, setError] =
        useState("");

    const [successMessage, setSuccessMessage] =
        useState("");


    // =========================================================
    // AGE EDIT
    // =========================================================

    const [editingAge, setEditingAge] =
        useState(false);

    const [ageInput, setAgeInput] =
        useState("");


    // =========================================================
    // eGFR EDIT
    // =========================================================

    const [editingMeasurementId, setEditingMeasurementId] =
        useState(null);

    const [editedEGFR, setEditedEGFR] =
        useState("");


    // =========================================================
    // LOAD PATIENT + HISTORY
    // =========================================================

    const loadData = async () => {

        try {

            setLoading(true);
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

            setHistory(
                Array.isArray(historyData)
                    ? historyData
                    : []
            );

            setAgeInput(
                patientData.age ?? ""
            );


        } catch (err) {

            console.error(
                "Patient loading error:",
                err
            );

            setError(
                err.response?.data?.error ||
                "Unable to load patient."
            );

        } finally {

            setLoading(false);

        }

    };


    useEffect(() => {

        loadData();

    }, [id]);


    // =========================================================
    // UPDATE AGE
    // =========================================================

    const saveAge = async () => {

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
                "Age updated successfully."
            );


            setTimeout(() => {

                setSuccessMessage("");

            }, 2500);


        } catch (err) {

            console.error(
                "Age update error:",
                err
            );

            setError(
                err.response?.data?.error ||
                "Unable to update age."
            );

        }

    };


    // =========================================================
    // START eGFR EDIT
    // =========================================================

    const startEGFREdit = (measurement) => {

        setEditingMeasurementId(
            measurement._id
        );

        setEditedEGFR(
            measurement.finalEGFR ??
            measurement.calculatedEGFR ??
            ""
        );

    };


    // =========================================================
    // SAVE eGFR
    // =========================================================

    const saveEGFR = async (measurementId) => {

        const value =
            Number(editedEGFR);


        if (
            !Number.isFinite(value) ||
            value < 0
        ) {

            setError(
                "Please enter a valid eGFR."
            );

            return;

        }


        try {

            await axios.put(

                `http://localhost:5000/api/patients/${id}/measurements/${measurementId}`,

                {
                    finalEGFR: value
                }

            );


            setEditingMeasurementId(
                null
            );

            setEditedEGFR("");

            setSuccessMessage(
                "Final eGFR updated successfully."
            );


            await loadData();


            setTimeout(() => {

                setSuccessMessage("");

            }, 2500);


        } catch (err) {

            console.error(
                "eGFR update error:",
                err
            );

            setError(
                err.response?.data?.error ||
                "Unable to update eGFR."
            );

        }

    };


    // =========================================================
    // ANALYZE PROGRESSION
    //
    // IMPORTANT:
    // Backend route is GET /:id/progression
    // Do NOT change this to POST.
    // =========================================================

    const analyzeProgression = async () => {

        try {

            setProgressionLoading(true);

            setError("");

            const response =
                await axios.get(

                    `http://localhost:5000/api/patients/${id}/progression`

                );


            setProgression(
                response.data
            );


        } catch (err) {

            console.error(
                "Progression error:",
                err
            );

            setError(
                err.response?.data?.error ||
                "Unable to analyze progression."
            );

        } finally {

            setProgressionLoading(false);

        }

    };


    // =========================================================
    // SORT HISTORY
    // =========================================================

    const sortedHistory = useMemo(() => {

        return [...history].sort(
            (a, b) =>
                new Date(a.date) -
                new Date(b.date)
        );

    }, [history]);


    // =========================================================
    // OBSERVED PROGRESSION
    // =========================================================

    const observedProgression =
        useMemo(() => {

            if (
                !sortedHistory ||
                sortedHistory.length === 0
            ) {

                return null;

            }


            const values =
                sortedHistory

                    .map(item => {

                        const value =
                            Number(
                                item.finalEGFR ??
                                item.calculatedEGFR
                            );

                        return value;

                    })

                    .filter(value =>
                        Number.isFinite(value)
                    );


            if (
                values.length === 0
            ) {

                return null;

            }


            const current =
                values[
                    values.length - 1
                ];


            const first =
                values[0];


            const change =
                current - first;


            const percentageChange =
                first !== 0
                    ? (
                        (change / first) *
                        100
                    )
                    : 0;


            let trend =
                "Stable";


            if (change < -0.5) {

                trend =
                    "Declining";

            } else if (change > 0.5) {

                trend =
                    "Improving";

            }


            return {

                count:
                    values.length,

                current:
                    Number(
                        current.toFixed(2)
                    ),

                change:
                    Number(
                        change.toFixed(2)
                    ),

                percentageChange:
                    Number(
                        percentageChange.toFixed(2)
                    ),

                trend:
                    trend

            };

        }, [sortedHistory]);


    // =========================================================
    // LOADING
    // =========================================================

    if (loading) {

        return (

            <div className="main-content">

                <section className="panel">

                    <h2>
                        Loading patient...
                    </h2>

                </section>

            </div>

        );

    }


    // =========================================================
    // PATIENT NOT FOUND
    // =========================================================

    if (!patient) {

        return (

            <div className="main-content">

                <section className="panel">

                    <h2>
                        Patient not found
                    </h2>

                    <Link to="/patients">
                        Back to Patients
                    </Link>

                </section>

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


                {/* =================================================
                    HEADER
                ================================================= */}

                <div className="page-header">

                    <div>

                        <Link to="/patients">
                            ← Back to Patients
                        </Link>


                        <p className="eyebrow">
                            PATIENT PROFILE
                        </p>


                        <h1>
                            {patient.name}
                        </h1>


                        <p>
                            Patient ID:{" "}
                            {patient.patientCode}
                        </p>

                    </div>


                    <button
                        type="button"
                        className="primary-button"
                        onClick={() =>
                            navigate(
                                `/patients/${id}/assessment`
                            )
                        }
                    >
                        New Assessment
                    </button>

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
                                        display:
                                            "flex",
                                        gap:
                                            "10px",
                                        alignItems:
                                            "center"
                                    }}
                                >

                                    <input
                                        value={
                                            patient.age ??
                                            ""
                                        }
                                        readOnly
                                    />


                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() => {

                                            setAgeInput(
                                                patient.age ??
                                                ""
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
                                        display:
                                            "flex",
                                        gap:
                                            "10px",
                                        alignItems:
                                            "center"
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
                                            saveAge
                                        }
                                    >
                                        Save
                                    </button>


                                    <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() => {

                                            setEditingAge(
                                                false
                                            );

                                            setAgeInput(
                                                patient.age ??
                                                ""
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
                                value={
                                    patient.gender ??
                                    ""
                                }
                                readOnly
                            />

                        </div>

                    </div>

                </section>


                {/* =================================================
                    PROGRESSION OUTLOOK
                ================================================= */}

                <section
                    className="panel"
                    style={{
                        marginTop: "20px"
                    }}
                >

                    <div
                        style={{
                            display: "flex",
                            justifyContent:
                                "space-between",
                            alignItems:
                                "center",
                            gap: "20px",
                            flexWrap:
                                "wrap"
                        }}
                    >

                        <div>

                            <h2
                                style={{
                                    marginBottom:
                                        "6px"
                                }}
                            >
                                Progression Outlook
                            </h2>

                            <p
                                style={{
                                    margin: 0,
                                    color:
                                        "#718096"
                                }}
                            >
                                Based on the patient's
                                recorded eGFR history.
                            </p>

                        </div>


                        {history.length >= 4 && (

                            <button
                                type="button"
                                className="primary-button"
                                onClick={
                                    analyzeProgression
                                }
                                disabled={
                                    progressionLoading
                                }
                            >

                                {progressionLoading
                                    ? "Analyzing..."
                                    : "Analyze Progression"}

                            </button>

                        )}

                    </div>


                    {/* =================================================
                        ONE MEASUREMENT
                    ================================================= */}

                    {history.length === 1 && (

                        <div
                            style={{
                                marginTop:
                                    "20px",
                                padding:
                                    "25px",
                                background:
                                    "#f7f9fc",
                                borderRadius:
                                    "12px"
                            }}
                        >

                            <p
                                style={{
                                    margin:
                                        "0 0 8px",
                                    color:
                                        "#718096"
                                }}
                            >
                                Current eGFR
                            </p>


                            <h2
                                style={{
                                    margin:
                                        "0 0 12px"
                                }}
                            >

                                {
                                    Number(
                                        history[0]
                                            .finalEGFR ??
                                        history[0]
                                            .calculatedEGFR
                                    ).toFixed(2)
                                }

                                {" "}

                                <small>
                                    mL/min/1.73m²
                                </small>

                            </h2>


                            <p>
                                One measurement is
                                available. More
                                measurements are needed
                                to assess change over
                                time.
                            </p>

                        </div>

                    )}


                    {/* =================================================
                        TWO MEASUREMENTS
                    ================================================= */}

                    {history.length === 2 && (

                        <div
                            style={{
                                marginTop:
                                    "20px",
                                display:
                                    "grid",
                                gridTemplateColumns:
                                    "repeat(auto-fit, minmax(180px, 1fr))",
                                gap:
                                    "15px"
                            }}
                        >

                            <div className="metric-card">

                                <span>
                                    Current eGFR
                                </span>

                                <strong>
                                    {
                                        observedProgression
                                            ?.current
                                    }
                                </strong>

                            </div>


                            <div className="metric-card">

                                <span>
                                    Observed Change
                                </span>

                                <strong>
                                    {
                                        observedProgression
                                            ?.change
                                    }
                                </strong>

                            </div>


                            <div className="metric-card">

                                <span>
                                    Relative Change
                                </span>

                                <strong>
                                    {
                                        observedProgression
                                            ?.percentageChange
                                    }%
                                </strong>

                            </div>


                            <div className="metric-card">

                                <span>
                                    Observed Trajectory
                                </span>

                                <strong>
                                    {
                                        observedProgression
                                            ?.trend
                                    }
                                </strong>

                            </div>

                        </div>

                    )}


                    {/* =================================================
                        THREE MEASUREMENTS
                    ================================================= */}

                    {history.length === 3 && (

                        <div
                            style={{
                                marginTop:
                                    "20px"
                            }}
                        >

                            <div
                                style={{
                                    display:
                                        "grid",
                                    gridTemplateColumns:
                                        "repeat(auto-fit, minmax(180px, 1fr))",
                                    gap:
                                        "15px"
                                }}
                            >

                                <div className="metric-card">

                                    <span>
                                        Current eGFR
                                    </span>

                                    <strong>
                                        {
                                            observedProgression
                                                ?.current
                                        }
                                    </strong>

                                </div>


                                <div className="metric-card">

                                    <span>
                                        Overall Change
                                    </span>

                                    <strong>
                                        {
                                            observedProgression
                                                ?.change
                                        }
                                    </strong>

                                </div>


                                <div className="metric-card">

                                    <span>
                                        Relative Change
                                    </span>

                                    <strong>
                                        {
                                            observedProgression
                                                ?.percentageChange
                                        }%
                                    </strong>

                                </div>


                                <div className="metric-card">

                                    <span>
                                        Observed Trajectory
                                    </span>

                                    <strong>
                                        {
                                            observedProgression
                                                ?.trend
                                        }
                                    </strong>

                                </div>

                            </div>


                            <p
                                style={{
                                    marginTop:
                                        "20px",
                                    color:
                                        "#718096"
                                }}
                            >
                                A longitudinal trend is
                                now available from three
                                recorded measurements.
                                The model-based progression
                                outlook becomes available
                                once four historical
                                measurements are present.
                            </p>

                        </div>

                    )}


                    {/* =================================================
                        FOUR OR MORE MEASUREMENTS
                    ================================================= */}

                    {history.length >= 4 && (

                        <div
                            style={{
                                marginTop:
                                    "20px"
                            }}
                        >

                            <div
                                style={{
                                    display:
                                        "grid",
                                    gridTemplateColumns:
                                        "repeat(auto-fit, minmax(180px, 1fr))",
                                    gap:
                                        "15px"
                                }}
                            >

                                <div className="metric-card">

                                    <span>
                                        Current eGFR
                                    </span>

                                    <strong>
                                        {
                                            observedProgression
                                                ?.current
                                        }
                                    </strong>

                                </div>


                                <div className="metric-card">

                                    <span>
                                        Observed Change
                                    </span>

                                    <strong>
                                        {
                                            observedProgression
                                                ?.change
                                        }
                                    </strong>

                                </div>


                                <div className="metric-card">

                                    <span>
                                        Relative Change
                                    </span>

                                    <strong>
                                        {
                                            observedProgression
                                                ?.percentageChange
                                        }%
                                    </strong>

                                </div>


                                <div className="metric-card">

                                    <span>
                                        Observed Trajectory
                                    </span>

                                    <strong>
                                        {
                                            observedProgression
                                                ?.trend
                                        }
                                    </strong>

                                </div>

                            </div>

                        {/* =================================================
                    eGFR TREND GRAPH
                ================================================= */}

                {sortedHistory.length > 0 && (

                    <section
                        className="panel"
                        style={{
                            marginTop:
                                "20px"
                        }}
                    >

                        <div className="section-title">

                            <div>

                                <h2>
                                    eGFR Trend
                                </h2>

                                <p
                                    style={{
                                        color:
                                            "#718096"
                                    }}
                                >
                                    Recorded final eGFR
                                    values across visits
                                </p>

                            </div>

                        </div>


                        {(() => {

                            const points =
                                sortedHistory
                                    .map(
                                        (
                                            item,
                                            index
                                        ) => {

                                            const value =
                                                Number(
                                                    item.finalEGFR ??
                                                    item.calculatedEGFR
                                                );

                                            return {
                                                index,
                                                value,
                                                visit:
                                                    item.visitNumber ||
                                                    index + 1
                                            };

                                        }
                                    )
                                    .filter(
                                        point =>
                                            Number.isFinite(
                                                point.value
                                            )
                                    );


                            if (
                                points.length === 0
                            ) {

                                return (

                                    <p
                                        style={{
                                            color:
                                                "#718096"
                                        }}
                                    >
                                        No valid eGFR
                                        values available
                                        for the graph.
                                    </p>

                                );

                            }


                            const width = 900;

                            const height = 320;

                            const paddingLeft = 70;

                            const paddingRight = 30;

                            const paddingTop = 30;

                            const paddingBottom = 55;


                            const chartWidth =
                                width -
                                paddingLeft -
                                paddingRight;

                            const chartHeight =
                                height -
                                paddingTop -
                                paddingBottom;


                            const values =
                                points.map(
                                    point =>
                                        point.value
                                );


                            const minValue =
                                Math.min(
                                    ...values
                                );

                            const maxValue =
                                Math.max(
                                    ...values
                                );


                            const range =
                                maxValue -
                                minValue;


                            const extra =
                                range === 0
                                    ? 10
                                    : range * 0.15;


                            const minY =
                                Math.max(
                                    0,
                                    minValue -
                                    extra
                                );

                            const maxY =
                                maxValue +
                                extra;


                            const getX =
                                index => {

                                    if (
                                        points.length ===
                                        1
                                    ) {

                                        return (
                                            paddingLeft +
                                            chartWidth /
                                            2
                                        );

                                    }


                                    return (
                                        paddingLeft +
                                        (
                                            index /
                                            (
                                                points.length -
                                                1
                                            )
                                        ) *
                                        chartWidth
                                    );

                                };


                            const getY =
                                value => {

                                    if (
                                        maxY === minY
                                    ) {

                                        return (
                                            paddingTop +
                                            chartHeight /
                                            2
                                        );

                                    }


                                    return (
                                        paddingTop +
                                        (
                                            1 -
                                            (
                                                (
                                                    value -
                                                    minY
                                                ) /
                                                (
                                                    maxY -
                                                    minY
                                                )
                                            )
                                        ) *
                                        chartHeight
                                    );

                                };


                            const path =
                                points
                                    .map(
                                        (
                                            point,
                                            index
                                        ) => {

                                            const x =
                                                getX(
                                                    index
                                                );

                                            const y =
                                                getY(
                                                    point.value
                                                );

                                            return (
                                                index ===
                                                0
                                                    ? `M ${x} ${y}`
                                                    : `L ${x} ${y}`
                                            );

                                        }
                                    )
                                    .join(" ");


                            return (

                                <div
                                    style={{
                                        width:
                                            "100%",
                                        overflowX:
                                            "auto"
                                    }}
                                >

                                    <svg
                                        viewBox={`0 0 ${width} ${height}`}
                                        width="100%"
                                        style={{
                                            minWidth:
                                                "650px",
                                            height:
                                                "320px"
                                        }}
                                    >

                                        {/* Y AXIS */}

                                        <line
                                            x1={
                                                paddingLeft
                                            }
                                            y1={
                                                paddingTop
                                            }
                                            x2={
                                                paddingLeft
                                            }
                                            y2={
                                                height -
                                                paddingBottom
                                            }
                                            stroke="#cbd5e1"
                                            strokeWidth="1"
                                        />


                                        {/* X AXIS */}

                                        <line
                                            x1={
                                                paddingLeft
                                            }
                                            y1={
                                                height -
                                                paddingBottom
                                            }
                                            x2={
                                                width -
                                                paddingRight
                                            }
                                            y2={
                                                height -
                                                paddingBottom
                                            }
                                            stroke="#cbd5e1"
                                            strokeWidth="1"
                                        />


                                        {/* HORIZONTAL GRID */}

                                        {[0, 1, 2, 3, 4].map(
                                            index => {

                                                const y =
                                                    paddingTop +
                                                    (
                                                        index /
                                                        4
                                                    ) *
                                                    chartHeight;

                                                const value =
                                                    maxY -
                                                    (
                                                        index /
                                                        4
                                                    ) *
                                                    (
                                                        maxY -
                                                        minY
                                                    );

                                                return (

                                                    <g
                                                        key={
                                                            index
                                                        }
                                                    >

                                                        <line
                                                            x1={
                                                                paddingLeft
                                                            }
                                                            y1={
                                                                y
                                                            }
                                                            x2={
                                                                width -
                                                                paddingRight
                                                            }
                                                            y2={
                                                                y
                                                            }
                                                            stroke="#e2e8f0"
                                                            strokeWidth="1"
                                                        />


                                                        <text
                                                            x={
                                                                paddingLeft -
                                                                10
                                                            }
                                                            y={
                                                                y +
                                                                4
                                                            }
                                                            textAnchor="end"
                                                            fontSize="12"
                                                            fill="#718096"
                                                        >
                                                            {
                                                                value.toFixed(
                                                                    0
                                                                )
                                                            }
                                                        </text>

                                                    </g>

                                                );

                                            }
                                        )}


                                        {/* GRAPH LINE */}

                                        {points.length >= 2 && (

                                            <path
                                                d={
                                                    path
                                                }
                                                fill="none"
                                                stroke="#3158d4"
                                                strokeWidth="3"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            />

                                        )}


                                        {/* POINTS */}

                                        {points.map(
                                            (
                                                point,
                                                index
                                            ) => {

                                                const x =
                                                    getX(
                                                        index
                                                    );

                                                const y =
                                                    getY(
                                                        point.value
                                                    );

                                                return (

                                                    <g
                                                        key={
                                                            index
                                                        }
                                                    >

                                                        <circle
                                                            cx={
                                                                x
                                                            }
                                                            cy={
                                                                y
                                                            }
                                                            r="6"
                                                            fill="#ffffff"
                                                            stroke="#3158d4"
                                                            strokeWidth="3"
                                                        />


                                                        <text
                                                            x={
                                                                x
                                                            }
                                                            y={
                                                                y -
                                                                14
                                                            }
                                                            textAnchor="middle"
                                                            fontSize="12"
                                                            fontWeight="600"
                                                            fill="#1a2b49"
                                                        >
                                                            {
                                                                point.value.toFixed(
                                                                    2
                                                                )
                                                            }
                                                        </text>


                                                        <text
                                                            x={
                                                                x
                                                            }
                                                            y={
                                                                height -
                                                                paddingBottom +
                                                                25
                                                            }
                                                            textAnchor="middle"
                                                            fontSize="12"
                                                            fill="#718096"
                                                        >
                                                            Visit{" "}
                                                            {
                                                                point.visit
                                                            }
                                                        </text>

                                                    </g>

                                                );

                                            }
                                        )}

                                    </svg>

                                </div>

                            );

                        })()}


                        
                            

                        

                    </section>

                )}
                            {/* =================================================
                                MODEL RESULT
                            ================================================= */}

                            {progression &&
                                progression.progressionModel &&
                                progression.progressionModel.available !== false && (

                                    <div
                                        style={{
                                            marginTop:
                                                "25px",
                                            padding:
                                                "24px",
                                            border:
                                                "1px solid #dbe3ef",
                                            borderRadius:
                                                "14px",
                                            background:
                                                "#ffffff"
                                        }}
                                    >

                                        <div
                                            style={{
                                                textAlign:
                                                    "center",
                                                marginBottom:
                                                    "20px"
                                            }}
                                        >

                                            <h2
                                                style={{
                                                    margin:
                                                        "0 0 8px"
                                                }}
                                            >
                                                Model-Based
                                                Progression
                                                Outlook
                                            </h2>

                                            <p
                                                style={{
                                                    margin: 0,
                                                    color:
                                                        "#718096"
                                                }}
                                            >
                                                Generated using
                                                the trained
                                                progression model
                                                and the available
                                                historical eGFR
                                                measurements.
                                            </p>

                                        </div>


                                        <div
                                            style={{
                                                border:
                                                    "1px solid #dbe3ef",
                                                borderRadius:
                                                    "14px",
                                                padding:
                                                    "28px",
                                                display:
                                                    "flex",
                                                justifyContent:
                                                    "space-between",
                                                alignItems:
                                                    "center",
                                                gap:
                                                    "30px",
                                                flexWrap:
                                                    "wrap"
                                            }}
                                        >

                                            <div
                                                style={{
                                                    flex: 1,
                                                    minWidth:
                                                        "250px"
                                                }}
                                            >

                                                <p
                                                    style={{
                                                        margin:
                                                            "0 0 14px",
                                                        color:
                                                            "#3158d4",
                                                        fontWeight:
                                                            "700",
                                                        fontSize:
                                                            "14px",
                                                        textTransform:
                                                            "uppercase",
                                                        letterSpacing:
                                                            "0.5px"
                                                    }}
                                                >
                                                    Model Outlook
                                                </p>


                                                <div
                                                    style={{
                                                        fontSize:
                                                            "21px",
                                                        lineHeight:
                                                            "1.5"
                                                    }}
                                                >
                                                    {
                                                        progression
                                                            .progressionModel
                                                            .outlook ||
                                                        "Model result available."
                                                    }
                                                </div>

                                            </div>


                                            <div
                                                style={{
                                                    minWidth:
                                                        "120px",
                                                    textAlign:
                                                        "center"
                                                }}
                                            >

                                                <p
                                                    style={{
                                                        margin:
                                                            "0 0 4px",
                                                        color:
                                                            "#718096",
                                                        fontSize:
                                                            "14px"
                                                    }}
                                                >
                                                    MODEL SCORE
                                                </p>


                                                <strong
                                                    style={{
                                                        fontSize:
                                                            "38px"
                                                    }}
                                                >

                                                    {
                                                        progression
                                                            .progressionModel
                                                            .probability ??
                                                        progression
                                                            .progressionModel
                                                            .score ??
                                                        "—"
                                                    }

                                                    {(
                                                        progression
                                                            .progressionModel
                                                            .probability !==
                                                        undefined ||
                                                        progression
                                                            .progressionModel
                                                            .score !==
                                                        undefined
                                                    ) && "%"}

                                                </strong>

                                            </div>

                                        </div>


                                        {/* NOTE */}

                                        <div
                                            style={{
                                                marginTop:
                                                    "30px",
                                                padding:
                                                    "18px",
                                                background:
                                                    "#f7f9fc",
                                                borderRadius:
                                                    "10px",
                                                color:
                                                    "#5f6f89",
                                                fontSize:
                                                    "14px",
                                                lineHeight:
                                                    "1.6"
                                            }}
                                        >

                                            <strong>
                                                Note:
                                            </strong>{" "}

                                            The graph shows the
                                            patient's recorded
                                            final eGFR values
                                            across visits. The
                                            observed trajectory
                                            is based on these
                                            measurements, while
                                            the progression
                                            outlook is generated
                                            separately by the
                                            trained progression
                                            model.

                                        </div>

                                    </div>

                                )}


                            {/* =================================================
                                MODEL UNAVAILABLE
                            ================================================= */}

                            {progression &&
                                progression.progressionModel &&
                                progression.progressionModel.available === false && (

                                    <div
                                        style={{
                                            marginTop:
                                                "20px",
                                            padding:
                                                "18px",
                                            background:
                                                "#fff7ed",
                                            borderRadius:
                                                "10px",
                                            color:
                                                "#7c4a03"
                                        }}
                                    >

                                        The progression model
                                        could not be reached.
                                        Please make sure the
                                        Flask ML service is
                                        running.

                                    </div>

                                )}

                        </div>

                    )}

                </section>


                


                {/* =================================================
                    eGFR HISTORY
                ================================================= */}

                <section className="panel history-panel">
                    <div className="section-title history-heading">
                        <div>
                            <h2>eGFR History</h2>
                            <p>Recorded clinical measurements</p>
                        </div>
                    </div>

                    {history.length === 0 ? (
                        <div className="history-empty">
                            No measurements have been recorded yet.
                        </div>
                    ) : (
                        <div className="history-table-wrap">
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>Visit</th>
                                        <th>Date</th>
                                        <th>eGFR</th>
                                        <th>Creatinine</th>
                                        <th>UACR</th>
                                        <th>BP</th>
                                        <th>Details</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {sortedHistory.map((measurement, index) => {
                                        const visitId =
                                            measurement._id || `visit-${index}`;
                                        const isExpanded =
                                            expandedVisitId === visitId;
                                        const explanation =
                                            measurement.shapExplanation ||
                                            measurement.explanation ||
                                            measurement.ckdExplanation ||
                                            null;
                                        const shapFeatures =
                                            Array.isArray(explanation?.features)
                                                ? explanation.features
                                                : [];

                                        const additionalLabs =
                                            measurement.recommendationData ||
                                            measurement.additionalLabs ||
                                            {};

                                        const systolic =
                                            measurement.systolicBP ??
                                            measurement.BP?.systolic;
                                        const diastolic =
                                            measurement.diastolicBP ??
                                            measurement.BP?.diastolic;

                                        const formatValue = (value, suffix = "") =>
                                            value === null ||
                                            value === undefined ||
                                            value === ""
                                                ? "—"
                                                : `${value}${suffix}`;

                                        const clinicalFeatures = [
                                            {
                                                label: "Age",
                                                value: formatValue(
                                                    measurement.age ?? patient.age,
                                                    " years"
                                                ),
                                            },
                                            {
                                                label: "Gender",
                                                value:
                                                    measurement.gender ??
                                                    patient.gender ??
                                                    "—",
                                            },
                                            {
                                                label: "Systolic Blood Pressure",
                                                value: formatValue(systolic, " mmHg"),
                                            },
                                            {
                                                label: "Diastolic Blood Pressure",
                                                value: formatValue(diastolic, " mmHg"),
                                            },
                                            {
                                                label: "Serum Creatinine",
                                                value: formatValue(
                                                    measurement.serumCreatinine,
                                                    " mg/dL"
                                                ),
                                            },
                                            {
                                                label: "UACR",
                                                value: formatValue(
                                                    measurement.UACR ??
                                                        measurement.albumin_creatinine_ratio,
                                                    " mg/g"
                                                ),
                                            },
                                            {
                                                label: "Diabetes Diagnosed",
                                                value:
                                                    measurement.diabetes ??
                                                    measurement.diabetes_diagnosed ??
                                                    "—",
                                            },
                                        ];

                                        const additionalLabLabels = {
                                            potassium: "Potassium",
                                            phosphorus: "Phosphorus",
                                            hemoglobin: "Hemoglobin",
                                            bun: "Blood Urea Nitrogen (BUN)",
                                            bodyWeight: "Body Weight",
                                            serumAlbumin: "Serum Albumin",
                                            bicarbonate: "Bicarbonate",
                                            urineOutput: "Urine Output",
                                            dialysisStatus: "Dialysis Status",
                                            edema: "Edema",
                                            fatigueLevel: "Fatigue Level",
                                            physicalActivity: "Physical Activity",
                                            dietQuality: "Diet Quality",
                                            notes: "Additional Notes",
                                        };

                                        const hasAdditionalLabs =
                                            Object.entries(additionalLabs).some(
                                                ([key, value]) =>
                                                    value !== null &&
                                                    value !== undefined &&
                                                    value !== "" &&
                                                    key in additionalLabLabels
                                            );

                                        return (
                                            <Fragment key={visitId}>
                                                <tr className="history-main-row">
                                                    <td>
                                                        <strong>
                                                            Visit{" "}
                                                            {measurement.visitNumber ||
                                                                index + 1}
                                                        </strong>
                                                    </td>

                                                    <td>
                                                        {measurement.date
                                                            ? new Date(
                                                                  measurement.date
                                                              ).toLocaleDateString()
                                                            : "—"}
                                                    </td>

                                                    <td>
                                                        {editingMeasurementId ===
                                                        measurement._id ? (
                                                            <div className="history-egfr-edit">
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    min="0"
                                                                    value={editedEGFR}
                                                                    onChange={(e) =>
                                                                        setEditedEGFR(
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                />
                                                                <button
                                                                    type="button"
                                                                    className="primary-button"
                                                                    onClick={() =>
                                                                        saveEGFR(
                                                                            measurement._id
                                                                        )
                                                                    }
                                                                >
                                                                    Save
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="secondary-button"
                                                                    onClick={() => {
                                                                        setEditingMeasurementId(
                                                                            null
                                                                        );
                                                                        setEditedEGFR(
                                                                            ""
                                                                        );
                                                                    }}
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="history-egfr-value">
                                                                <strong>
                                                                    {measurement.finalEGFR ??
                                                                        measurement.calculatedEGFR ??
                                                                        "—"}
                                                                </strong>
                                                                {measurement.calculatedEGFR !=
                                                                    null && (
                                                                    <small>
                                                                        Calculated:{" "}
                                                                        {
                                                                            measurement.calculatedEGFR
                                                                        }
                                                                    </small>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>

                                                    <td>
                                                        {formatValue(
                                                            measurement.serumCreatinine
                                                        )}
                                                    </td>

                                                    <td>
                                                        {formatValue(
                                                            measurement.UACR ??
                                                                measurement.albumin_creatinine_ratio
                                                        )}
                                                    </td>

                                                    <td>
                                                        {systolic != null ||
                                                        diastolic != null
                                                            ? `${systolic ?? "—"}/${diastolic ?? "—"}`
                                                            : "—"}
                                                    </td>

                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="history-details-button"
                                                            aria-expanded={isExpanded}
                                                            onClick={() =>
                                                                setExpandedVisitId(
                                                                    isExpanded
                                                                        ? null
                                                                        : visitId
                                                                )
                                                            }
                                                        >
                                                            {isExpanded
                                                                ? "Hide details"
                                                                : "View details"}
                                                            <span
                                                                className={
                                                                    isExpanded
                                                                        ? "history-chevron is-open"
                                                                        : "history-chevron"
                                                                }
                                                            >
                                                                ▾
                                                            </span>
                                                        </button>
                                                    </td>

                                                    <td>
                                                        {editingMeasurementId !==
                                                            measurement._id && (
                                                            <button
                                                                type="button"
                                                                className="secondary-button history-edit-button"
                                                                onClick={() =>
                                                                    startEGFREdit(
                                                                        measurement
                                                                    )
                                                                }
                                                            >
                                                                Edit eGFR
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>

                                                {isExpanded && (
                                                    <tr className="history-details-row">
                                                        <td colSpan="8">
                                                            <div className="history-details-content">
                                                                <div className="history-details-header">
                                                                    <div>
                                                                        <h3>
                                                                            Visit{" "}
                                                                            {measurement.visitNumber ||
                                                                                index + 1}{" "}
                                                                            — Assessment Details
                                                                        </h3>
                                                                        <p>
                                                                            Clinical inputs,
                                                                            additional lab
                                                                            values, prediction,
                                                                            and model explanation
                                                                        </p>
                                                                    </div>
                                                                </div>

                                                                <section className="history-detail-section">
                                                                    <h4>
                                                                        Clinical Features
                                                                    </h4>
                                                                    <div className="history-feature-grid">
                                                                        {clinicalFeatures.map(
                                                                            (feature) => (
                                                                                <div
                                                                                    className="history-feature-card"
                                                                                    key={
                                                                                        feature.label
                                                                                    }
                                                                                >
                                                                                    <span>
                                                                                        {
                                                                                            feature.label
                                                                                        }
                                                                                    </span>
                                                                                    <strong>
                                                                                        {
                                                                                            feature.value
                                                                                        }
                                                                                    </strong>
                                                                                </div>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                </section>

                                                                <section className="history-detail-section">
                                                                    <h4>
                                                                        Additional Lab Values
                                                                    </h4>
                                                                    {hasAdditionalLabs ? (
                                                                        <div className="history-feature-grid">
                                                                            {Object.entries(
                                                                                additionalLabs
                                                                            )
                                                                                .filter(
                                                                                    ([key, value]) =>
                                                                                        key in
                                                                                            additionalLabLabels &&
                                                                                        value !==
                                                                                            null &&
                                                                                        value !==
                                                                                            undefined &&
                                                                                        value !==
                                                                                            ""
                                                                                )
                                                                                .map(
                                                                                    ([key, value]) => (
                                                                                        <div
                                                                                            className="history-feature-card"
                                                                                            key={key}
                                                                                        >
                                                                                            <span>
                                                                                                {
                                                                                                    additionalLabLabels[
                                                                                                        key
                                                                                                    ]
                                                                                                }
                                                                                            </span>
                                                                                            <strong>
                                                                                                {typeof value ===
                                                                                                "boolean"
                                                                                                    ? value
                                                                                                        ? "Present"
                                                                                                        : "Absent"
                                                                                                    : String(
                                                                                                          value
                                                                                                      )}
                                                                                            </strong>
                                                                                        </div>
                                                                                    )
                                                                                )}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="history-no-data">
                                                                            No additional lab
                                                                            values were saved
                                                                            for this visit.
                                                                        </p>
                                                                    )}
                                                                </section>

                                                                <section className="history-detail-section">
                                                                    <h4>
                                                                        CKD Prediction
                                                                    </h4>
                                                                    <div className="history-prediction-card">
                                                                        <div>
                                                                            <span>
                                                                                Model Result
                                                                            </span>
                                                                            <strong>
                                                                                {measurement.ckdPrediction ===
                                                                                1
                                                                                    ? "Potential CKD indicators detected"
                                                                                    : measurement.ckdPrediction ===
                                                                                      0
                                                                                    ? "No CKD indicators detected by the model"
                                                                                    : "Not available"}
                                                                            </strong>
                                                                        </div>
                                                                        <div>
                                                                            <span>
                                                                                Model Score
                                                                            </span>
                                                                            <strong>
                                                                                {measurement.ckdProbability !=
                                                                                null
                                                                                    ? `${measurement.ckdProbability}%`
                                                                                    : "—"}
                                                                            </strong>
                                                                        </div>
                                                                    </div>
                                                                </section>

                                                                <section className="history-detail-section">
                                                                    <h4>
                                                                        SHAP Explainability
                                                                    </h4>
                                                                    <p className="history-shap-intro">
                                                                        Shows how the model's
                                                                        input features
                                                                        influenced this
                                                                        prediction. SHAP
                                                                        contributions explain
                                                                        model behavior, not
                                                                        medical causation.
                                                                    </p>

                                                                    {shapFeatures.length > 0 ? (
                                                                        <div className="history-shap-table-wrap">
                                                                            <table className="history-shap-table">
                                                                                <thead>
                                                                                    <tr>
                                                                                        <th>
                                                                                            Feature
                                                                                        </th>
                                                                                        <th>
                                                                                            Patient
                                                                                            Value
                                                                                        </th>
                                                                                        <th>
                                                                                            SHAP
                                                                                            Contribution
                                                                                        </th>
                                                                                        <th>
                                                                                            Feature
                                                                                            Role
                                                                                        </th>
                                                                                        <th>
                                                                                            Effect on
                                                                                            CKD
                                                                                            Prediction
                                                                                        </th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {shapFeatures.map(
                                                                                        (
                                                                                            feature,
                                                                                            featureIndex
                                                                                        ) => {
                                                                                            const shapValue =
                                                                                                Number(
                                                                                                    feature.shap_value
                                                                                                );
                                                                                            const positive =
                                                                                                Number.isFinite(
                                                                                                    shapValue
                                                                                                ) &&
                                                                                                shapValue >=
                                                                                                    0;
                                                                                            const name =
                                                                                                String(
                                                                                                    feature.feature ??
                                                                                                        "Feature"
                                                                                                );
                                                                                            const normalized =
                                                                                                name
                                                                                                    .toLowerCase()
                                                                                                    .replace(
                                                                                                        /^.*__/,
                                                                                                        ""
                                                                                                    )
                                                                                                    .replace(
                                                                                                        /[^a-z0-9]/g,
                                                                                                        ""
                                                                                                    );
                                                                                            const roles =
                                                                                                {
                                                                                                    age: "Patient age; relevant to kidney function and CKD risk.",
                                                                                                    serumcreatinine:
                                                                                                        "A waste product filtered by the kidneys; its level helps assess kidney function.",
                                                                                                    uacr: "Measures albumin in urine and helps identify possible kidney damage.",
                                                                                                    albumincreatinineratio:
                                                                                                        "Measures albumin in urine and helps identify possible kidney damage.",
                                                                                                    bpsystolic:
                                                                                                        "Measures blood pressure when the heart contracts.",
                                                                                                    bpdiastolic:
                                                                                                        "Measures blood pressure when the heart rests between beats.",
                                                                                                    diabetesdiagnosed:
                                                                                                        "Indicates whether the patient has diagnosed diabetes, a CKD risk factor.",
                                                                                                    diabetes:
                                                                                                        "Indicates whether the patient has diagnosed diabetes, a CKD risk factor.",
                                                                                                    catgenderfemale:
                                                                                                        "Gender category encoded for the prediction model.",
                                                                                                    catgendermale:
                                                                                                        "Gender category encoded for the prediction model.",
                                                                                                };
                                                                                            return (
                                                                                                <tr
                                                                                                    key={`${name}-${featureIndex}`}
                                                                                                >
                                                                                                    <td>
                                                                                                        <strong>
                                                                                                            {name}
                                                                                                        </strong>
                                                                                                    </td>
                                                                                                    <td>
                                                                                                        {feature.value ??
                                                                                                            "—"}
                                                                                                    </td>
                                                                                                    <td>
                                                                                                        {Number.isFinite(
                                                                                                            shapValue
                                                                                                        )
                                                                                                            ? `${
                                                                                                                  shapValue >
                                                                                                                  0
                                                                                                                      ? "+"
                                                                                                                      : ""
                                                                                                              }${shapValue.toFixed(
                                                                                                                  4
                                                                                                              )}`
                                                                                                            : "—"}
                                                                                                    </td>
                                                                                                    <td>
                                                                                                        {roles[
                                                                                                            normalized
                                                                                                        ] ||
                                                                                                            "Input feature used by the prediction model."}
                                                                                                    </td>
                                                                                                    <td>
                                                                                                        {Number.isFinite(
                                                                                                            shapValue
                                                                                                        ) ? (
                                                                                                            <span
                                                                                                                className={
                                                                                                                    positive
                                                                                                                        ? "history-shap-positive"
                                                                                                                        : "history-shap-negative"
                                                                                                                }
                                                                                                            >
                                                                                                                {positive
                                                                                                                    ? "Pushes toward CKD"
                                                                                                                    : "Pushes away from CKD"}
                                                                                                            </span>
                                                                                                        ) : (
                                                                                                            "Unavailable"
                                                                                                        )}
                                                                                                    </td>
                                                                                                </tr>
                                                                                            );
                                                                                        }
                                                                                    )}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    ) : (
                                                                        <p className="history-no-data">
                                                                            SHAP explanation
                                                                            is not available
                                                                            for this visit.
                                                                        </p>
                                                                    )}
                                                                </section>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>


                {/* =================================================
                    MESSAGES
                ================================================= */}

                {successMessage && (

                    <div
                        className="success-message"
                        style={{
                            marginTop:
                                "16px"
                        }}
                    >
                        {successMessage}
                    </div>

                )}


                {error && (

                    <div
                        className="error-message"
                        style={{
                            marginTop:
                                "16px"
                        }}
                    >
                        {error}
                    </div>

                )}

            </main>

        </div>

    );

}


export default PatientDetails;