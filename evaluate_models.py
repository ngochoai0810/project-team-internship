"""CLI for reproducible paired CNN versus EAR/MAR evaluation."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from model_evaluation import (
    EvaluationInputError,
    evaluate_predictions,
    load_predictions,
)


def _parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Evaluate paired CNN and EAR/MAR out-of-fold predictions with "
            "exact McNemar and subject-cluster bootstrap statistics."
        )
    )
    parser.add_argument("input", type=Path, help="Paired prediction CSV")
    parser.add_argument("--output", type=Path, help="Optional JSON report path")
    parser.add_argument(
        "--bootstrap-resamples",
        type=int,
        default=10_000,
        help="Number of subject bootstrap samples (default: 10000)",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=2026,
        help="Bootstrap random seed (default: 2026)",
    )
    parser.add_argument(
        "--confidence-level",
        type=float,
        default=0.95,
        help="Bootstrap confidence level (default: 0.95)",
    )
    return parser.parse_args(argv)


def _format_p_value(value: float) -> str:
    if value < 0.001:
        return f"{value:.3e} (p < 0.001)"
    return f"{value:.6g}"


def _print_summary(report: dict[str, object]) -> None:
    bootstrap = report["bootstrap"]
    mcnemar = report["mcnemar"]
    assert isinstance(bootstrap, dict)
    assert isinstance(mcnemar, dict)

    print(
        f"Samples: {report['sample_count']} | "
        f"Subjects: {report['subject_count']}"
    )
    print(f"CNN macro-F1: {float(report['cnn_macro_f1']) * 100:.2f}%")
    print(
        "EAR/MAR macro-F1: "
        f"{float(report['ear_mar_macro_f1']) * 100:.2f}%"
    )
    print(
        "Difference: "
        f"{float(report['macro_f1_difference']) * 100:+.2f} percentage points"
    )
    print(
        "Exact McNemar p-value: "
        f"{_format_p_value(float(mcnemar['p_value']))} "
        f"(CNN wins={mcnemar['cnn_correct_baseline_wrong']}, "
        f"EAR/MAR wins={mcnemar['cnn_wrong_baseline_correct']})"
    )
    confidence_percent = float(bootstrap["confidence_level"]) * 100
    print(
        f"{confidence_percent:g}% subject bootstrap CI: "
        f"[{float(bootstrap['ci_low']) * 100:+.2f}, "
        f"{float(bootstrap['ci_high']) * 100:+.2f}] percentage points"
    )


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    try:
        records = load_predictions(args.input)
        report = evaluate_predictions(
            records,
            bootstrap_resamples=args.bootstrap_resamples,
            seed=args.seed,
            confidence_level=args.confidence_level,
        )
        if args.output:
            args.output.write_text(
                json.dumps(report, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
    except (EvaluationInputError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    _print_summary(report)
    if args.output:
        print(f"JSON report: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
