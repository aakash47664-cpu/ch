/**
 * ChemDiag AI — ESP32 Real Sensor Ingestion Firmware
 * 
 * Hardware Target: ESP32 DevKit (30-pin or 38-pin)
 * Sensor: DS18B20 Digital Temperature Sensor (E-101 Heat Exchanger Outlet Temperature)
 * 
 * =========================================================================
 * WIRING DIAGRAM (DS18B20 to ESP32):
 * =========================================================================
 *  DS18B20 VCC (Red wire)   -----> ESP32 3.3V (or 5V)
 *  DS18B20 GND (Black wire) -----> ESP32 GND
 *  DS18B20 DQ  (Yellow wire) ----> ESP32 GPIO 4
 *  
 *  CRITICAL: Place a 4.7kΩ pull-up resistor between GPIO 4 (DQ) and 3.3V (VCC).
 * 
 * =========================================================================
 * REQUIRED ARDUINO LIBRARIES:
 * =========================================================================
 * Install via Arduino IDE Library Manager:
 * 1. OneWire (by Jim Studt, Paul Stoffregen)
 * 2. DallasTemperature (by Miles Burton)
 * 3. ArduinoJson (by Benoit Blanchon, v6 or v7)
 * 
 * =========================================================================
 * TELEMETRY PAYLOAD:
 * =========================================================================
 * POST http://<LAPTOP_IP>:8000/api/sensors
 * Content-Type: application/json
 * {
 *   "source": "real",
 *   "unit": "heat_exchanger",
 *   "outlet_temperature": 36.8
 * }
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ArduinoJson.h>

// =========================================================================
// 1. NETWORK & BACKEND CONFIGURATION
// =========================================================================
// Replace with your local Wi-Fi network credentials:
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Replace with your development machine's local LAN IP address:
// Example: "http://192.168.1.105:8000/api/sensors"
const char* BACKEND_URL   = "http://192.168.1.100:8000/api/sensors";

// =========================================================================
// 2. HARDWARE PIN DEFINITIONS
// =========================================================================
#define PIN_DS18B20_OUTLET 4   // DS18B20 1-Wire Data line connected to GPIO 4

// =========================================================================
// 3. GLOBAL SENSOR & TIMING INSTANCES
// =========================================================================
OneWire oneWire(PIN_DS18B20_OUTLET);
DallasTemperature dallasSensor(&oneWire);

unsigned long lastTransmissionTime = 0;
const unsigned long TRANSMISSION_INTERVAL_MS = 1000; // Transmit telemetry every 1 second (1000ms)
int consecutiveErrors = 0;

// Forward Declarations
void connectToWiFi();
void sendSensorData(float outletTemp);

// =========================================================================
// 4. SETUP
// =========================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n=======================================================");
  Serial.println("  CHEMDIAG AI — ESP32 E-101 OUTLET TEMPERATURE SENSOR  ");
  Serial.println("=======================================================");
  Serial.printf("[SETUP] Initializing DS18B20 on GPIO %d...\n", PIN_DS18B20_OUTLET);

  // Initialize OneWire & DS18B20
  dallasSensor.begin();
  int deviceCount = dallasSensor.getDeviceCount();
  Serial.printf("[SETUP] Found %d OneWire device(s) on GPIO %d\n", deviceCount, PIN_DS18B20_OUTLET);

  // Set 10-bit resolution (~0.25°C precision, 187.5ms conversion time)
  dallasSensor.setResolution(10);
  dallasSensor.setWaitForConversion(true);

  // Connect to Local Wi-Fi
  connectToWiFi();

  Serial.println("[SETUP] Initialization complete. Starting telemetry loop...\n");
}

// =========================================================================
// 5. MAIN LOOP
// =========================================================================
void loop() {
  // Ensure Wi-Fi remains connected
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi();
  }

  unsigned long currentMillis = millis();

  if (currentMillis - lastTransmissionTime >= TRANSMISSION_INTERVAL_MS) {
    lastTransmissionTime = currentMillis;

    // Request temperature conversion from DS18B20
    dallasSensor.requestTemperatures();
    float outletTemp = dallasSensor.getTempCByIndex(0);

    // Error Handling:
    // - DEVICE_DISCONNECTED_C is -127.0°C (sensor not found / disconnected)
    // - 85.0°C is power-on reset uninitialized register value
    // - Valid physical operating range: -20°C to 120°C
    bool isInvalid = (outletTemp == DEVICE_DISCONNECTED_C || 
                      outletTemp <= -50.0 || 
                      outletTemp >= 125.0 || 
                      (outletTemp == 85.0 && consecutiveErrors == 0));

    if (isInvalid) {
      consecutiveErrors++;
      Serial.printf("[WARN] DS18B20 Sensor Error! Raw reading: %.2f °C (Count: %d)\n", outletTemp, consecutiveErrors);
      Serial.println("       Check GPIO 4 wiring and 4.7kΩ pull-up resistor to 3.3V.");
      return;
    }

    // Reset error counter on successful reading
    consecutiveErrors = 0;

    // Display formatted reading on Serial Monitor
    Serial.printf("[DS18B20] E-101 Outlet Temperature: %.1f °C\n", outletTemp);

    // Transmit JSON payload to backend server
    sendSensorData(outletTemp);
  }
}

// =========================================================================
// 6. WI-FI CONNECTION HANDLER
// =========================================================================
void connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[WIFI] Connecting to '%s' ", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Connected successfully!");
    Serial.printf("[WIFI] ESP32 IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WIFI] Target Backend: %s\n\n", BACKEND_URL);
  } else {
    Serial.println("\n[WIFI] Connection attempt failed. Will retry on next cycle.");
  }
}

// =========================================================================
// 7. HTTP SENSOR TELEMETRY TRANSMITTER
// =========================================================================
void sendSensorData(float outletTemp) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Transmission skipped: Wi-Fi is disconnected.");
    return;
  }

  HTTPClient http;
  http.begin(BACKEND_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(3000); // 3-second HTTP timeout

  // Build JSON payload matching ChemDiag backend schema
  StaticJsonDocument<256> doc;
  doc["source"] = "real";
  doc["unit"] = "heat_exchanger";
  doc["outlet_temperature"] = serialized(String(outletTemp, 1));

  String requestBody;
  serializeJson(doc, requestBody);

  int httpCode = http.POST(requestBody);

  if (httpCode > 0) {
    if (httpCode == HTTP_CODE_OK || httpCode == 200) {
      Serial.printf("[HTTP] POST Success -> %d OK (E-101 Tout: %.1f °C)\n", httpCode, outletTemp);
    } else {
      Serial.printf("[HTTP] POST Response -> Code %d\n", httpCode);
    }
  } else {
    Serial.printf("[HTTP] POST Failed! Error: %s\n", http.errorToString(httpCode).c_str());
    Serial.println("       Ensure backend server is running and laptop IP is reachable.");
  }

  http.end();
}
