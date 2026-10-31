# School Management ERP — Microservices Backend (MERN)

A scalable, role-based backend for the School ERP system, built as independent Node.js/Express microservices, each with its own MongoDB database, wired together through a single API Gateway. Frontend (your existing `Frontend-Admin-panel`) or any teacher/student/parent app can talk to **one URL** (the gateway) instead of knowing about every service.

## 1. Architecture

```
                              ┌─────────────────────┐
                              │   Client Apps        │
                              │  Admin / Teacher /   │
                              │  Student / Parent     │
                              └──────────┬───────────┘
                                         │  HTTPS
                              ┌──────────▼───────────┐
                              │     API GATEWAY       │  :5000
                              │ (routing, rate-limit, │
                              │  helmet, cors)        │
                              └──────────┬───────────┘
        ┌──────────────┬─────────────────┼─────────────────┬──────────────┬─────────────┐
        │              │                 │                 │              │             │
  ┌─────▼────┐   ┌──────▼─────┐   ┌───────▼──────┐   ┌──────▼─────┐  ┌─────▼─────┐ ┌────▼─────┐
  │  Auth    │   │  Student   │   │    Staff     │   │  Academic  │  │    Fee    │ │Communica-│
  │ Service  │   │  Service   │   │   Service    │   │  Service   │  │  Service  │ │tion Svc  │
  │  :5001   │   │   :5002    │   │    :5003     │   │   :5004    │  │   :5005   │ │  :5006   │
  └─────┬────┘   └──────┬─────┘   └───────┬──────┘   └──────┬─────┘  └─────┬─────┘ └────┬─────┘
        │               │                 │                 │              │            │
   ┌────▼────┐    ┌─────▼────┐     ┌──────▼─────┐    ┌──────▼─────┐  ┌─────▼────┐ ┌─────▼────┐
   │erp_auth │    │erp_student│    │ erp_staff  │    │erp_academic│  │ erp_fee  │ │erp_comm  │
   └─────────┘    └──────────┘     └────────────┘    └────────────┘  └──────────┘ └──────────┘

        ┌───────────────┐        ┌────────────────┐
        │Library Service │       │Facility Service │  (Hostel + Transport/Bus + Inventory)
        │     :5007      │       │      :5008       │
        └───────┬────────┘       └────────┬─────────┘
           erp_library                erp_facility
```

Each service is a **separate Node app, own package.json, own Dockerfile, own MongoDB database** — you can scale, redeploy, or replace any one of them without touching the others (true microservices, not a monolith split into folders).

| Service                 | Responsibility                                                              | Port |
| ----------------------- | --------------------------------------------------------------------------- | ---- |
| `api-gateway`           | Single entry point, proxies requests, rate limiting, security headers       | 5000 |
| `auth-service`          | Register/login, JWT issuing, role management (admin/teacher/student/parent) | 5001 |
| `student-service`       | Student records, admission enquiries                                        | 5002 |
| `staff-service`         | Teacher/staff records, leave management, payroll                            | 5003 |
| `academic-service`      | Timetable, attendance, homework, exams, marks/report card                   | 5004 |
| `fee-service`           | Fee structure, invoices, payments (online/offline)                          | 5005 |
| `communication-service` | Notices, events/circulars                                                   | 5006 |
| `library-service`       | Books catalogue, issue/return tracking                                      | 5007 |
| `facility-service`      | Hostel allotment, bus/transport routes, inventory                           | 5008 |

### Why microservices here

- **Independent scaling** — e.g. spin up 3 replicas of `academic-service` during exam/report-card season without touching others.
- **Independent DB per service** — no shared schema, no accidental coupling.
- **Fault isolation** — if `library-service` goes down, fee payments and attendance keep working.
- **Independent deploys** — ship a fix to `fee-service` without redeploying the whole backend.

## 2. Role-Based Access Control (RBAC)

Every request carries a JWT (issued by `auth-service`) containing `{ id, role, refId, linkedStudentIds }`. Each service verifies the token locally (shared `JWT_SECRET`) and enforces access with `authorizeRoles(...)` middleware, plus extra ownership checks:

| Role        | Access pattern                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------------- |
| **admin**   | Full CRUD on every module                                                                                      |
| **teacher** | Manage attendance/homework/marks for their classes, view own staff profile, apply leave, view students/notices |
| **student** | Read-only access to **own** record: attendance, homework, timetable, exams/marks, fee invoices, notices        |
| **parent**  | Same as student but scoped to `linkedStudentIds` (can view multiple children)                                  |

Ownership is enforced server-side (e.g. a student token can never fetch another student's `studentId` — the middleware rejects it), not just hidden in the UI.

## 3. Local Setup (without Docker)

```bash
# 1. copy env
cp .env.example .env
# edit .env if needed (JWT_SECRET must be the SAME value used by every service, and at least 32 characters — services fail to start otherwise)

# 2. install deps for every service
npm run install:all

# 3. make sure MongoDB is running locally on 27017
mongod

# 4. start everything with one command (loads root .env, passes env to all services)
npm run dev:all
```

> **Note:** MongoDB URIs live in the root `.env` as one variable per service
> (`AUTH_MONGODB_URI`, `STUDENT_MONGODB_URI`, ...). Each service reads **only its own**
> variable, e.g. `process.env.AUTH_MONGODB_URI`. Fill in the same values in `.env.example`
> as you do in `.env` — the template is committed, `.env` is gitignored.

> **Security:** never commit a real MongoDB URI (especially an Atlas SRV string with
> username/password) to this README or any other repo file. Use `mongodb://localhost:27017/<db>`
> in documentation.

## 4. Run the full stack with Docker Compose

From `Backend-server`, create `.env` only if it does not already exist. Preserve
existing environment files, then configure a 32-character-or-longer `JWT_SECRET`,
the Docker MongoDB root password, and any required integration credentials:

```powershell
Copy-Item .env.example .env  # only if .env does not already exist
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
foreach ($name in 'JWT_SECRET', 'MONGO_INITDB_ROOT_PASSWORD', 'MONGO_APP_PASSWORD') {
  $bytes = New-Object byte[] 32
  $rng.GetBytes($bytes)
  "$name=$([BitConverter]::ToString($bytes).Replace('-', '').ToLowerInvariant())"
}
$rng.Dispose()
```

Put each generated value in its matching variable in `.env`. The MongoDB root
and application accounts are created only when the data volume is first
initialized. The application account is limited to read/write access on ERP
databases; root credentials are only passed to MongoDB. Keep `.env` private and
never commit it.

For local development, set `PAYMENT_PROVIDER_ENABLED=false` unless a real
payment provider and its webhook secret are configured. Production refuses to
start the fee service when provider payments are enabled with an invalid secret.

Build and start the frontend, authenticated MongoDB, API gateway, and all
microservices:

```powershell
docker compose up --build -d
docker compose ps
```

Open `http://localhost:8080`. The frontend container proxies `/api` and
`/socket.io` to the internal gateway. Only the frontend is published to the
host; MongoDB and backend service ports stay on the private Compose network.
The frontend binds to `127.0.0.1` by default so a host-based TLS reverse proxy
can securely expose it. Set `FRONTEND_BIND_ADDRESS` only when your deployment
requires a different bind address, and restrict access with a firewall.

```powershell
docker compose logs -f
docker compose down              # stop containers; preserve MongoDB data
```

MongoDB persists in the `mongo_data` volume. Existing volumes created before
MongoDB authentication was enabled need an administrator to provision the
configured account before the services can use them; do not remove the volume
to work around an authentication error.

For production, set `CORS_ORIGIN` and `DOCKER_FRONTEND_URL` to the exact public
HTTPS origin, protect `.env` with host-level access controls or a secrets
manager, and terminate TLS at a reverse proxy. Take regular backups of
`mongo_data` and test restoring them before handling production data.

## 5. Quick Test Flow

```bash
# 1. Register an admin
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Super Admin","email":"admin@school.com","password":"Admin@123","role":"admin"}'

# 2. Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.com","password":"Admin@123"}'
# -> copy accessToken from response

# 3. Create a student (use the accessToken as Bearer token)
curl -X POST http://localhost:5000/api/students \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"admissionNo":"ADM1001","name":"Aarav Sharma","class":"Class 8","section":"A","rollNo":"12"}'
```

## 6. API Reference (via Gateway — `http://localhost:5000`)

### Auth (`/api/auth`)

| Method | Endpoint            | Role                                     |
| ------ | ------------------- | ---------------------------------------- |
| POST   | `/register`         | public (gate behind admin in production) |
| POST   | `/login`            | public                                   |
| POST   | `/refresh-token`    | public                                   |
| GET    | `/me`               | any authenticated                        |
| POST   | `/change-password`  | any authenticated                        |
| GET    | `/users?role=`      | admin                                    |
| PATCH  | `/users/:id/status` | admin                                    |
| DELETE | `/users/:id`        | admin                                    |

### Students (`/api/students`, `/api/admissions`)

| Method              | Endpoint                                | Role                               |
| ------------------- | --------------------------------------- | ---------------------------------- |
| POST                | `/api/students`                         | admin                              |
| GET                 | `/api/students?class=&section=&search=` | all (scoped for student/parent)    |
| GET                 | `/api/students/stats/summary`           | admin, teacher                     |
| GET                 | `/api/students/:id`                     | admin, teacher, own student/parent |
| PUT                 | `/api/students/:id`                     | admin                              |
| DELETE              | `/api/students/:id`                     | admin                              |
| POST/GET/PUT/DELETE | `/api/admissions`                       | admin, teacher                     |

### Staff (`/api/staff`, `/api/leaves`, `/api/payroll`)

| Method     | Endpoint                 | Role                        |
| ---------- | ------------------------ | --------------------------- |
| POST       | `/api/staff`             | admin                       |
| GET        | `/api/staff`             | admin, teacher (own record) |
| PUT/DELETE | `/api/staff/:id`         | admin                       |
| POST       | `/api/leaves`            | teacher, admin              |
| GET        | `/api/leaves`            | admin, teacher (own)        |
| PATCH      | `/api/leaves/:id/status` | admin                       |
| POST       | `/api/payroll`           | admin                       |
| GET        | `/api/payroll`           | admin, teacher (own)        |
| PATCH      | `/api/payroll/:id/pay`   | admin                       |

### Academic (`/api/timetable`, `/api/attendance`, `/api/homework`, `/api/exams`, `/api/marks`)

| Method              | Endpoint                                      | Role                          |
| ------------------- | --------------------------------------------- | ----------------------------- |
| POST                | `/api/timetable`                              | admin                         |
| GET                 | `/api/timetable?class=&section=`              | all                           |
| POST                | `/api/attendance/mark`                        | teacher, admin                |
| GET                 | `/api/attendance?studentId=&class=&from=&to=` | all (scoped)                  |
| POST/GET/PUT/DELETE | `/api/homework`                               | teacher/admin write, all read |
| POST                | `/api/exams`                                  | admin                         |
| GET                 | `/api/exams`                                  | all                           |
| POST                | `/api/marks`                                  | teacher, admin                |
| GET                 | `/api/marks/report-card?studentId=&examName=` | all (scoped)                  |

### Fees (`/api/fees`, `/api/fees/structure`, `/api/payments`)

| Method          | Endpoint                       | Role                        |
| --------------- | ------------------------------ | --------------------------- |
| POST/GET/DELETE | `/api/fees/structure`          | admin write, all read       |
| POST            | `/api/fees` (create invoice)   | admin                       |
| GET             | `/api/fees?studentId=&status=` | admin, student/parent (own) |
| POST            | `/api/payments`                | admin, student/parent       |
| GET             | `/api/payments?studentId=`     | admin, student/parent (own) |

### Communication (`/api/notices`, `/api/events`)

| Method      | Endpoint       | Role                       |
| ----------- | -------------- | -------------------------- |
| POST/DELETE | `/api/notices` | admin, teacher             |
| GET         | `/api/notices` | all (filtered by audience) |
| POST/DELETE | `/api/events`  | admin, teacher             |
| GET         | `/api/events`  | all (filtered by audience) |

### Library (`/api/library/books`, `/api/library/issues`)

| Method          | Endpoint                          | Role  |
| --------------- | --------------------------------- | ----- |
| POST/PUT/DELETE | `/api/library/books`              | admin |
| GET             | `/api/library/books?search=`      | all   |
| POST            | `/api/library/issues/issue`       | admin |
| PATCH           | `/api/library/issues/:id/return`  | admin |
| GET             | `/api/library/issues?borrowerId=` | all   |

### Facility (`/api/hostel`, `/api/transport`, `/api/inventory`)

| Method              | Endpoint                      | Role           |
| ------------------- | ----------------------------- | -------------- |
| POST                | `/api/hostel`                 | admin          |
| GET                 | `/api/hostel?studentId=`      | all            |
| PATCH               | `/api/hostel/:id/allot`       | admin          |
| POST                | `/api/transport`              | admin          |
| GET                 | `/api/transport?studentId=`   | all            |
| PATCH               | `/api/transport/:id/location` | admin, teacher |
| PATCH               | `/api/transport/:id/assign`   | admin          |
| POST/PUT/DELETE/GET | `/api/inventory`              | admin only     |

## 7. Connecting Your Existing Frontend

In `Frontend-Admin-panel`, replace the local-storage-driven data hooks (`src/data/*.js`, `useLocalStorage.js`) with API calls to `http://localhost:5000/api/...`, sending the JWT from login in the `Authorization: Bearer <token>` header. Since the gateway exposes a single base URL, you only need to change one `BASE_URL` constant.

## 8. Production Hardening Checklist (next steps)

- Put `JWT_SECRET`, Mongo URIs, and payment gateway keys in a secrets manager (not `.env` in git).
- Add an **event bus** (RabbitMQ/Kafka) for async workflows — e.g. fee payment → auto notification via `communication-service`.
- Add per-service Kubernetes deployment + HPA (Horizontal Pod Autoscaler) for true elastic scaling.
- Add centralized logging (ELK) and tracing (OpenTelemetry) across services.
- Add API Gateway-level JWT pre-validation to reject bad tokens before they hit downstream services.
- Replace `register` open endpoint with admin-only staff/student/parent account provisioning flow.
- Integrate real payment gateway (Razorpay/Stripe) in `fee-service` instead of the current manual "record payment" flow.
