import "./RiskScorePanel.css";

// Bars are scaled to the largest contribution in the list so the strongest
// factor always spans the full half-width.
function ContributionBars({ items, valueKey }) {
    const max = Math.max(...items.map((item) => Math.abs(item[valueKey])), 1e-9);

    return (
        <ul className="contributions">
            {items.map((item) => {
                const value = item[valueKey];
                const width = `${(Math.abs(value) / max) * 50}%`;

                return (
                    <li key={item.feature}>
                        <span className="contribution-label">
                            {item.label}
                            <small>{String(item.value)}</small>
                        </span>
                        <span className="contribution-track">
                            <span
                                className={`contribution-bar ${value > 0 ? "up" : "down"}`}
                                style={{ width }}
                            />
                        </span>
                        <span className="contribution-value">
                            {item.hazard_ratio !== undefined
                                ? `×${item.hazard_ratio.toFixed(2)}`
                                : `${value > 0 ? "+" : ""}${value.toFixed(2)}`}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

export function ScreeningExplanation({ explanation }) {
    if (!explanation) {
        return (
            <small>
                Feature explanations are unavailable (install <code>shap</code> in
                the ML service).
            </small>
        );
    }

    return (
        <div className="panel-section">
            <h3>Why the model gave this result</h3>
            <p className="hint">
                SHAP values in log-odds. Red pushed the score towards CKD, green
                pushed it away.
            </p>
            <ContributionBars
                items={explanation.contributions}
                valueKey="shap_value"
            />
        </div>
    );
}

function RiskScorePanel({ risk }) {
    const { kdigo, kfre } = risk;

    return (
        <div className="risk-panel">
            <h2>Early Warning Risk Score</h2>

            <div className={`risk-level level-${risk.level}`}>
                {risk.level_label} risk
            </div>

            <p>
                <strong>{kdigo.gfr_category.code}</strong> ({kdigo.gfr_category.description})
                {" · "}
                <strong>{kdigo.albuminuria_category.code}</strong> ({kdigo.albuminuria_category.description})
                {" · "}
                eGFR {risk.egfr} mL/min/1.73 m²
            </p>

            <div className="panel-section">
                <h3>Kidney failure risk (KFRE)</h3>
                {kfre.applicable ? (
                    <>
                        <div className="kfre-numbers">
                            <div>
                                <strong>{kfre.risk_2_year}%</strong>
                                <small>within 2 years</small>
                            </div>
                            <div>
                                <strong>{kfre.risk_5_year}%</strong>
                                <small>within 5 years</small>
                            </div>
                        </div>

                        <h3>What drives this risk</h3>
                        <p className="hint">
                            Risk multiplier compared with an average patient in the
                            KFRE study cohort.
                        </p>
                        <ContributionBars
                            items={kfre.contributions}
                            valueKey="contribution"
                        />
                        <ul className="plain-list">
                            {kfre.contributions.map((c) => (
                                <li key={c.feature}>{c.explanation}</li>
                            ))}
                        </ul>
                    </>
                ) : (
                    <p className="hint">{kfre.reason}</p>
                )}
            </div>

            <div className="panel-section">
                <h3>Why this level</h3>
                <ul className="plain-list">
                    {kdigo.reasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                    ))}
                    {risk.drivers.map((driver) => (
                        <li key={driver}>{driver}</li>
                    ))}
                </ul>
            </div>

            {risk.flags.length > 0 && (
                <div className="panel-section">
                    <h3>Warnings</h3>
                    <ul className="plain-list">
                        {risk.flags.map((flag) => (
                            <li key={flag.message} className={`flag flag-${flag.severity}`}>
                                {flag.message}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {risk.actions.length > 0 && (
                <div className="panel-section">
                    <h3>Suggested actions</h3>
                    <ul className="plain-list">
                        {risk.actions.map((action) => (
                            <li key={action}>{action}</li>
                        ))}
                    </ul>
                </div>
            )}

            <small>{risk.disclaimer}</small>
        </div>
    );
}

export default RiskScorePanel;
