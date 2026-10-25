"""Paired statistical evaluation for CNN and EAR/MAR predictions."""

from __future__ import annotations

import csv
import statistics
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence

import numpy as np
from scipy.stats import binomtest


REQUIRED_COLUMNS = {
    "sample_id",
    "subject_id",
    "y_true",
    "cnn_pred",
    "ear_mar_pred",
}


class EvaluationInputError(ValueError):
    """Raised when paired prediction data cannot support the evaluation."""


@dataclass(frozen=True)
class PredictionRecord:
    sample_id: str
    subject_id: str
    y_true: str
    cnn_pred: str
    ear_mar_pred: str
    fold_id: str | None = None


def load_predictions(path: str | Path) -> list[PredictionRecord]:
    """Load and validate paired out-of-fold predictions from a CSV file."""

    csv_path = Path(path)
    try:
        handle = csv_path.open("r", newline="", encoding="utf-8-sig")
    except OSError as exc:
        raise EvaluationInputError(f"cannot read prediction CSV: {csv_path}") from exc

    with handle:
        reader = csv.DictReader(handle)
        fieldnames = set(reader.fieldnames or [])
        missing = sorted(REQUIRED_COLUMNS - fieldnames)
        if missing:
            raise EvaluationInputError(
                "missing required columns: " + ", ".join(missing)
            )

        has_fold_id = "fold_id" in fieldnames
        records = [
            PredictionRecord(
                sample_id=(row.get("sample_id") or "").strip(),
                subject_id=(row.get("subject_id") or "").strip(),
                y_true=(row.get("y_true") or "").strip(),
                cnn_pred=(row.get("cnn_pred") or "").strip(),
                ear_mar_pred=(row.get("ear_mar_pred") or "").strip(),
                fold_id=(row.get("fold_id") or "").strip() if has_fold_id else None,
            )
            for row in reader
        ]

    _validate_records(records)
    return records


def evaluate_predictions(
    records: Sequence[PredictionRecord],
    *,
    bootstrap_resamples: int = 10_000,
    seed: int = 2026,
    confidence_level: float = 0.95,
) -> dict[str, object]:
    """Calculate paired metrics and a subject-cluster bootstrap interval."""

    _validate_records(records)
    if not isinstance(bootstrap_resamples, int) or bootstrap_resamples <= 0:
        raise EvaluationInputError("bootstrap_resamples must be a positive integer")
    if not 0.0 < confidence_level < 1.0:
        raise EvaluationInputError("confidence_level must be between 0 and 1")

    labels = sorted(
        {
            label
            for record in records
            for label in (record.y_true, record.cnn_pred, record.ear_mar_pred)
        }
    )
    cnn_macro_f1 = _macro_f1(records, "cnn_pred", labels)
    ear_mar_macro_f1 = _macro_f1(records, "ear_mar_pred", labels)

    cnn_wins = sum(
        record.cnn_pred == record.y_true
        and record.ear_mar_pred != record.y_true
        for record in records
    )
    baseline_wins = sum(
        record.cnn_pred != record.y_true
        and record.ear_mar_pred == record.y_true
        for record in records
    )
    discordant_pairs = cnn_wins + baseline_wins
    p_value = (
        1.0
        if discordant_pairs == 0
        else float(
            binomtest(
                cnn_wins,
                n=discordant_pairs,
                p=0.5,
                alternative="two-sided",
            ).pvalue
        )
    )

    ci_low, ci_high = _subject_bootstrap_interval(
        records,
        labels,
        bootstrap_resamples=bootstrap_resamples,
        seed=seed,
        confidence_level=confidence_level,
    )

    report: dict[str, object] = {
        "sample_count": len(records),
        "subject_count": len({record.subject_id for record in records}),
        "labels": labels,
        "cnn_macro_f1": cnn_macro_f1,
        "ear_mar_macro_f1": ear_mar_macro_f1,
        "macro_f1_difference": cnn_macro_f1 - ear_mar_macro_f1,
        "mcnemar": {
            "method": "exact_binomial_two_sided",
            "cnn_correct_baseline_wrong": cnn_wins,
            "cnn_wrong_baseline_correct": baseline_wins,
            "discordant_pairs": discordant_pairs,
            "p_value": p_value,
        },
        "bootstrap": {
            "unit": "subject_id",
            "method": "percentile",
            "confidence_level": confidence_level,
            "resamples": bootstrap_resamples,
            "seed": seed,
            "ci_low": ci_low,
            "ci_high": ci_high,
        },
    }
    report.update(_fold_report(records, labels))
    return report


def _validate_records(records: Sequence[PredictionRecord]) -> None:
    if not records:
        raise EvaluationInputError("prediction data must contain at least one row")

    seen_sample_ids: set[str] = set()
    fields = ("sample_id", "subject_id", "y_true", "cnn_pred", "ear_mar_pred")
    for row_number, record in enumerate(records, start=2):
        for field in fields:
            value = getattr(record, field)
            if not isinstance(value, str) or not value.strip():
                raise EvaluationInputError(
                    f"row {row_number} has an empty {field} value"
                )
        if record.sample_id in seen_sample_ids:
            raise EvaluationInputError(f"duplicate sample_id: {record.sample_id}")
        seen_sample_ids.add(record.sample_id)

    subjects = {record.subject_id for record in records}
    if len(subjects) < 2:
        raise EvaluationInputError(
            "subject-level bootstrap requires at least two subjects"
        )

    fold_values = [record.fold_id for record in records]
    if any(value is not None for value in fold_values) and any(
        value is None or not value.strip() for value in fold_values
    ):
        raise EvaluationInputError(
            "fold_id must be non-empty for every row when the column is present"
        )


def _macro_f1(
    records: Iterable[PredictionRecord], pred_field: str, labels: Sequence[str]
) -> float:
    true_positives = defaultdict(int)
    false_positives = defaultdict(int)
    false_negatives = defaultdict(int)

    for record in records:
        actual = record.y_true
        predicted = getattr(record, pred_field)
        if actual == predicted:
            true_positives[actual] += 1
        else:
            false_positives[predicted] += 1
            false_negatives[actual] += 1

    f1_values = []
    for label in labels:
        numerator = 2 * true_positives[label]
        denominator = (
            numerator + false_positives[label] + false_negatives[label]
        )
        f1_values.append(numerator / denominator if denominator else 0.0)
    return float(statistics.fmean(f1_values))


def _subject_bootstrap_interval(
    records: Sequence[PredictionRecord],
    labels: Sequence[str],
    *,
    bootstrap_resamples: int,
    seed: int,
    confidence_level: float,
) -> tuple[float, float]:
    by_subject: dict[str, list[PredictionRecord]] = defaultdict(list)
    for record in records:
        by_subject[record.subject_id].append(record)

    subjects = sorted(by_subject)
    rng = np.random.default_rng(seed)
    differences = np.empty(bootstrap_resamples, dtype=float)

    for index in range(bootstrap_resamples):
        selected = rng.integers(0, len(subjects), size=len(subjects))
        sample = [
            record
            for subject_index in selected
            for record in by_subject[subjects[int(subject_index)]]
        ]
        differences[index] = _macro_f1(sample, "cnn_pred", labels) - _macro_f1(
            sample, "ear_mar_pred", labels
        )

    alpha = 1.0 - confidence_level
    low, high = np.percentile(
        differences,
        [100.0 * alpha / 2.0, 100.0 * (1.0 - alpha / 2.0)],
    )
    return float(low), float(high)


def _fold_report(
    records: Sequence[PredictionRecord], labels: Sequence[str]
) -> dict[str, object]:
    if all(record.fold_id is None for record in records):
        return {}

    by_fold: dict[str, list[PredictionRecord]] = defaultdict(list)
    for record in records:
        assert record.fold_id is not None
        by_fold[record.fold_id].append(record)

    folds = []
    for fold_id in sorted(by_fold):
        fold_records = by_fold[fold_id]
        cnn_f1 = _macro_f1(fold_records, "cnn_pred", labels)
        baseline_f1 = _macro_f1(fold_records, "ear_mar_pred", labels)
        folds.append(
            {
                "fold_id": fold_id,
                "sample_count": len(fold_records),
                "subject_count": len(
                    {record.subject_id for record in fold_records}
                ),
                "cnn_macro_f1": cnn_f1,
                "ear_mar_macro_f1": baseline_f1,
                "macro_f1_difference": cnn_f1 - baseline_f1,
            }
        )

    cnn_values = [float(fold["cnn_macro_f1"]) for fold in folds]
    baseline_values = [float(fold["ear_mar_macro_f1"]) for fold in folds]
    return {
        "folds": folds,
        "fold_summary": {
            "fold_count": len(folds),
            "cnn_macro_f1_mean": statistics.fmean(cnn_values),
            "cnn_macro_f1_sample_std": (
                statistics.stdev(cnn_values) if len(cnn_values) > 1 else None
            ),
            "ear_mar_macro_f1_mean": statistics.fmean(baseline_values),
            "ear_mar_macro_f1_sample_std": (
                statistics.stdev(baseline_values)
                if len(baseline_values) > 1
                else None
            ),
        },
    }
