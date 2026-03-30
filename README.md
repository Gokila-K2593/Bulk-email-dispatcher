#  Bulk Email Dispatcher

A robust and reliable background job processing system designed for high-performance bulk email workloads. This system utilizes a distributed queue architecture to handle large-scale operations with fault tolerance and deterministic retry logic.

---

##  Performance & Reliability Rules

This system is engineered for stability and follows a strict set of operational rules:

*   **Concurrency Control (3x)**: Limits processing to 3 emails simultaneously, preventing resource exhaustion and ensuring system stability.
*   **Intelligent Retry System**: Each job is attempted up to **4 times** (1 initial + 3 retries) before being marked as failed.
*   **Exponential Backoff**: Implements a progressive wait strategy (1s, 2s, 4s) between retries to recover from transient failures.
*   **Deterministic Failure Simulation**: For testing purposes, every **5th email** is designed to fail consistently through all retries, allowing for verification of failure handling paths.
*   **Atomic Data Integrity**: Leverages database transactions to guarantee that success, failure, and total counts remain accurate at all times.

---

##  Tech Stack

| Technology | Purpose |

| **Next.js** | API Layer & Orchestration |
| **PostgreSQL** | Persistent Data Storage (Jobs & Emails) |
| **Redis & BullMQ** | High-performance Distributed Queue Management |
| **Prisma** | Modern Type-safe Database ORM |
| **Docker** | One-click Containerized Deployment |

---

##  Getting Started

The system is designed with a **"container-first"** philosophy. You only need **Docker** installed.

### 1. Initialize & Start
In your terminal, navigate to the project directory and run:

```bash
docker compose up --build
```
> [!NOTE]
> This command orchestrates the entire stack: Database, Redis, Next.js API, and the Background Worker.

---

##  Testing the Dispatcher

Once the services are active, use the following commands in a new terminal to interact with the system.

### 1. Dispatch a Bulk Job
Send a POST request to initiate a batch of email processing:

```bash
curl -X POST http://localhost:3000/api/send-bulk \
     -H "Content-Type: application/json" \
     -d '{"emails": ["user1@ex.com", "user2@ex.com", "user3@ex.com", "user4@ex.com", "user5@ex.com", "user6@ex.com"]}'
```
*Wait for the response to receive your unique **`jobId`**.*

### 2. Verify Job Status
Monitor the real-time progress of your job:

```bash
curl http://localhost:3000/api/job-status/<YOUR_JOB_ID>
```
*Displays current success, failure, and pending counts.*

### 3. Observe the Worker
Monitor the background processing logs in real-time:

```bash
docker compose logs -f worker
```

---

##  Pro-Tips

- **Environment**: No local Node.js or PostgreSQL installation is required; the entire environment is isolated within Docker.
*   **Troubleshooting**: If your IDE reports TypeScript errors, simply restart the TS server (Ctrl+Shift+P > *Restart TS Server*).
*   **Architecture**: This is a production-pattern simulation focusing on queue management, retry strategies, and data consistency rather than actual SMTP delivery.