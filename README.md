# Gentlemans Bar · Die Kasse

Eine responsive Kasse in Schwarz, Oliv und Gold, gestaltet mit eurem Emblem und Flyer. Die Oberfläche ist auf Deutsch.

## Was enthalten ist

- Anmeldung mit Mitarbeitername und gemeinsamem Bar-Passwort; optional 30 Tage angemeldet bleiben. Derselbe Name wird unabhängig von Groß-/Kleinschreibung wiedererkannt.
- Artikelliste mit Kategorien und Suche, Mengenauswahl, Warenkorb und exakter Berechnung in Cent.
- Verkauf buchen mit Kennzeichnung „Bar“ oder „Karte“. Die Seite erfasst die Zahlung; sie belastet keine Karte und verbindet kein Kartenterminal.
- Umsatz pro Mitarbeiter, Gesamtumsatz, Tages-/Wochen-/Monatsübersicht und eigene Datumsfilter.
- Buchungsdetails, meistverkaufte Artikel und CSV-Export aller Positionen im gewählten Zeitraum.
- Artikelverwaltung für alle angemeldeten Mitarbeiter: Preise ändern, Artikel hinzufügen und pausieren.
- Storno mit Begründung. Die ursprüngliche Buchung bleibt sichtbar und zählt nicht mehr zum Umsatz.
- Eigene Einkaufsseite: Einkaufsmengen erfassen, Einkaufspreise berechnen, Bestand erhöhen und Kosten automatisch als Ausgabe buchen.
- Lagerbestand mit Warnungen unter 30 Stück, automatischem Abzug bei Verkäufen, Rückgabe bei Storno und Bestandsänderungen mit Grund.
- Separate VIP-Seite für VIP Lounge und Oberen Bereich mit Kundendaten, Mietzeitraum und automatischer Mieteinnahme.
- Finanzen mit sonstigen Einnahmen, Ausgaben, Pflichtgrund, Stornos und Gesamtsaldo.
- Zentrale PostgreSQL-Datenbank auf Render für mehrere Geräte. Doppelte Buchungsanfragen werden abgefangen.
- Ein lokal gespeicherter Warenkorb pro Mitarbeiter. Bei Verbindungsabbruch bleibt eine offene Buchung gesperrt, bis ihr ihren Status über „Buchung prüfen“ erneut prüft.

Die Kasse enthält **24 Artikel aus eurer Speise- und Shishakarte** mit den bestätigten **Dollarpreisen (USD)**. Dazu gehören Essen, alkoholische und alkoholfreie Getränke, Kaffeespezialitäten, Zigaretten & Zigarren, Spezielles, die Magische E-Shisha und sieben Aromen. Die Preise 250 bzw. 5.000 auf den Karten werden als **250 $ bzw. 5.000 $** übernommen. Artikel und Preise bleiben unter „Sortiment“ bearbeitbar.

Beim ersten Start mit dieser Version wird die Karte auch in bestehenden Datenbanken automatisch eingespielt. Alte Beispielartikel werden aus Kasse und Sortiment archiviert; selbst angelegte zusätzliche Artikel bleiben erhalten. Die Umstellung auf die echte Karte erfolgt einmalig. Weitere Starts oder Deployments überschreiben eure späteren Preisänderungen nicht.

Neue Verkäufe werden nach dem Kartenimport in USD gebucht. Bestehende Buchungen behalten ihre ursprünglichen Artikel, Preise und Währungen. Falls noch Euro-Umsätze aus der vorherigen Version vorhanden sind, könnt ihr in „Umsätze“ zwischen Dollar und Euro wählen. Die Summen werden je Währung getrennt berechnet; es findet keine Währungsumrechnung statt. Nach dem ersten Verkauf lässt sich die Währung über „Sortiment“ nicht mehr ändern.

## Anmeldung und Angemeldet bleiben

Mit eurem Namen und dem vereinbarten gemeinsamen Passwort anmelden. **Angemeldet bleiben** ist standardmäßig aktiviert und hält die Anmeldung auf diesem Gerät **30 Tage** gültig. Der zuletzt verwendete Name wird dabei vorausgefüllt. Das Passwort wird dabei nicht im Browser-Speicher gespeichert. Über Abmelden endet die Sitzung sofort. Ohne die Option wird ein Browser-Sitzungscookie mit maximal zwölf Stunden Gültigkeit verwendet.

Beim ersten Deploy der Passwort-Erweiterung werden die bisherigen Sitzungen ohne Passwortnachweis ungültig: einmal erneut anmelden. Alle Mitarbeiter, Umsätze und Bestände bleiben erhalten. Weitere Deployments mit demselben Passwort erhalten die angemeldeten Sitzungen. Optional kann **BAR_PASSWORD** in Render Environment oder einer lokalen .env überschrieben werden; ein Wechsel macht vorhandene Sitzungen ungültig. Der Vorgabewert ist als gesalzener Verifikator im Server hinterlegt, daher ist kein zusätzlicher Render-Wert notwendig.

## FiveM-Tablet und eingebettete Browser

Die Kasse erlaubt das Öffnen in einem iframe, wie es FiveM-Tablets verwenden. `X-Frame-Options` und die CSP-Direktive `frame-ancestors` werden deshalb nicht gesetzt. Die übrigen Sicherheitsheader bleiben aktiv. In Render verwendet die Anmeldung ein `HttpOnly; Secure; SameSite=None`-Cookie, damit sie im eingebetteten HTTPS-Browser funktioniert. Schreibende API-Anfragen benötigen weiterhin JSON und dürfen nur vom Ursprung der Kasse kommen.

Nach dem Update den Tablet-Browser neu laden und dort gegebenenfalls einmal mit Name und Bar-Passwort anmelden. Falls das Tablet grundsätzlich Cookies von eingebetteten Websites blockiert oder seine eigene Liste erlaubter Websites verwendet, muss dies zusätzlich in der Tablet-Konfiguration erlaubt werden. Das Update verändert keine Umsätze, Bestände oder Einkaufspreise.

## Lokal starten

Voraussetzung: **Node.js 22 ab 22.17**. Im Projektordner ausführen:

```powershell
npm ci
npm start
```

Dann [http://localhost:3000](http://localhost:3000) öffnen. Unter Windows könnt ihr auch **Start-Kasse.cmd** doppelklicken. Das Fenster muss offen bleiben, solange die Kasse läuft. Beenden mit `Strg+C`.

Es ist keine separate Datenbankinstallation notwendig: Für die lokale Vorschau wird eine PostgreSQL-Engine in `data/` gespeichert. Dieser Ordner wird nicht nach Render hochgeladen. Ein Neustart bewahrt die lokalen Daten.

Die Anmeldung benötigt einen Namen und das vereinbarte gemeinsame Bar-Passwort. Jeder angemeldete Mitarbeiter kann Artikel und Preise bearbeiten, die Währung vor dem ersten Verkauf festlegen und Buchungen mit Begründung stornieren.

## Auf Render veröffentlichen

Das Projekt wird als **Web Service mit PostgreSQL** betrieben. Eine „Static Site“ kann die zentralen Buchungen nicht speichern.

1. Die Dateien aus diesem Ordner oder dem ZIP in ein neues GitHub-Repository hochladen. **`package.json`, `package-lock.json`, `render.yaml`, `server.js`, `lib/` und `public/` müssen direkt im Stamm des Repositorys liegen**, nicht in einem zusätzlichen Unterordner. `node_modules/`, `data/` und `.env` nicht hochladen.
2. Bei [Render](https://dashboard.render.com) anmelden und **New → Blueprint** wählen.
3. Das GitHub-Repository verbinden. Render liest die beiliegende `render.yaml` und erstellt den Web Service sowie die Datenbank in Frankfurt.
4. Den Blueprint anlegen und warten, bis die Bereitstellung abgeschlossen ist. Render gibt euch eine `https://…onrender.com`-Adresse. Das vereinbarte Bar-Passwort ist bereits eingerichtet; zusätzliche Zugangswerte sind für das Deployment nicht erforderlich.
5. Die Adresse öffnen, mit Namen und Bar-Passwort anmelden und unter **Sortiment** zuerst Währung, Artikel und Preise festlegen.

`DATABASE_URL` wird durch den Blueprint automatisch verbunden. Der Server legt Tabellen beim ersten Start an und importiert die Speise- und Shishakarte einmalig. Weitere Deployments überschreiben weder Umsätze noch eure danach geänderte Karte. Im Produktionsmodus startet die App mit der zentralen Datenbank; die Anmeldung benötigt Name und Bar-Passwort.

Die Konfiguration verwendet zunächst kostenlose Render-Instanzen. **Die kostenlose Render-Postgres-Datenbank läuft nach 30 Tagen ab.** Für dauerhaften Betrieb die Datenbank rechtzeitig auf einen kostenpflichtigen Tarif umstellen oder eine dauerhafte PostgreSQL-Datenbank über `DATABASE_URL` anschließen. Der kostenlose Web Service schläft nach 15 Minuten ohne Aufrufe ein; der erste Aufruf danach kann ungefähr eine Minute dauern. Für eine Kasse ohne diese Startpause den Web-Service-Tarif ändern. Aktuelle Bedingungen: [Render Free](https://render.com/docs/free).

Die Bereitstellungsvorlage folgt der [Render-Blueprint-Referenz](https://render.com/docs/blueprint-spec). Startbefehl ist `npm start`, Buildbefehl `npm ci --omit=dev`, Healthcheck `/api/health`. Die Node-Version wird auf die Major-Version 22 gesetzt.

## Wenn Render beim Start fehlschlägt

Für Render muss `DATABASE_URL` die vollständige PostgreSQL-Verbindungsadresse enthalten. Der Blueprint trägt sie automatisch ein; falls sie fehlt, die **Internal Database URL** der angelegten Datenbank verwenden. Fehler in der Datenbankadresse oder im Port werden im Start-Log erklärt.

`ADMIN_PIN` und `BAR_ACCESS_CODE` werden nicht mehr verwendet. Bereits vorhandene Werte in Render oder einer lokalen `.env` werden ignoriert. Damit kann der bestehende Web Service ohne diese Einstellungen neu deployt werden.

Die Meldung `.env not found. Continuing without it.` ist auf Render normal: Die Datenbankverbindung kommt aus den Environment-Einstellungen.

## Bedienung

1. Mit eurem Namen und dem Bar-Passwort anmelden; „Angemeldet bleiben“ nach Bedarf wählen. Bitte immer denselben Namen verwenden; verschiedene Namen erscheinen als verschiedene Mitarbeiter.
2. Links einen Artikel anklicken, Menge angeben und hinzufügen.
3. Rechts Mengen nach Bedarf ändern und Zahlungsart wählen.
4. Nach Zahlungseingang **Verkauf buchen**. Erst die erfolgreiche Serverantwort zählt als gebuchter Umsatz.
5. Unter **Umsätze** Mitarbeiterbeträge und Gesamtsumme für den gewünschten Zeitraum ansehen. **Gesamt** zeigt die gesamte Historie.
6. Über **Details → Buchung stornieren** kann jeder angemeldete Mitarbeiter eine Buchung mit Grund stornieren.

Mit „Angemeldet bleiben“ ist die Anmeldung auf dem Gerät 30 Tage gültig, auch nach Browser- und Server-Neustarts. Ohne diese Option gilt das Cookie für die Browser-Sitzung und die Anmeldung höchstens zwölf Stunden. Das Sortiment bleibt für alle angemeldeten Mitarbeiter bearbeitbar. Tagesgrenzen und Zeitangaben richten sich nach `Europe/Berlin`. Die Kassenansicht aktualisiert Karte und Tageswerte alle 30 Sekunden; in der Umsatzübersicht könnt ihr **Aktualisieren** wählen.

Preisänderungen betreffen neue Verkäufe. Enthält ein offener Warenkorb einen alten Preis, lehnt der Server die Buchung ab: den Artikel entfernen und mit dem aktuellen Preis erneut hinzufügen. Pausierte Artikel können nicht neu gebucht werden.

Die CSV-Datei lässt sich mit Excel öffnen und verwendet Semikolon als Trennzeichen sowie Komma als Dezimalzeichen. Jeder Datensatz ist eine Artikelposition. Status „Storniert“ beim Weiterrechnen herausfiltern. Der Export aus der Umsatzübersicht enthält alle Buchungen des gewählten Zeitraums und der ausgewählten Währung, während die Oberfläche nur die neuesten 50 Buchungen auflistet. Für Datenbanksicherungen zusätzlich die Export-/Backupmöglichkeiten eures PostgreSQL-Anbieters nutzen; der CSV-Export ist kein vollständiges Datenbank-Backup.

## Lagerbestand

Der erste Deploy dieser Erweiterung übernimmt **einmalig die 24 Bestände aus den Lagerbildern**: ausschließlich die Stückzahlen oben rechts, gleiche Artikel addiert. Die Grammangaben und die drei zusätzlichen Felder Orange Eclipse / Moonfire werden ausgelassen. Insgesamt sind es 1.196 Stück. Weitere Deployments ändern weder diese Bestände noch manuelle Inventuren. Die früheren Beispielartikel sind auch aus der Sortimentsverwaltung entfernt; die Datensätze bleiben für alte Buchungen erhalten.

Unter **Lager** seht ihr alle Bestände und könnt nach Artikeln suchen oder nur niedrige Bestände anzeigen. **Unter 30 Stück** erscheint eine Warnung; genau 30 zählt als ausreichend. In der Kasse stehen die Bestände direkt am Artikel. Bestand 0 sperrt den Verkauf. Alle Ansichten prüfen alle 30 Sekunden auf neu unterschrittene Bestände, die Kasse und das Lager aktualisieren ihre Bestandsanzeigen automatisch. Über **Bestand ändern** den neuen gesamten Bestand und einen Grund eingeben (Nachlieferung, Inventur, Bruch usw.). Das Bewegungsprotokoll erfasst Änderung, Bestand danach, Grund und Mitarbeiter.

Neue Verkäufe buchen Bestand und Umsatz gemeinsam in einer Datenbanktransaktion. Überverkauf und doppelte Abbuchungen durch wiederholte Anfragen werden verhindert. Ein Storno neuer Verkäufe gibt die Menge einmal zurück. Buchungen, die bereits vor Einführung des Lagers bestanden, wurden in der Foto-Inventur berücksichtigt und erhöhen beim Storno deshalb nicht nachträglich den Bestand.

## Einkauf und Konto

Unter **Einkauf** die Menge jedes eingekauften Artikels eingeben; 0 bedeutet nicht ausgewählt. Die Seite zeigt die Einkaufssumme und den voraussichtlichen Kontostand danach. Optional einen Lieferanten/Grund ergänzen und das Buchungsdatum festlegen. **Einkauf buchen** speichert in einer gemeinsamen Datenbanktransaktion:

1. Einkauf und Mengen mit den damaligen Einkaufspreisen,
2. Zuwachs im Lager samt Bewegungsprotokoll,
3. eine Ausgabe über den gesamten Einkaufspreis in Finanzen.

Der Kontostand entspricht dem gesamten Dollar-Saldo: Kassenumsatz + Mieteinnahmen + sonstige Einnahmen − Ausgaben. Der Einkauf reduziert diesen Saldo. Bei mehr Ausgaben als Einnahmen kann er negativ werden. Den Einkauf nicht zusätzlich als manuelle Ausgabe erfassen.

Die Einkaufspreise aus den Bildern und der Ergänzung werden einmalig eingespielt:

| Artikel | Einkauf pro Stück |
| --- | ---: |
| Magische E-Shisha | 3.000 $ |
| Trinkblut | 600 $ |
| Magische Kohle und alle sechs weiteren Aromen, inklusive Blutmondkirsche und Frostminze | 300 $ |
| Alle 15 weiteren Kartenartikel | 100 $ |

Einkaufspreise sind für jeden angemeldeten Mitarbeiter unter **Sortiment → Bearbeiten → Einkaufspreis ($)** änderbar. Bei neuen Artikeln ohne Einkaufspreis muss dieser zuerst ergänzt werden. Pausierte Artikel können eingekauft werden. Änderungen und weitere Deployments ändern weder historische Einkäufe noch Bestände oder Geldbeträge. Wiederholte Buchungsanfragen buchen die Mengen und Kosten nur einmal.

Unter **Letzte Einkäufe → Details** einen Einkauf mit Grund stornieren. Das zieht die Menge wieder vom Lager ab und storniert die Ausgabe; beide Änderungen erfolgen gemeinsam. Bereits verbrauchter Bestand darf nicht negativ werden: das Storno wird abgelehnt, wenn die nötige Menge nicht mehr vorhanden ist. Einkaufs-Ausgaben lassen sich deshalb ausschließlich über den zugehörigen Einkauf stornieren. Bei Verbindungsproblemen den gespeicherten Status über **Buchung prüfen** klären.

## VIP und Vermietung

Unter **VIP** liegen die Vermietungen außerhalb des Artikelwarenkorbs:

- **VIP Lounge:** 50.000 $ pro Stunde.
- **Oberer Bereich:** 100.000 $ für genau 1 Woche oder 250.000 $ für genau 4 Wochen.

Im Buchungsfenster Name, optional Familie, Nummer, Beginn und Tarif angeben. Beim Oberen Bereich gibt es ausschließlich die beiden festen Laufzeiten 1 Woche und 4 Wochen; ein Dauerfeld entfällt. Der Server setzt die Laufzeit automatisch und berechnet Enddatum und Preis. Die VIP Lounge bleibt stundenweise mit einer Dauer von 1 bis 52 Stunden buchbar. Die Vorschau zeigt Zeitraum und Preis vor dem Speichern. Wochen behalten die Berliner Uhrzeit bei Zeitumstellungen bei. Bereits gespeicherte Vermietungen behalten ihren ursprünglichen Zeitraum und Preis.

Die VIP-Seite zeigt Name, Familie, Nummer, Beginn, Ende, Preis, Mitarbeiter und Status. Suchbar und filterbar nach aktiv/geplant, beendet, storniert oder allen Vermietungen. **VIP Lounge und Oberer Bereich können im gleichen Zeitraum vermietet werden**, auch an verschiedene Gäste. Beide Vermietungen werden über die jeweiligen Schaltflächen separat gebucht und erhalten eigene Mieteinnahmen. Überschneidungen im selben Bereich sind gesperrt; die Fehlermeldung nennt den betroffenen Bereich. **Beim Buchen wird die gesamte Miete als Einnahme am Buchungstag in Finanzen erfasst**; bei Bedarf erst nach dem Zahlungseingang buchen. Vermietungsstornos mit Grund geben nur den Zeitraum des stornierten Bereichs frei und stornieren seine verknüpfte Einnahme gemeinsam.

## Finanzen

Unter **Finanzen** sonstige Einnahmen und Ausgaben in Dollar erfassen: positiver Betrag, Buchungsdatum und Grund sind Pflicht. Der Mitarbeiter wird aus der Anmeldung übernommen. Einträge bleiben bei Storno sichtbar, zählen aber nicht mehr zu den Summen. Mietbeträge werden automatisch erfasst und dürfen nicht zusätzlich als sonstige Einnahme gebucht werden.

Die Übersicht zeigt Kassenumsatz, Vermietungen, sonstige Einnahmen, Ausgaben, gesamte Einnahmen und **Saldo = Kassenumsatz + Vermietungen + sonstige Einnahmen − Ausgaben**. Zeitraumfilter begrenzen Summen und Liste; Euro-Altumsätze werden nicht mit Dollarbeträgen vermischt. Das ist eine Einnahmen-/Ausgabenübersicht, keine automatische Gewinn- oder Steuerberechnung. Die letzten 200 Finanzbuchungen werden angezeigt. Vermietungen werden auf der VIP-Seite storniert.

Offene Lager-/VIP-/Finanzanfragen bleiben bei Verbindungsfehlern mit derselben Buchungsnummer im Browser gespeichert. Über **Buchung prüfen** wird das Ergebnis sicher abgefragt, bevor eine neue Buchung erfasst werden kann.

## Technik und Prüfung

Node.js, Express, PostgreSQL (`pg`), lokale PostgreSQL-Engine (`PGlite`), HTML/CSS/JavaScript ohne Buildschritt. Bilder und Schriften laden ohne externe Dienste. Buchungsbeträge werden serverseitig aus aktuellen Preisen berechnet, Mitarbeitende werden aus der Sitzung zugeordnet. Sitzungen verwenden HttpOnly-Cookies, im Produktionsmodus HTTPS. Die Artikelverwaltung ist für alle angemeldeten Mitarbeiter offen. Das gemeinsame Bar-Passwort wird ausschließlich auf dem Server gegen einen gesalzenen scrypt-Verifikator geprüft. Namen ordnen die Buchungen weiterhin dem jeweiligen Mitarbeiter zu. Das Passwort wird weder im Frontend noch im Browser-Speicher abgelegt.

```powershell
npm run check
npm test
```

Die Integrationstests prüfen Berechnung und Mitarbeiterzuordnung, doppelte und gleichzeitige Requests, Preisänderungen, ungültige Mengen, Stornos, Berliner Tagesgrenzen, CSV und dauerhafte lokale Speicherung. Zusätzlich prüfen sie die 24 Foto-Bestände, konkurrierende Verkäufe, Stock-Stornos, einmalige Datenmigration, feste Miettarife, Wochenlaufzeiten, Sommerzeit, Reservierungskonflikte sowie Finanzsummen und -stornos sowie Passwortschutz, dauerhafte/abgelaufene Sitzungen, die 24 Einkaufspreise, Einkaufsabrechnung, Bestandszuwachs, Wiederholungen und Einkaufsstornos. Sie verwenden eigene isolierte Testdatenbanken.

Dateien: `server.js` startet die App; `lib/app.js` enthält die API; `lib/database.js` verwaltet Datenbank und Tabellen; `public/` enthält die Oberfläche; `render.yaml` bereitet das Hosting vor.
