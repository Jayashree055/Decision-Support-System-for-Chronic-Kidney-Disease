import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from risk_score import (  # noqa: E402
    albuminuria_category,
    early_warning_score,
    gfr_category,
    kdigo_assessment,
    kfre,
)


def patient(**overrides):
    values = dict(age=60, gender="Male", egfr=95, acr=10, bp_systolic=115,
                  bp_diastolic=75, diabetes_diagnosed=0)
    values.update(overrides)
    return values


class KdigoCategoryTests(unittest.TestCase):

    def test_gfr_boundaries(self):
        cases = [(90, "G1"), (89.9, "G2"), (60, "G2"), (59.9, "G3a"),
                 (45, "G3a"), (44.9, "G3b"), (30, "G3b"), (29.9, "G4"),
                 (15, "G4"), (14.9, "G5"), (3, "G5")]
        for egfr, expected in cases:
            self.assertEqual(gfr_category(egfr)["code"], expected, egfr)

    def test_albuminuria_boundaries(self):
        cases = [(29.9, "A1"), (30, "A2"), (300, "A2"), (300.1, "A3")]
        for acr, expected in cases:
            self.assertEqual(albuminuria_category(acr)["code"], expected, acr)

    def test_heat_map_cells(self):
        self.assertEqual(kdigo_assessment(95, 10)["level"], "low")
        self.assertEqual(kdigo_assessment(70, 100)["level"], "moderate")
        self.assertEqual(kdigo_assessment(50, 10)["level"], "moderate")
        self.assertEqual(kdigo_assessment(50, 100)["level"], "high")
        self.assertEqual(kdigo_assessment(35, 400)["level"], "very_high")
        self.assertEqual(kdigo_assessment(20, 5)["level"], "very_high")


class KfreTests(unittest.TestCase):

    def test_not_applicable_when_egfr_60_or_above(self):
        self.assertFalse(kfre(60, "Male", 60, 100)["applicable"])

    def test_matches_hand_calculation(self):
        # 70-year-old man, eGFR 30, ACR 300 mg/g, North American calibration.
        lp = (-0.2201 * (7.0 - 7.036) + 0.2467 * (1 - 0.5642)
              - 0.5567 * (6.0 - 7.222) + 0.4510 * (math.log(300) - 5.137))
        expected_2y = (1 - 0.9750 ** math.exp(lp)) * 100
        expected_5y = (1 - 0.9240 ** math.exp(lp)) * 100

        result = kfre(70, "Male", 30, 300, region="north_american")

        self.assertAlmostEqual(result["risk_2_year"], expected_2y, places=1)
        self.assertAlmostEqual(result["risk_5_year"], expected_5y, places=1)
        self.assertAlmostEqual(result["risk_2_year"], 7.0, delta=0.1)

    def test_contributions_sum_to_linear_predictor(self):
        result = kfre(52, "Female", 25, 800)
        total = sum(c["contribution"] for c in result["contributions"])
        self.assertAlmostEqual(total, result["linear_predictor"], places=3)

    def test_contributions_sorted_by_impact(self):
        impacts = [abs(c["contribution"]) for c in kfre(52, "Female", 25, 800)["contributions"]]
        self.assertEqual(impacts, sorted(impacts, reverse=True))

    def test_risk_rises_as_egfr_falls(self):
        risks = [kfre(65, "Male", egfr, 200)["risk_5_year"] for egfr in (55, 40, 25, 12)]
        self.assertEqual(risks, sorted(risks))

    def test_non_north_american_calibration_is_lower(self):
        na = kfre(65, "Male", 30, 300, region="north_american")
        other = kfre(65, "Male", 30, 300, region="non_north_american")
        self.assertLess(other["risk_5_year"], na["risk_5_year"])


class EarlyWarningScoreTests(unittest.TestCase):

    def test_healthy_patient_is_low_without_kfre(self):
        result = early_warning_score(**patient())
        self.assertEqual(result["level"], "low")
        self.assertFalse(result["kfre"]["applicable"])
        self.assertEqual(result["flags"], [])

    def test_kfre_referral_threshold(self):
        # Young man, G3b A2: KFRE 5-year risk is above 5%.
        result = early_warning_score(**patient(age=35, egfr=35, acr=250))
        self.assertGreaterEqual(result["kfre"]["risk_5_year"], 5)
        self.assertTrue(any("KFRE 5-year" in a for a in result["actions"]))
        self.assertTrue(any(d.startswith("KFRE:") for d in result["drivers"]))

    def test_below_referral_threshold_has_no_referral(self):
        result = early_warning_score(**patient(age=80, gender="Female", egfr=55, acr=10))
        self.assertLess(result["kfre"]["risk_5_year"], 5)
        self.assertFalse(any("nephrology" in a for a in result["actions"]))

    def test_advanced_ckd_gets_referral_and_krt_planning(self):
        result = early_warning_score(**patient(age=45, egfr=12, acr=2000))
        self.assertEqual(result["level"], "very_high")
        self.assertTrue(any("kidney replacement" in a for a in result["actions"]))
        self.assertEqual(sum("nephrology" in a for a in result["actions"]), 1)

    def test_blood_pressure_flags(self):
        severities = {
            (185, 100): "urgent",
            (150, 85): "warning",
            (125, 70): "info",
        }
        for (sys_bp, dia_bp), expected in severities.items():
            flags = early_warning_score(**patient(bp_systolic=sys_bp, bp_diastolic=dia_bp))["flags"]
            self.assertEqual(flags[0]["severity"], expected)

    def test_diabetes_flag(self):
        flags = early_warning_score(**patient(diabetes_diagnosed=1))["flags"]
        self.assertTrue(any("Diabetes" in f["message"] for f in flags))


class ApiTests(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        import app
        cls.client = app.app.test_client()

    def body(self, **overrides):
        values = dict(age=58, gender="Female", bp_systolic=142, bp_diastolic=88,
                      serum_creatinine=1.6, albumin_creatinine_ratio=180,
                      diabetes_diagnosed=1)
        values.update(overrides)
        return values

    def test_risk_score_endpoint(self):
        response = self.client.post("/risk-score", json=self.body())
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertAlmostEqual(data["egfr"], 37.4, delta=0.5)
        self.assertEqual(data["kdigo"]["gfr_category"]["code"], "G3b")
        self.assertTrue(data["kfre"]["applicable"])

    def test_missing_and_invalid_fields_return_400(self):
        response = self.client.post("/risk-score", json={"age": 10, "gender": "x"})
        self.assertEqual(response.status_code, 400)
        fields = response.get_json()["fields"]
        self.assertIn("age", fields)
        self.assertIn("gender", fields)
        self.assertIn("serum_creatinine", fields)

    def test_non_json_body_returns_400(self):
        response = self.client.post("/risk-score", data="nope")
        self.assertEqual(response.status_code, 400)

    def test_unknown_region_returns_400(self):
        response = self.client.post("/risk-score", json=self.body(region="mars"))
        self.assertEqual(response.status_code, 400)

    def test_lowercase_gender_is_accepted(self):
        response = self.client.post("/risk-score", json=self.body(gender="male"))
        self.assertEqual(response.status_code, 200)

    def test_health(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertIn("screening_model_loaded", response.get_json())


if __name__ == "__main__":
    unittest.main()
