import { BrowserRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Patients from "./pages/Patients";
import PatientDetails from "./pages/PatientDetails";
import CKDAssessment from "./pages/CKDAssessment";

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

            </Routes>

        </BrowserRouter>

    );
}

export default App;