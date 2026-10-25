# Paired Model Evaluation Design

## Intent

Provide a reproducible way to calculate the reported CNN-versus-EAR/MAR statistics from real out-of-fold predictions instead of copying illustrative values into documentation.

## Goals

- Read paired predictions from a CSV containing `sample_id`, `subject_id`, `y_true`, `cnn_pred`, and `ear_mar_pred`.
- Report both macro-F1 scores, their paired difference, exact McNemar discordance counts and p-value, and a 95% subject-cluster bootstrap confidence interval for the macro-F1 difference.
- Optionally report per-fold macro-F1 values and their sample mean/standard deviation when `fold_id` is present.
- Produce machine-readable JSON and a concise terminal summary with deterministic bootstrap output for a fixed seed.
- Fail clearly on malformed or unsafe evaluation input.

## Non-goals

- Train either classifier or manufacture missing predictions.
- Treat the existing image-level validation split as subject-independent cross-validation.
- Evaluate temporal alert episodes; this tool evaluates paired classification rows only.

## Constraints

- Use the repository's existing Python dependencies: NumPy, SciPy, and scikit-learn.
- Resample subjects, not individual rows, because observations from one subject are correlated.
- Use the same label universe for both macro-F1 calculations.
- Preserve unrelated working-tree changes.

## Approaches

1. **Standalone CSV evaluator (selected).** Keeps statistical evaluation independent of TensorFlow training, runs quickly in tests, and can consume predictions produced on Colab or another machine.
2. **Embed evaluation into `train_cnn.py`.** Rejected because that script currently performs image-level validation splitting and has no subject metadata or EAR/MAR predictions.
3. **Notebook-only analysis.** Rejected because it is harder to test, automate, and reproduce exactly.

## Design

`model_evaluation.py` owns CSV validation and statistical calculations. `evaluate_models.py` is a thin CLI that writes JSON when requested. The input contract requires unique, non-empty sample IDs, non-empty subject IDs and labels, at least two subjects, and at least one row. Bootstrap samples subjects with replacement and includes all rows belonging to each selected subject; duplicate selected subjects contribute duplicate clusters. The percentile interval uses 10,000 resamples by default and a fixed default seed.

