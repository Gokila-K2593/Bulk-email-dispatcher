# 📧 Bulk Email Dispatcher

This project is a **Bulk Email Sender Simulator**. It is a tool designed to let you paste a large list of email addresses, "send" emails to all of them, and watch the sending progress update live on a dashboard. 

To make testing safe and easy, it sends the emails to a **fake mailbox** on your computer. This means you can see the emails, read them, and check their layout without actually sending real spam emails to real people!

---

## 🌟 What makes this project cool?

*   **Beautiful Dashboard**: A clean web page where you paste emails, dispatch them, and track your history.
*   **Live Progress Chart**: A visual circular chart (donut gauge) that updates live, showing how many emails succeeded (Green), failed (Red), or are still waiting.
*   **Fake Inbox (Mailpit)**: A separate webpage that acts like a mock Gmail. Every email sent from this app lands instantly in this local mailbox so you can read and inspect them.
*   **Smart Retry System**: If an email fails to send, the system doesn't give up! It automatically waits and retries up to 4 times. (For testing, every 5th email is programmed to fail on purpose so you can watch this retry system work).
*   **Download Reports**: You can download a spreadsheet (.csv) summary of how many emails succeeded or failed once the dispatch is done.
*   **Search & Filter**: You can search through your past runs in the history list or filter them by status (active, completed, failed).

---

## 🗺️ Step-by-Step Guide: How to run and use it

You do not need to install databases or coding tools. The entire project runs inside a container system called **Docker**. 

### 1. Start the Application
Open your terminal inside the project folder and run:
```bash
docker compose up --build -d
```
*(This starts the database, the queues, the mock mailbox, and the webpage automatically).*

### 2. Open the Webpages
Open your internet browser and open these two tabs:
1.  **The Dispatcher Webpage**: Go to [http://localhost:3000](http://localhost:3000)
2.  **The Fake Mailbox**: Go to [http://localhost:8025](http://localhost:8025) (This is where your emails will land).

### 3. Send a Batch & Monitor
1.  On the Dispatcher webpage (`localhost:3000`), paste some email addresses in the box on the right. E.g.:
    `test1@gmail.com, test2@domain.com, test3@org.com, test4@mail.net, test5@abc.com`
2.  Click **Dispatch Emails**.
3.  The screen will change immediately to show your **Active Job Monitor**. Watch the metrics and the circular donut chart fill up as emails are sent!
4.  Switch over to your Fake Mailbox tab (`localhost:8025`). You will see the emails appearing in the inbox. Click on any email to view the beautiful summary letter inside!
5.  Once done, click **Export CSV Report** to download the spreadsheet data.

---

## 🧠 How it works behind the scenes 

Here is exactly what happens from the moment you click "Send" to the moment the emails land in your inbox:

### Step 1: Writing the plan in the notebook (The Webpage & Database)
When you paste your list of emails and click **Dispatch Emails**, the webpage (Next.js) instantly takes action:
* It creates a "Batch Job" entry in our digital notebook (the PostgreSQL Database).
* It registers the total number of emails you typed in and creates a separate pending task sheet for each individual address.

### Step 2: Standing in a single-file line (The Queue)
To make sure your computer doesn't crash or freeze under heavy work, we do not try to send all emails at the exact same millisecond. Instead, the webpage places the emails into a neat waiting line (the Queue, managed by Redis and BullMQ). Think of it like customers waiting in a single-file line at a bank counter.

### Step 3: The Helper starts delivering (The Background Worker)
We have a separate helper program (the Background Worker) whose only job is to stand at the front of the line:
* The helper only processes **up to 3 emails at a time** (our speed limit) to ensure things run smoothly.
* For each email, it marks its status as "Processing" in our database notebook, packages the email, and attempts to send it.

### Step 4: What happens during roadblocks? (Smart Retries)
If an email fails to deliver (like every 5th email in our simulation):
* The helper doesn't give up. It logs a warning and puts the email back into the queue.
* To avoid spamming a broken system, the queue makes the email wait progressively longer before trying again (**1 second, then 2 seconds, then 4 seconds**).
* If the email fails **4 times in total** (the initial try + 3 retries), the helper writes "Failed" in the database notebook and moves on.

### Step 5: Catching the letters (The Fake Mailbox)
When the helper sends the email, it targets our local **Mailpit** service. Mailpit acts like a bucket that catches every email. It saves them locally so that when you open `localhost:8025`, you see your HTML messages.

### Step 6: Showing you the progress
While all this background work is happening, the webpage checks our database notebook every **1.5 seconds** (polling). It reads the latest success and failure counts, and dynamically updates the circular chart and stats on your screen so you can watch it live!

---
