# Personal Productivity & WhatsApp Reminder System

## 1. Overview

A personal productivity application designed to help users maintain a consistent daily routine through scheduled tasks, reminders, recurring activities, progress tracking, and WhatsApp notifications.

The primary goal is to reduce decision fatigue by defining a daily schedule in advance and automatically reminding the user what they should be doing at each scheduled time.

The system should eventually support multiple users and be architected so it can evolve into a small productivity SaaS.

---

# 2. Primary Goals

### MVP Goals

* Create and manage tasks.
* Create recurring tasks.
* Define a daily schedule.
* Display today's tasks.
* Track task completion.
* Send scheduled WhatsApp reminders.
* Allow users to mark tasks as completed.
* Track daily/weekly consistency.
* Persist notification delivery status.
* Handle failed notifications with retries.

### Future Goals

* WhatsApp two-way interaction.
* Streaks.
* Productivity analytics.
* Calendar integration.
* Email notifications.
* Multiple notification channels.
* AI-generated schedules.
* AI productivity recommendations.
* Multiple routines.
* Team/family routines.

---

# 3. Example User

The initial system should support a routine such as:

| Time  | Activity               |
| ----- | ---------------------- |
| 08:00 | Wake up                |
| 08:30 | DSA                    |
| 10:00 | Company Work           |
| 17:00 | Finish Work            |
| 17:45 | System Design          |
| 19:00 | Gym                    |
| 21:15 | Job Applications       |
| 22:15 | Communication Practice |
| 22:45 | Project / Learning     |
| 23:30 | Wind Down              |
| 00:00 | Sleep                  |

The user should be able to modify these times and tasks from the dashboard.

---

# 4. Core Features

## 4.1 Authentication

Users should be able to:

* Sign up
* Sign in
* Sign out
* Reset password
* Manage profile

User profile:

* Name
* Email
* Timezone
* WhatsApp number
* Notification preferences

---

# 5. Task Management

Users can create tasks with:

* Title
* Description
* Scheduled time
* Duration
* Priority
* Category
* Recurrence
* Notification preferences
* Active/inactive status

Example:

```text
Title: DSA Practice

Description:
Solve 2 NeetCode problems.

Time:
08:30

Duration:
60 minutes

Category:
Learning

Recurrence:
Every weekday

Notification:
WhatsApp
```

---

# 6. Recurring Tasks

The system should support:

* Daily
* Weekdays
* Weekends
* Specific weekdays
* Weekly
* Custom recurrence

Example:

```text
DSA
Monday → Friday
08:30

Gym
Monday → Saturday
19:00

Weekly Review
Sunday
18:00
```

Recurring tasks should generate task occurrences without requiring the user to manually create each task.

---

# 7. Today's Dashboard

The main dashboard should show:

```text
Good Morning, Vedant

Today's Progress
████████░░ 80%

08:30  ✓ DSA
10:00  ✓ Company Work
17:45  ✓ System Design
19:00  ○ Gym
21:15  ○ Job Applications
22:15  ○ Communication
22:45  ○ Project
```

Each task should display:

* Scheduled time
* Title
* Category
* Status
* Completion time
* Duration

---

# 8. Task States

A task can have the following states:

```text
PENDING
COMPLETED
MISSED
SKIPPED
CANCELLED
```

State transitions:

```text
PENDING
   ├── COMPLETED
   ├── SKIPPED
   ├── CANCELLED
   └── MISSED
```

A task should automatically become `MISSED` if its scheduled time has passed without completion, subject to configurable grace periods.

---

# 9. WhatsApp Notifications

The system should send reminders before or at the task's scheduled time.

Example:

```text
⏰ DSA Time

Your scheduled task is starting now.

Task:
DSA Practice

Duration:
60 minutes

Reply:
DONE
SKIP
```

The notification system should support configurable reminder timing:

```text
At scheduled time
5 minutes before
10 minutes before
30 minutes before
```

---

# 10. WhatsApp Two-Way Interaction

Future MVP+ functionality should allow the user to interact with the system through WhatsApp.

Example:

```text
User:
DONE

System:
Great. DSA marked as completed.

Today's progress:
2 / 3 tasks completed.
```

Supported commands:

```text
DONE
SKIP
TODAY
NEXT
STATUS
HELP
```

Example:

```text
User:
TODAY

System:
Today's Schedule

08:30 ✓ DSA
10:00 ✓ Work
17:45 ○ System Design
19:00 ○ Gym
21:15 ○ Job Applications
```

---

# 11. Notification Architecture

Notifications should not be sent directly from the API request.

Use asynchronous processing:

```text
Scheduler
    ↓
Find upcoming tasks
    ↓
Create Notification Job
    ↓
Redis / BullMQ
    ↓
Worker
    ↓
Notification Provider
    ↓
WhatsApp API
    ↓
Notification Log
```

The worker should support:

* Retry
* Exponential backoff
* Failed jobs
* Dead-letter handling
* Idempotency
* Delivery logging

---

# 12. Notification Provider

The notification layer should use an abstraction:

```typescript
interface NotificationProvider {
  send(message: NotificationMessage): Promise<void>;
}
```

Initial implementation:

```text
NotificationProvider
        │
        └── WhatsAppProvider
```

Future implementations:

```text
NotificationProvider
        ├── WhatsAppProvider
        ├── EmailProvider
        ├── TelegramProvider
        └── PushNotificationProvider
```

This prevents the core application from being tightly coupled to WhatsApp.

---

# 13. Database Design

## users

```text
id
name
email
password_hash
timezone
whatsapp_number
created_at
updated_at
```

## tasks

```text
id
user_id
title
description
category
priority
scheduled_time
duration_minutes
recurrence_rule
is_active
created_at
updated_at
```

## task_occurrences

Represents an actual occurrence of a recurring task.

```text
id
task_id
user_id
scheduled_at
status
completed_at
created_at
updated_at
```

## notification_jobs

```text
id
task_occurrence_id
channel
scheduled_at
status
attempts
sent_at
failed_at
error_message
created_at
updated_at
```

## notification_logs

```text
id
user_id
task_occurrence_id
channel
provider_message_id
status
sent_at
error_message
created_at
```

---

# 14. Recommended Technology Stack

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* shadcn/ui

## Backend

* Next.js API / Route Handlers initially
* TypeScript
* Zod

## Database

* PostgreSQL
* Drizzle ORM

## Background Processing

* Redis
* BullMQ
* Dedicated worker

## Authentication

* Better Auth or Auth.js

## Notifications

* WhatsApp Business Platform / compatible WhatsApp provider

## Infrastructure

* Docker
* Nginx
* VPS

## Monitoring

Future:

* OpenTelemetry
* Prometheus
* Grafana
* Structured logging

---

# 15. API Design

Example endpoints:

```text
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/tasks
POST   /api/tasks
GET    /api/tasks/:id
PATCH  /api/tasks/:id
DELETE /api/tasks/:id

POST   /api/tasks/:id/complete
POST   /api/tasks/:id/skip

GET    /api/today
GET    /api/progress

GET    /api/settings
PATCH  /api/settings

POST   /api/webhooks/whatsapp
```

---

# 16. Scheduler

The scheduler is responsible for identifying upcoming tasks.

Example:

```text
Every minute:

Find task occurrences
where scheduled_at <= current_time
and notification has not been sent.

Create notification jobs.

Worker processes the jobs.
```

The scheduler must account for the user's timezone.

Example:

```text
User timezone:
Asia/Kolkata

Task:
08:30 IST
```

The system should store timestamps consistently and convert them to the user's timezone when displaying/scheduling tasks.

---

# 17. Idempotency

The system must prevent duplicate WhatsApp notifications.

For example:

```text
task_occurrence_id = 123
notification_type = REMINDER
```

Only one notification should be created for that combination.

A unique database constraint should enforce this.

---

# 18. Retry Strategy

If WhatsApp delivery fails:

```text
Attempt 1
    ↓
Wait 30 seconds
    ↓
Attempt 2
    ↓
Wait 2 minutes
    ↓
Attempt 3
    ↓
Dead Letter Queue
```

The exact retry policy should be configurable.

---

# 19. Progress Tracking

The system should calculate:

### Daily

```text
Completed
Total
Completion %
```

### Weekly

```text
Monday     80%
Tuesday    100%
Wednesday  60%
Thursday   90%
Friday     70%
Saturday   100%
Sunday     80%
```

### Metrics

* Daily completion rate
* Weekly completion rate
* Current streak
* Longest streak
* Tasks completed
* Tasks missed
* Tasks skipped
* Category-wise completion

---

# 20. Categories

Initial categories:

```text
WORK
DSA
SYSTEM_DESIGN
JOB_SEARCH
GYM
COMMUNICATION
PROJECT
PERSONAL
```

Users should be able to create custom categories later.

---

# 21. Project Dashboard

A separate dashboard should track longer-term goals.

Example:

```text
Goal:
Get a better software engineering job

Progress:
████████░░ 80%

Tasks:
✓ DSA preparation
✓ Resume updated
✓ LinkedIn updated
○ Mock interviews
○ System Design preparation
```

This is separate from daily tasks.

---

# 22. Security Requirements

* Passwords must never be stored in plaintext.
* API endpoints must require authentication where appropriate.
* Users must only access their own tasks.
* Validate all request bodies using Zod.
* Validate webhook signatures.
* Encrypt sensitive credentials where required.
* Rate-limit public endpoints.
* Protect webhook endpoints.
* Never expose WhatsApp credentials to the frontend.

---

# 23. Non-Functional Requirements

The system should be:

### Reliable

A temporary WhatsApp API failure should not lose the notification.

### Idempotent

The same reminder should not be sent multiple times.

### Observable

Every notification should have a traceable lifecycle:

```text
CREATED
QUEUED
PROCESSING
SENT
FAILED
RETRYING
```

### Scalable

The architecture should eventually support:

```text
1 user
    ↓
100 users
    ↓
10,000 users
    ↓
100,000 users
```

without redesigning the entire notification system.

---

# 24. MVP Scope

The first version should contain ONLY:

```text
✓ Authentication
✓ Task CRUD
✓ Recurring tasks
✓ Today's dashboard
✓ Task completion
✓ PostgreSQL
✓ Redis
✓ BullMQ
✓ WhatsApp reminders
✓ Notification logs
✓ Basic progress tracking
```

Do NOT build initially:

```text
✗ AI
✗ Calendar integration
✗ Mobile app
✗ Multiple notification channels
✗ Complex analytics
✗ Team functionality
✗ Social features
```

---

# 25. Development Phases

## Phase 1 — Foundation

* Initialize monorepo/project
* Configure Next.js
* Configure PostgreSQL
* Configure Drizzle
* Authentication
* User model

## Phase 2 — Tasks

* Task CRUD
* Categories
* Recurring tasks
* Task occurrences
* Today's dashboard

## Phase 3 — Completion

* Complete task
* Skip task
* Missed task detection
* Daily progress

## Phase 4 — Background Jobs

* Redis
* BullMQ
* Worker
* Scheduler
* Job retries

## Phase 5 — WhatsApp

* WhatsApp provider
* Notification templates
* Reminder jobs
* Delivery logging
* Webhook handling

## Phase 6 — Two-Way WhatsApp

* DONE
* SKIP
* TODAY
* STATUS
* NEXT

## Phase 7 — Analytics

* Streaks
* Weekly progress
* Completion rate
* Category statistics

## Phase 8 — Production

* Docker
* Nginx
* HTTPS
* Logging
* Monitoring
* Error tracking
* Backups

---

# 26. Success Criteria

The project is considered successful when:

1. A user can define a recurring daily schedule.
2. The system automatically generates task occurrences.
3. The user receives WhatsApp reminders at the correct local time.
4. The user can mark tasks complete from the web dashboard.
5. The user can mark tasks complete through WhatsApp.
6. Failed notifications are retried.
7. Duplicate notifications are prevented.
8. The dashboard accurately shows daily and weekly progress.
9. The entire system can run reliably in production using Docker.
10. The architecture can support multiple users.

---

# 27. Long-Term Vision

The application should eventually become a **personal execution system**, rather than a simple todo application.

The core loop:

```text
Plan
 ↓
Schedule
 ↓
Reminder
 ↓
Execute
 ↓
Complete
 ↓
Measure
 ↓
Improve
 ↓
Repeat
```

The system should make it easier for the user to consistently execute predefined goals without repeatedly deciding what to do next.
