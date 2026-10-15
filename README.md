# Gentlemans Bar · Die Kasse

Eine responsive Kasse in Schwarz, Oliv und Gold, gestaltet mit eurem Emblem und Flyer. Die Oberfläche ist auf Deutsch.

## Was enthalten ist

- Anmeldung mit Mitarbeitername und gemeinsamem Bar-Passwort; optional 30 Tage angemeldet bleiben. Derselbe Name wird unabhängig von Groß-/Kleinschreibung wiedererkannt.
- Mitarbeiterliste mit mehreren auswählbaren Rängen je Person und frei eintragbarer Abteilung, Rauswerfen aus der Liste, Wiederherstellen, Abmelden auf allen Geräten und Deaktivieren.
- Individuelle Zugriffsrechte je Mitarbeiter per Häkchen, ausschließlich durch Inhaber und Manager einstellbar; alternativ weiter Rechte aus den Rängen übernehmen.
- Rollenrechte: Inhaber und Manager mit Vollzugriff, beide Leitungen für alle Arbeitsbereiche und Statistiken, Barkeeper für Kasse und Security für Eintritt; kombinierbar.
- Stempeluhr auf jeder Seite mit Arbeitsrangwahl, Lohnberechnung und separater Lohnübersicht samt Bankauszahlung.
- Mitarbeiterstatistik mit Zeitraum, Suche, Rang-/Statusfiltern, Sortierung, Einzelhistorie und CSV-Export.
- Lieferoption pro Kassenzettel mit einmalig 1.000 $ Lieferlohn für den buchenden Mitarbeiter.
- Eintritt mit Preis pro Person, Personenanzahl, Zahlungsart und automatischer Gutschrift in Finanzen und Kassenstand.
- Events-Seite für Mitarbeiter: Termine mit Datum und Uhrzeit eintragen, bearbeiten und löschen; Beschreibung und Ende sind optional.
- Artikelliste mit Kategorien und Suche, Mengenauswahl, Warenkorb und exakter Berechnung in Cent.
- Rabatt von 0–100 % auf den ganzen Kassenzettel, mit Zwischensumme, Rabattbetrag und Endbetrag.
- Verkauf buchen mit Kennzeichnung „Bar“ oder „Karte“. Die Seite erfasst die Zahlung; sie belastet keine Karte und verbindet kein Kartenterminal.
- Umsatz pro Mitarbeiter, Gesamtumsatz, Tages-/Wochen-/Monatsübersicht und eigene Datumsfilter.
- Buchungsdetails, meistverkaufte Artikel und CSV-Export aller Positionen im gewählten Zeitraum.
- Artikelverwaltung für Inhaber, Manager und beide Leitungen: Preise ändern, Artikel hinzufügen und pausieren.
- Storno mit Begründung. Die ursprüngliche Buchung bleibt sichtbar und zählt nicht mehr zum Umsatz.
- Eigene Einkaufsseite: Einkaufsmengen erfassen, Einkaufspreise berechnen, Bestand erhöhen und Kosten automatisch als Ausgabe buchen.
- Lagerbestand mit Warnungen unter 30 Stück, automatischem Abzug bei Verkäufen, Rückgabe bei Storno und Bestandsänderungen mit Grund.
- Separate VIP-Seite für VIP Lounge und Oberen Bereich mit Kundendaten, Mietzeitraum und automatischer Mieteinnahme.
- Finanzen mit sonstigen Einnahmen, Ausgaben, Pflichtgrund, Stornos und Gesamtsaldo.
- Kassenstand mit Bankguthaben, Übergangskonto, Bargeld pro Mitarbeiter, manuellen Anfangsbeständen und Bankeinzahlungen ohne zusätzlichen Umsatz.
- Zentrale PostgreSQL-Datenbank auf Render für mehrere Geräte. Doppelte Buchungsanfragen werden abgefangen.
- Ein lokal gespeicherter Warenkorb pro Mitarbeiter. Bei Verbindungsabbruch bleibt eine offene Buchung gesperrt, bis ihr ihren Status über „Buchung prüfen“ erneut prüft.

Die Kasse enthält **24 Artikel aus eurer Speise- und Shishakarte** mit den bestätigten **Dollarpreisen (USD)**. Dazu gehören Essen, alkoholische und alkoholfreie Getränke, Kaffeespezialitäten, Zigaretten & Zigarren, Spezielles, die Magische E-Shisha und sieben Aromen. Die Preise 250 bzw. 5.000 auf den Karten werden als **250 $ bzw. 5.000 $** übernommen. Artikel und Preise bleiben unter „Sortiment“ bearbeitbar.

Beim ersten Start mit dieser Version wird die Karte auch in bestehenden Datenbanken automatisch eingespielt. Alte Beispielartikel werden aus Kasse und Sortiment archiviert; selbst angelegte zusätzliche Artikel bleiben erhalten. Die Umstellung auf die echte Karte erfolgt einmalig. Weitere Starts oder Deployments überschreiben eure späteren Preisänderungen nicht.

Neue Verkäufe werden nach dem Kartenimport in USD gebucht. Bestehende Buchungen behalten ihre ursprünglichen Artikel, Preise und Währungen. Falls noch Euro-Umsätze aus der vorherigen Version vorhanden sind, könnt ihr in „Umsätze“ zwischen Dollar und Euro wählen. Die Summen werden je Währung getrennt berechnet; es findet keine Währungsumrechnung statt. Nach dem ersten Verkauf lässt sich die Währung über „Sortiment“ nicht mehr ändern.

## Rabatt im Kassenzettel

In **Kasse → Aktuelle Bestellung → Rabatt** einen Prozentsatz von **0 bis 100 %** eingeben, bei Bedarf mit bis zu zwei Nachkommastellen. Zwischensumme, abgezogener Rabattbetrag und Endbetrag werden sofort angezeigt. Der Rabatt gilt für die ganze Bestellung. Der Rabattbetrag wird auf volle Cent gerundet und von der Zwischensumme abgezogen. Beispiel: 1.000 $ mit 20 % Rabatt ergeben 200 $ Rabatt und 800 $ Gesamtbetrag.

Beim Buchen berechnet der Server den Rabatt aus den tatsächlichen Artikelpreisen. Umsatz pro Mitarbeiter, Gesamtumsatz, Finanzen und Bar-/Kartengeldbestände verwenden den Betrag nach Rabatt. Auch bei **100 %** wird die vollständige Menge aus dem Lager abgezogen, mit einem Endbetrag von **0 $**. Ein Storno gibt die Artikel zurück und korrigiert nur das tatsächlich gebuchte Geld.

Der Rabatt bleibt zusammen mit dem Warenkorb beim Neuladen oder einer offenen Buchung gespeichert. Nach erfolgreichem Verkauf oder Leeren des Warenkorbs beginnt die nächste Bestellung wieder bei **0 %**. Während der Buchungsstatus offen ist, ist das Rabattfeld gesperrt. Bereits gespeicherte Verkäufe behalten ihren Rabatt; Altbuchungen haben 0 % und behalten ihre ursprünglichen Beträge. Weitere Deployments setzen keine Rabatte oder Umsätze zurück.

Die **Buchungsdetails** zeigen Zwischensumme, Rabatt und Endbetrag. Im **CSV-Export** stehen die Positionssummen vor/nach Rabatt, der Positionsrabatt sowie Rabattprozentsatz, Rabatt der Buchung und tatsächlicher Buchungsbetrag. Die beiden Buchungsbeträge wiederholen sich je Artikelzeile und dürfen beim Summieren der CSV nicht mehrfach pro Buchung gezählt werden. Für Umsätze der Favoriten und CSV-Positionssummen wird der Rabatt anteilig auf die Artikel verteilt; Rundungscent werden so verteilt, dass alle Positionen exakt den Endbetrag ergeben.

## Anmeldung und Angemeldet bleiben

Mit eurem Namen und dem vereinbarten gemeinsamen Passwort anmelden. **Angemeldet bleiben** ist standardmäßig aktiviert und hält die Anmeldung auf diesem Gerät **30 Tage** gültig. Der zuletzt verwendete Name wird dabei vorausgefüllt. Das Passwort wird dabei nicht im Browser-Speicher gespeichert. Über Abmelden endet die Sitzung sofort. Ohne die Option wird ein Browser-Sitzungscookie mit maximal zwölf Stunden Gültigkeit verwendet.

Beim ersten Deploy der Passwort-Erweiterung werden die bisherigen Sitzungen ohne Passwortnachweis ungültig: einmal erneut anmelden. Alle Mitarbeiter, Umsätze und Bestände bleiben erhalten. Weitere Deployments mit demselben Passwort erhalten die angemeldeten Sitzungen. Optional kann **BAR_PASSWORD** in Render Environment oder einer lokalen .env überschrieben werden; ein Wechsel macht vorhandene Sitzungen ungültig. Der Vorgabewert ist als gesalzener Verifikator im Server hinterlegt, daher ist kein zusätzlicher Render-Wert notwendig.

## Rollen und Eintritt

Die Tabelle zeigt die Standardrechte, solange für eine Person keine individuellen Zugriffsrechte festgelegt sind. Die Ränge bestimmen weiterhin den Stundenlohn. Inhaber und Manager behalten immer Vollzugriff.

| Rolle | Zugriff |
| --- | --- |
| Inhaber | Alle Seiten und Funktionen |
| Manager | Alle Seiten und Funktionen |
| Barkeeper Leitung / Security Leitung | Kasse, Eintritt, Lager, Einkauf, VIP, Events, Mitarbeiter, Sortiment und Statistiken; eigener Lohn |
| Barkeeper | Kasse, eigene Verkäufe und eigene Verkaufsstornos; eigener Lohn |
| Security | Eintritt buchen, eigene Eintritte ansehen und stornieren; eigener Lohn |

Unter **Mitarbeiter → Rolle & Abteilung** einen oder mehrere Ränge ankreuzen. Die Rechte aller Ränge werden kombiniert: **Barkeeper + Security** erlaubt Kasse und Eintritt. Die Abteilung bleibt frei eintragbar und verändert keine Rechte. Beide Leitungen dürfen die Arbeitsbereiche vollständig bearbeiten und Mitarbeiter unterhalb des Managements verwalten. Inhaber/Manager vergeben oder ändern Management-Ränge und verwalten Management-Mitglieder. Finanzen, Kassenstand und Lohnauszahlungen sind standardmäßig Inhabern/Managern vorbehalten; über die individuellen Zugriffsrechte können sie diese Bereiche freigeben. Änderungen gelten sofort für bestehende Sitzungen; direkte API-Aufrufe werden ebenfalls geprüft. Mindestens ein aktiver Inhaber oder Manager bleibt erhalten. **Michael Black** bekommt bei Einführung einmalig die Inhaberrolle; spätere Rollenänderungen werden durch Deployments nicht überschrieben. Neue Namen erhalten zunächst „Barkeeper“. Bisherige einzelne Ränge werden beim Update einmalig übernommen.

Die Anmeldung verwendet weiterhin Namen und das gemeinsame Bar-Passwort. Wer dieses Passwort kennt, kann einen anderen Namen eingeben und dessen Rolle verwenden; die Anmeldung ist deshalb kein Nachweis einer persönlichen Identität.

Unter **Eintritt** Preis pro Person in Dollar, Anzahl und Zahlungsart angeben. Der Gesamtbetrag wird aus **Preis × Menge** berechnet. Eine Buchung erzeugt gemeinsam einen Eintrittsdatensatz, eine Finanz-Einnahme mit der Art „Eintritt“ und eine Geldbewegung: **Bar** liegt beim buchenden Mitarbeiter, **Karte** auf dem Übergangskonto und **Bank** direkt auf dem Bankkonto. Die Einnahme nicht zusätzlich manuell erfassen. Security sieht die eigenen Buchungen; Inhaber, Manager und beide Leitungen sehen alle. **Stornieren** verlangt einen Grund und korrigiert Eintritt, Finanz-Einnahme und Geldbestand zusammen; nach einer Bankeinzahlung wird bereits abgegebenes Geld über die Bank erstattet. Wiederholungen erzeugen keine zweite Einnahme. Weitere Deployments erhalten alle Buchungen und Geldbestände.

Die Mitarbeitertermine bleiben sichtbar: Auf Kasse und Eintritt gibt es **Nächste Events fürs Team** zum Aufklappen. Inhaber, Manager und beide Leitungen verwalten die Termine auf der Events-Seite.

## Individuelle Zugriffsrechte

Als Inhaber oder Manager unter **Mitarbeiter → Zugriffsrechte** bei der gewünschten Person **Individuelle Rechte festlegen** aktivieren. Danach die benötigten Bereiche ankreuzen und **Rechte speichern** wählen. Verfügbar sind Kasse, Eintritt, Umsätze, eigene Löhne, Lohnverwaltung/Auszahlung, Statistiken, Lager, Einkauf, VIP, Events, Finanzen, Kassenstand, Mitarbeiter und Sortiment. Ein Haken erlaubt den Bereich einschließlich seiner Buchungs- und Bearbeitungsfunktionen. „Umsätze“ erlaubt alle Kassenzettel und Verkaufsstornos; „Statistiken“ allein erlaubt die Einzelhistorien und Kassenzettel lesend. Unter Kasse und Eintritt gelten ohne weitere Freigaben weiterhin die eigenen Buchungen.

**Alle auswählen** oder **Alle abwählen** setzen die Haken gemeinsam. Auch ohne freigegebene Seiten kann eine Person angemeldet bleiben und ihre Stempeluhr nutzen. **Eigene Löhne** zeigt nur die eigene Abrechnung; **Löhne verwalten & auszahlen** erlaubt zusätzlich Teamlöhne, das Beenden fremder Schichten und Bankauszahlungen. Beim Aktivieren wird „Eigene Löhne“ mit aktiviert. Einkauf zeigt das für die Buchung benötigte Bankguthaben, braucht aber keine Freigabe der Kassenstand-Seite.

Die individuelle Auswahl ersetzt die Standardrechte aus den Rängen. Zum Wiederherstellen der Rangrechte **Individuelle Rechte festlegen** abwählen und speichern. Individuelle Haken überstehen Rangänderungen, neue Anmeldungen und Deployments. Änderungen gelten beim nächsten API-Aufruf; die sichtbare Navigation wird spätestens bei der nächsten Aktualisierung nach 30 Sekunden oder beim Neuladen angepasst. Ausgeblendete Bereiche sind auch über direkte API-Aufrufe gesperrt. Bei individueller Auswahl ohne „Events“ entfallen auch die Eventhinweise in Kasse und Eintritt.

Nur **Inhaber und Manager** dürfen diese Auswahl speichern. Das Mitarbeiterrecht allein erlaubt keine Rechtevergabe und keine Änderung von Management-Mitgliedern oder Zuweisung von Management-Rängen. Bei Rangänderungen durch andere berechtigte Mitarbeiter bleiben die bisherigen Zugriffsrechte erhalten. Inhaber und Manager haben immer Vollzugriff und können sich über Haken nicht aussperren. Die bisherigen Einstellungen, Umsätze und Geldbestände werden durch das Update nicht verändert.

## Mitarbeiterliste

Unter **Mitarbeiter** erscheinen alle Namen, die sich bisher angemeldet haben, einschließlich abgemeldeter und deaktivierter Personen. Entfernte Personen werden in der normalen Liste und ihren Zählern ausgeblendet; sie sind ausschließlich über den Filter **Entfernte Mitarbeiter** sichtbar. Die Übersicht zeigt Rolle, Abteilung, letzte Anmeldung, Anzahl gültiger Anmeldungen und noch vorhandenes Bargeld. Nach Name, Rolle oder Abteilung suchen oder nach aktiv, angemeldet und deaktiviert filtern. Eine gültige Anmeldung ist kein Nachweis, dass die Person gerade die Seite geöffnet hat.

Über **Rolle & Abteilung → Ränge** eine oder mehrere der sechs Vorgaben auswählen: **Inhaber, Manager, Barkeeper Leitung, Barkeeper, Security Leitung, Security**. Mindestens ein Rang muss ausgewählt sein. Eigene Jobnamen lassen sich nicht speichern. Die **Abteilung** ist ein freies Textfeld, etwa „Bar“, „Küche“ oder „VIP-Service“, und darf leer bleiben. Ohne individuelle Freigaben bestimmen die Ränge gemeinsam den Zugriff gemäß der obigen Tabelle.

**Rauswerfen** entfernt die Person aus der normalen Mitarbeiterliste, beendet alle Anmeldungen und sperrt die erneute Anmeldung mit diesem Namen. Das funktioniert auch bei bereits abgemeldeten oder deaktivierten Mitarbeitern. Über **Entfernte Mitarbeiter → Wiederherstellen** lässt sich die Person mit derselben Mitarbeiter-ID, Rolle und Abteilung zurückholen; dann kann sie sich wieder anmelden. Umsätze, Buchungen und Bargeld werden dabei nicht gelöscht. Eigene Entfernung ist gesperrt; ein anderer Inhaber oder Manager kann dies übernehmen. **Anmeldungen beenden** meldet eine Person auf allen Geräten ab, behält sie in der Mitarbeiterliste und lässt die erneute Anmeldung zu. **Deaktivieren** beendet zusätzlich die Anmeldungen und sperrt die erneute Anmeldung mit diesem Namen, auch mit anderer Groß-/Kleinschreibung. Weil die Anmeldung weiterhin einen frei gewählten Namen und das gemeinsame Passwort verwendet, ist diese Sperre an den Namen gebunden. Über **Wieder aktivieren** kann die Person mit ihrer bisherigen Mitarbeiter-ID zurückkehren. Niemand kann sich selbst deaktivieren; ein anderer Inhaber oder Manager kann dies übernehmen.

Es werden keine Mitarbeiterdaten gelöscht: bisherige Umsätze, Buchungen, Bargeldbestände und Zuordnungen bleiben bei Rauswurf oder Deaktivierung erhalten. Offenes Bargeld bleibt auch unter **Kassenstand** sichtbar und kann weiterhin auf die Bank eingezahlt werden. Beim ersten Update auf die feste Jobliste werden bekannte Jobs einheitlich geschrieben. Frühere eigene Jobnamen und „Mitarbeiter“ werden einmalig zu „Barkeeper“ mit denselben Kassenrechten. Die gewünschte andere Rolle danach in der Job-Auswahl setzen. Abteilungen, Anmeldungen, Sperren, Umsätze und Geldbestände bleiben erhalten. Spätere Deployments bewahren die eingetragenen Angaben und Sperren.

## Stempeluhr und Löhne

Oben in der Leiste ist auf jeder Seite die **Stempeluhr** sichtbar. **Einstempeln** öffnet die Auswahl der eigenen zugewiesenen Ränge. Genau einen Arbeitsrang für die Schicht auswählen:

| Arbeitsrang | Stundenlohn |
| --- | ---: |
| Barkeeper / Security | 10.000 $ |
| Barkeeper Leitung / Security Leitung | 15.000 $ |
| Inhaber / Manager | 20.000 $ |

Mehrere Ränge erzeugen keinen doppelten Lohn. Pro Mitarbeiter läuft höchstens eine Schicht; für einen Rangwechsel zuerst ausstempeln und dann neu einstempeln. **Ausstempeln** beendet die Schicht und merkt den Lohn sekundengenau anteilig auf volle Cent gerundet vor. Der gewählte Rang und Tarif bleiben für diese Schicht gespeichert, auch wenn später die Ränge geändert werden. Zeit und Lohn berechnet der Server. Anmeldungen auf mehreren Geräten zeigen dieselbe Schicht. Abmelden, Neuladen und Deployments beenden die Schicht nicht automatisch. Rauswerfen oder Deaktivieren beendet eine laufende Schicht; der verdiente Lohn bleibt erhalten.

Unter **Löhne** sehen Mitarbeiter ihre eigenen Arbeitszeiten, Lohnpositionen und bisherigen Auszahlungen. Inhaber, Manager und Personen mit dem Recht „Löhne verwalten & auszahlen“ sehen das ganze Team, können vergessene Schichten beenden und über **Lohn auszahlen** den offenen Betrag auszahlen. Ausgezahlt werden abgeschlossene Schichten und vorgemerkter Lieferlohn; laufende Schichten werden erst nach dem Ausstempeln ergänzt. Der Button erzeugt gemeinsam eine Bankabbuchung, eine Finanz-Ausgabe und einen Auszahlungsnachweis. Bargeld beim Mitarbeiter und das Karten-Übergangskonto bleiben unverändert. Es muss genug Bankguthaben vorhanden sein. Pro Auszahlung sind bis zu 10.000.000 $ möglich. Doppelte Speicheranfragen zahlen denselben Lohn nur einmal aus; eine inzwischen geänderte Lohnsumme verlangt eine aktualisierte Übersicht. Alte Umsätze bekommen rückwirkend keinen Lohn.

## Lieferungen

In der Kasse beim Kassenzettel **Lieferung** ankreuzen. Ein erfolgreich gebuchter Kassenzettel merkt **einmalig 1.000 $ Lieferlohn** für den buchenden Mitarbeiter vor, unabhängig von Artikel- und Stückzahl. Die Bestellung bleibt zu ihren normalen Preisen und Rabatten gebucht. Der Bonus erhöht den Verkaufspreis nicht und belastet die Bank erst bei **Löhne → Lohn auszahlen**. Die Lieferoption bleibt im offenen Warenkorb gespeichert und wird nach erfolgreichem Verkauf zurückgesetzt. Buchungsdetails und Verkaufs-CSV zeigen die Kennzeichnung.

Wird eine Lieferung storniert, entfällt ihr noch nicht ausgezahlter Lieferlohn. Bereits ausgezahlter Lieferlohn wird als negative Lohnposition mit künftigem Lohn verrechnet; das Storno bucht keinen fiktiven Geldrückfluss auf die Bank. Die Statistik berücksichtigt diese Korrekturen.

## Mitarbeiterstatistik

Unter **Statistiken** können Inhaber, Manager und beide Leitungen alle Mitarbeiter vergleichen. Zeitraum (Heute, 7 Tage, Monat, Gesamt oder Datum), Name/Abteilung, Rang und Status filtern; beispielsweise nach Einnahmen, Arbeitszeit, offenem Lohn, Lieferungen oder Name auf- und absteigend sortieren. Mehrfach zugewiesene Ränge sind bei jedem passenden Rangfilter enthalten.

**Alle Details** zeigt pro Person Artikelverkäufe, Stornos, Eintritte, Vermietungen, Einkauf, sonstige Einnahmen/Ausgaben, Arbeitszeit, Löhne, Lieferungen und Lagerbewegungen. Über **Weitere Einträge laden** die Historie weiterblättern. Der Mitarbeiter-CSV enthält sämtliche Einträge des Zeitraums; der Überblick-CSV alle Mitarbeiter im Zeitraum. Summen sind in USD; Euro-Altverkäufe bleiben in der Einzelhistorie mit ihrer ursprünglichen Währung sichtbar. Arbeitszeit wird auf den Zeitraum begrenzt; **Lohn offen** und **Bargeld** zeigen ausdrücklich den aktuellen Stand. Entfernte Mitarbeiter und ihre Historie bleiben abrufbar. Einkäufe und manuelle Finanzbuchungen werden nach ihrem Buchungsdatum gefiltert, Verkäufe nach ihrem Erfassungszeitpunkt (Europe/Berlin).

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

Die Anmeldung benötigt einen Namen und das vereinbarte gemeinsame Bar-Passwort. Inhaber und Manager können Artikel und Preise bearbeiten, die Währung vor dem ersten Verkauf festlegen und Buchungen mit Begründung stornieren.

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
6. Über **Details → Buchung stornieren** können Barkeeper ihre eigenen Verkäufe mit Grund stornieren; Inhaber, Manager und beide Leitungen dürfen alle Verkäufe stornieren.

Mit „Angemeldet bleiben“ ist die Anmeldung auf dem Gerät 30 Tage gültig, auch nach Browser- und Server-Neustarts. Ohne diese Option gilt das Cookie für die Browser-Sitzung und die Anmeldung höchstens zwölf Stunden. Das Sortiment ist für Inhaber, Manager und beide Leitungen bearbeitbar. Tagesgrenzen und Zeitangaben richten sich nach `Europe/Berlin`. Die Kassenansicht aktualisiert Karte und Tageswerte alle 30 Sekunden; in der Umsatzübersicht könnt ihr **Aktualisieren** wählen.

Preisänderungen betreffen neue Verkäufe. Enthält ein offener Warenkorb einen alten Preis, lehnt der Server die Buchung ab: den Artikel entfernen und mit dem aktuellen Preis erneut hinzufügen. Pausierte Artikel können nicht neu gebucht werden.

Die CSV-Datei lässt sich mit Excel öffnen und verwendet Semikolon als Trennzeichen sowie Komma als Dezimalzeichen. Jeder Datensatz ist eine Artikelposition. Status „Storniert“ beim Weiterrechnen herausfiltern. Der Export aus der Umsatzübersicht enthält alle Buchungen des gewählten Zeitraums und der ausgewählten Währung, während die Oberfläche nur die neuesten 50 Buchungen auflistet. Für Datenbanksicherungen zusätzlich die Export-/Backupmöglichkeiten eures PostgreSQL-Anbieters nutzen; der CSV-Export ist kein vollständiges Datenbank-Backup.

## Lagerbestand

Der erste Deploy dieser Erweiterung übernimmt **einmalig die 24 Bestände aus den Lagerbildern**: ausschließlich die Stückzahlen oben rechts, gleiche Artikel addiert. Die Grammangaben und die drei zusätzlichen Felder Orange Eclipse / Moonfire werden ausgelassen. Insgesamt sind es 1.196 Stück. Weitere Deployments ändern weder diese Bestände noch manuelle Inventuren. Die früheren Beispielartikel sind auch aus der Sortimentsverwaltung entfernt; die Datensätze bleiben für alte Buchungen erhalten.

Unter **Lager** seht ihr alle Bestände und könnt nach Artikeln suchen oder nur niedrige Bestände anzeigen. **Unter 30 Stück** erscheint eine Warnung; genau 30 zählt als ausreichend. In der Kasse stehen die Bestände direkt am Artikel. Bestand 0 sperrt den Verkauf. Alle Ansichten prüfen alle 30 Sekunden auf neu unterschrittene Bestände, die Kasse und das Lager aktualisieren ihre Bestandsanzeigen automatisch. Über **Bestand ändern** den neuen gesamten Bestand und einen Grund eingeben (Nachlieferung, Inventur, Bruch usw.). Das Bewegungsprotokoll erfasst Änderung, Bestand danach, Grund und Mitarbeiter.

Neue Verkäufe buchen Bestand und Umsatz gemeinsam in einer Datenbanktransaktion. Überverkauf und doppelte Abbuchungen durch wiederholte Anfragen werden verhindert. Ein Storno neuer Verkäufe gibt die Menge einmal zurück. Buchungen, die bereits vor Einführung des Lagers bestanden, wurden in der Foto-Inventur berücksichtigt und erhöhen beim Storno deshalb nicht nachträglich den Bestand.

## Einkauf und Konto

Unter **Einkauf** die Menge jedes eingekauften Artikels eingeben; 0 bedeutet nicht ausgewählt. Die Seite zeigt die Einkaufssumme und den voraussichtlichen Bankbestand danach. Optional einen Lieferanten/Grund ergänzen und das Buchungsdatum festlegen. **Einkauf buchen** speichert in einer gemeinsamen Datenbanktransaktion:

1. Einkauf und Mengen mit den damaligen Einkaufspreisen,
2. Zuwachs im Lager samt Bewegungsprotokoll,
3. eine Ausgabe über den gesamten Einkaufspreis in Finanzen.

Ein Einkauf reduziert sowohl das Bankguthaben unter **Kassenstand** als auch den Dollar-Saldo der Buchungshistorie unter **Finanzen**. Bargeld beim Team und das Übergangskonto werden dabei nicht belastet. Bei mehr Ausgaben als Bankguthaben kann die Bank negativ werden. Den Einkauf nicht zusätzlich als manuelle Ausgabe erfassen.

Die Einkaufspreise aus den Bildern und der Ergänzung werden einmalig eingespielt:

| Artikel | Einkauf pro Stück |
| --- | ---: |
| Magische E-Shisha | 3.000 $ |
| Trinkblut | 600 $ |
| Magische Kohle und alle sechs weiteren Aromen, inklusive Blutmondkirsche und Frostminze | 300 $ |
| Alle 15 weiteren Kartenartikel | 100 $ |

Einkaufspreise sind für Inhaber, Manager und beide Leitungen unter **Sortiment → Bearbeiten → Einkaufspreis ($)** änderbar. Bei neuen Artikeln ohne Einkaufspreis muss dieser zuerst ergänzt werden. Pausierte Artikel können eingekauft werden. Änderungen und weitere Deployments ändern weder historische Einkäufe noch Bestände oder Geldbeträge. Wiederholte Buchungsanfragen buchen die Mengen und Kosten nur einmal.

Unter **Letzte Einkäufe → Details** einen Einkauf mit Grund stornieren. Das zieht die Menge wieder vom Lager ab und storniert die Ausgabe; beide Änderungen erfolgen gemeinsam. Bereits verbrauchter Bestand darf nicht negativ werden: das Storno wird abgelehnt, wenn die nötige Menge nicht mehr vorhanden ist. Einkaufs-Ausgaben lassen sich deshalb ausschließlich über den zugehörigen Einkauf stornieren. Bei Verbindungsproblemen den gespeicherten Status über **Buchung prüfen** klären.

## Events fürs Team

Unter **Events → Event eintragen** einen Eventnamen, Datum und Uhrzeit eingeben. **Infos für das Team** und ein Endzeitpunkt sind optional. Inhaber, Manager und beide Leitungen können die Termine sehen, bearbeiten und über **Details → Löschen** entfernen. Andere Mitarbeiter sehen kommende Termine als Hinweis auf Kasse oder Eintritt. Das Löschen benötigt eine Bestätigung. Eventzeiten gelten für **Europe/Berlin**; ungültige Daten und Uhrzeiten während der Zeitumstellung werden abgelehnt.

Die Übersicht zeigt kommende und laufende Termine zuerst, mit Suche und Filtern für **Kommend & laufend**, **Alle Events** und **Vergangen**. Ohne Endzeitpunkt erscheint ein Termin ab seiner Startzeit unter „Vergangen“; mit Endzeitpunkt erscheint er dazwischen als „Läuft gerade“. Wer den Termin eingetragen und zuletzt bearbeitet hat, wird angezeigt. Die Seite aktualisiert sich alle 30 Sekunden, wenn kein Dialog geöffnet ist.

Events werden zentral in PostgreSQL gespeichert und bleiben nach weiteren Deployments erhalten. Wiederholte Speicheranfragen erzeugen keinen zweiten Termin. Gleichzeitige Änderungen werden erkannt: vor erneutem Bearbeiten oder Löschen die aktuelle Liste laden. Eventplanung verändert keine Umsätze, Geldbestände, Lagerbestände oder VIP-Vermietungen.

## VIP und Vermietung

Unter **VIP** liegen die Vermietungen außerhalb des Artikelwarenkorbs:

- **VIP Lounge:** 50.000 $ pro Stunde.
- **Oberer Bereich:** 100.000 $ für genau 1 Woche oder 250.000 $ für genau 4 Wochen.

Im Buchungsfenster Name, optional Familie, Nummer, Beginn und Tarif angeben. Beim Oberen Bereich gibt es ausschließlich die beiden festen Laufzeiten 1 Woche und 4 Wochen; ein Dauerfeld entfällt. Der Server setzt die Laufzeit automatisch und berechnet Enddatum und Preis. Die VIP Lounge bleibt stundenweise mit einer Dauer von 1 bis 52 Stunden buchbar. Die Vorschau zeigt Zeitraum und Preis vor dem Speichern. Wochen behalten die Berliner Uhrzeit bei Zeitumstellungen bei. Bereits gespeicherte Vermietungen behalten ihren ursprünglichen Zeitraum und Preis.

Die VIP-Seite zeigt Name, Familie, Nummer, Beginn, Ende, Preis, Mitarbeiter und Status. Suchbar und filterbar nach aktiv/geplant, beendet, storniert oder allen Vermietungen. **Mehrere Gäste können denselben Bereich im gleichen Zeitraum buchen**, sowohl die VIP Lounge als auch den Oberen Bereich. Auch beide Bereiche können gleichzeitig vermietet werden. Es gibt keine Sperre für überlappende Zeiträume. Jeden Gast separat über die jeweilige Schaltfläche buchen; jede Buchung erhält ihre eigene Mieteinnahme zum gewählten Tarif. **Beim Buchen wird die gesamte Miete als Einnahme am Buchungstag in Finanzen erfasst**; bei Bedarf erst nach dem Zahlungseingang buchen. Ein Storno mit Grund storniert nur die ausgewählte Vermietung und ihre verknüpfte Einnahme; die Buchungen anderer Gäste bleiben bestehen.

In beiden Buchungsfenstern gibt es zwei unabhängige Ankreuzfelder:

- **Kostenlos:** Miete 0 $. Der normale Zeitraum gilt weiterhin, solange „Unbegrenzt“ nicht gewählt wird. Es werden keine Mieteinnahme und keine Geldbewegung erzeugt.
- **Unbegrenzt:** kein Enddatum. Die Buchung bleibt ab ihrem Beginn aktiv, bis sie storniert wird; vor ihrem Beginn erscheint sie als geplant. Ohne „Kostenlos“ wird der ausgewählte Tarif einmalig berechnet: 50.000 $ für die VIP Lounge oder 100.000 $ / 250.000 $ für den Oberen Bereich. Es entstehen keine automatischen Folgebuchungen. Bei der VIP Lounge entfällt das Dauerfeld.
- **Beide angekreuzt:** kostenlos und ohne Enddatum.

Die Vorschau zeigt Enddatum bzw. „Unbegrenzt“ und den tatsächlichen Preis. Die VIP-Gästekarte zeigt die gewählten Optionen auch nach dem Neuladen. Unbegrenzte Buchungen erscheinen unter „Aktiv & geplant“, nicht unter „Beendet“; nach Storno stehen sie unter „Storniert“. Ein Storno funktioniert auch bei kostenlosen Buchungen, ohne einen Geldbetrag abzuziehen. Bestehende Mietzeiträume, Preise und Einnahmen bleiben bei Einführung der Optionen erhalten.

## Kassenstand, Bargeld und Bankeinzahlungen

Die neue Seite **Kassenstand** zeigt **Gesamtbestand = Bank + Übergangskonto + Bargeld beim Team**. Diese Geldbestände starten bei Einführung dieser Erweiterung einmalig bei **0 $**. Bestehende Umsätze, Vermietungen und Finanzbuchungen werden erhalten und nicht nachträglich in die neuen Bestände importiert. Unter **Bestand festlegen** die tatsächlichen Anfangsbestände für Bank, Übergangskonto und jeden Mitarbeiter eintragen; angegeben wird der neue Gesamtbetrag, nicht eine zusätzliche Einzahlung. Solche Korrekturen benötigen einen Grund und erzeugen keinen neuen Umsatz. Weitere Deployments oder Neustarts setzen die Bestände nicht zurück.

Neue **Barverkäufe** liegen beim Mitarbeiter, der den Verkauf bucht. **Kartenzahlungen** landen im **Übergangskonto**. Über **Auf Bank einzahlen** kann das Bargeld eines Mitarbeiters vollständig oder teilweise als eingezahlt verbucht werden. Auch das Übergangskonto kann auf die Bank übertragen werden. Erst bestätigen, nachdem das Geld tatsächlich eingezahlt wurde. Die Umbuchung zieht den Betrag an der Quelle ab und erhöht die Bank um denselben Betrag; Gesamtbestand und Umsatz bleiben dabei gleich. Wer die Abgabe erfasst hat, wird protokolliert. Inhaber und Manager können diese Bestände verwalten.

Bei **Vermietungen** und **sonstigen Einnahmen/Ausgaben** Bar, Karte/Übergangskonto oder Bank wählen. Bar-Einnahmen liegen beim buchenden Mitarbeiter; eine Bar-Ausgabe wird von dessen Bargeld abgezogen und braucht genügend vorhandenes Bargeld. **Einkäufe** belasten die Bank; die Einkaufsseite zeigt deshalb das Bankguthaben und den Bankbestand nach dem Einkauf. Ein Bankbestand kann durch Ausgaben negativ werden und anschließend über die Bestandskorrektur abgeglichen werden.

Stornos korrigieren auch den Geldbestand. Ausgaben werden an ihrer ursprünglichen Geldquelle zurückgebucht. Bei Einnahmen wird zuerst der noch vorhandene Betrag an der ursprünglichen Quelle abgezogen; bereits eingezahltes Bargeld oder übertragene Kartenzahlungen werden über die Bank erstattet. Ein Storno von Altbuchungen vor Einführung der Geldbestände verändert ausschließlich die bisherige Umsatz-/Finanzhistorie. Doppelte Anfragen erzeugen keine zweite Einzahlung; bei zwischenzeitlich verändertem Bestand muss vor der Buchung aktualisiert werden. Offene Geldbuchungen werden bei Verbindungsfehlern über **Buchung prüfen** mit derselben Buchungsnummer wiederholt.

## Finanzen

Unter **Finanzen** sonstige Einnahmen und Ausgaben in Dollar erfassen: positiver Betrag, Buchungsdatum und Grund sind Pflicht. Der Mitarbeiter wird aus der Anmeldung übernommen. Einträge bleiben bei Storno sichtbar, zählen aber nicht mehr zu den Summen. Mietbeträge werden automatisch erfasst und dürfen nicht zusätzlich als sonstige Einnahme gebucht werden.

Die Übersicht zeigt Kassenumsatz, Vermietungen, sonstige Einnahmen, Ausgaben, gesamte Einnahmen und **Saldo = Kassenumsatz + Vermietungen + sonstige Einnahmen − Ausgaben**. Das ist die bisherige Buchungshistorie; den aktuellen Geldbestand mit euren manuell erfassten Anfangswerten findet ihr unter **Kassenstand**. Zeitraumfilter begrenzen Summen und Liste; Euro-Altumsätze werden nicht mit Dollarbeträgen vermischt. Das ist eine Einnahmen-/Ausgabenübersicht, keine automatische Gewinn- oder Steuerberechnung. Die letzten 200 Finanzbuchungen werden angezeigt. Vermietungen werden auf der VIP-Seite storniert.

Offene Lager-/Einkaufs-/VIP-/Finanz-/Eintritts-/Geldanfragen bleiben bei Verbindungsfehlern mit derselben Buchungsnummer im Browser gespeichert. Über **Buchung prüfen** wird das Ergebnis sicher abgefragt, bevor eine neue Buchung erfasst werden kann.

## Technik und Prüfung

Node.js, Express, PostgreSQL (`pg`), lokale PostgreSQL-Engine (`PGlite`), HTML/CSS/JavaScript ohne Buildschritt. Bilder und Schriften laden ohne externe Dienste. Buchungsbeträge werden serverseitig aus aktuellen Preisen berechnet, Mitarbeitende werden aus der Sitzung zugeordnet. Sitzungen verwenden HttpOnly-Cookies, im Produktionsmodus HTTPS. Die Artikelverwaltung ist für Inhaber, Manager und beide Leitungen offen. Das gemeinsame Bar-Passwort wird ausschließlich auf dem Server gegen einen gesalzenen scrypt-Verifikator geprüft. Namen ordnen die Buchungen weiterhin dem jeweiligen Mitarbeiter zu. Das Passwort wird weder im Frontend noch im Browser-Speicher abgelegt.

```powershell
npm run check
npm test
```

Die Integrationstests prüfen Berechnung und Mitarbeiterzuordnung, doppelte und gleichzeitige Requests, Preisänderungen, ungültige Mengen, Stornos, Berliner Tagesgrenzen, CSV und dauerhafte lokale Speicherung. Zusätzlich prüfen sie die 24 Foto-Bestände, konkurrierende Verkäufe, Stock-Stornos, einmalige Datenmigration, feste Miettarife, Wochenlaufzeiten, Sommerzeit, gleichzeitige Gäste sowie Finanzsummen und -stornos sowie Passwortschutz, dauerhafte/abgelaufene Sitzungen, die 24 Einkaufspreise, Einkaufsabrechnung, Bestandszuwachs, Wiederholungen und Einkaufsstornos. Die Mitarbeiter-Tests prüfen voreingestellte Jobs und freie Abteilungen, Rauswurf auf mehreren Geräten, Namenssperren und Wiederaktivierung, konkurrierende Anmeldung/Deaktivierung sowie den Erhalt von Umsätzen, Bargeld, Mitarbeiter-IDs und Angaben beim Update. Die Rollen- und Eintrittstests prüfen direkte API-Sperren, Sofortwirkung geänderter Rollen, einmalige Besitzerzuweisung, Schutz des letzten Management-Mitglieds, Zahlungsgutschriften, eigene Buchungen, Stornos und Wiederholungen. Die Erweiterungstests prüfen kombinierte Ränge, Rechte beider Leitungen, gewählten Stundenlohn, einzelne laufende Schichten, sekundengenaue Abrechnung, Bankdeckung, einmalige Auszahlung, Lieferstornos vor/nach Auszahlung sowie Statistik-Summen, Berliner Zeiträume und lückenloses Blättern der Einzelhistorie. Sie verwenden eigene isolierte Testdatenbanken.

Dateien: `server.js` startet die App; `lib/app.js` enthält die API; `lib/database.js` verwaltet Datenbank und Tabellen; `public/` enthält die Oberfläche; `render.yaml` bereitet das Hosting vor.

Die Tests für individuelle Zugriffsrechte prüfen jeden Bereich einzeln, gesperrte Schreibzugriffe, Rechtevergabe nur durch das Management, getrennte Lohnrechte, sofortige Wirkung auf bestehende Sitzungen und den Erhalt der Auswahl bei Neustarts und Rangänderungen.
