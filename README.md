# ChemDiag AI
### Explainable AI-Based Fault Diagnosis and Root-Cause Analysis for Chemical Processes

> **"Don't just detect the fault — explain why it happened and what the operator should do."**

---

## 1. Project Overview & Problem Statement

In continuous chemical and process industries (petrochemical plants, pharmaceutical synthesis, water treatment facilities), unpredicted equipment failures and process excursions cost billions in downtime, product degradation, and safety hazards. Traditional SCADA and DCS systems trigger threshold-based alarms, resulting in "alarm flooding" where operators are bombarded with hundreds of blinking alerts without understanding the true underlying root cause or immediate mitigation steps.

**ChemDiag AI** solves this critical gap by bridging physical IoT edge telemetry with unsupervised and supervised machine learning and deterministic first-principles chemical engineering rules. It delivers an end-to-end explainable diagnosis chain:

$$\text{ANOMALY} \longrightarrow \text{FAULT} \longrightarrow \text{ROOT CAUSE} \longrightarrow \text{IMPORTANT VARIABLES} \longrightarrow \text{SEVERITY} \longrightarrow \text{CONFIDENCE} \longrightarrow \text{RECOMMENDED ACTION}$$

---

## 2. Core USP (Explainability Chain)

ChemDiag AI does not stop at flagging an anomaly. Every diagnostic event explains:
1. **Anomaly Status & Anomaly Score**: Computed via multi-dimensional Isolation Trees.
2. **Fault Classification**: Categorized via an ensemble Random Forest classifier.
3. **Probable Root Cause**: Derived using chemical engineering process heuristics.
4. **Important Variables**: Directional indicators showing which variables drifted (`Vibration ↑`, `RPM ↓`, `Cooling Status OFF`).
5. **Severity**: Standardized scale (`NORMAL`, `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`).
6. **AI Confidence**: Ensemble voting percentage (e.g. 87%).
7. **Recommended Operator Action**: Actionable instructions telling the technician or operator what to check immediately.

---

## 3. System Architecture

```text
┌────────────────────────────────────────────────────────┐
│                   PHYSICAL HARDWARE                    │
│  ESP32 DevKit (GPIO 4, 5, 21, 22, 18)                  │
│  • DS18B20 Inlet Temp   • DS18B20 Outlet Temp          │
│  • MPU6050 Vibration    • IR RPM Pulse Sensor          │
└───────────────────────────┬────────────────────────────┘
                            │ HTTP POST /api/sensors (JSON, 1 Hz)
                            ▼
┌────────────────────────────────────────────────────────┐
│            NODE.JS + EXPRESS BACKEND (:8000)           │
│                                                        │
│  ┌─────────────────┐    ┌───────────────────────────┐  │
│  │ REST Endpoints  │    │ Continuous Simulators     │  │
│  │ /api/sensors    │    │ • Reactor CSTR Model      │  │
│  │ /api/equipment  │    │ • Distillation Column     │  │
│  │ /api/diagnosis  │    │ • Fallback Demo Hardware  │  │
│  │ /api/demo/fault │    └─────────────┬─────────────┘  │
│  │ /api/alerts     │                  │                │
│  └────────┬────────┘                  │                │
│           │                           │                │
│           ▼                           ▼                │
│  ┌──────────────────────────────────────────────────┐  │
│  │ AI & EXPLAINABILITY PIPELINE                     │  │
│  │ 1. Isolation Forest (Multivariate Anomaly Score) │  │
│  │ 2. Random Forest (Fault Classification)          │  │
│  │ 3. Engineering Root-Cause Heuristic Engine       │  │
│  │ 4. Severity & Directional Variable Evaluation    │  │
│  └──────────────────────┬───────────────────────────┘  │
│                         │                              │
│           ┌─────────────┴─────────────┐                │
│           ▼                           ▼                │
│  ┌─────────────────┐       ┌────────────────────────┐  │
│  │ SQLite Database │       │ WebSocket Server (/ws) │  │
│  │ chemdiag.db     │       │ Broadcasts 1 Hz state  │  │
│  └─────────────────┘       └──────────┬─────────────┘  │
└───────────────────────────────────────┼────────────────┘
                                        │ WebSocket / Polling
                                        ▼
┌────────────────────────────────────────────────────────┐
│          REACT + TYPESCRIPT + VITE DASHBOARD           │
│  • Dark industrial aesthetic with high contrast        │
│  • Strict badges: REAL DATA vs SIMULATED DATA          │
│  • 4 Equipment Cards (Pump, Exchanger, Reactor, Dist.) │
│  • Core USP: AI Diagnosis Hero Banner                  │
│  • Interactive DEMO MODE fault injection bar           │
│  • Live Recharts time-series rolling trends            │
│  • Active alerts log with severity badges              │
│  • Clear educational safety disclaimer                 │
└────────────────────────────────────────────────────────┘
```

---

## 4. Real vs. Simulated Data Transparency

Transparency is a fundamental tenet of ChemDiag AI:

| Equipment | When ESP32 Connected | When ESP32 Offline |
| :--- | :--- | :--- |
| **Pump** | <span style="color:#10b981;font-weight:bold;">REAL DATA</span> | <span style="color:#f59e0b;font-weight:bold;">DEMO / SIMULATED</span> |
| **Heat Exchanger** | <span style="color:#10b981;font-weight:bold;">REAL DATA</span> | <span style="color:#f59e0b;font-weight:bold;">DEMO / SIMULATED</span> |
| **Reactor** | <span style="color:#818cf8;font-weight:bold;">SIMULATED DATA</span> | <span style="color:#818cf8;font-weight:bold;">SIMULATED DATA</span> |
| **Distillation Column** | <span style="color:#818cf8;font-weight:bold;">SIMULATED DATA</span> | <span style="color:#818cf8;font-weight:bold;">SIMULATED DATA</span> |

- If the ESP32 disconnects or is powered off, the dashboard displays:
  `ESP32 OFFLINE: Waiting for real ESP32 sensor data`
- The system gracefully falls back to synthetic pump/exchanger values without crashing or interrupting the continuous Reactor and Distillation simulations.

---

## 5. Hardware Specifications & Sensor Wiring

The physical prototype uses low-voltage DC components powered independently from an external bench supply or battery pack:

| Sensor / Unit | ESP32 Pin | Interface | Notes |
| :--- | :--- | :--- | :--- |
| **DS18B20 (Inlet Temp)** | **GPIO 4** | 1-Wire Digital | Requires 4.7kΩ pull-up resistor to 3.3V |
| **DS18B20 (Outlet Temp)**| **GPIO 5** | 1-Wire Digital | Requires 4.7kΩ pull-up resistor to 3.3V |
| **MPU6050 (Vibration)**  | **SDA: GPIO 21**<br>**SCL: GPIO 22** | I2C Bus | 3.3V power, measures 3-axis dynamic acceleration |
| **IR RPM Sensor**        | **GPIO 18** | Digital Interrupt | Hardware interrupt on `FALLING` edge |
| **6V Mini Water Pump**   | *External Power* | 6V DC Supply | **NEVER** drive pump motor directly from ESP32 GPIO |

---

## 6. Software Stack

- **Backend**: Node.js, Express, WebSocket (`ws`), SQLite (`sqlite3`), dotenv, cors.
- **AI / ML**: Pure JavaScript implementation of:
  - **Isolation Forest** (Liu, Ting & Zhou 2008) for multivariate anomaly scoring.
  - **Random Forest Classifier** with bootstrap aggregation and Gini impurity criterion.
  - **Deterministic Chemical Engineering Rule Engine**.
- **Frontend**: React 18, TypeScript, Vite, Recharts, Lucide React, Custom Dark Industrial CSS.
- **Firmware**: Arduino C/C++ (`chemdiag_esp32.ino`) with `WiFi.h`, `HTTPClient.h`, `OneWire.h`, `DallasTemperature.h`, `Adafruit_MPU6050.h`, and `ArduinoJson.h`.

---

## 7. Quickstart & Installation

### Prerequisites
- Node.js (v18.x or later)
- npm (v9.x or later)
- Arduino IDE (optional, for flashing ESP32)

### Step 1: Install Dependencies
Open a terminal in the project root:

```bash
# Setup both backend and frontend dependencies
npm run setup
```

### Step 2: One-Command Start (Backend + Frontend + Browser)
In the project root folder:
```bash
npm run dev
```
This automatically starts:
- **Backend API & WebSocket Server** on `http://localhost:8000`
- **Frontend Vite Dashboard** on `http://localhost:5173`
- And automatically launches **`http://localhost:5173`** in your default web browser!

---

### Alternative: Running Separately
If you prefer separate terminal windows:
- **Terminal 1 (Backend)**:
  ```bash
  npm run dev:backend
  ```
- **Terminal 2 (Frontend)**:
  ```bash
  npm run dev:frontend
  ```

---

## 8. ESP32 Setup & Flashing Instructions

1. Open `esp32/chemdiag_esp32.ino` in the Arduino IDE.
2. In the Arduino Library Manager (`Ctrl+Shift+I` / `Cmd+Shift+I`), install:
   - `OneWire` (by Jim Studt / Paul Stoffregen)
   - `DallasTemperature` (by Miles Burton)
   - `Adafruit MPU6050` and `Adafruit Unified Sensor`
   - `ArduinoJson` (v6 or v7)
3. Update network credentials in `chemdiag_esp32.ino`:
   ```cpp
   const char* WIFI_SSID     = "Your_WiFi_Network";
   const char* WIFI_PASSWORD = "Your_WiFi_Password";
   const char* BACKEND_URL   = "http://YOUR_LAPTOP_IP:8000/api/sensors";
   ```
4. Connect ESP32 DevKit via micro-USB, select `Board: ESP32 Dev Module` and the correct COM Port.
5. Click **Upload**. Open Serial Monitor at **115200 baud** to observe Wi-Fi connection and sensor telemetry transmission.
6. When packets reach the backend, the dashboard badges for Pump and Heat Exchanger will automatically switch to **REAL DATA**.

---

## 9. REST API & WebSocket Specifications

### Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/sensors` | Ingests ESP32 sensor telemetry (`inlet_temperature`, `outlet_temperature`, `vibration`, `rpm`) |
| `GET` | `/api/equipment` | Returns telemetry & operational status for all 4 equipment units |
| `GET` | `/api/equipment/:id` | Returns recent telemetry history for a specific unit |
| `GET` | `/api/diagnosis` | Returns latest explainable AI diagnosis object |
| `GET` | `/api/alerts` | Returns recent system alerts ordered by timestamp descending |
| `GET` | `/api/history` | Rolling telemetry log for charts |
| `POST` | `/api/demo/fault` | Injects fault mode (`normal`, `pump_fault`, `heat_exchanger_fault`, `reactor_cooling_failure`, `distillation_fault`) |
| `GET` | `/api/status` | System health, ESP32 status, and active mode |

### WebSocket Protocol (`ws://localhost:8000/ws`)
Broadcasts a unified JSON packet every second (`1 Hz`):
```json
{
  "type": "PROCESS_UPDATE",
  "timestamp": "2026-09-06T16:00:00.000Z",
  "active_fault_mode": "reactor_cooling_failure",
  "esp32_status": { "connected": false, "status": "ESP32 OFFLINE", "message": "..." },
  "equipment": { "pump": {...}, "heat_exchanger": {...}, "reactor": {...}, "distillation": {...} },
  "diagnosis": {
    "equipment": "Reactor",
    "anomaly": true,
    "fault": "reactor_cooling_failure",
    "probable_fault": "Reactor Cooling Failure",
    "root_cause": "Cooling-system failure",
    "severity": "CRITICAL",
    "confidence": 0.91,
    "important_variables": ["Cooling Status OFF", "Temperature ↑ (92.5°C)", "Pressure ↑ (3.82 bar)"],
    "recommended_action": "Check cooling-water circulation and heat-removal system immediately. Prepare emergency quench.",
    "timestamp": "..."
  }
}
```

---

## 10. Demo Fault Scenarios

The **DEMO MODE** bar allows judges and evaluators to inject faults and verify the AI explainability pipeline:

### Scenario 1: `NORMAL`
- Process values operate within nominal limits.
- AI Diagnosis: `SYSTEM NORMAL — No significant anomaly detected.`
- Severity: `NORMAL`

### Scenario 2: `PUMP FAULT`
- Casing vibration rises to $\approx 0.48\text{ g}$, motor speed drops to $\approx 1750\text{ RPM}$.
- AI Diagnosis: `Abnormal vibration`
- Probable Root Cause: `Possible bearing wear / mechanical imbalance`
- Important Variables: `Vibration ↑`, `RPM ↓`
- Severity: `HIGH`
- Action: *Inspect pump alignment and mechanical condition.*

### Scenario 3: `HEAT EXCHANGER FAULT`
- Outlet temperature fails to cool; $\Delta T$ collapses below $2.0^\circ\text{C}$.
- AI Diagnosis: `Reduced heat-transfer performance`
- Probable Root Cause: `Possible heat-transfer degradation / fouling`
- Important Variables: `Temperature Difference ↓`, `Heat Transfer Indicator ↓`
- Severity: `MEDIUM` (or `HIGH` if prolonged)
- Action: *Inspect heat exchanger tubes for fouling, verify cooling water flow rate.*

### Scenario 4: `REACTOR COOLING FAILURE` (Judge Favorite)
- Cooling status trips to `OFF (0)`.
- Reaction temperature escalates rapidly from $65^\circ\text{C} \rightarrow 98^\circ\text{C}+$.
- Vapor pressure climbs to $> 4.0\text{ bar}$.
- AI Diagnosis: `Reactor Cooling Failure / Thermal Runaway Risk`
- Probable Root Cause: `Cooling-system failure`
- Important Variables: `Cooling Status OFF`, `Temperature ↑`, `Pressure ↑`
- Severity: `CRITICAL`
- Action: *Check cooling-water circulation and heat-removal system immediately. Prepare emergency quench.*

### Scenario 5: `DISTILLATION FAULT`
- Reflux ratio collapses from $2.2 \rightarrow 0.65$.
- Top tray vapor temperature jumps from $64^\circ\text{C} \rightarrow 82^\circ\text{C}$.
- AI Diagnosis: `Reflux separation problem`
- Probable Root Cause: `Reflux problem`
- Important Variables: `Reflux Ratio ↓`, `Top Temperature ↑`
- Severity: `HIGH`
- Action: *Verify reflux pump discharge and increase distillate return flow.*

---

## 11. Safety Disclaimer

> **ChemDiag AI is a student prototype developed for demonstration, hackathon presentation, and educational purposes. It is not a certified industrial safety, control, or process protection system.**
> All physical hardware integration is limited to low-voltage (6V DC) ambient water demonstrator circuits without mains voltage switching or hazardous chemicals.
