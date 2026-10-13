# Beispiel-Zahlungsplan

Browserbasierte Anwendung zur Planung von Meilensteinen und Teilzahlungen, Sicherheiten mit Laufzeiten, Projektphasen, Gewährleistung und Verzugs­schadenspauschalen (VSP). Die Zeitachse zeigt den kumulierten Zahlungsverlauf.

## Beispielplan

Beim Start wird der **Beispiel-Zahlungsplan** geladen. Seine Meilensteine, Sicherheiten und Projektphasen sind in `model.mjs` in der Funktion `example()` definiert.

## Lokal starten

Die Dateien sind eine statische Webanwendung ohne Build-Schritt. Den Repository-Ordner mit einem lokalen Webserver ausliefern, zum Beispiel:

```sh
python3 -m http.server 8080
```

Danach `http://localhost:8080` im Browser öffnen. Pläne lassen sich in der Anwendung als Datei speichern und wieder laden.

## Dateien

- `index.html` – Einstiegspunkt
- `app.mjs`, `model.mjs`, `chart.mjs` – Anwendung, Datenmodell und Zeitachse
- `styles.css` – Darstellung
- `lib/lucide.min.js` – Icons
- `favicon.svg` – Seitensymbol
