# Beispiel-Zahlungsplan

Browserbasierte Anwendung zur Planung von Meilensteinen und Teilzahlungen, Sicherheiten mit Laufzeiten, Projektphasen, Gewährleistung und Verzugs­schadenspauschalen (VSP). Die Zeitachse zeigt den kumulierten Zahlungsverlauf.

## Beispielplan

Beim Start wird der **Beispiel-Zahlungsplan** geladen. Seine Meilensteine, Sicherheiten und Projektphasen sind in `index.html` in der Funktion `example()` definiert.

## Lokal starten

Die Anwendung ist eine einzelne HTML-Datei ohne Build-Schritt. Den Repository-Ordner mit einem lokalen Webserver ausliefern, zum Beispiel:

```sh
python3 -m http.server 8080
```

Danach `http://localhost:8080` im Browser öffnen.

## Speichern und Öffnen

„Speichern“ erzeugt eine eigenständige HTML-Datei (`JJJJMMTT_Projektname.html`): Sie enthält die ganze Anwendung inklusive Icons sowie den aktuellen Plan und lässt sich offline direkt im Browser öffnen und weiterbearbeiten. Über „Öffnen“ können gespeicherte HTML-Dateien, ältere JSON-Dateien und gespeicherte Gantt-Projekte geladen werden.

## Dateien

- `index.html` – komplette Anwendung (Markup, Darstellung, Datenmodell, Zeitachse)
- `lib/lucide.min.js` – Icons (wird beim Speichern in die HTML-Datei eingebettet)
