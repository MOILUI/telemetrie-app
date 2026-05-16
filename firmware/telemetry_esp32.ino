/****************************************************************************
 *  TÉLÉMÉTRIE ESP32 + MODEM 4G SIM7600
 *  --------------------------------------------------
 *  Firmware générique pour superviser n'importe quelle machine
 *  (café, distributeur, etc.) via MQTT sur réseau cellulaire.
 *
 *  Capteurs supportés en standard :
 *    • Compteur d'impulsions (débit, tasses, monnaies, ventes…)
 *    • Sonde de température DS18B20 (chaudière, frigo)
 *    • Entrée numérique (porte, niveau bas, panne)
 *    • Entrée analogique (pression, capacitif)
 *    • Sortie relais (commandable depuis le backend)
 *
 *  Bibliothèques requises (à installer via le gestionnaire Arduino) :
 *    • TinyGSM            (par Volodymyr Shymanskyy)
 *    • PubSubClient       (par Nick O'Leary)
 *    • ArduinoJson        (par Benoît Blanchon)
 *    • OneWire + DallasTemperature (Miles Burton)  -- optionnel si DS18B20
 ****************************************************************************/

// --- Sélection du modem AVANT d'inclure TinyGsmClient.h ---
#define TINY_GSM_MODEM_SIM7600
#define TINY_GSM_RX_BUFFER 1024
#define SerialMon Serial
#define SerialAT  Serial1

#include <Arduino.h>
#include <TinyGsmClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

#include "config.h"   // copie config.h.example -> config.h

#if USE_DS18B20
  #include <OneWire.h>
  #include <DallasTemperature.h>
  OneWire           oneWire(ONEWIRE_PIN);
  DallasTemperature ds18b20(&oneWire);
#endif

// --- Globaux ---
TinyGsm        modem(SerialAT);
TinyGsmClient  gsmClient(modem);
PubSubClient   mqtt(gsmClient);

volatile uint32_t pulseCount = 0;
volatile uint32_t lastPulseMs = 0;
uint32_t lastTelemetryMs = 0;
uint32_t lastReconnectMs = 0;
bool     relayState = false;

// Topics MQTT (cf. backend/src/mqtt.js)
String topicData;
String topicEvent;
String topicStatus;
String topicAck;
String topicCmd;

// --- ISR compteur d'impulsions ---
void IRAM_ATTR onPulse() {
  uint32_t now = millis();
  if (now - lastPulseMs > PULSE_DEBOUNCE_MS) {
    pulseCount++;
    lastPulseMs = now;
  }
}

// --- Allumage du modem SIM7600 ---
void modemPowerOn() {
  pinMode(MODEM_POWER_ON, OUTPUT);
  digitalWrite(MODEM_POWER_ON, HIGH);

  pinMode(MODEM_PWRKEY_PIN, OUTPUT);
  pinMode(MODEM_RST_PIN, OUTPUT);
  digitalWrite(MODEM_RST_PIN, HIGH);

  // Séquence d'allumage SIM7600 : PWRKEY HIGH 500ms
  digitalWrite(MODEM_PWRKEY_PIN, LOW);
  delay(100);
  digitalWrite(MODEM_PWRKEY_PIN, HIGH);
  delay(500);
  digitalWrite(MODEM_PWRKEY_PIN, LOW);
  delay(5000); // attente boot modem
}

// --- Connexion réseau cellulaire ---
bool connectGsm() {
  SerialMon.println("[GSM] Initialisation du modem...");
  if (!modem.restart()) {
    SerialMon.println("[GSM] Échec restart modem");
    return false;
  }

  if (strlen(GSM_PIN) > 0 && modem.getSimStatus() != 3) {
    modem.simUnlock(GSM_PIN);
  }

  SerialMon.print("[GSM] Recherche réseau ");
  if (!modem.waitForNetwork(60000L)) {
    SerialMon.println(" échec");
    return false;
  }
  SerialMon.println(" OK");

  SerialMon.print("[GSM] Connexion GPRS (APN: " + String(GSM_APN) + ")... ");
  if (!modem.gprsConnect(GSM_APN, GSM_USER, GSM_PASS)) {
    SerialMon.println("échec");
    return false;
  }
  SerialMon.println("OK");

  SerialMon.print("[GSM] IP locale : ");
  SerialMon.println(modem.getLocalIP());

  return true;
}

// --- Callback MQTT (commandes reçues du backend) ---
void onMqttMessage(char* topic, byte* payload, unsigned int len) {
  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, payload, len);
  if (err) {
    SerialMon.println("[MQTT] JSON invalide reçu");
    return;
  }
  const char* cmd = doc["cmd"] | "";
  SerialMon.print("[MQTT] Commande reçue : ");
  SerialMon.println(cmd);

  // === Traitement des commandes ===
  String ackStatus = "done";
  String ackMsg = "";

  if (strcmp(cmd, "ping") == 0) {
    ackMsg = "pong";
  }
  else if (strcmp(cmd, "relay") == 0) {
    bool val = doc["params"]["on"] | false;
    relayState = val;
    digitalWrite(RELAY_OUTPUT_PIN, val ? HIGH : LOW);
    ackMsg = val ? "relay on" : "relay off";
  }
  else if (strcmp(cmd, "reset_counter") == 0) {
    noInterrupts();
    pulseCount = 0;
    interrupts();
    ackMsg = "counter reset";
  }
  else if (strcmp(cmd, "reboot") == 0) {
    publishAck("done", "rebooting");
    delay(500);
    ESP.restart();
  }
  else {
    ackStatus = "unknown";
    ackMsg = "commande inconnue";
  }

  publishAck(ackStatus, ackMsg);
}

void publishAck(const String& status, const String& message) {
  StaticJsonDocument<256> doc;
  doc["ts"] = (uint32_t)(millis());
  doc["status"] = status;
  doc["message"] = message;
  char buf[256];
  size_t n = serializeJson(doc, buf);
  mqtt.publish(topicAck.c_str(), buf, n);
}

// --- Connexion MQTT ---
bool connectMqtt() {
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMqttMessage);
  mqtt.setBufferSize(1024);
  mqtt.setKeepAlive(60);

  SerialMon.print("[MQTT] Connexion à ");
  SerialMon.print(MQTT_HOST);
  SerialMon.print(":");
  SerialMon.print(MQTT_PORT);
  SerialMon.print(" ... ");

  // Last Will & Testament : si l'ESP32 perd la connexion, le broker
  // publie automatiquement "offline" sur le topic de statut.
  bool ok = mqtt.connect(
    DEVICE_ID,
    MQTT_USERNAME,
    MQTT_PASSWORD,
    topicStatus.c_str(),      // will topic
    1, true,                  // qos, retain
    "offline"                 // will message
  );

  if (!ok) {
    SerialMon.print("échec (rc=");
    SerialMon.print(mqtt.state());
    SerialMon.println(")");
    return false;
  }
  SerialMon.println("OK");

  // Annonce "online" (retained)
  mqtt.publish(topicStatus.c_str(), "online", true);
  // Abonnement aux commandes
  mqtt.subscribe(topicCmd.c_str(), 1);

  // Annonce un évènement de démarrage
  StaticJsonDocument<128> doc;
  doc["level"] = "info";
  doc["code"] = "boot";
  doc["message"] = "Démarrage du firmware";
  char buf[128];
  size_t n = serializeJson(doc, buf);
  mqtt.publish(topicEvent.c_str(), buf, n);

  return true;
}

// --- Lecture des capteurs et publication ---
void publishTelemetry() {
  StaticJsonDocument<512> doc;
  doc["ts"] = (uint32_t)(millis());

  // Compteur d'impulsions
  noInterrupts();
  uint32_t count = pulseCount;
  interrupts();
  doc["pulses"] = count;

  // Entrée numérique
  doc["digital_in"] = digitalRead(DIGITAL_INPUT_PIN) == HIGH;

  // Sortie relais
  doc["relay"] = relayState;

  // Entrée analogique
#if ANALOG_ENABLED
  int raw = analogRead(ANALOG_INPUT_PIN);
  doc["analog"] = raw;
  doc["voltage"] = (raw * 3.3f) / 4095.0f;
#endif

  // Température DS18B20
#if USE_DS18B20
  ds18b20.requestTemperatures();
  float t = ds18b20.getTempCByIndex(0);
  if (t > -100.0f && t < 200.0f) {   // valeur plausible
    doc["temp_c"] = t;
  }
#endif

  // Qualité réseau
  doc["rssi"] = modem.getSignalQuality();
  doc["uptime_s"] = millis() / 1000;

  char buf[512];
  size_t n = serializeJson(doc, buf);
  mqtt.publish(topicData.c_str(), buf, n);

  SerialMon.print("[TLM] Envoyé : ");
  SerialMon.println(buf);
}

// --- LED de statut ---
void blinkStatus(int times, int delayMs = 100) {
  for (int i = 0; i < times; i++) {
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(delayMs);
    digitalWrite(STATUS_LED_PIN, LOW);
    delay(delayMs);
  }
}

void setup() {
  SerialMon.begin(115200);
  delay(200);
  SerialMon.println();
  SerialMon.println("=== Télémétrie ESP32 — démarrage ===");
  SerialMon.print("Device ID : "); SerialMon.println(DEVICE_ID);

  // GPIOs
  pinMode(STATUS_LED_PIN, OUTPUT);
  pinMode(DIGITAL_INPUT_PIN, INPUT_PULLUP);
  pinMode(RELAY_OUTPUT_PIN, OUTPUT);
  digitalWrite(RELAY_OUTPUT_PIN, LOW);

  // Compteur d'impulsions sur interruption
  pinMode(PULSE_INPUT_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(PULSE_INPUT_PIN), onPulse, FALLING);

#if USE_DS18B20
  ds18b20.begin();
#endif

  // Topics
  topicData   = "tlm/" DEVICE_ID "/data";
  topicEvent  = "tlm/" DEVICE_ID "/event";
  topicStatus = "tlm/" DEVICE_ID "/status";
  topicAck    = "tlm/" DEVICE_ID "/ack";
  topicCmd    = "tlm/" DEVICE_ID "/cmd";

  // Modem SIM7600
  modemPowerOn();
  SerialAT.begin(115200, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);
  delay(1000);

  if (connectGsm()) {
    blinkStatus(3);
    connectMqtt();
  }

  lastTelemetryMs = millis() - TELEMETRY_PERIOD_MS; // pour publier immédiatement
}

void loop() {
  // Maintien GSM
  if (!modem.isGprsConnected()) {
    SerialMon.println("[GSM] Connexion perdue, reconnexion...");
    connectGsm();
  }

  // Maintien MQTT
  if (!mqtt.connected()) {
    uint32_t now = millis();
    if (now - lastReconnectMs > 5000) {
      lastReconnectMs = now;
      connectMqtt();
    }
  } else {
    mqtt.loop();
  }

  // Publication périodique
  if (mqtt.connected() && (millis() - lastTelemetryMs) >= TELEMETRY_PERIOD_MS) {
    lastTelemetryMs = millis();
    publishTelemetry();
    digitalWrite(STATUS_LED_PIN, HIGH);
    delay(30);
    digitalWrite(STATUS_LED_PIN, LOW);
  }
}
