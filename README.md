#  Bulk Email Dispatcher

This project is a solid and reliable system for processing bulk email jobs in the background. It uses a queue system to manage the work in the background, making it very performant.

---

##  What is implemented?
This system simulates email processing and does not actually send real emails.
We have built this system to follow these exact rules:

1.  **Concurrency = 3**:The system only sends 3 emails at a time. This prevents overloading the system.
2.  **Retry System**: Each email job is attempted up to 4 times (1 original attempt + 3 retries) if it fails.
3.  **Wait and Retry**: If an email fails, the system waits (1s, 2s, 4s) before trying again (**Exponential Backoff**).
4.  **Failure Simulation**: To test the system,Every 5th email is designed to fail on all attempts, resulting in a permanent failure after exhausting retries.
5.  **Reliability**: We use database transactions to make sure your email counts (Success/Failure/Total) are always correct.

---

##  Technology Used

- **Next.js**: For the API.
- **PostgreSQL**: To store your jobs and email data.
- **Redis & BullMQ**: To manage the queue.
- **Prisma**: To talk to the database.
- **Docker**: To run everything with one command.

---

##  How to start

You only need **Docker** installed on your computer.

1.  **Clone the project** to your computer.
2.  **Start the project**:
    Open your terminal in the project folder and run:
    ```bash
    docker compose up --build
    ```
    *This command will start the Database, Redis, the API, and the Background Worker all at once.*

---

##  How to test

Once the system is running, you can use these commands in a **new terminal**:

### 1. Send a Bulk Email Request
This will send a list of emails to the system:
```bash
curl -X POST http://localhost:3000/api/send-bulk \
     -H "Content-Type: application/json" \
     -d '{"emails": ["user1@ex.com", "user2@ex.com", "user3@ex.com", "user4@ex.com", "user5@ex.com", "user6@ex.com"]}'
```
*Wait for the response to get your **`jobId`**.*

### 2. Check the Status
Replace `<YOUR_JOB_ID>` with the ID you received above:
```bash
curl http://localhost:3000/api/job-status/<YOUR_JOB_ID>
```
*You will see how many emails are successful, pending, or failed.*

### 3. See the "Worker" in action
To see the system processing emails in real-time, run:
```bash
docker compose logs -f worker
```

---

##  Tips
- If you see any errors in your code editor, try restarting the TypeScript server.
- The system is built to be "containers-first," meaning it works perfectly inside Docker without you needing to install Node.js or Postgres on your host machine.

##  Design Note
This system focuses on reliable background job processing (queue, retry, failure handling, and progress tracking) rather than actual email delivery.