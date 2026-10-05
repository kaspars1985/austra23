<p align="center">
  <img src="assets/austra_logo.png" width="130" alt="Austra ERP logo" />
</p>

# ⚡ Austra ERP – auto-rezervācija un nodošana ražošanā

> **Pārlūka paplašinājums (Microsoft Edge un Google Chrome, Manifest V3)**, kas automatizē AM Furnitūra ERP sistēmas (*Austra*) pasūtījumu apstrādes rutīnu: materiālu rezervēšanu, reāllaika indikatoru uzraudzību un automātisku statusa nomaiņu uz **"Uz ražošanu"**.

---

## 🎯 Problēma un risinājums

Strādājot ar pasūtījumiem sistēmā `https://austra.amfurnitura.lv/order_management/orders/*`, pirms pasūtījuma nodošanas ražošanā ir nepieciešams rezervēt materiālus. Šis process bieži aizņem ilgāku laiku, tādēļ lietotājam nākas regulāri atgriezties pie pasūtījuma, pārbaudīt, vai materiāli ir veiksmīgi rezervējušies, vai arī pastāv risks aizmirst pasūtījumu un savlaicīgi nenodot to ražošanā.

**Šis paplašinājums visu šo procesu paveic automātiski:**
1. Ar vienu klikšķi nospiež **"Rezervēt materiālus"**.
2. Fonā seko līdzi 3 svarīgajiem indikatoriem:
   - ✂️ **Nosūtīts uz CutRite**
   - 📋 **BOM izveidoti**
   - 🔨 **Montāžas pasūtījums izveidots**
3. Brīdī, kad visi 3 punkti kļūst zaļi, paplašinājums **pats automātiski izvēlas "Uz ražošanu" un apstiprina uznirstošo logu (modālo dialogu)**.
4. Ielogo katru darbību sānu paneļa darbību žurnālā.
5. Atskaņo patīkamu skaņas melodiju un nosūta darbvirsmas paziņojumu.

---

## ✨ Galvenās iespējas

- **Integrēts labās puses sānu panelis:**
  - Panelis neaizsedz lapas saturu. Atverot paneli (320px platumā), viss Austra ERP saturs (teksti, tabulas, pogas) automātiski nobīdās pa kreisi.
  - Ekrāna labajā malā atrodas eleganta cilne (`LPAxxx palaidējs ◀`), ar kuru paneli var jebkurā brīdī sakļaut vai atvērt.
- **Viena klikšķa palaišana:**
  - Viena liela, skaidra poga **"🚀 Sākt auto-rezervāciju"**.
- **Neatkarīgs daudzcilņu atbalsts:**
  - Var paralēli atvērt 5, 10 vai vairāk pasūtījumu cilnes un katrā palaist procesu – katra cilne darbojas 100% autonomi un droši.
  - Uzklikšķinot uz pabeigšanas paziņojuma Windows paziņojumu centrā, pārlūks uzreiz pārslēdz lietotāju tieši uz to cilni, kurā pasūtījums pabeigts.
- **Reāllaika hronometrs un drošības taimauts:**
  - Rāda, cik sekundes vai minūtes konkrētais pasūtījums jau rezervējas.
  - Iebūvēts 15 minūšu drošības taimauts, kas brīdina ar skaņas signālu, ja servera process ir iestrēdzis.
- **Stāvokļa nepārtrauktība (sesijas saglabāšana pāri lapas pārlādēm):**
  - Kad tiek nospiests "Rezervēt materiālus" un lapa pārlādējas, paplašinājums atceras sākuma laiku un statusu (`sessionStorage`). Pēc pārlādes taimeris neapstājas uz 00:00 un uzraudzība uzreiz turpinās.
- **Audio signāli:**
  - Nav atkarības no ārējiem MP3 failiem vai interneta bibliotēkām – skaņa tiek ģenerēta tieši pārlūka dzinējā (Web Audio API).
  - Var ieslēgt vai izslēgt ar vienu klikšķi.
- **Automātiska atjauninājumu pārbaude:**
  - Paplašinājums pats fonā pārbauda GitHub repozitoriju (`github.com/kaspars1985/austra23`).
  - Ja ir izlaista jaunāka versija, sānu panelī uzreiz parādās pamanāma paziņojuma josla ar pogu *"Atvērt GitHub un atjaunināt ↗"*.
  - Sānu paneļa kājenē ir redzama pašreizējā versija un poga *"Pārbaudīt atjauninājumu"* tūlītējai manuālai pārbaudei.
- **Pārlūka rīkjoslas integrācija:**
  - Klikšķis uz paplašinājuma ikonas Microsoft Edge vai Google Chrome rīkjoslā tieši atver vai aizver sānu paneli aktīvajā cilnē.

---

## 🖥️ Kā izskatās saskarne

```text
+-------------------------------------------------------------+-----------------------+
|  Austra ERP pasūtījums (100% brīvs, nekas netiek aizsegts)  | Austra LPAxxx auto    |
|                                                             | palaidējs [Sakļaut ▶] |
|  Pasūtījumi / LPA123456 (KLIENTS SIA)                      |-----------------------|
|  [Rezervēt materiālus]  [Mainīt statusu ▾]                  | 🚀 Sākt auto-         |
|                                                             |    rezervāciju        |
|  Operācija   Datums   Statuss      Izpildītāji   Laiks      |-----------------------|
|  Zāģēšana    -        Nav uzsākta  -             0:11:50    | ⚪ Gatavs darbam  00:00|
|  Līmēšana    -        Nav uzsākta  -             0:08:20    |-----------------------|
|  CNC         -        Nav uzsākta  -             0:04:10    | ✂️ CutRite:    🟢     |
|                                                             | 📋 BOM:        🟢     |
|                                                             | 🔨 Montāža:    🟢     |
|  Pielikumi: pasutijums.pdf, specifikacija.xlsx              |-----------------------|
|                                                             | Žurnāls:              |
|                                                             | [16:45] Visi 3 zaļi!  |
+-------------------------------------------------------------+-----------------------+
```

---

## 🚀 Uzstādīšana un palaišana

Paplašinājums ir izstrādāts pēc modernā **Manifest V3** standarta un ir savietojams ar **Microsoft Edge**, **Google Chrome**, **Brave** un citiem Chromium bāzētiem pārlūkiem.

### Microsoft Edge:
1. Pārlūka adreses joslā ievadiet: `edge://extensions/` un nospiediet **Enter**.
2. Kreisajā apakšējā stūrī ieslēdziet slēdzi: **"Izstrādātāja režīms" (Developer mode)**.
3. Augšpusē nospiediet pogu **"Ielādēt neiepakotu" (Load unpacked)**.
4. Izvēlieties šī projekta mapi `extension`:  
   `.../AUSTRA/extension`  
   un nospiediet **Select Folder (Izvēlēties mapi)**.

### Google Chrome:
1. Pārlūka adreses joslā ievadiet: `chrome://extensions/` un nospiediet **Enter**.
2. Labajā augšējā stūrī ieslēdziet: **"Izstrādātāja režīms" (Developer mode)**.
3. Nospiediet pogu **"Ielādēt neiepakotu" (Load unpacked)**.
4. Izvēlieties mapi `extension`.

---

## 📖 Lietošanas pamācība

1. Atveriet jebkuru pasūtījumu vietnē `https://austra.amfurnitura.lv/order_management/orders/...`.
2. Ekrāna labajā pusē automātiski atvērsies sānu panelis (ja atvērāt lapu pirms paplašinājuma ielādes, vienreiz pārlādējiet lapu ar `F5`).
3. Nospiediet zaļo pogu **"🚀 Sākt auto-rezervāciju"**:
   - Poga kļūs sarkana (**"⏹ Apturēt"**), ja procesu vēlēsieties pārtraukt manuāli.
   - Statusa lodziņš sāks skaitīt laiku.
   - Indikatoru aplīši rādīs katra soļa izpildi.
4. Tiklīdz visi 3 punkti kļūs zaļi:
   - Statuss automātiski tiek nomainīts uz **"Uz ražošanu"** un tiek apstiprināts modālais logs.
   - Darbību žurnālā tiek reģistrēts katrs izpildītais solis.
   - Atskan apstiprinājuma skaņa un parādās darbvirsmas paziņojums.

---

## 📁 Projekta struktūra

```text
AUSTRA/
├── .gitignore                # Git ignorētie faili
├── README.md                 # Dokumentācija latviešu valodā
├── generate_icons.py         # Skripts ikonu ģenerēšanai
├── assets/                   # Projekta vizuālie materiāli un logo
├── extension/                # Paplašinājuma galvenā mape (jāielādē pārlūkā)
│   ├── manifest.json         # Manifest V3 konfigurācija
│   ├── content.js            # Lapas DOM loģika, novērošana un automatizācija
│   ├── styles.css            # Sānu paneļa un lapas nobīdes stili
│   ├── background.js         # Servisa darbinieks (paziņojumi, klikšķu uztveršana)
│   └── icons/                # Ikonas (16px, 32px, 48px, 128px)
└── test/                     # Testēšanas rīki
    ├── mock_austra_page.html # Austra ERP lokālā simulācijas lapa
    └── test_extension.js     # Automatizētais testēšanas skripts
```

---

## 🧪 Testēšana un verifikācija

Lai pārbaudītu koda pareizību pirms publicēšanas:

```bash
# Palaist sintakses, manifesta un loģikas testus:
node test/test_extension.js
```

Lai izmēģinātu paplašinājuma darbību drošā testa vidē:
- Atveriet pārlūkā failu `test/mock_austra_page.html`.
- Šī lapa precīzi atveido Austra ERP pogas, stilus, indikatorus un apstiprinājuma logu.

---

## ❓ Biežāk uzdotie jautājumi (BUJ)

#### Vai paplašinājums ietekmē citus pasūtījumus?
Nē. Katra cilne darbojas pilnīgi neatkarīgi. Ja vienā cilnē palaižat rezervāciju, citās cilnēs nekas netiek aiztikts, kamēr paši to nepalaižat.

#### Ko nozīmē "Gatavs darbam ar 00:00"?
Tas ir sākuma stāvoklis – paplašinājums ir veiksmīgi pieslēdzies pasūtījumam un gaida, kad nospiedīsiet zaļo pogu "🚀 Sākt auto-rezervāciju".

#### Vai paplašinājums sūta datus uz ārējiem serveriem?
Nē. Paplašinājums darbojas 100% lokāli Jūsu datorā, neizmanto nekādus ārējus serverus vai trešo pušu analītiku.

---

## 📋 Versiju vēsture

- **v1.2.3**
  - Ieviests jaunais Austras koka identitātes logo un panelis pārdēvēts par *Austra LPAxxx auto palaidējs*.
  - Automātiski atrod un nospiež apstiprinājuma pogu modālajā logā *"Uz ražošanu"*.
  - Detalizēts apstiprināšanas procesa ieraksts sānu paneļa darbību žurnālā.
  - Droša pabeigtības stāvokļa saglabāšana pat tad, ja modāļa apstiprināšana izraisa tūlītēju lapas pārlādi.
- **v1.2.2**
  - Aizstāts lapas `MutationObserver` ar vienmērīgu 1 sekundes ciklu, novēršot pārlūka cilnes uzkāršanos.
  - Paaugstināta indikatoru meklēšanas precizitāte, izslēdzot blakus esošo tabulu rindu kļūdainu nolasīšanu.
- **v1.2.1**
  - Pievienota sesijas saglabāšana (`sessionStorage`), kas novērš taimera atgriešanos uz `00:00` pēc pogas "Rezervēt materiālus" nospiešanas un lapas pārlādes.
- **v1.2.0**
  - Ieviesta automātiska atjauninājumu pārbaude pret GitHub repozitoriju.
  - Pielāgots kājenes formāts: `kasparsciematnieks@amf.lv © 2026`.

---

## 📄 Licence

Izstrādāts uzņēmuma AM Furnitūra iekšējām darba ērtībām.  
Autors: Kaspars Ciematnieks (kasparsciematnieks@amf.lv) &copy; 2026.
