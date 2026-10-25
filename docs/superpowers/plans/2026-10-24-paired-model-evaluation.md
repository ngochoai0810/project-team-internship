# Paired Model Evaluation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reproducible CLI that calculates paired CNN-versus-EAR/MAR metrics from real out-of-fold prediction rows.

**Architecture:** Put input validation and statistics in an importable Python module, with a thin command-line wrapper for CSV and JSON I/O. Bootstrap complete subject clusters and calculate both models with one shared label set.

**Tech Stack:** Python standard library, NumPy, SciPy, scikit-learn, unittest

**Spec:** `docs/superpowers/specs/2026-10-24-paired-model-evaluation-design.md`

## Global Constraints

- Do not modify or depend on the current image-level validation behavior in `train_cnn.py`.
- Do not overwrite unrelated working-tree changes.
- Default to 10,000 subject-level bootstrap resamples and a deterministic seed.

## Review Focus

- Duplicate sample IDs must be rejected so paired rows cannot be counted twice.
- A single subject must be rejected because subject-level uncertainty cannot be estimated meaningfully.
- Empty required values and missing columns must produce actionable errors.
- Both models must use the same label universe, including labels appearing only in predictions.
- A fixed seed must reproduce identical confidence intervals.

---

### Task 1: Statistical evaluation module

**Files:**
- Create: `model_evaluation.py`
- Test: `tests/test_model_evaluation.py`

**Interfaces:**
- Produces: `load_predictions(path)`, `evaluate_predictions(records, *, bootstrap_resamples, seed, confidence_level)`, and `EvaluationInputError`.

- [ ] Write tests for exact macro-F1, McNemar counts/p-value, clustered bootstrap determinism, fold summaries, and invalid inputs.
- [ ] Run the focused tests and verify they fail because the module does not exist.
- [ ] Implement the minimum evaluation module needed to pass.
- [ ] Run focused tests and the full Python suite.

### Task 2: Command-line interface and documentation

**Files:**
- Create: `evaluate_models.py`
- Modify: `README.md`
- Test: `tests/test_evaluate_models_cli.py`

**Interfaces:**
- Consumes: Task 1's evaluation API.
- Produces: CLI `python evaluate_models.py INPUT.csv [--output report.json] [--bootstrap-resamples N] [--seed N]`.

- [ ] Write integration tests for JSON output and malformed CSV exit behavior.
- [ ] Run the focused tests and verify they fail because the CLI does not exist.
- [ ] Implement the CLI and document the exact CSV schema and command.
- [ ] Run focused tests, the full Python suite, and whitespace checks.

