import { Link } from "react-router-dom";

function Dashboard() {

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
                            CLINICIAN PORTAL
                        </p>

                        <h1>
                            Clinical Dashboard
                        </h1>

                        <p>
                            Monitor CKD assessments and
                            patient progression.
                        </p>

                    </div>

                    <Link
                        to="/patients"
                        className="primary-button"
                    >
                        View Patients
                    </Link>

                </div>


                <div className="dashboard-grid">

                    <div className="dashboard-card">

                        <span className="card-label">
                            Patient Management
                        </span>

                        <h3>
                            Patient Records
                        </h3>

                        <p>
                            Create and manage individual
                            patient profiles.
                        </p>

                        <Link to="/patients">
                            Manage Patients →
                        </Link>

                    </div>


                    <div className="dashboard-card">

                        <span className="card-label">
                            CKD Assessment
                        </span>

                        <h3>
                            Clinical Screening
                        </h3>

                        <p>
                            Assess CKD indicators using
                            clinical measurements.
                        </p>

                    </div>


                    <div className="dashboard-card">

                        <span className="card-label">
                            Progression
                        </span>

                        <h3>
                            Progression Outlook
                        </h3>

                        <p>
                            Analyze longitudinal eGFR
                            history and persistent decline.
                        </p>

                    </div>

                </div>

            </main>

        </div>

    );
}

export default Dashboard;