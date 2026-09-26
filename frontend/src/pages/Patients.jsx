import { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

function Patients() {

    const [patients, setPatients] = useState([]);

    const [form, setForm] = useState({
        patientCode: "",
        name: "",
        age: "",
        gender: ""
    });

    const [loading, setLoading] = useState(false);


    const loadPatients = async () => {

        try {

            const response =
                await axios.get(
                    "http://localhost:5000/api/patients"
                );

            setPatients(response.data);

        } catch (error) {

            console.error(error);

        }

    };


    useEffect(() => {

        loadPatients();

    }, []);


    const handleChange = (e) => {

        setForm({
            ...form,
            [e.target.name]: e.target.value
        });

    };


    const createPatient = async (e) => {

        e.preventDefault();

        setLoading(true);

        try {

            await axios.post(
                "http://localhost:5000/api/patients",
                {
                    patientCode: form.patientCode,
                    name: form.name,
                    age: Number(form.age),
                    gender: form.gender
                }
            );

            setForm({
                patientCode: "",
                name: "",
                age: "",
                gender: ""
            });

            loadPatients();

        } catch (error) {

            console.error(error);

            alert(
                error.response?.data?.error ||
                "Unable to create patient"
            );

        } finally {

            setLoading(false);

        }

    };


    return (

        <div className="app-layout">

            <aside className="sidebar">

                <h2>KidneyCare</h2>

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


            <main className="main-content">

                <div className="page-header">

                    <div>

                        <p className="eyebrow">
                            PATIENT MANAGEMENT
                        </p>

                        <h1>
                            Patients
                        </h1>

                        <p>
                            Select a patient to view their
                            assessments and history.
                        </p>

                    </div>

                </div>


                <div className="content-grid">


                    {/* CREATE PATIENT */}

                    <section className="panel">

                        <h2>
                            Add Patient
                        </h2>

                        <form
                            onSubmit={createPatient}
                            className="form-grid"
                        >

                            <div className="form-field">

                                <label>
                                    Patient ID
                                </label>

                                <input
                                    name="patientCode"
                                    value={
                                        form.patientCode
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    placeholder="PT-001"
                                    required
                                />

                            </div>


                            <div className="form-field">

                                <label>
                                    Patient Name
                                </label>

                                <input
                                    name="name"
                                    value={
                                        form.name
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    placeholder="Patient name"
                                    required
                                />

                            </div>


                            <div className="form-field">

                                <label>
                                    Age
                                </label>

                                <input
                                    type="number"
                                    name="age"
                                    value={
                                        form.age
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    required
                                />

                            </div>


                            <div className="form-field">

                                <label>
                                    Gender
                                </label>

                                <select
                                    name="gender"
                                    value={
                                        form.gender
                                    }
                                    onChange={
                                        handleChange
                                    }
                                    required
                                >

                                    <option value="">
                                        Select
                                    </option>

                                    <option value="Male">
                                        Male
                                    </option>

                                    <option value="Female">
                                        Female
                                    </option>

                                </select>

                            </div>


                            <button
                                className="primary-button"
                                disabled={loading}
                            >
                                {loading
                                    ? "Creating..."
                                    : "Create Patient"}
                            </button>

                        </form>

                    </section>


                    {/* PATIENT LIST */}

                    <section className="panel">

                        <div className="panel-header">

                            <h2>
                                Patient Records
                            </h2>

                            <span>
                                {patients.length} patients
                            </span>

                        </div>


                        <div className="patient-list">

                            {patients.map(
                                (patient) => (

                                    <Link
                                        key={patient._id}
                                        to={`/patients/${patient._id}`}
                                        className="patient-card"
                                    >

                                        <div className="patient-avatar">
                                            {patient.name
                                                .charAt(0)
                                                .toUpperCase()}
                                        </div>

                                        <div>

                                            <strong>
                                                {patient.name}
                                            </strong>

                                            <p>
                                                {
                                                    patient.patientCode
                                                }
                                                {" • "}
                                                {patient.age} years
                                                {" • "}
                                                {patient.gender}
                                            </p>

                                        </div>

                                    </Link>

                                )
                            )}

                        </div>

                    </section>

                </div>

            </main>

        </div>

    );
}

export default Patients;