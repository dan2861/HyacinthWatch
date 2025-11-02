# Photo Upload Workflow - Detailed Documentation

## Overview
When you upload a photo, it goes through multiple stages: synchronous API handling, asynchronous background processing with ML models, and gamification scoring. This document details each step.

---

## 1. Frontend Upload (Synchronous)

**Location:** `hyacinthwatch-pwa/src/api.js` → `postObservation()`

### Steps:
1. **User clicks upload** in PWA
2. **Get Supabase access token** (if user is logged in)
   - Calls `getAccessToken({ refresh: true })` from Supabase session
   - Token used for authentication: `Authorization: Bearer <token>`

3. **Create FormData** with:
   - Image blob
   - Metadata JSON containing:
     - `id`: UUID for observation
     - `captured_at`: ISO8601 timestamp
     - `lat`, `lon`: GPS coordinates
     - `device_info`: User agent string

4. **POST to backend** (`/v1/observations`)
   - Includes token in Authorization header (if available)

---

## 2. Backend API - Observation Creation (Synchronous)

**Location:** `backend/observations/views.py` → `ObservationListCreate.post()`

### Steps:

#### 2.1 Authentication
- **JWT Verification** (if token provided):
  - `SupabaseJWTAuthentication` class verifies token
  - Maps Supabase user ID (`sub` claim) to Django User
  - Creates Django user if doesn't exist
  - Sets `request.user` for authenticated requests

#### 2.2 Request Processing
1. **Extract file** from `request.FILES.get('image')`
2. **Parse metadata** JSON from form data
3. **Validate** `captured_at` timestamp
4. **Create Observation record** in database:
   - Status: `'received'`
   - User: Set if authenticated, else `NULL`
   - Image: Saved to local filesystem (`media/observations/YYYY/MM/DD/`)
   - All metadata fields populated

#### 2.3 Optional: Upload to Supabase Storage
- **If configured** (`SUPABASE_URL`, `STORAGE_BUCKET_OBS`):
  - Reads local image file
  - Uploads to Supabase Storage bucket
  - Updates `obs.image_url` with `supabase://bucket/path`

#### 2.4 Enqueue Background Tasks
Two Celery tasks are enqueued **asynchronously** (non-blocking):

1. **`classify_presence.delay(obs_id)`** (Priority: HIGH)
   - Classifies if image contains hyacinth
   - Runs first to enable early decision-making

2. **`run_qc_and_segmentation.delay(obs_id)`** (QC computation)
   - **Note:** This task may not exist in workers (legacy reference)
   - QC might be computed elsewhere or skipped

**API returns immediately** with observation data (doesn't wait for background processing)

---

## 3. Background Worker - Presence Classification (Asynchronous)

**Container:** `hyacinth-worker`  
**Task:** `workers.tasks.classify_presence(obs_id)`  
**Trigger:** Celery task queue (Redis)

### Detailed Steps:

#### 3.1 Load Model
- **Download model from Supabase Storage:**
  - `models/presence/1.0.0/model_meta.json`
  - `models/presence/1.0.0/presence_mobilenetv2.pt`
- **Load PyTorch MobileNetV2 model** with model weights
- **Get threshold** from metadata (default: 0.5)

#### 3.2 Get Image
- **Try Supabase Storage first** (if `obs.image_url` exists):
  - Download from `supabase://bucket/path`
- **Fallback:** Read local file (`obs.image.path`)

#### 3.3 Image Preprocessing
- Convert to RGB
- Resize to model input size (from metadata)
- Normalize: `(pixel / 255.0 - mean) / std`
- Convert to PyTorch tensor
- Move to model device (CPU/GPU)

#### 3.4 Run Inference
- **Forward pass:** `model(image_tensor)`
- **Apply sigmoid:** Get probability score (0.0 to 1.0)
- **Classify:**
  - `label = 'present'` if `score >= threshold`
  - `label = 'absent'` otherwise

#### 3.5 Save Results
- **Update `obs.pred`** with:
  ```json
  {
    "presence": {
      "score": 0.85,
      "label": "present",
      "model_v": "1.0.0"
    }
  }
  ```
- **Update status:**
  - `'processing'` if present (segmentation will run)
  - `'done'` if absent

#### 3.6 Award Gamification Points
- **Check:** Only if `score >= threshold` (avoid false positives)
- **Points:**
  - `'present'`: **5 points**
  - `'absent'`: **0 points** (changed from 1)
- **Log:** `"awarded X points to user=N reason=presence:present/absent"`

#### 3.7 Enqueue Segmentation Task
- **Always enqueues** `segment_and_cover.delay(obs_id)`
- Runs regardless of presence label (to ensure masks are always produced)

---

## 4. Background Worker - Segmentation (Asynchronous)

**Container:** `hyacinth-worker`  
**Task:** `workers.tasks.segment_and_cover(obs_id)`  
**Trigger:** Enqueued by `classify_presence` task

### Detailed Steps:

#### 4.1 Load Model
- **Try to download from Supabase Storage:**
  - `models/segmentation/1.0.0/model_meta.json`
  - `models/segmentation/1.0.0/unet_aquavplant.pt`
- **Fallback:** If model not found (404):
  - Uses threshold-based fallback
  - **WARNING:** `"failed to load segmenter v1.0.0: ... using fallback threshold mask"`

#### 4.2 Get Image
- Same as presence: Try Supabase first, fallback to local file

#### 4.3 Image Preprocessing
- Convert to RGB
- Resize to model input size (320x320)
- Normalize with ImageNet stats
- Convert to float32 tensor (matches model dtype)

#### 4.4 Run Segmentation
- **If model available:**
  - Forward pass through U-Net model
  - Get logits → sigmoid → probabilities
  - Threshold: `mask = (probs >= 0.5) * 255`
- **If fallback:**
  - Convert to grayscale
  - Simple threshold: `pixel >= 128 ? 255 : 0`

#### 4.5 Compute Cover Percentage
- Calculate: `cover_pct = (mask.mean() / 255) * 100`
- Example: 50% white pixels = 50% cover

#### 4.6 Upload Mask
- **Upload to Supabase Storage:**
  - Bucket: `masks`
  - Path: `{user_id}/{obs_id}.png` (or `anon/{obs_id}.png` if no user)
- **Retry logic:** Handles HTTP 400 errors by retrying with PUT
- **Log:** `"uploaded mask via upload_bytes to supabase://masks/..."`

#### 4.7 Save Results
- **Update `obs.pred`** with:
  ```json
  {
    "seg": {
      "cover_pct": 12.5,
      "model_v": "1.0.0",
      "mask_url": "supabase://masks/user_id/obs_id.png"
    }
  }
  ```
- **Status:** Set to `'done'`

#### 4.8 Check Presence Before Awarding Points
- **Read presence label** from `obs.pred.presence.label`
- **Require both:**
  - `presence_label == 'present'`
  - `presence_score >= 0.5`
- **Require cover:** `cover_pct > 0%`
- **Only then award segmentation points**

#### 4.9 Award Gamification Points
- **If hyacinth detected** (present + score >= 0.5 + cover > 0%):
  - **Points:** 0-12 points
    - Base: `min(10, cover_pct // 10)` (1 point per 10% cover)
    - Bonus: +2 points if using real model (not fallback)
    - Example: 95% cover = 9 base + 2 bonus = 11 points
- **If not hyacinth:** **0 points** (skipped)

---

## 5. Celery Worker Architecture

### Infrastructure
- **Redis:** Message broker (stores task queue)
- **Celery Worker:** `hyacinth-worker` container
  - Runs: `celery -A hyacinthwatch.celery worker --loglevel=info`
  - Concurrency: 8 workers (prefork mode)
  - Tasks registered:
    - `classify_presence`
    - `segment_and_cover`
    - `debug_task`

### Task Queue Flow
1. **Backend enqueues** task → Redis queue
2. **Worker picks up** task from Redis
3. **Worker executes** task in separate process
4. **Task completes** → Results stored (if configured)

### Task Dependencies
```
Upload → classify_presence (async)
         ↓
         segment_and_cover (async, always triggered)
```

---

## 6. Parallel Execution

### Tasks Run in Parallel:
- ✅ **`classify_presence`** and **`segment_and_cover`** can run simultaneously
  - Both download images independently
  - Both can process different observations concurrently
  - Worker has 8 concurrent processes

### Sequential Dependencies:
- ⚠️ **Gamification points** for segmentation wait for presence classification
  - Segmentation checks `obs.pred.presence.label` before awarding points
  - If presence hasn't completed yet, segmentation may not award points

---

## 7. Data Flow Summary

```
Frontend Upload
    ↓
POST /v1/observations (Backend API)
    ├─→ Create Observation (status='received')
    ├─→ Upload to Supabase Storage (optional)
    └─→ Enqueue Tasks → Redis Queue
           │
           ├─→ classify_presence (Worker)
           │     ├─→ Download model
           │     ├─→ Classify image
           │     ├─→ Save presence results
           │     ├─→ Award presence points (if score >= threshold)
           │     └─→ Enqueue segment_and_cover
           │
           └─→ segment_and_cover (Worker, triggered by presence)
                 ├─→ Download model (or use fallback)
                 ├─→ Segment image → mask
                 ├─→ Compute cover_pct
                 ├─→ Upload mask to Supabase
                 ├─→ Save segmentation results
                 └─→ Award segmentation points (if presence='present' AND score >= 0.5 AND cover > 0%)
```

---

## 8. Status Transitions

**Observation Status Flow:**
```
'received' → (presence classification)
              ↓
         'processing' (if present) OR 'done' (if absent)
              ↓
         (segmentation completes)
              ↓
            'done'
```

---

## 9. Gamification Points Timeline

**For Hyacinth Images:**
1. **Presence classification completes** → +5 points (if score >= 0.5)
2. **Segmentation completes** → +0-12 points (if presence='present' + score >= 0.5 + cover > 0%)
3. **Total:** 5-17 points per hyacinth image

**For Non-Hyacinth Images:**
1. **Presence classification** → 0 points (score < threshold OR label='absent')
2. **Segmentation** → 0 points (presence check fails OR cover = 0%)
3. **Total:** 0 points

---

## 10. Error Handling

### Image Not Found:
- Task logs warning and sets `status='error'`
- No points awarded

### Model Not Found:
- **Presence:** Task fails (no fallback)
- **Segmentation:** Uses threshold fallback, logs warning

### Network Errors:
- Supabase downloads: Retried automatically
- Mask uploads: Retry with PUT if POST fails

---

## 11. Key Files Reference

- **Frontend Upload:** `hyacinthwatch-pwa/src/api.js:postObservation()`
- **Backend API:** `backend/observations/views.py:ObservationListCreate.post()`
- **Presence Task:** `backend/workers/tasks.py:classify_presence()`
- **Segmentation Task:** `backend/workers/tasks.py:segment_and_cover()`
- **Gamification:** `backend/observations/gamification.py`
- **Authentication:** `backend/observations/authentication.py`
- **Celery Config:** `backend/hyacinthwatch/celery.py`
- **Worker Container:** `infra/docker-compose.yml:worker`

