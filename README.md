# Gentlemans Bar · Die Kasse

Eine responsive Kasse in Schwarz, Oliv und Gold, gestaltet mit eurem Emblem und Flyer. Die Oberfläche ist auf Deutsch.

## Was enthalten ist

- Anmeldung mit Mitarbeitername. Derselbe Name wird unabhängig von Groß-/Kleinschreibung wiedererkannt.
- Artikelliste mit Kategorien und Suche, Mengenauswahl, Warenkorb und exakter Berechnung in Cent.
- Verkauf buchen mit Kennzeichnung „Bar“ oder „Karte“. Die Seite erfasst die Zahlung; sie belastet keine Karte und verbindet kein Kartenterminal.
- Umsatz pro Mitarbeiter, Gesamtumsatz, Tages-/Wochen-/Monatsübersicht und eigene Datumsfilter.
- Buchungsdetails, meistverkaufte Artikel und CSV-Export aller Positionen im gewählten Zeitraum.
- Artikelverwaltung für alle angemeldeten Mitarbeiter: Preise ändern, Artikel hinzufügen und pausieren.
- Storno mit Begründung. Die ursprüngliche Buchung bleibt sichtbar und zählt nicht mehr zum Umsatz.
- Lagerbestand mit Warnungen unter 30 Stück, automatischem Abzug bei Verkäufen, Rückgabe bei Storno und Bestandsänderungen mit Grund.
- Separate VIP-Seite für VIP Lounge und Oberen Bereich mit Kundendaten, Mietzeitraum und automatischer Mieteinnahme.
- Finanzen mit sonstigen Einnahmen, Ausgaben, Pflichtgrund, Stornos und Gesamtsaldo.
- Zentrale PostgreSQL-Datenbank auf Render für mehrere Geräte. Doppelte Buchungsanfragen werden abgefangen.
- Ein lokal gespeicherter Warenkorb pro Mitarbeiter. Bei Verbindungsabbruch bleibt eine offene Buchung gesperrt, bis ihr ihren Status über „Buchung prüfen“ erneut prüft.

Die Kasse enthält **24 Artikel aus eurer Speise- und Shishakarte** mit den bestätigten **Dollarpreisen (USD)**. Dazu gehören Essen, alkoholische und alkoholfreie Getränke, Kaffeespezialitäten, Zigaretten & Zigarren, Spezielles, die Magische E-Shisha und sieben Aromen. Die Preise 250 bzw. 5.000 auf den Karten werden als **250 $ bzw. 5.000 $** übernommen. Artikel und Preise bleiben unter „Sortiment“ bearbeitbar.

Beim ersten Start mit dieser Version wird die Karte auch in bestehenden Datenbanken automatisch eingespielt. Alte Beispielartikel werden aus Kasse und Sortiment archiviert; selbst angelegte zusätzliche Artikel bleiben erhalten. Die Umstellung auf die echte Karte erfolgt einmalig. Weitere Starts oder Deployments überschreiben eure späteren Preisänderungen nicht.

Neue Verkäufe werden nach dem Kartenimport in USD gebucht. Bestehende Buchungen behalten ihre ursprünglichen Artikel, Preise und Währungen. Falls noch Euro-Umsätze aus der vorherigen Version vorhanden sind, könnt ihr in „Umsätze“ zwischen Dollar und Euro wählen. Die Summen werden je Währung getrennt berechnet; es findet keine Währungsumrechnung statt. Nach dem ersten Verkauf lässt sich die Währung über „Sortiment“ nicht mehr ändern.

## Lokal starten

Voraussetzung: **Node.js 22 ab 22.17**. Im Projektordner ausführen:

```powershell
npm ci
npm start
```

Dann [http://localhost:3000](http://localhost:3000) öffnen. Unter Windows könnt ihr auch **Start-Kasse.cmd** doppelklicken. Das Fenster muss offen bleiben, solange die Kasse läuft. Beenden mit `Strg+C`.

Es ist keine separate Datenbankinstallation notwendig: Für die lokale Vorschau wird eine PostgreSQL-Engine in `data/` gespeichert. Dieser Ordner wird nicht nach Render hochgeladen. Ein Neustart bewahrt die lokalen Daten.

Die Anmeldung erfolgt ausschließlich mit dem Namen. Jeder angemeldete Mitarbeiter kann Artikel und Preise bearbeiten, die Währung vor dem ersten Verkauf festlegen und Buchungen mit Begründung stornieren.

## Auf Render veröffentlichen

Das Projekt wird als **Web Service mit PostgreSQL** betrieben. Eine „Static Site“ kann die zentralen Buchungen nicht speichern.

1. Die Dateien aus diesem Ordner oder dem ZIP in ein neues GitHub-Repository hochladen. **`package.json`, `package-lock.json`, `render.yaml`, `server.js`, `lib/` und `public/` müssen direkt im Stamm des Repositorys liegen**, nicht in einem zusätzlichen Unterordner. `node_modules/`, `data/` und `.env` nicht hochladen.
2. Bei [Render](https://dashboard.render.com) anmelden und **New → Blueprint** wählen.
3. Das GitHub-Repository verbinden. Render liest die beiliegende `render.yaml` und erstellt den Web Service sowie die Datenbank in Frankfurt.
4. Den Blueprint anlegen und warten, bis die Bereitstellung abgeschlossen ist. Render gibt euch eine `https://…onrender.com`-Adresse. Es werden keine PIN oder Zugangscodes abgefragt.
5. Die Adresse öffnen, mit Namen anmelden und unter **Sortiment** zuerst Währung, Artikel und Preise festlegen.

`DATABASE_URL` wird durch den Blueprint automatisch verbunden. Der Server legt Tabellen beim ersten Start an und importiert die Speise- und Shishakarte einmalig. Weitere Deployments überschreiben weder Umsätze noch eure danach geänderte Karte. Im Produktionsmodus startet die App mit der zentralen Datenbank; die Anmeldung benötigt nur einen Namen.

Die Konfiguration verwendet zunächst kostenlose Render-Instanzen. **Die kostenlose Render-Postgres-Datenbank läuft nach 30 Tagen ab.** Für dauerhaften Betrieb die Datenbank rechtzeitig auf einen kostenpflichtigen Tarif umstellen oder eine dauerhafte PostgreSQL-Datenbank über `DATABASE_URL` anschließen. Der kostenlose Web Service schläft nach 15 Minuten ohne Aufrufe ein; der erste Aufruf danach kann ungefähr eine Minute dauern. Für eine Kasse ohne diese Startpause den Web-Service-Tarif ändern. Aktuelle Bedingungen: [Render Free](https://render.com/docs/free).

Die Bereitstellungsvorlage folgt der [Render-Blueprint-Referenz](https://render.com/docs/blueprint-spec). Startbefehl ist `npm start`, Buildbefehl `npm ci --omit=dev`, Healthcheck `/api/health`. Die Node-Version wird auf die Major-Version 22 gesetzt.

## Wenn Render beim Start fehlschlägt

Für Render muss `DATABASE_URL` die vollständige PostgreSQL-Verbindungsadresse enthalten. Der Blueprint trägt sie automatisch ein; falls sie fehlt, die **Internal Database URL** der angelegten Datenbank verwenden. Fehler in der Datenbankadresse oder im Port werden im Start-Log erklärt.

`ADMIN_PIN` und `BAR_ACCESS_CODE` werden nicht mehr verwendet. Bereits vorhandene Werte in Render oder einer lokalen `.env` werden ignoriert. Damit kann der bestehende Web Service ohne diese Einstellungen neu deployt werden.

Die Meldung `.env not found. Continuing without it.` ist auf Render normal: Die Datenbankverbindung kommt aus den Environment-Einstellungen.

## Bedienung

1. Mit eurem Namen anmelden. Bitte immer denselben Namen verwenden; verschiedene Namen erscheinen als verschiedene Mitarbeiter.
2. Links einen Artikel anklicken, Menge angeben und hinzufügen.
3. Rechts Mengen nach Bedarf ändern und Zahlungsart wählen.
4. Nach Zahlungseingang **Verkauf buchen**. Erst die erfolgreiche Serverantwort zählt als gebuchter Umsatz.
5. Unter **Umsätze** Mitarbeiterbeträge und Gesamtsumme für den gewünschten Zeitraum ansehen. **Gesamt** zeigt die gesamte Historie.
6. Über **Details → Buchung stornieren** kann jeder angemeldete Mitarbeiter eine Buchung mit Grund stornieren.

Anmeldungen gelten zwölf Stunden. Das Sortiment ist nach der Namensanmeldung sofort bearbeitbar. Tagesgrenzen und Zeitangaben richten sich nach `Europe/Berlin`. Die Kassenansicht aktualisiert Karte und Tageswerte alle 30 Sekunden; in der Umsatzübersicht könnt ihr **Aktualisieren** wählen.

Preisänderungen betreffen neue Verkäufe. Enthält ein offener Warenkorb einen alten Preis, lehnt der Server die Buchung ab: den Artikel entfernen und mit dem aktuellen Preis erneut hinzufügen. Pausierte Artikel können nicht neu gebucht werden.

Die CSV-Datei lässt sich mit Excel öffnen und verwendet Semikolon als Trennzeichen sowie Komma als Dezimalzeichen. Jeder Datensatz ist eine Artikelposition. Status „Storniert“ beim Weiterrechnen herausfiltern. Der Export aus der Umsatzübersicht enthält alle Buchungen des gewählten Zeitraums und der ausgewählten Währung, während die Oberfläche nur die neuesten 50 Buchungen auflistet. Für Datenbanksicherungen zusätzlich die Export-/Backupmöglichkeiten eures PostgreSQL-Anbieters nutzen; der CSV-Export ist kein vollständiges Datenbank-Backup.

## Lagerbestand

Der erste Deploy dieser Erweiterung übernimmt **einmalig die 24 Bestände aus den Lagerbildern**: ausschließlich die Stückzahlen oben rechts, gleiche Artikel addiert. Die Grammangaben und die drei zusätzlichen Felder Orange Eclipse / Moonfire werden ausgelassen. Insgesamt sind es 1.196 Stück. Weitere Deployments ändern weder diese Bestände noch manuelle Inventuren. Die früheren Beispielartikel sind auch aus der Sortimentsverwaltung entfernt; die Datensätze bleiben für alte Buchungen erhalten.

Unter **Lager** seht ihr alle Bestände und könnt nach Artikeln suchen oder nur niedrige Bestände anzeigen. **Unter 30 Stück** erscheint eine Warnung; genau 30 zählt als ausreichend. In der Kasse stehen die Bestände direkt am Artikel. Bestand 0 sperrt den Verkauf. Alle Ansichten prüfen alle 30 Sekunden auf neu unterschrittene Bestände, die Kasse und das Lager aktualisieren ihre Bestandsanzeigen automatisch. Über **Bestand ändern** den neuen gesamten Bestand und einen Grund eingeben (Nachlieferung, Inventur, Bruch usw.). Das Bewegungsprotokoll erfasst Änderung, Bestand danach, Grund und Mitarbeiter.

Neue Verkäufe buchen Bestand und Umsatz gemeinsam in einer Datenbanktransaktion. Überverkauf und doppelte Abbuchungen durch wiederholte Anfragen werden verhindert. Ein Storno neuer Verkäufe gibt die Menge einmal zurück. Buchungen, die bereits vor Einführung des Lagers bestanden, wurden in der Foto-Inventur berücksichtigt und erhöhen beim Storno deshalb nicht nachträglich den Bestand.

## VIP und Vermietung

Unter **VIP** liegen die Vermietungen außerhalb des Artikelwarenkorbs:

- **VIP Lounge:** 50.000 $ pro Stunde.
- **Oberer Bereich:** 100.000 $ für genau 1 Woche oder 250.000 $ für genau 4 Wochen.

Im Buchungsfenster Name, optional Familie, Nummer, Beginn und Tarif angeben. Beim Oberen Bereich gibt es ausschließlich die beiden festen Laufzeiten 1 Woche und 4 Wochen; ein Dauerfeld entfällt. Der Server setzt die Laufzeit automatisch und berechnet Enddatum und Preis. Die VIP Lounge bleibt stundenweise mit einer Dauer von 1 bis 52 Stunden buchbar. Die Vorschau zeigt Zeitraum und Preis vor dem Speichern. Wochen behalten die Berliner Uhrzeit bei Zeitumstellungen bei. Bereits gespeicherte Vermietungen behalten ihren ursprünglichen Zeitraum und Preis.

Die VIP-Seite zeigt Name, Familie, Nummer, Beginn, Ende, Preis, Mitarbeiter und Status. Suchbar und filterbar nach aktiv/geplant, beendet, storniert oder allen Vermietungen. Überschneidungen im selben Bereich sind gesperrt. **Beim Buchen wird die gesamte Miete als Einnahme am Buchungstag in Finanzen erfasst**; bei Bedarf erst nach dem Zahlungseingang buchen. Vermietungsstornos mit Grund geben den Zeitraum frei und stornieren die verknüpfte Einnahme gemeinsam.

## Finanzen

Unter **Finanzen** sonstige Einnahmen und Ausgaben in Dollar erfassen: positiver Betrag, Buchungsdatum und Grund sind Pflicht. Der Mitarbeiter wird aus der Anmeldung übernommen. Einträge bleiben bei Storno sichtbar, zählen aber nicht mehr zu den Summen. Mietbeträge werden automatisch erfasst und dürfen nicht zusätzlich als sonstige Einnahme gebucht werden.

Die Übersicht zeigt Kassenumsatz, Vermietungen, sonstige Einnahmen, Ausgaben, gesamte Einnahmen und **Saldo = Kassenumsatz + Vermietungen + sonstige Einnahmen − Ausgaben**. Zeitraumfilter begrenzen Summen und Liste; Euro-Altumsätze werden nicht mit Dollarbeträgen vermischt. Das ist eine Einnahmen-/Ausgabenübersicht, keine automatische Gewinn- oder Steuerberechnung. Die letzten 200 Finanzbuchungen werden angezeigt. Vermietungen werden auf der VIP-Seite storniert.

Offene Lager-/VIP-/Finanzanfragen bleiben bei Verbindungsfehlern mit derselben Buchungsnummer im Browser gespeichert. Über **Buchung prüfen** wird das Ergebnis sicher abgefragt, bevor eine neue Buchung erfasst werden kann.

## Technik und Prüfung

Node.js, Express, PostgreSQL (`pg`), lokale PostgreSQL-Engine (`PGlite`), HTML/CSS/JavaScript ohne Buildschritt. Bilder und Schriften laden ohne externe Dienste. Buchungsbeträge werden serverseitig aus aktuellen Preisen berechnet, Mitarbeitende werden aus der Sitzung zugeordnet. Sitzungen verwenden HttpOnly-Cookies, im Produktionsmodus HTTPS. Die Artikelverwaltung ist für alle angemeldeten Mitarbeiter offen. Die Namensanmeldung identifiziert den Mitarbeiter anhand seiner Eingabe, nicht über ein persönliches Passwort.

```powershell
npm run check
npm test
```

Die Integrationstests prüfen Berechnung und Mitarbeiterzuordnung, doppelte und gleichzeitige Requests, Preisänderungen, ungültige Mengen, Stornos, Berliner Tagesgrenzen, CSV und dauerhafte lokale Speicherung. Zusätzlich prüfen sie die 24 Foto-Bestände, konkurrierende Verkäufe, Stock-Stornos, einmalige Datenmigration, feste Miettarife, Wochenlaufzeiten, Sommerzeit, Reservierungskonflikte sowie Finanzsummen und -stornos. Sie verwenden eigene isolierte Testdatenbanken.

Dateien: `server.js` startet die App; `lib/app.js` enthält die API; `lib/database.js` verwaltet Datenbank und Tabellen; `public/` enthält die Oberfläche; `render.yaml` bereitet das Hosting vor.
