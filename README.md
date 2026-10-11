# Gentlemans Bar · Die Kasse

Eine responsive Kasse in Schwarz, Oliv und Gold, gestaltet mit eurem Emblem und Flyer. Die Oberfläche ist auf Deutsch.

## Was enthalten ist

- Anmeldung mit Mitarbeitername. Derselbe Name wird unabhängig von Groß-/Kleinschreibung wiedererkannt.
- Artikelliste mit Kategorien und Suche, Mengenauswahl, Warenkorb und exakter Berechnung in Cent.
- Verkauf buchen mit Kennzeichnung „Bar“ oder „Karte“. Die Seite erfasst die Zahlung; sie belastet keine Karte und verbindet kein Kartenterminal.
- Umsatz pro Mitarbeiter, Gesamtumsatz, Tages-/Wochen-/Monatsübersicht und eigene Datumsfilter.
- Buchungsdetails, meistverkaufte Artikel und CSV-Export aller Positionen im gewählten Zeitraum.
- PIN-geschützte Artikelverwaltung: Preise ändern, Artikel hinzufügen und pausieren.
- Storno mit Begründung. Die ursprüngliche Buchung bleibt sichtbar und zählt nicht mehr zum Umsatz.
- Zentrale PostgreSQL-Datenbank auf Render für mehrere Geräte. Doppelte Buchungsanfragen werden abgefangen.
- Ein lokal gespeicherter Warenkorb pro Mitarbeiter. Bei Verbindungsabbruch bleibt eine offene Buchung gesperrt, bis ihr ihren Status über „Buchung prüfen“ erneut prüft.

Die Getränkekarte enthält **14 Beispielartikel**, keine echten Umsätze. Bitte Preise vor dem Einsatz anpassen. Standardwährung ist Euro; unter „Sortiment“ kann vor dem ersten Verkauf auf Dollar gewechselt werden. Nach der ersten Buchung ist die Währung fest, damit historische und neue Umsätze vergleichbar bleiben.

## Lokal starten

Voraussetzung: **Node.js 22 ab 22.17**. Im Projektordner ausführen:

```powershell
npm ci
npm start
```

Dann [http://localhost:3000](http://localhost:3000) öffnen. Unter Windows könnt ihr auch **Start-Kasse.cmd** doppelklicken. Das Fenster muss offen bleiben, solange die Kasse läuft. Beenden mit `Strg+C`.

Es ist keine separate Datenbankinstallation notwendig: Für die lokale Vorschau wird eine PostgreSQL-Engine in `data/` gespeichert. Dieser Ordner wird nicht nach Render hochgeladen. Ein Neustart bewahrt die lokalen Daten.

Lokale Verwaltungs-PIN: **2007**. Zum Ändern `.env.example` nach `.env` kopieren und `ADMIN_PIN` setzen. Optional könnt ihr auch lokal einen `BAR_ACCESS_CODE` setzen. Die automatische Vorschau zeigt den PIN-Hinweis nur im lokalen Modus.

## Auf Render veröffentlichen

Das Projekt wird als **Web Service mit PostgreSQL** betrieben. Eine „Static Site“ kann die zentralen Buchungen nicht speichern.

1. Die Dateien aus diesem Ordner oder dem ZIP in ein neues GitHub-Repository hochladen. **`package.json`, `package-lock.json`, `render.yaml`, `server.js`, `lib/` und `public/` müssen direkt im Stamm des Repositorys liegen**, nicht in einem zusätzlichen Unterordner. `node_modules/`, `data/` und `.env` nicht hochladen.
2. Bei [Render](https://dashboard.render.com) anmelden und **New → Blueprint** wählen.
3. Das GitHub-Repository verbinden. Render liest die beiliegende `render.yaml` und erstellt den Web Service sowie die Datenbank in Frankfurt.
4. Die beiden abgefragten Werte setzen:
   - `BAR_ACCESS_CODE`: ein eigener Zugangscode für das gesamte Team, mindestens vier Zeichen. Mitarbeiter geben ihn zusätzlich zu ihrem Namen ein.
   - `ADMIN_PIN`: eine eigene PIN mit 4–12 Ziffern für Artikelverwaltung und Stornos. Nur der Barleitung geben.
5. Den Blueprint anlegen und warten, bis die Bereitstellung abgeschlossen ist. Render gibt euch eine `https://…onrender.com`-Adresse.
6. Die Adresse öffnen, mit Namen und Zugangscode anmelden und unter **Sortiment** mit eurer PIN zuerst Währung, Artikel und Preise festlegen.

`DATABASE_URL` wird durch den Blueprint automatisch verbunden. Der Server legt Tabellen und Beispielartikel beim ersten Start an. Weitere Deployments überschreiben weder Umsätze noch eure geänderte Karte. Im Produktionsmodus startet die App nur mit der zentralen Datenbank und gültigen Zugangswerten.

Die Konfiguration verwendet zunächst kostenlose Render-Instanzen. **Die kostenlose Render-Postgres-Datenbank läuft nach 30 Tagen ab.** Für dauerhaften Betrieb die Datenbank rechtzeitig auf einen kostenpflichtigen Tarif umstellen oder eine dauerhafte PostgreSQL-Datenbank über `DATABASE_URL` anschließen. Der kostenlose Web Service schläft nach 15 Minuten ohne Aufrufe ein; der erste Aufruf danach kann ungefähr eine Minute dauern. Für eine Kasse ohne diese Startpause den Web-Service-Tarif ändern. Aktuelle Bedingungen: [Render Free](https://render.com/docs/free).

Die Bereitstellungsvorlage folgt der [Render-Blueprint-Referenz](https://render.com/docs/blueprint-spec). Startbefehl ist `npm start`, Buildbefehl `npm ci --omit=dev`, Healthcheck `/api/health`. Die Node-Version wird auf die Major-Version 22 gesetzt.

## Bedienung

1. Mit eurem Namen anmelden. Bitte immer denselben Namen verwenden; verschiedene Namen erscheinen als verschiedene Mitarbeiter.
2. Links einen Artikel anklicken, Menge angeben und hinzufügen.
3. Rechts Mengen nach Bedarf ändern und Zahlungsart wählen.
4. Nach Zahlungseingang **Verkauf buchen**. Erst die erfolgreiche Serverantwort zählt als gebuchter Umsatz.
5. Unter **Umsätze** Mitarbeiterbeträge und Gesamtsumme für den gewünschten Zeitraum ansehen. **Gesamt** zeigt die gesamte Historie.
6. Über **Details → Buchung stornieren** kann die Barleitung eine Buchung mit Grund stornieren.

Anmeldungen gelten zwölf Stunden. Die Verwaltung bleibt nach PIN-Eingabe 30 Minuten entsperrt. Tagesgrenzen und Zeitangaben richten sich nach `Europe/Berlin`. Die Kassenansicht aktualisiert Karte und Tageswerte alle 30 Sekunden; in der Umsatzübersicht könnt ihr **Aktualisieren** wählen.

Preisänderungen betreffen neue Verkäufe. Enthält ein offener Warenkorb einen alten Preis, lehnt der Server die Buchung ab: den Artikel entfernen und mit dem aktuellen Preis erneut hinzufügen. Pausierte Artikel können nicht neu gebucht werden.

Die CSV-Datei lässt sich mit Excel öffnen und verwendet Semikolon als Trennzeichen sowie Komma als Dezimalzeichen. Jeder Datensatz ist eine Artikelposition. Status „Storniert“ beim Weiterrechnen herausfiltern. Der Export enthält alle Buchungen des Zeitraums, während die Oberfläche nur die neuesten 50 Buchungen auflistet. Für Datenbanksicherungen zusätzlich die Export-/Backupmöglichkeiten eures PostgreSQL-Anbieters nutzen; der CSV-Export ist kein vollständiges Datenbank-Backup.

## Technik und Prüfung

Node.js, Express, PostgreSQL (`pg`), lokale PostgreSQL-Engine (`PGlite`), HTML/CSS/JavaScript ohne Buildschritt. Bilder und Schriften laden ohne externe Dienste. Buchungsbeträge werden serverseitig aus aktuellen Preisen berechnet, Mitarbeitende werden aus der Sitzung zugeordnet. Sitzungen verwenden HttpOnly-Cookies, im Produktionsmodus HTTPS; Verwaltung benötigt eine PIN. Die Namensanmeldung identifiziert den Mitarbeiter anhand seiner Eingabe, nicht über ein persönliches Passwort.

```powershell
npm run check
npm test
```

Die Integrationstests prüfen Berechnung und Mitarbeiterzuordnung, doppelte und gleichzeitige Requests, Preisänderungen, ungültige Mengen, Stornos, Berliner Tagesgrenzen, CSV und dauerhafte lokale Speicherung. Sie verwenden eigene isolierte Testdatenbanken.

Dateien: `server.js` startet die App; `lib/app.js` enthält die API; `lib/database.js` verwaltet Datenbank und Tabellen; `public/` enthält die Oberfläche; `render.yaml` bereitet das Hosting vor.
