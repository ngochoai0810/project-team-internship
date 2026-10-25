import csv
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class EvaluateModelsCliTest(unittest.TestCase):
    def test_cli_writes_reproducible_json_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            input_path = tmp_path / "predictions.csv"
            output_path = tmp_path / "report.json"
            with input_path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.writer(handle)
                writer.writerow(
                    [
                        "sample_id",
                        "subject_id",
                        "fold_id",
                        "y_true",
                        "cnn_pred",
                        "ear_mar_pred",
                    ]
                )
                writer.writerows(
                    [
                        ["1", "S1", "1", "open", "open", "closed"],
                        ["2", "S1", "1", "closed", "closed", "open"],
                        ["3", "S2", "2", "open", "closed", "closed"],
                        ["4", "S2", "2", "closed", "open", "open"],
                    ]
                )

            result = subprocess.run(
                [
                    sys.executable,
                    str(ROOT / "evaluate_models.py"),
                    str(input_path),
                    "--output",
                    str(output_path),
                    "--bootstrap-resamples",
                    "100",
                    "--seed",
                    "7",
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )

            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("CNN macro-F1: 50.00%", result.stdout)
            self.assertIn("EAR/MAR macro-F1: 0.00%", result.stdout)
            self.assertIn("Difference: +50.00 percentage points", result.stdout)
            self.assertIn("Exact McNemar p-value: 0.5", result.stdout)
            report = json.loads(output_path.read_text(encoding="utf-8"))

        self.assertEqual(report["sample_count"], 4)
        self.assertEqual(report["bootstrap"]["resamples"], 100)
        self.assertEqual(report["bootstrap"]["seed"], 7)
        self.assertAlmostEqual(report["macro_f1_difference"], 0.5)

    def test_cli_returns_usage_error_for_invalid_csv(self):
        with tempfile.TemporaryDirectory() as tmp:
            input_path = Path(tmp) / "invalid.csv"
            input_path.write_text(
                "sample_id,subject_id,y_true\n1,S1,open\n", encoding="utf-8"
            )

            result = subprocess.run(
                [sys.executable, str(ROOT / "evaluate_models.py"), str(input_path)],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )

        self.assertEqual(result.returncode, 2)
        self.assertIn("missing required columns", result.stderr)


if __name__ == "__main__":
    unittest.main()
