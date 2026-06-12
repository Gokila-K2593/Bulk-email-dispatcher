# Database Schema Documentation (Part 1)

## Job Model
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Unique identifier for the bulk email job. |
| `status` | ENUM | Current job state: `PROCESSING`, `COMPLETED`, or `FAILED` (system-level failure). Indexed for fast status querying. |
| `totalEmails` | Int | Total number of emails requested in this batch (Required). |
| `processedCount`| Int | Count of emails that reached a final state (`SUCCESS` or `FAILED`). |
| `successCount` | Int | Count of emails successfully sent. |
| `failureCount` | Int | Count of emails that failed after exhausting all 3 retry attempts. |
| `emails` | [Email] | One-to-many relation, indexed on `jobId` with `onDelete: Cascade`. |

## Email Model
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Unique identifier for the individual email task. |
| `jobId` | String | Foreign key linking the email to its parent job. Indexed for fast lookup. |
| `recipient` | String | The target email address (Max 255 chars). |
| `status` | ENUM | Current state: `PENDING`, `PROCESSING`, `SUCCESS`, or `FAILED`. |
| `retryCount` | Int | Number of retry attempts performed **after** the initial attempt (max 3). |
| `order` | Int | Deterministic sequence number (1-based) to ensure precise `emailIndex` for failure simulation. |

## Persistence Strategy Logic
- **Job Status**: Starts at `PROCESSING`. Moves to `COMPLETED` when the sum of `successCount + failureCount` equals `totalEmails`. This ensures a single source of truth for completion.
- **Processed Count**: This field is kept for historical tracking but is not used as the primary logic driver to avoid "Double Source of Truth" drift.
- **Email Retries**: The system uses `retryCount` to track progress through the exponential backoff (1s, 2s, 4s). If an email fails for the 4th time (initial + 3 retries), it is marked as `FAILED` and incremented in the job's `failureCount`.
- **Atomic Updates**: When a worker finishes an email, it updates both the `Email` status and the `Job` stats (`processedCount`, `successCount`/`failureCount`) in a single transaction to ensure data consistency.
