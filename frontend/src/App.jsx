import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientDetails from "./pages/PatientDetails";
import CKDAssessment from "./pages/CKDAssessment";
import RecommendationResultsPage from "./pages/RecommendationResultsPage";
import RecommendationForm from "./pages/RecommendationForm";
import "./App.css";

function App() {

    return (

        <BrowserRouter>

            <Routes>

                <Route
                    path="/"
                    element={<Dashboard />}
                />

                <Route
                    path="/patients"
                    element={<Patients />}
                />

                <Route
                    path="/patients/:id"
                    element={<PatientDetails />}
                />

                <Route
                    path="/patients/:id/assessment"
                    element={<CKDAssessment />}
                />
                <Route
                path="/patients/:patientId/recommendations/:measurementId/results"
                element={<RecommendationResultsPage />}
                />
                <Route
                path="/patients/:patientId/recommendations/:measurementId"
                element={<RecommendationForm />}
                />

                 


            </Routes>

        </BrowserRouter>

    );
}

export default App;