import csv
import math
import tempfile
import unittest
from pathlib import Path

from model_evaluation import (
    EvaluationInputError,
    PredictionRecord,
    evaluate_predictions,
    load_predictions,
)


def _record(
    sample_id: str,
    subject_id: str,
    y_true: str,
    cnn_pred: str,
    ear_mar_pred: str,
    fold_id: str | None = None,
) -> PredictionRecord:
    return PredictionRecord(
        sample_id=sample_id,
        subject_id=subject_id,
        y_true=y_true,
        cnn_pred=cnn_pred,
        ear_mar_pred=ear_mar_pred,
        fold_id=fold_id,
    )


class ModelEvaluationTest(unittest.TestCase):
    def test_reports_paired_metrics_and_exact_mcnemar_test(self):
        records = [
            _record("1", "S1", "open", "open", "closed"),
            _record("2", "S1", "closed", "closed", "open"),
            _record("3", "S2", "open", "closed", "closed"),
            _record("4", "S2", "closed", "open", "open"),
        ]

        report = evaluate_predictions(records, bootstrap_resamples=100, seed=7)

        self.assertEqual(report["sample_count"], 4)
        self.assertEqual(report["subject_count"], 2)
        self.assertEqual(report["labels"], ["closed", "open"])
        self.assertAlmostEqual(report["cnn_macro_f1"], 0.5)
        self.assertAlmostEqual(report["ear_mar_macro_f1"], 0.0)
        self.assertAlmostEqual(report["macro_f1_difference"], 0.5)
        self.assertEqual(report["mcnemar"]["cnn_correct_baseline_wrong"], 2)
        self.assertEqual(report["mcnemar"]["cnn_wrong_baseline_correct"], 0)
        self.assertEqual(report["mcnemar"]["discordant_pairs"], 2)
        self.assertAlmostEqual(report["mcnemar"]["p_value"], 0.5)

    def test_subject_bootstrap_is_reproducible_and_resamples_whole_subjects(self):
        records = [
            _record("1", "S1", "open", "open", "closed"),
            _record("2", "S1", "closed", "closed", "open"),
            _record("3", "S2", "open", "closed", "closed"),
            _record("4", "S2", "closed", "open", "open"),
        ]

        first = evaluate_predictions(records, bootstrap_resamples=10_000, seed=2026)
        second = evaluate_predictions(records, bootstrap_resamples=10_000, seed=2026)

        self.assertEqual(first["bootstrap"], second["bootstrap"])
        self.assertEqual(first["bootstrap"]["unit"], "subject_id")
        self.assertAlmostEqual(first["bootstrap"]["ci_low"], 0.0)
        self.assertAlmostEqual(first["bootstrap"]["ci_high"], 1.0)

    def test_reports_fold_mean_and_sample_standard_deviation(self):
        records = [
            _record("1", "S1", "open", "open", "closed", "1"),
            _record("2", "S1", "closed", "closed", "open", "1"),
            _record("3", "S2", "open", "closed", "closed", "2"),
            _record("4", "S2", "closed", "open", "open", "2"),
        ]

        report = evaluate_predictions(records, bootstrap_resamples=100, seed=7)

        self.assertEqual([fold["fold_id"] for fold in report["folds"]], ["1", "2"])
        self.assertAlmostEqual(report["fold_summary"]["cnn_macro_f1_mean"], 0.5)
        self.assertAlmostEqual(
            report["fold_summary"]["cnn_macro_f1_sample_std"], math.sqrt(0.5)
        )
        self.assertAlmostEqual(report["fold_summary"]["ear_mar_macro_f1_mean"], 0.0)

    def test_load_predictions_validates_schema_and_duplicate_sample_ids(self):
        with tempfile.TemporaryDirectory() as tmp:
            missing_path = Path(tmp) / "missing.csv"
            missing_path.write_text("sample_id,subject_id,y_true\n1,S1,open\n", encoding="utf-8")

            with self.assertRaisesRegex(EvaluationInputError, "missing required columns"):
                load_predictions(missing_path)

            duplicate_path = Path(tmp) / "duplicate.csv"
            with duplicate_path.open("w", newline="", encoding="utf-8") as handle:
                writer = csv.writer(handle)
                writer.writerow(
                    ["sample_id", "subject_id", "y_true", "cnn_pred", "ear_mar_pred"]
                )
                writer.writerow(["1", "S1", "open", "open", "open"])
                writer.writerow(["1", "S2", "closed", "closed", "closed"])

            with self.assertRaisesRegex(EvaluationInputError, "duplicate sample_id"):
                load_predictions(duplicate_path)

    def test_rejects_blank_values_single_subject_and_invalid_resample_count(self):
        blank = [_record("1", "S1", "open", "", "open"), _record("2", "S2", "open", "open", "open")]
        with self.assertRaisesRegex(EvaluationInputError, "cnn_pred"):
            evaluate_predictions(blank, bootstrap_resamples=10, seed=1)

        one_subject = [
            _record("1", "S1", "open", "open", "open"),
            _record("2", "S1", "closed", "closed", "closed"),
        ]
        with self.assertRaisesRegex(EvaluationInputError, "at least two subjects"):
            evaluate_predictions(one_subject, bootstrap_resamples=10, seed=1)

        valid = [
            _record("1", "S1", "open", "open", "open"),
            _record("2", "S2", "closed", "closed", "closed"),
        ]
        with self.assertRaisesRegex(EvaluationInputError, "bootstrap_resamples"):
            evaluate_predictions(valid, bootstrap_resamples=0, seed=1)

    def test_rejects_subject_assigned_to_multiple_test_folds(self):
        records = [
            _record("1", "S1", "open", "open", "open", "1"),
            _record("2", "S1", "closed", "closed", "closed", "2"),
            _record("3", "S2", "open", "open", "open", "2"),
        ]

        with self.assertRaisesRegex(EvaluationInputError, "multiple folds"):
            evaluate_predictions(records, bootstrap_resamples=10, seed=1)


if __name__ == "__main__":
    unittest.main()
