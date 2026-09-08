/**
 * ChemDiag AI — ESP32 Sensor Ingestion Firmware
 * 
 * Target Board: ESP32 30-pin DevKit v1
 * 
 * Hardware Pin Connections:
 * - DS18B20 Inlet Sensor:       GPIO 4  (Requires 4.7kΩ pull-up resistor to 3.3V)
 * - DS18B20 Outlet Sensor:      GPIO 5  (Requires 4.7kΩ pull-up resistor to 3.3V)
 * - MPU6050 Accelerometer:      SDA -> GPIO 21, SCL -> GPIO 22 (I2C Bus, 3.3V & GND)
 * - IR RPM Sensor Pulse:        GPIO 18 (Digital input with hardware interrupt)
 * 
 * SAFETY NOTICE:
 * The 6V mini water pump is powered externally (e.g. from a 6V DC supply or battery).
 * DO NOT power or switch inductive motor loads directly from ESP32 GPIO pins!
 * 
 * Required Arduino Libraries (Install via Arduino Library Manager):
 * - OneWire by Jim Studt, Paul Stoffregen
 * - DallasTemperature by Miles Burton
 * - Adafruit MPU6050 + Adafruit Unified Sensor
 * - ArduinoJson by Benoit Blanchon (v6 or v7)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <ArduinoJson.h>

// =========================================================================
// NETWORK CONFIGURATION (Configure for your local Wi-Fi & Laptop IP)
// =========================================================================
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Replace with your laptop's local LAN IP (e.g., "http://192.168.1.105:8000/api/sensors")
const char* BACKEND_URL   = "http://192.168.1.100:8000/api/sensors";

// =========================================================================
// PIN DEFINITIONS
// =========================================================================
#define PIN_DS18B20_INLET   4
#define PIN_DS18B20_OUTLET  5
#define PIN_MPU6050_SDA    21
#define PIN_MPU6050_SCL    22
#define PIN_IR_RPM         18

// =========================================================================
// GLOBAL HARDWARE HANDLERS
// =========================================================================
OneWire oneWireInlet(PIN_DS18B20_INLET);
OneWire oneWireOutlet(PIN_DS18B20_OUTLET);
DallasTemperature sensorInlet(&oneWireInlet);
DallasTemperature sensorOutlet(&oneWireOutlet);

Adafruit_MPU6050 mpu;
bool mpuAvailable = false;

// RPM Calculation Variables
volatile unsigned long pulseCount = 0;
unsigned long lastRpmCalcTime = 0;
float currentRpm = 0.0;

// Pulse interrupt service routine (ISR)
void IRAM_ATTR onIrPulse() {
  pulseCount++;
}

// Timing loop
unsigned long lastTransmissionTime = 0;
const unsigned long TRANSMISSION_INTERVAL_MS = 1000; // 1-second transmission rate

// =========================================================================
// SETUP
// =========================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=======================================================");
  Serial.println("   CHEMDIAG AI — ESP32 INDUSTRIAL SENSOR TELEMETRY     ");
  Serial.println("=======================================================");

  // 1. Initialize IR RPM interrupt pin
  pinMode(PIN_IR_RPM, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PIN_IR_RPM), onIrPulse, FALLING);
  Serial.printf("[INIT] IR RPM Sensor configured on GPIO %d (Interrupt FALLING)\n", PIN_IR_RPM);

  // 2. Initialize DS18B20 Temperature Sensors
  sensorInlet.begin();
  sensorOutlet.begin();
  sensorInlet.setResolution(10);  // 10-bit resolution (~0.25°C step, 187ms conversion)
  sensorOutlet.setResolution(10);
  Serial.printf("[INIT] DS18B20 Inlet on GPIO %d, Outlet on GPIO %d\n", PIN_DS18B20_INLET, PIN_DS18B20_OUTLET);

  // 3. Initialize MPU6050 Vibration Sensor
  Wire.begin(PIN_MPU6050_SDA, PIN_MPU6050_SCL);
  if (mpu.begin()) {
    mpuAvailable = true;
    mpu.setAccelerometerRange(MPU6050_RANGE_4_G);
    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);
    Serial.printf("[INIT] MPU6050 ready on I2C (SDA=%d, SCL=%d)\n", PIN_MPU6050_SDA, PIN_MPU6050_SCL);
  } else {
    Serial.println("[WARN] MPU6050 not detected. Defaulting to baseline vibration readings.");
  }

  // 4. Connect to Wi-Fi
  connectToWiFi();
}

// =========================================================================
// MAIN LOOP
// =========================================================================
void loop() {
  // Check Wi-Fi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }

  unsigned long currentMillis = millis();

  // Transmit telemetry every 1 second
  if (currentMillis - lastTransmissionTime >= TRANSMISSION_INTERVAL_MS) {
    lastTransmissionTime = currentMillis;

    // 1. Calculate RPM
    unsigned long pulses;
    noInterrupts();
    pulses = pulseCount;
    pulseCount = 0;
    interrupts();

    // Pulses per second * 60 = RPM (assumes 1 pulse / reflector pass per revolution)
    currentRpm = (pulses * 60.0);

    // 2. Read DS18B20 Temperatures
    sensorInlet.requestTemperatures();
    sensorOutlet.requestTemperatures();
    float tempIn = sensorInlet.getTempCByIndex(0);
    float tempOut = sensorOutlet.getTempCByIndex(0);

    // Handle sensor disconnection fallback (-127°C is Dallas disconnected code)
    if (tempIn <= -50.0 || tempIn >= 85.0 && tempIn == 85.0) tempIn = 25.4;
    if (tempOut <= -50.0 || tempOut >= 85.0 && tempOut == 85.0) tempOut = 36.8;

    // 3. Read MPU6050 Acceleration & Compute Vibration Index
    float vibrationG = 0.08; // nominal baseline
    if (mpuAvailable) {
      sensors_event_t a, g, temp;
      mpu.getEvent(&a, &g, &temp);

      // Convert m/s^2 to G (1 G = 9.80665 m/s^2)
      // Dynamic vibration magnitude = sqrt((ax)^2 + (ay)^2 + (az - 9.8)^2) / 9.8
      float dynamicZ = a.acceleration.z - 9.80665;
      float mag = sqrt(a.acceleration.x * a.acceleration.x +
                       a.acceleration.y * a.acceleration.y +
                       dynamicZ * dynamicZ);
      vibrationG = mag / 9.80665;
      if (vibrationG < 0.02) vibrationG = 0.05;
    }

    // Print diagnostics to Serial Monitor
    Serial.println("--------------------------------------------------");
    Serial.printf("[SENSORS] Inlet: %.1f °C | Outlet: %.1f °C | ΔT: %.1f °C\n", tempIn, tempOut, (tempOut - tempIn));
    Serial.printf("[SENSORS] Vibration: %.3f G | RPM: %.0f\n", vibrationG, currentRpm);

    // 4. Send JSON to ChemDiag Backend
    sendTelemetry(tempIn, tempOut, vibrationG, currentRpm);
  }
}

// =========================================================================
// WI-FI CONNECTION HANDLER
// =========================================================================
void connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[WIFI] Connecting to SSID: %s ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 15) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected successfully!");
    Serial.printf("[WIFI] IP Address: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WIFI] Connection pending / failed. Will retry next cycle.");
  }
}

// =========================================================================
// HTTP POST TRANSMISSION HANDLER
// =========================================================================
void sendTelemetry(float tempIn, float tempOut, float vibration, float rpm) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Cannot transmit: Wi-Fi disconnected");
    return;
  }

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");

  // Construct JSON payload
  StaticJsonDocument<256> doc;
  doc["source"] = "real";
  doc["unit"] = "pump";
  doc["timestamp"] = String(millis());
  doc["inlet_temperature"] = serialized(String(tempIn, 1));
  doc["outlet_temperature"] = serialized(String(tempOut, 1));
  doc["vibration"] = serialized(String(vibration, 3));
  doc["rpm"] = serialized(String(rpm, 0));

  String requestBody;
  serializeJson(doc, requestBody);

  int httpResponseCode = http.POST(requestBody);

  if (httpResponseCode > 0) {
    Serial.printf("[HTTP] POST %s -> Code %d\n", BACKEND_URL, httpResponseCode);
  } else {
    Serial.printf("[HTTP] POST failed, error: %s (Check if backend server is running)\n", http.errorToString(httpResponseCode).c_str());
  }

  http.end();
}
