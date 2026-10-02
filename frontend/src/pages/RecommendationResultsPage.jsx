import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import "./RecommendationResults.css";

const pretty = (key = "") =>
  String(key).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function safeText(value, fallback = "Not provided") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : fallback;
  }
  return String(value);
}

function TextValue({ value }) {
  if (value === null || value === undefined || value === "") {
    return <span className="rec-muted">Not provided</span>;
  }

  if (Array.isArray(value)) {
    return (
      <ul className="rec-list">
        {value.map((item, index) => (
          <li key={index}>
            <TextValue value={item} />
          </li>
        ))}
      </ul>
    );
  }

  if (typeof value === "object") {
    const title =
      value.title || value.name || value.meal || value.activity;

    const description =
      value.description ||
      value.suggestion ||
      value.instructions ||
      value.activity_description;

    const benefit =
      value.benefit ||
      value.purpose ||
      value.renal_therapeutic_benefit;

    const duration =
      value.duration || value.frequency || value.schedule;

    if (title || description || benefit || duration) {
      return (
        <div className="rec-item-content">
          {title && <strong>{title}</strong>}

          {description && <p>{description}</p>}

          {duration && (
            <p>
              <b>Duration / Frequency:</b>{" "}
              {typeof duration === "object" ? (
                <TextValue value={duration} />
              ) : (
                duration
              )}
            </p>
          )}

          {benefit && (
            <p>
              <b>Notes:</b> {benefit}
            </p>
          )}

          {Object.entries(value)
            .filter(
              ([key]) =>
                ![
                  "title",
                  "name",
                  "meal",
                  "activity",
                  "description",
                  "suggestion",
                  "instructions",
                  "activity_description",
                  "benefit",
                  "purpose",
                  "renal_therapeutic_benefit",
                  "duration",
                  "frequency",
                  "schedule",
                ].includes(key)
            )
            .map(([key, val]) => (
              <p key={key}>
                <b>{pretty(key)}:</b> <TextValue value={val} />
              </p>
            ))}
        </div>
      );
    }

    return (
      <div className="rec-object">
        {Object.entries(value).map(([key, val]) => (
          <div className="rec-object-row" key={key}>
            <b>{pretty(key)}</b>
            <span>
              <TextValue value={val} />
            </span>
          </div>
        ))}
      </div>
    );
  }

  return <>{String(value)}</>;
}

function ItemList({
  items,
  empty = "No information was returned for this section.",
}) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="rec-muted">{empty}</p>;
  }

  return (
    <ul className="rec-list">
      {items.map((item, index) => (
        <li key={index}>
          <TextValue value={item} />
        </li>
      ))}
    </ul>
  );
}

function FoodGuidanceList({
  items,
  empty = "No information was returned for this section.",
}) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="rec-muted">{empty}</p>;
  }

  return (
    <ul className="rec-list">
      {items.map((item, index) => {
        if (typeof item !== "object" || item === null) {
          return (
            <li key={index}>
              <TextValue value={item} />
            </li>
          );
        }

        const food =
          item.food ??
          item.Food ??
          item.name ??
          item.title ??
          item.item;

        const explanation =
          item.notes ??
          item.Notes ??
          item.reason ??
          item.Reason ??
          item.description ??
          item.benefit;

        return (
          <li key={index}>
            <div className="rec-item-content">
              {food && <strong>{food}</strong>}
              {food && explanation ? ": " : ""}
              {explanation ? (
                <TextValue value={explanation} />
              ) : (
                !food && <TextValue value={item} />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function TargetCard({ title, value, unit, tone, note }) {
  const display =
    value === null || value === undefined || value === ""
      ? "Not specified"
      : `${typeof value === "object" ? "" : value}${unit ? ` ${unit}` : ""}`;

  return (
    <article className={`rec-target-card ${tone}`}>
      <h3>{title}</h3>

      <p className="rec-target-value">
        {typeof value === "object" && value !== null ? (
          <TextValue value={value} />
        ) : (
          display
        )}
      </p>

      {note && <p className="rec-target-note">{note}</p>}
    </article>
  );
}

function YogaList({ items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return (
      <p className="rec-muted">
        No yoga or breathing guidance was returned.
      </p>
    );
  }

  return (
    <div className="rec-accordion-list">
      {items.map((item, index) => {
        const name =
          item?.name ||
          item?.title ||
          item?.activity ||
          `Activity ${index + 1}`;

        const duration = item?.duration || item?.frequency || "";

        const instructions =
          item?.instructions || item?.description || "";

        const benefit =
          item?.benefit ||
          item?.purpose ||
          item?.renal_therapeutic_benefit ||
          "";

        return (
          <details className="rec-accordion" key={index}>
            <summary>
              <span>
                <strong>{name}</strong>
                {duration ? ` — ${duration}` : ""}
              </span>
            </summary>

            <div className="rec-accordion-body">
              {instructions && (
                <p>
                  <b>Instructions:</b> {instructions}
                </p>
              )}

              {benefit && (
                <p>
                  <b>Notes:</b> {benefit}
                </p>
              )}

              {Object.entries(item || {})
                .filter(
                  ([key]) =>
                    ![
                      "name",
                      "title",
                      "activity",
                      "duration",
                      "frequency",
                      "instructions",
                      "description",
                      "benefit",
                      "purpose",
                      "renal_therapeutic_benefit",
                    ].includes(key)
                )
                .map(([key, value]) => (
                  <p key={key}>
                    <b>{pretty(key)}:</b>{" "}
                    <TextValue value={value} />
                  </p>
                ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

function WeeklySchedule({ plan }) {
  if (!plan) {
    return (
      <p className="rec-muted">
        No weekly exercise schedule was returned.
      </p>
    );
  }

  const rows = Array.isArray(plan)
    ? plan.map((item, i) => ({
        day: item.day || item.weekday || `Day ${i + 1}`,
        activity:
          item.activity ||
          item.activities ||
          item.description ||
          item,
      }))
    : Object.entries(plan).map(([day, activity]) => ({
        day: pretty(day),
        activity,
      }));

  if (!rows.length) {
    return (
      <p className="rec-muted">
        No weekly exercise schedule was returned.
      </p>
    );
  }

  return (
    <div className="rec-table-wrap">
      <table className="rec-weekly-table">
        <thead>
          <tr>
            <th>Day</th>
            <th>Activity</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>{row.day}</td>
              <td>
                <TextValue value={row.activity} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, children, className = "" }) {
  return (
    <section className={`rec-section ${className}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export default function RecommendationResultsPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  

  const raw = state?.recommendations ?? state?.result ?? state;
  const data = raw?.recommendations ?? raw?.data ?? raw ?? {};

  const diet = data.diet_plan ?? data.nutrition ?? {};
  const targets = {
    protein: diet.daily_protein_target,
    sodium: diet.daily_sodium_target,
    fluid: diet.daily_fluid_target,
    };

  // The assessment page passes its clinical values separately in route state.
  const clinical =
    state?.clinicalInformation ??
    data.clinical_information ??
    data.clinical_data ??
    {};

  const foods =
    diet.general_food_guidance ??
    diet.recommended_foods ??
    diet.kidney_superfoods ??
    [];

  const avoid =
    diet.foods_to_review ??
    diet.foods_to_avoid ??
    diet.avoid_foods ??
    [];

  const meals =
    diet.sample_meal_framework ??
    diet.daily_meal_framework ??
    diet.meal_framework ??
    [];

  const yoga =
    data.yoga_program ??
    data.yoga_guidance ??
    data.yoga ??
    [];

  const exercise =
    data.exercise_plan ??
    data.exercise_guidance ??
    {};

  const weekly =
    exercise.weekly_plan ??
    exercise.weekly_schedule ??
    exercise.schedule ??
    data.weekly_exercise_schedule;

  const flags =
    diet.patient_specific_flags ??
    data.patient_specific_flags ??
    [];

  const considerations =
    diet.clinical_considerations ??
    data.clinical_considerations ??
    [];

  const patient = data.patient_summary ?? data.patient ?? {};
    const [downloadingReport, setDownloadingReport] = useState(false);
    const [downloadError, setDownloadError] = useState("");

    const handleDownloadReport = async () => {
    setDownloadingReport(true);
    setDownloadError("");

    const reportData = {
        patient_name:
        clinical.patient_name ??
        patient.patient_name ??
        patient.name ??
        "Patient",

        age: clinical.age ?? patient.age ?? "N/A",
        gender: clinical.gender ?? patient.gender ?? "N/A",

        record_id: state?.recordId ?? "REC-01",
        username: state?.username ?? "Clinician",

        prediction: {
          is_ckd:
              patient.is_ckd ??
              (clinical.prediction === 1),

          status: clinical.status,

          risk_percentage:
              patient.risk_percentage ??
              patient.probability ??
              clinical.modelScore ??
              0,

          kdigo_stage: {
              stage:
                  patient.stage ??
                  clinical.stage ??
                  "Not specified",
              label: patient.stage_label ?? "",
          },
      },

        input_parameters: {
        SerumCreatinine:
            clinical.serum_creatinine ??
            clinical.SerumCreatinine ??
            0.9,

        GFR:
            clinical.finalEGFR ??
            clinical.calculatedEGFR ??
            clinical.eGFR ??
            patient.eGFR ??
            0,

        BUNLevels:
            clinical.bun ?? clinical.BUN ?? null,

        ACR:
            clinical.albumin_creatinine_ratio ??
            clinical.ACR ??
            patient.ACR ??
            0,

        HemoglobinLevels:
            clinical.hemoglobin ?? null,

        SystolicBP:
            clinical.bp_systolic ?? null,

        DiastolicBP:
            clinical.bp_diastolic ?? null,
        },

        diet_plan: diet,
        prescribed_tablets: data.prescribed_tablets ?? [],
        yoga_program: yoga,
        exercise_plan: exercise,
    };

    try {
        const response = await fetch(
        "http://localhost:5001/generate-report",
        {
            method: "POST",
            headers: {
            "Content-Type": "application/json",
            },
            body: JSON.stringify(reportData),
        }
        );

        if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Unable to generate PDF.");
        }

        const pdfBlob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(pdfBlob);

        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = "NefroAI_Recommendation_Report.pdf";
        document.body.appendChild(link);
        link.click();
        link.remove();

        window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
        console.error("PDF download failed:", error);
        setDownloadError(
        error.message || "Unable to download the report."
        );
    } finally {
        setDownloadingReport(false);
    }
    };

  if (!raw) {
    return (
      <main className="rec-page">
        <div className="rec-container">
          <button
            className="rec-back"
            type="button"
            onClick={() => navigate(-1)}
          >
            ← Back
          </button>

          <section className="rec-section">
            <h2>Recommendations are not available</h2>
            <p>
              Return to the assessment and generate recommendations
              again.
            </p>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="rec-page">
      <div className="rec-container">
        <button
          className="rec-back"
          type="button"
          onClick={() => navigate(-1)}
        >
          ← Back to Assessment
        </button>

        <header className="rec-page-header">
          <span className="rec-eyebrow">PERSONALIZED CARE</span>
          <h1>Personalized Recommendations</h1>
          <p>
            Nutrition, gentle movement, and lifestyle guidance based
            on the information provided.
          </p>
        </header>

        <Section
          title="Personalized Renal Nutrition & Daily Food Guide"
          className="rec-nutrition"
        >
          <div className="rec-target-grid">
            <TargetCard
            title="Daily Protein Target"
            value={targets.protein}
            tone="rec-blue"
            note={diet.protein_rationale}
            />

            <TargetCard
            title="Daily Sodium Limit"
            value={targets.sodium}
            tone="rec-yellow"
            note="Limit salt, canned snacks, and sodium seasonings."
            />

            <TargetCard
            title="Daily Fluid Target"
            value={targets.fluid}
            tone="rec-green"
            note={diet.fluid_rationale}
            />
          </div>

          {diet.target_note && (
            <p className="rec-note">{diet.target_note}</p>
          )}

          <div className="rec-food-grid">
            <div className="rec-food-column">
              <h3>Recommended Kidney Superfoods</h3>
              <FoodGuidanceList
                items={foods}
                empty="No food guidance was returned."
              />
            </div>

            <div className="rec-food-column">
              <h3>Foods to Review or Limit</h3>
              <FoodGuidanceList
                items={avoid}
                empty="No foods to review or limit were returned."
              />
            </div>
          </div>

          {Array.isArray(meals) && meals.length > 0 && (
            <div className="rec-meal-framework">
              <h3>Daily Meal Framework</h3>
              <ItemList items={meals} />
            </div>
          )}
        </Section>

        {(flags.length > 0 || considerations.length > 0) && (
          <div className="rec-two-column">
            {flags.length > 0 && (
              <Section title="Patient-Specific Considerations">
                <ItemList items={flags} />
              </Section>
            )}

            {considerations.length > 0 && (
              <Section title="Clinical Review Points">
                <ItemList items={considerations} />
              </Section>
            )}
          </div>
        )}

        <Section
          title="Kidney-Beneficial Therapeutic Yoga Program"
          className="rec-yoga"
        >
          <p className="rec-section-description">
            Gentle yoga and breathing activities. Choose only
            activities that are appropriate for the patient's
            condition and abilities.
          </p>

          <YogaList items={yoga} />
        </Section>

        <Section
          title="Tailored Weekly Exercise Schedule"
          className="rec-exercise"
        >
          <div className="rec-exercise-grid">
            <div className="rec-exercise-guidance">
              {exercise.target_intensity && (
                <p>
                  <b>Target Intensity:</b>{" "}
                  {exercise.target_intensity}
                </p>
              )}

              {exercise.recommended_frequency && (
                <p>
                  <b>Recommended Frequency:</b>{" "}
                  {exercise.recommended_frequency}
                </p>
              )}

              {exercise.aerobic_modality && (
                <p>
                  <b>Aerobic Modality:</b>{" "}
                  {exercise.aerobic_modality}
                </p>
              )}

              {exercise.resistance_guidance && (
                <p>
                  <b>Resistance Guidance:</b>{" "}
                  {exercise.resistance_guidance}
                </p>
              )}

              {exercise.safety && (
                <p>
                  <b>Safety:</b> {exercise.safety}
                </p>
              )}

              {Array.isArray(exercise.safety_guidelines) &&
                exercise.safety_guidelines.length > 0 && (
                  <>
                    <b>Safety:</b>
                    <ItemList
                      items={exercise.safety_guidelines}
                    />
                  </>
                )}

              {!exercise.target_intensity &&
                !exercise.recommended_frequency &&
                !exercise.aerobic_modality &&
                !exercise.resistance_guidance &&
                !exercise.safety &&
                !exercise.safety_guidelines?.length && (
                  <p className="rec-muted">
                    No additional exercise guidance was returned.
                  </p>
                )}
            </div>

            <div className="rec-weekly">
              <h3>Weekly Plan</h3>
              <WeeklySchedule plan={weekly} />
            </div>
          </div>
        </Section>

        <Section
          title="Clinical Information Used"
          className="rec-clinical"
        >
          <div className="rec-clinical-grid">
            <div>
              <span>CKD Prediction</span>
              <strong>
                {safeText(
                  patient.is_ckd === true
                    ? "CKD predicted"
                    : patient.is_ckd === false
                    ? "CKD not predicted"
                    : patient.prediction
                )}
              </strong>
            </div>

            <div>
              <span>Model Score</span>
              <strong>
                {safeText(
                  patient.risk_percentage ??patient.probability ??clinical.modelScore,
                  patient.risk_percentage != null ||
                    patient.probability != null
                    ? ""
                    : "Not provided"
                )}
                {patient.risk_percentage != null ||
                patient.probability != null|| clinical.modelScore != null
                  ? "%"
                  : ""}
              </strong>
            </div>

            <div>
              <span>eGFR</span>
              <strong>
                {safeText(
                  clinical.finalEGFR ??
                  clinical.calculatedEGFR ??
                  clinical.eGFR ??
                  patient.eGFR
                )}
              </strong>
            </div>

            <div>
              <span>CKD Stage</span>
              <strong>
                {safeText(
                  patient.stage ??
                  clinical.stage ??
                  patient.kdigo_stage?.stage
                )}
              </strong>
            </div>

            <div>
              <span>Urine ACR</span>
              <strong>
                {safeText(
                  clinical.albumin_creatinine_ratio ??
                  clinical.ACR ??
                  patient.ACR
                )}
              </strong>
            </div>

            <div>
              <span>Potassium</span>
              <strong>
                {safeText(
                  clinical.potassium ??
                  clinical.SerumElectrolytesPotassium
                )}
              </strong>
            </div>

            <div>
              <span>Phosphorus</span>
              <strong>
                {safeText(
                  clinical.phosphorus ??
                  clinical.SerumElectrolytesPhosphorus
                )}
              </strong>
            </div>

            <div>
              <span>Hemoglobin</span>
              <strong>
                {safeText(
                  clinical.hemoglobin ??
                  clinical.HemoglobinLevels
                )}
              </strong>
            </div>

            <div>
              <span>BUN</span>
              <strong>
                {safeText(
                  clinical.bun ??
                  clinical.BUN ??
                  clinical.BUNLevels
                )}
              </strong>
            </div>

            <div>
              <span>Edema</span>
              <strong>
                {safeText(
                  clinical.edema ??
                  clinical.Edema
                )}
              </strong>
            </div>

            <div>
              <span>Physical Activity</span>
              <strong>
                {safeText(
                  clinical.physicalActivity ??
                  clinical.physical_activity ??
                  clinical.PhysicalActivity
                )}
              </strong>
            </div>

            <div>
              <span>Diet Quality</span>
              <strong>
                {safeText(
                  clinical.dietQuality ??
                  clinical.diet_quality ??
                  clinical.DietQuality
                )}
              </strong>
            </div>
          </div>
        </Section>
        <div className="rec-report-actions">
        <button
            type="button"
            className="rec-download-button"
            onClick={handleDownloadReport}
            disabled={downloadingReport}
        >
            {downloadingReport
            ? "Generating PDF..."
            : "⬇ Download Recommendation Report"}
        </button>

        {downloadError && (
            <p className="rec-download-error">{downloadError}</p>
        )}
        </div>

        <p className="rec-disclaimer">
          This page provides general decision-support information
          only. It is not a diagnosis or prescription. A qualified
          healthcare professional or renal dietitian should review
          recommendations before use.
        </p>
      </div>
    </main>
  );
}