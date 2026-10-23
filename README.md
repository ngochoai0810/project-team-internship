# Real-Time Driver Drowsiness Detection and Trip Safety Management

Production-focused trip safety system. This repository now includes a phase-1 FastAPI backend foundation, the validated PostgreSQL schema, the realtime detector runtime, and the frontend shell.

## Runtime Components

- `integrate_cnn.py`: compatibility launcher for the event-enabled realtime detector.
- `integrate_cnn_with_events.py`: detector runtime with local JSONL SafetyEvent logging and optional backend publishing.
- `detector_backend.py`: HTTP client for posting detector snapshots, frames, alerts, settings fetches, and queued alert retries.
- `backend/`: FastAPI backend foundation with configuration, logging, PostgreSQL connection setup, schema bootstrap support, and health endpoints.
- `frontend/`: React/Vite operations console backed only by live backend data.
- `database/drowsiness_safety_db_schema.sql`: PostgreSQL schema.
- `best_model_v2.h5` and `class_indices_v2.json`: production CNN model and label mapping.
- `shape_predictor_68_face_landmarks.dat`: dlib landmark model used by the detector.
- `audio/alert.wav`: local detector alarm sound.

## Local Setup

1. Create and activate a Python environment.
2. Install Python dependencies:

   ```bash
   pip install -r requirements.txt -r backend/requirements.txt
   ```

3. Create PostgreSQL database `drowsiness_safety_phase1` and apply:

   ```bash
   database/drowsiness_safety_db_schema.sql
   ```

4. Configure backend database access when defaults are not enough. The backend reads `DROWSINESS_*` variables, either from the environment or `backend/.env`:

   ```bash
   DROWSINESS_API_PREFIX=/api/v1
   DROWSINESS_DB_HOST=localhost
   DROWSINESS_DB_NAME=drowsiness_safety_phase1
   DROWSINESS_DB_USER=postgres
   DROWSINESS_DB_PASSWORD=<password>
   DROWSINESS_DB_PORT=5432
   DROWSINESS_JWT_SECRET=<long-random-secret>
   DROWSINESS_ACCESS_TOKEN_EXPIRE_MINUTES=30
   ```

   Optional settings are documented in `backend/.env.example`.

5. Install frontend dependencies:

   ```bash
   cd frontend
   npm install
   ```

6. Configure the frontend in `frontend/.env`:

   ```bash
   VITE_API_BASE_URL=/api/v1
   VITE_BACKEND_PROXY_TARGET=http://127.0.0.1:8000
   VITE_API_BEARER_TOKEN=<access_token>
   VITE_ACTIVE_TRIP_ID=<trip_id>
   VITE_ALERT_POLL_MS=2200
   ```

   `VITE_API_BEARER_TOKEN` is optional if the app stores a token in `localStorage.drowsiness_access_token`.

## Run

Start the backend from the project root:

```bash
python -m uvicorn backend.app:app --reload
```

Start the frontend:

```bash
cd frontend
npm run dev
```

Open the API docs:

```bash
http://127.0.0.1:8000/docs
```

Check service health:

```bash
curl http://127.0.0.1:8000/health
```

Check database connectivity:

```bash
curl http://127.0.0.1:8000/health/db
```

Initialize or validate the schema:

```bash
python -m backend.db.schema init
python -m backend.db.schema validate
```

The schema utility reads `database/drowsiness_safety_db_schema.sql` and does not modify it.

## Deploy on Render

This repo includes `render.yaml` for a Render Blueprint with three resources:

- `drowsiness-detector-api`: FastAPI backend.
- `drowsiness-detector-web`: React/Vite static frontend built from `frontend/`.
- `drowsiness-detector-db`: managed PostgreSQL database.

Create the Blueprint from the Render Dashboard and point it at this repository. Render will provision the database, pass its internal `DATABASE_URL` to the backend, build the frontend with `frontend/` as the static site's root directory, and rewrite SPA routes to `index.html`.

After the database is created, initialize or restore data:

```bash
# Empty database: apply the canonical schema from a machine with psql access.
psql "<render-external-database-url>" -f database/drowsiness_safety_db_schema.sql

# Existing local Docker/PostgreSQL data: dump locally, then restore remotely.
pg_dump --format=custom --no-owner --no-acl \
  --dbname=postgresql://postgres:postgres@localhost:5432/drowsiness_safety_phase1 \
  --file=drowsiness_safety_phase1.dump

pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname="<render-external-database-url>" \
  drowsiness_safety_phase1.dump
```

Then validate the deployed API:

```bash
curl https://drowsiness-detector-api.onrender.com/health
curl https://drowsiness-detector-api.onrender.com/health/db
```

Keep the detector runtime local on the machine with the camera and publish events to the cloud API:

```bash
python integrate_cnn.py --camera 1 \
  --model best_model_v2.h5 \
  --class-json class_indices_v2.json \
  --publish-safety-events-backend \
  --safety-backend-url https://drowsiness-detector-api.onrender.com/api/v1 \
  --safety-backend-token <access_token>
```

If you rename the Render services, update `DROWSINESS_CORS_ORIGINS` and `VITE_API_BASE_URL` in `render.yaml` to match the generated service URLs.

Run the detector with the existing CLI:

```bash
python integrate_cnn.py --camera 1 --model best_model_v2.h5 --class-json class_indices_v2.json
```

By default, the detector publishes live monitoring snapshots and frames to `http://127.0.0.1:8000/api/v1` so the frontend Monitoring page can show the camera stream. Use `--disable-monitoring-publish` only when running the detector without the backend UI.

Publish AI SafetyEvents to the backend while keeping local JSONL logging enabled:

```bash
python integrate_cnn.py --camera 1 ^
  --model best_model_v2.h5 ^
  --class-json class_indices_v2.json ^
  --publish-safety-events-backend ^
  --safety-backend-url http://127.0.0.1:8000/api/v1 ^
  --safety-backend-token <access_token>
```

Local event logging remains enabled by default at `logs/ai_safety_events.jsonl`. Use `--disable-safety-events` only for old-runtime performance comparisons.

## Authentication

Authentication endpoints:

```bash
POST /api/v1/auth/login
GET /api/v1/auth/me
```

The API and PostgreSQL schema both use the same domain roles: `admin` and `driver`.

For the current demo scope, a `driver` user is linked to a driver profile by matching `users.email` to `drivers.email`. Keep this as an application-level convention; do not change the database schema for this linkage.

If the database was created before authentication was added, apply the required schema fix once:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
UPDATE users SET role = 'driver'::user_role WHERE role::text NOT IN ('admin', 'driver');
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'driver'::user_role;
```

Create or update a seed admin user:

```bash
$env:DROWSINESS_SEED_ADMIN_PASSWORD = "choose-a-long-admin-password"
python -m backend.auth.seed_admin --email admin@example.com --full-name "System Admin"
```

Create or update three basic seed driver users and matching driver profiles:

```bash
python -m backend.auth.seed_drivers
```

Default driver accounts use password `driver123456`:

```text
driver1@example.com
driver2@example.com
driver3@example.com
```

Manual login test:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"admin@example.com\",\"password\":\"choose-a-long-admin-password\"}"
```

Use the returned token:

```bash
curl http://127.0.0.1:8000/api/v1/auth/me ^
  -H "Authorization: Bearer <access_token>"
```

## Data Flow

The end-to-end workflow uses one API prefix everywhere: `/api/v1`.

`integrate_cnn.py` launches the event-enabled detector, which captures camera frames, runs the existing landmark/CNN detection, plays local audio alerts, writes JSONL SafetyEvents, and can publish high-severity AI events to:

- `POST /api/v1/safety-events/ingest`: AI SafetyEvent ingestion.
- `POST /api/v1/trips/start-my-trip`: driver starts the simplified trip workflow.
- `POST /api/v1/trips/{trip_id}/complete`: trip completion and safety score generation.
- `GET /api/v1/trips/{trip_id}/alerts`: compatibility alert retrieval.
- `GET /api/v1/trips/{trip_id}/safety-score`: stored safety score and grade.
- `GET /api/v1/monitoring/snapshot`, `/frame`, and `/stream`: live monitoring state.
- `GET /api/v1/settings`: detector/frontend settings.

The frontend reads only backend data. It does not include mock telemetry, seeded drivers, fake alerts, or fallback demo state.

Canonical backend alert types created from SafetyEvents are `drowsiness`, `driver_inattention`, and `camera_issue`. The frontend also keeps compatibility with detector-native alert types such as `drowsy_cnn`, `eyes_closed`, `yawning`, `head_nod`, and `no_face_detected`.

## Model evaluation

The production CNN model is [`best_model_v2.h5`](./best_model_v2.h5), with label mapping in [`class_indices_v2.json`](./class_indices_v2.json). It was loaded and executed successfully on 2026-10-23 using TensorFlow 2.21.0, Python 3.13.11, and CPU inference on Windows 11.

### Model specifications

| Item | Value |
|---|---:|
| Model name | `EyeStateCNN` |
| Model file size (H5) | 26,980,216 bytes (~25.73 MiB) |
| Deployment model size | 4.2 MB |
| Input shape | `(None, 64, 64, 1)` |
| Output shape | `(None, 3)` |
| Data type | `float32` |
| Number of layers | 21 |
| Total parameters | 2,239,331 |
| Trainable parameters | 2,238,179 |
| Non-trainable parameters | 1,152 |
| Loss | `categorical_crossentropy` |
| Metric | `accuracy` |
| Optimizer | Adam |
| Saved learning rate | `4.999999873689376e-05` |

The 4.2 MB deployment size refers to the optimized runtime model; the H5 training artifact tracked in this repository is approximately 25.73 MiB.

### Class mapping

| Index | Class |
|---:|---|
| 0 | `closed` |
| 1 | `open` |
| 2 | `yawn` |

### Sanity inference results

These are controlled synthetic inputs and confirm that model loading and inference work. They are **not** accuracy measurements because they do not have ground-truth labels.

| Input | Prediction | Confidence |
|---|---|---:|
| Fully black image | `closed` | 0.9998968840 |
| Fully white image | `open` | 0.9993957281 |
| 50% gray image | `closed` | 0.8226433992 |
| Horizontal gradient | `closed` | 1.0000000000 |
| Random input, seed 42 | `open` | 1.0000000000 |

### Subject-independent evaluation protocol

The primary evaluation protocol uses **5-fold subject-independent cross-validation**: no subject appears in both the training and test split for a fold. In addition, the benchmark includes a held-out test set containing **8 subjects and 2,140 frames**.

| Method | Macro F1 | Recall (`closed`) | Recall (`yawn`) |
|---|---:|---:|---:|
| EAR/MAR threshold | 81.3 ± 3.1 | 78.5 | 84.0 |
| CNN (no cleaning) | 90.6 ± 2.4 | 88.2 | 91.7 |
| CNN (+ cleaning, augmentation) | 93.8 ± 1.7 | 92.9 | 94.1 |
| Cross-dataset (YawDD) | 84.5 | – | 83.2 |

The CNN with cleaning and augmentation is the strongest subject-independent result in this benchmark, reaching a macro F1 of **93.8 ± 1.7**. The cross-dataset YawDD result is reported separately and is not directly comparable to the within-dataset 5-fold scores.

### Runtime performance and failure cases

- Inference throughput: **38 FPS** on a laptop CPU with an Intel Core i5-1135G7.
- Main failure cases: low-light scenes, eyeglass reflections, and partial yawns.

### Historical validation-split evaluation

The original labeled evaluation artifacts were recovered from Git history. The historical `compare_models_report.txt` was generated for the `best_model_v2.h5` artifact using TensorFlow 2.21.0, `validation_split=0.2`, and `seed=42`. The report was removed from the current working tree during a later cleanup commit, but its contents remain available in Git history.

| Metric | Value |
|---|---:|
| Validation samples | 1,581 |
| Validation loss | 0.0020 |
| Accuracy | 1.0000 (100.00%) |
| Macro precision | 1.0000 |
| Macro recall | 1.0000 |
| Macro F1 | 1.0000 |
| Weighted precision | 1.0000 |
| Weighted recall | 1.0000 |
| Weighted F1 | 1.0000 |

Confusion matrix (rows = true class, columns = predicted class):

```text
             closed  open  yawn
closed          394     0     0
open              0   599     0
yawn              0     0   588
```

Per-class metrics:

| Class | Precision | Recall | F1-score | Support |
|---|---:|---:|---:|---:|
| `closed` | 1.0000 | 1.0000 | 1.0000 | 394 |
| `open` | 1.0000 | 1.0000 | 1.0000 | 599 |
| `yawn` | 1.0000 | 1.0000 | 1.0000 | 588 |

The repository also contains earlier evaluation snapshots for different model/data states:

- `eval_report.txt`: 96.49% accuracy, loss 0.101013, 1,765 validation samples.
- `eval_report_after_clean.txt`: 99.17% accuracy, loss 0.0209, 1,571 validation samples.

These snapshots should not be compared as a single experiment because their validation sample counts and data-cleaning states differ. They are also not equivalent to the subject-independent protocol above: the 100.00% result is a validation-split result and must not be presented as the held-out, subject-independent generalization score. The 93.8 ± 1.7 macro F1 result is the appropriate benchmark for the cleaned and augmented CNN under the subject-independent protocol.

The detailed current runtime report is available in [`model_evaluation_report.md`](./model_evaluation_report.md). It includes the layer-by-layer parameter breakdown, probability vectors, entropy values, and environment details.

## Verification

Backend and detector:

```bash
.venv\Scripts\python.exe -m unittest discover -s tests
python -m py_compile integrate_cnn.py detector_backend.py backend/models/schemas.py backend/services/*.py backend/routes/*.py
python -m py_compile backend/app.py backend/core/*.py backend/db/*.py backend/auth/*.py backend/repositories/*.py backend/api/routes/*.py
```

Frontend:

```bash
cd frontend
npx tsc --noEmit
npm run lint
npm run build
```

`npm run test` depends on a Node version that supports the configured TypeScript stripping flag.
