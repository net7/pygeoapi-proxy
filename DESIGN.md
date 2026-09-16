# Design system e stack frontend

Linee guida dell'interfaccia Geo-INQUIRE, aggiornate al **16 settembre 2026**.
Il riferimento iniziale è l'implementazione del commit `dbc9143`.
Questo documento descrive le scelte da mantenere quando si aggiungono o
modificano pagine e componenti.

Le fonti operative sono [app.css](proxy/resources/css/app.css), i
[componenti UI](proxy/resources/js/components/ui),
[components.json](proxy/components.json), [package.json](proxy/package.json)
e [bun.lock](proxy/bun.lock). Quando cambia il sistema, aggiornare anche questo
documento. Le indicazioni su build e ambienti riguardano `develop` e `staging`.

## 1. Identità e principi visivi

- **Palette INGV:** blu e petrolio sono i colori principali. Verde, magenta,
  giallo e violetto completano la palette con ruoli precisi.
- **Interfaccia scientifica leggibile:** gerarchia chiara, spazio tra le sezioni,
  testi descrittivi comprensibili, dati tecnici riconoscibili.
- **Angoli retti in tutta l'app:** pannelli, card, pulsanti, campi, badge,
  avatar, menu, dialog, notifiche, barre di avanzamento e scrollbar.
- **Liquid glass leggero sulle card:** riflessi, trasparenze e ombre devono
  valorizzare la superficie mantenendo nitidi contenuti e controlli.
- **Hover coerenti:** feedback visibile su azioni e navigazione, transizioni
  brevi e spostamenti contenuti.
- **Tema chiaro e scuro:** entrambi fanno parte del design; ogni nuova superficie
  e ogni nuovo stato devono funzionare in entrambi.
- **Accessibilità e mobile:** focus riconoscibile, contenuti utilizzabili senza
  hover, animazioni rispettose delle preferenze dell'utente.
- **Componenti condivisi:** le modifiche generali si applicano al tema o ai
  componenti di base, evitando stili diversi per la stessa azione.

### Logo

Usare `AppLogo` e `AppLogoIcon`, preservando proporzioni e testo alternativo.
Gli asset si trovano in [resources/images](proxy/resources/images):

| Asset                 | Utilizzo                                                                                |
| --------------------- | --------------------------------------------------------------------------------------- |
| `invg-logo.svg`       | Logo originale per superfici chiare; il nome del file è quello presente nel repository. |
| `ingv-logo-white.svg` | Variante bianca per superfici scure e sidebar, tramite `appearance="inverse"`.          |
| `ingv-logo-short.png` | Simbolo compatto per la sidebar desktop collassata.                                     |

La sidebar mostra il logo INGV. Il blocco aggiuntivo con la scritta
**Geo-INQUIRE e le linee colorate sottostanti è stato rimosso e non va
reintrodotto**. La sottile fascia cromatica del pannello di autenticazione è
un elemento distinto, presente nell'attuale layout.

## 2. Libreria UI e architettura frontend

La libreria di riferimento è **shadcn/ui**, configurata con stile **New York**,
componenti **TSX**, primitive **Radix UI**, icone **Lucide** e variabili CSS.
I componenti shadcn sono sorgenti mantenuti nel repository, in
`proxy/resources/js/components/ui/`; la loro versione effettiva è quella del
codice Git, mentre le dipendenze Radix hanno versioni proprie nel lockfile.
Questo modello consente di adattare le primitive al tema dell'app.
[Riferimento ufficiale shadcn/ui](https://ui.shadcn.com/docs).

`components.json` conserva `baseColor: "neutral"` come configurazione del
generatore; i colori effettivi dell'app sono i token INGV definiti in `app.css`.
La configurazione usa `rsc: false`, `tsx: true` e nessun prefisso Tailwind.

L'app usa **React + TypeScript + Inertia**, con pagine e dati forniti da Laravel:

1. Laravel espone le pagine Inertia e le relative proprietà.
2. `app.tsx` inizializza tema, lingua, notifiche, tooltip, infrastruttura realtime
   e layout comuni.
3. Le pagine React vivono in `resources/js/pages`; i layout condivisi in
   `resources/js/layouts`.
4. I componenti applicativi compongono le primitive di `components/ui`.
5. **Tailwind CSS 4** e `app.css` definiscono token, superfici, responsive e
   interazioni.
6. **Vite 8** integra Laravel, Inertia, React Compiler, Tailwind e Wayfinder.

Gli alias condivisi da Vite e TypeScript sono:

| Alias                     | Percorso, relativo a `proxy/`                      |
| ------------------------- | -------------------------------------------------- |
| `@/`                      | `resources/js/`                                    |
| `@/images/`               | `resources/images/`                                |
| `@/components/ui/`        | Componenti UI condivisi                            |
| `@/hooks/`                | Hook applicativi                                   |
| `@/lib/`                  | Utilità, validazione, traduzioni e logica frontend |
| `@/routes/`, `@/actions/` | Helper di routing generati da Laravel Wayfinder    |

## 3. Colori e token

### Palette originale del logo

| Token             | Colore    | Ruolo                                            |
| ----------------- | --------- | ------------------------------------------------ |
| `--brand-petrol`  | `#004458` | Sidebar, identità e profondità delle superfici   |
| `--brand-blue`    | `#006380` | Azioni principali nel tema chiaro                |
| `--brand-ocean`   | `#00769a` | Informazioni, focus e progresso di navigazione   |
| `--brand-green`   | `#008245` | Successo e accenti secondari                     |
| `--brand-magenta` | `#c60e41` | Errori e azioni distruttive                      |
| `--brand-yellow`  | `#d2cd1c` | Evidenziazioni e navigazione sulla sidebar scura |
| `--brand-violet`  | `#b471ad` | Serie dei grafici e accenti complementari        |

I colori del logo restano invariati. I token semantici possono usare tonalità
derivate per mantenere leggibilità e contrasto, soprattutto nel tema scuro.

### Superfici e contenuti

Valori effettivi dei token; i riferimenti tra variabili sono risolti nella tabella.

| Token                    | Chiaro    | Scuro     |
| ------------------------ | --------- | --------- |
| `--background`           | `#f2f6f8` | `#102630` |
| `--foreground`           | `#173d4b` | `#e7f1f5` |
| `--card`                 | `#ffffff` | `#18333f` |
| `--card-foreground`      | `#173d4b` | `#e7f1f5` |
| `--popover`              | `#ffffff` | `#1b3946` |
| `--popover-foreground`   | `#173d4b` | `#e7f1f5` |
| `--primary`              | `#006380` | `#80cce3` |
| `--primary-foreground`   | `#ffffff` | `#00394b` |
| `--secondary`            | `#e5eff3` | `#244653` |
| `--secondary-foreground` | `#004458` | `#d9edf5` |
| `--muted`                | `#edf3f6` | `#203e4b` |
| `--muted-foreground`     | `#55717e` | `#a5c1cd` |
| `--accent`               | `#e0eff4` | `#284e5e` |
| `--accent-foreground`    | `#004458` | `#e7f4fa` |
| `--border`               | `#d9e5eb` | `#2c4c5b` |
| `--input`                | `#b6cbd6` | `#456777` |
| `--ring`                 | `#00769a` | `#80cce3` |
| `--highlight`            | `#d2cd1c` | `#d2cd1c` |

### Stati semantici

| Token                      | Chiaro    | Scuro     |
| -------------------------- | --------- | --------- |
| `--success`                | `#008245` | `#62d49d` |
| `--success-foreground`     | `#ffffff` | `#073e29` |
| `--success-emphasis`       | `#006b39` | `#84dfb2` |
| `--info`                   | `#00769a` | `#80cce3` |
| `--info-emphasis`          | `#006380` | `#a1dbed` |
| `--warning`                | `#9a8200` | `#d2cd1c` |
| `--warning-emphasis`       | `#756300` | `#e6e16b` |
| `--destructive`            | `#c60e41` | `#b91143` |
| `--destructive-foreground` | `#c60e41` | `#ff91b0` |
| `--destructive-emphasis`   | `#a70b36` | `#ff91b0` |

Usare i token `*-emphasis` per testi di stato su superfici leggere o attenuate.
La variante `destructive` del pulsante usa testo bianco: l'attuale token
`destructive-foreground` non costituisce una coppia adatta al testo su un fondo
pieno `destructive` nel tema chiaro.

### Sidebar

| Token                          | Chiaro    | Scuro     |
| ------------------------------ | --------- | --------- |
| `--sidebar`                    | `#004458` | `#082f3e` |
| `--sidebar-foreground`         | `#e9f3f7` | `#e9f3f7` |
| `--sidebar-primary`            | `#d2cd1c` | `#d2cd1c` |
| `--sidebar-primary-foreground` | `#004458` | `#004458` |
| `--sidebar-accent`             | `#125a70` | `#194a5b` |
| `--sidebar-accent-foreground`  | `#ffffff` | `#ffffff` |
| `--sidebar-border`             | `#2b6475` | `#2a5364` |
| `--sidebar-ring`               | `#d2cd1c` | `#d2cd1c` |

### Regole d'uso

- Nei componenti usare classi semantiche: `bg-card`, `text-foreground`,
  `text-muted-foreground`, `border-border`, `bg-primary`, `text-success-emphasis`.
- Definire nuovi colori condivisi in `app.css`, con comportamento chiaro/scuro.
- Le mappature `@theme inline` collegano i token alle utility Tailwind.
  [Riferimento ufficiale sul tema](https://tailwindcss.com/docs/theme).
- Usare `dark:` per differenze strutturali o casi mirati; per i colori comuni
  preferire lo stesso token nei due temi.
- Accompagnare gli stati con testo e, quando utile, icone. Il colore da solo
  non deve essere l'unica informazione.
- La selezione del testo usa `primary` al 20%; il progresso Inertia usa
  `#00769a`, coerente con il blu oceano del logo.

## 4. Tipografia e icone

I font sono caricati localmente tramite Fontsource, con fallback di sistema.

| Elemento                                                     | Regola                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Testi dell'interfaccia                                       | **Source Sans 3 Variable**, token `--font-sans`                                      |
| Identificativi, codice, JSON e dati tecnici                  | **Roboto Mono Variable**, token `--font-mono`                                        |
| Titoli principali `.page-header h1` e `.settings-heading h2` | `clamp(1.75rem, 2.5vw, 2.125rem)`, peso `650`, interlinea `1.2`, tracking `-0.035em` |
| Titoli delle card processo                                   | `text-lg`, peso semibold, interlinea compatta                                        |
| Descrizioni delle card processo                              | `text-sm`, `leading-6`, `text-muted-foreground`                                      |
| Identificativo del processo                                  | `font-mono text-xs`                                                                  |
| Paragrafi dell'intestazione                                  | Larghezza massima `72ch`                                                             |

Usare la gerarchia dei titoli anche semanticamente. `CardTitle` e `Heading`
forniscono uno stile: verificare comunque l'elemento HTML e la struttura della
pagina. Troncamento e `line-clamp-3` sono adatti alle anteprime; messaggi di
errore e informazioni necessarie a completare un'attività devono restare leggibili.

Le icone principali provengono da **lucide-react**. I simboli dei provider di
autenticazione e alcune icone esistenti usano **react-icons**. Nei pulsanti
usare `data-icon="inline-start"` o `data-icon="inline-end"`; i pulsanti con
sola icona devono avere un nome accessibile.

## 5. Geometria, spaziature e responsive

### Angoli retti

Il token globale è `--radius: 0`. Tutta la scala da `--radius-xs` a
`--radius-4xl` punta a questo valore. Le classi dimensionate come `rounded-md`
ancora presenti nei componenti producono quindi angoli retti.

Per i nuovi elementi usare `rounded-none` o i token del tema. Non introdurre
`rounded-full`, raggi arbitrari o `border-radius` fissi: aggirerebbero la scala
globale. Gli arrotondamenti dei controlli **MapLibre** sono azzerati anche al
focus; **Sonner** riceve `--border-radius` dal tema e classi dedicate per i
pulsanti delle notifiche. Le forme interne di icone, loghi e dati cartografici
mantengono la loro geometria.

### Misure di riferimento

Le equivalenze in pixel assumono la dimensione radice standard di `16px`.

| Elemento                             | Misura                                                           |
| ------------------------------------ | ---------------------------------------------------------------- |
| Padding principale della pagina      | `clamp(1.25rem, 2.5vw, 2.5rem)`, circa `20–40px`                 |
| Distanza tra sezioni del catalogo    | `gap-7`, `28px`                                                  |
| Distanza tra card del catalogo       | `gap-5`, `20px`                                                  |
| Card standard                        | `py-6`, `gap-6`; header, contenuto e footer con `px-6`           |
| Toolbar                              | `h-16`, `64px`, superficie `card` e separatore inferiore         |
| Header della pagina                  | Padding verticale `0.25rem 0 1.5rem` e bordo inferiore           |
| Icona nella card processo            | Contenitore `3rem × 3rem`, `48px × 48px`                         |
| Voci principali della sidebar        | Altezza minima `2.625rem`, `42px`; `2rem` in modalità collassata |
| Pulsante standard / piccolo / grande | `40px` / `32px` / `44px` di altezza                              |
| Pulsante icona standard              | `40px × 40px`                                                    |
| Intestazione di tabella              | Altezza `3rem`, `48px`                                           |
| Celle di tabella                     | Padding verticale `0.875rem`, `14px`                             |

Usare `flex`/`grid` con `gap-*`, `size-*` per dimensioni uguali e `min-w-0`
nei figli flessibili che contengono testi lunghi. Conservare `break-words`
nei titoli delle card e lo spazio necessario ai badge di versione.

Il catalogo usa una colonna alla larghezza base, due da `md`, tre da `xl` e
quattro da `2xl`. I breakpoint Tailwind del progetto sono quelli standard:

| Breakpoint | Larghezza minima              |
| ---------- | ----------------------------- |
| `sm`       | `40rem`, normalmente `640px`  |
| `md`       | `48rem`, normalmente `768px`  |
| `lg`       | `64rem`, normalmente `1024px` |
| `xl`       | `80rem`, normalmente `1280px` |
| `2xl`      | `96rem`, normalmente `1536px` |

La sidebar desktop è collassabile a icone e su mobile usa un pannello `Sheet`.
Le tabelle estese possono scorrere nel proprio contenitore; la pagina non deve
allargarsi oltre il viewport. Distribuire le azioni su più righe quando necessario.

## 6. Componenti e composizione delle pagine

| Esigenza        | Componenti e convenzioni                                                                            |
| --------------- | --------------------------------------------------------------------------------------------------- |
| Azioni          | `Button`, varianti `default`, `secondary`, `outline`, `ghost`, `link`, `destructive`                |
| Contenitori     | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`                   |
| Form            | `Field`, `FieldGroup`, `FieldLabel`, `Input`, `Textarea`, `Select`, `Checkbox` e messaggi associati |
| Scelte compatte | `ToggleGroup` e `Toggle`                                                                            |
| Stati e avvisi  | `Badge`, `Alert`, `Spinner`, `Skeleton`                                                             |
| Overlay         | `Dialog`, `Sheet`, `Popover`, `Tooltip`, `DropdownMenu`                                             |
| Navigazione     | `Sidebar`, `Breadcrumb`, `NavigationMenu`                                                           |
| Dati tabellari  | Componenti `Table` condivisi, con TanStack Table dove necessario                                    |
| Profilo         | `Avatar` con `AvatarFallback`, entrambi squadrati                                                   |
| Notifiche       | `Toaster` condiviso e API `toast` di Sonner                                                         |

### Regole di composizione

- Riutilizzare i componenti presenti; aggiungere varianti condivise quando
  uno stesso trattamento serve in più pagine.
- Usare `cn()` per combinare classi e `class-variance-authority` per le varianti.
- Le primitive Radix si compongono con `asChild` dove supportato. Per esempio,
  un'azione di navigazione può essere `Button asChild` con un `Link` Inertia.
- Mantenere i `data-slot`, `data-variant`, `data-active`, `data-state` e gli
  attributi ARIA: il tema e gli stati interattivi si basano anche su questi.
- I titoli di dialog e sheet sono necessari anche quando vengono nascosti
  visivamente. Mantenere trigger, gruppi e contenuti nella composizione prevista.
- Associare label, descrizioni ed errori ai campi; utilizzare `aria-invalid`
  sul controllo e gli stati di validazione dei componenti esistenti.
- Usare le chiavi di traduzione per titoli, azioni, stati, tooltip e messaggi.

### Pagine principali

**Catalogo processi:** ogni processo è un `article.process-card` contenente una
card con bordo superiore di `3px` in `primary`, icona, titolo, versione,
identificativo, descrizione e azione. Il footer resta allineato in fondo con
`mt-auto`. L'apertura avviene tramite il link esplicito nel pulsante.

**Form dei processi:** separare nome, input, output e note. Il rendering segue
gli schemi OGC, i componenti `Field` e i renderer applicativi. L'hover non deve
coprire errori o indicazioni di campo disabilitato; le card del form ricevono
il riflesso senza il sollevamento riservato alle card del catalogo.

**Liste e amministrazione:** usare intestazioni `muted`, bordi `border`,
superfici `card`, badge e azioni coerenti. Selezione, filtri, ordinamento,
stato vuoto e caricamento devono essere riconoscibili.

**Impostazioni:** navigazione laterale con indicatore sinistro in `primary`,
contenuto su una superficie delimitata, gerarchia coerente con le altre pagine.

**Autenticazione:** canvas con diagonale petrolio/blu, pannello squadrato,
padding fluido e ombra ampia. La fascia superiore del pannello è alta `4px`
e riprende la palette INGV.

## 7. Hover, liquid glass e movimento

### Card

L'effetto **liquid glass è stilizzato e realizzato in CSS**, mediante gradienti,
trasparenza, `backdrop-filter` e ombre. Non richiede una libreria di animazione
aggiuntiva o aggiornamenti React a ogni movimento del puntatore.

| Proprietà           | Implementazione                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Superficie          | `card` all'88% di opacità quando `backdrop-filter` è supportato                            |
| Vetro               | Pseudo-elemento `::before`, `blur(14px) saturate(1.15)`                                    |
| Accenti             | Gradiente radiale `primary` al 12% in alto a sinistra e `success` all'8% in basso a destra |
| Riflesso            | Gradiente lineare a `115deg`, dimensione orizzontale `250%`, posizione animata             |
| Bordo luminoso      | Ombra interna di `1px` con `--glass-edge`                                                  |
| Hover/focus         | Bordo al 50% tra `primary` e `border`, doppia ombra e riflesso visibile                    |
| Sollevamento        | Solo `.process-card`, `translate: 0 -4px` all'hover                                        |
| Icona del processo  | All'hover/focus passa a fondo `primary` e simbolo `primary-foreground`                     |
| Freccia dell'azione | Spostamento di `3px` verso destra quando il movimento è abilitato                          |

Il layer decorativo ha `pointer-events: none`, `z-index: -1` e un contenitore
con `isolation: isolate`: resta dietro al contenuto e non intercetta click.
Non sfocare il contenuto testuale. In assenza di supporto al filtro, la card
mantiene la superficie opaca di base.

| Token del vetro  | Chiaro                   | Scuro                    |
| ---------------- | ------------------------ | ------------------------ |
| `--glass-edge`   | `rgb(255 255 255 / 90%)` | `rgb(188 233 247 / 20%)` |
| `--glass-sheen`  | `rgb(255 255 255 / 65%)` | `rgb(188 233 247 / 8%)`  |
| `--glass-shadow` | `rgb(0 68 88 / 16%)`     | `rgb(0 12 20 / 45%)`     |

### Pulsanti, menu e campi

- Pulsanti pieni: lieve riflesso verticale; ombra più evidente all'hover,
  mantenendo i colori della variante e il ring di focus.
- Pulsanti `default`, `destructive`, `outline` e `secondary`: sollevamento di
  `1px` all'hover quando consentito. Durante la pressione lo spostamento è
  di `1px` verso il basso; lo stato `active` ha priorità.
- Sidebar: fondo `sidebar-accent`, indicatore sinistro di `3px` e icona gialla
  per la voce attiva o in hover.
- Impostazioni: indicatore sinistro di `3px` in `primary`.
- Input, textarea, select e checkbox: bordo che si avvicina al colore
  `primary`, con transizione; l'hover non sovrascrive gli stati di errore,
  disabilitato o focus visibile.
- Menu, toggle e righe tabellari: transizioni di colore, fondo, bordo e ombra.

### Tempi e preferenze

| Interazione                                       | Durata  |
| ------------------------------------------------- | ------- |
| Base e transizioni della navigazione              | `180ms` |
| Pulsanti e ingresso degli overlay                 | `160ms` |
| Bordo, ombra, opacità, icona e freccia delle card | `240ms` |
| Sollevamento della card                           | `320ms` |
| Scorrimento del riflesso                          | `700ms` |

La curva comune è `cubic-bezier(0.2, 0.8, 0.2, 1)`, esposta come
`--motion-ease`. Dichiarare le proprietà animate in modo esplicito.

Gli effetti hover personalizzati sono limitati a `(hover: hover) and
(pointer: fine)`. I sollevamenti richiedono anche
`(prefers-reduced-motion: no-preference)`. `focus-within` rende riconoscibile
la card anche durante l'uso da tastiera.

Con `prefers-reduced-motion: reduce`, animazioni e transizioni diventano
praticamente immediate (`0.01ms`), lo scorrimento torna automatico, le View
Transitions sono disabilitate e i sollevamenti non vengono attivati.

Le transizioni tra pagine sono gestite da Inertia e dalla View Transition API
del browser; i cambiamenti locali usano anche `ViewTransition` di React e
`runUiTransition`. Riutilizzare [motion.ts](proxy/resources/js/lib/motion.ts)
e [content-transition.tsx](proxy/resources/js/components/content-transition.tsx),
che gestiscono supporto del browser, preferenze e navigazioni concorrenti.

## 8. Scrollbar globali

La scrollbar è tematizzata globalmente, comprese le aree con overflow interno.

| Proprietà             | Valore                                                               |
| --------------------- | -------------------------------------------------------------------- |
| Layout                | `scrollbar-gutter: stable` sulla radice                              |
| API standard          | `scrollbar-width: thin`, thumb tematizzato e track trasparente       |
| Percorso WebKit       | Larghezza e altezza `10px`, thumb minimo `40px`                      |
| Thumb WebKit          | Bordo trasparente `2px`, `background-clip: padding-box`, raggio zero |
| Track e angolo        | Trasparenti                                                          |
| Thumb chiaro / hover  | `#668b9b` / `#006380`                                                |
| Thumb scuro / hover   | `#688d9f` / `#80cce3`                                                |
| Thumb sidebar / hover | `#74a0b1` / `#d2cd1c`                                                |

Quando sono disponibili gli pseudo-elementi WebKit, le proprietà standard
vengono riportate ad `auto` per evitare che prevalgano sullo stile dedicato.
Non nascondere la scrollbar per ottenere un risultato visivamente più pulito.

## 9. Stati, grafici e contenuti specializzati

Gli stili degli stati dei job sono centralizzati in
[jobs.ts](proxy/resources/js/lib/jobs.ts).

| Stato                                     | Famiglia di colore     | Indicazione                    |
| ----------------------------------------- | ---------------------- | ------------------------------ |
| `submitting`                              | `info`                 | Invio in corso                 |
| `accepted`                                | `primary`              | Richiesta accettata            |
| `running`                                 | `warning`              | Elaborazione in corso          |
| `successful`                              | `success`              | Elaborazione completata        |
| `failed`, `submission_failed`             | `destructive-emphasis` | Errore                         |
| `remote_missing` e stati non riconosciuti | `muted`                | Stato neutro o non disponibile |

Usare le stesse famiglie per badge, righe, bordi e avanzamento. Errori e
successi devono avere etichette leggibili. Le notifiche Sonner seguono i token
semantici dell'app, con superfici attenuate e testo di enfasi.

### Palette dei grafici

Chart.js legge i token CSS risolti per il tema corrente. Riutilizzare
`chart-result-preview.tsx` e i suoi fallback, mantenendo legende e serie leggibili.

| Token       | Chiaro    | Scuro     |
| ----------- | --------- | --------- |
| `--chart-1` | `#006380` | `#80cce3` |
| `--chart-2` | `#008245` | `#62d49d` |
| `--chart-3` | `#b471ad` | `#dba1d4` |
| `--chart-4` | `#c60e41` | `#ff91b0` |
| `--chart-5` | `#9a8200` | `#e6e16b` |
| `--chart-6` | `#327f98` | `#52b2c5` |
| `--chart-7` | `#8a5c7e` | `#c19ddf` |
| `--chart-8` | `#004458` | `#b1cad4` |

**Mappe:** MapLibre GL visualizza le anteprime geospaziali, con layer pubblicati
tramite GeoServer. Controlli e popup devono mantenere gli angoli retti, anche
negli stati `focus`, `first-child` e `last-child` gestiti dal CSS della libreria.

**Dati strutturati:** JSON View per JSON, renderer applicativi per CSV e tabelle,
font monospaziato e overflow confinato al contenitore.

**Note:** Tiptap con Starter Kit ed estensione Link; toolbar condivisa e
stili `.prose-note` per paragrafi, liste, citazioni, codice e link.

## 10. Accessibilità, lingua e tema

- Conservare la navigazione da tastiera delle primitive Radix, i nomi
  accessibili e la gestione del focus degli overlay.
- Il focus delle navigazioni usa un outline esplicito di `2px`, offset `2px`:
  giallo nella sidebar, `ring` nelle impostazioni. Non eliminarlo aggiungendo
  un'ombra hover che sostituisca il ring.
- Verificare contrasto e leggibilità su superfici piene, attenuate e traslucide
  in entrambi i temi. Il riflesso non deve nascondere testi, errori o icone.
- Le azioni essenziali devono restare disponibili su touch e senza animazioni.
- Conservare dimensioni utilizzabili dei controlli; valutare l'area di tocco
  quando si usano varianti compatte.
- Usare `useTranslation()` e le risorse di `lib/i18n` per italiano e inglese;
  formattare date e numeri secondo la lingua. Prevedere testi più lunghi
  dell'equivalente inglese.
- `useAppearance()` gestisce `light`, `dark` e `system`, persiste la scelta in
  localStorage e cookie, applica la classe `.dark` e la proprietà `color-scheme`.
  Riutilizzare questo meccanismo per i nuovi componenti sensibili al tema.

## 11. Stack frontend e versioni

Le versioni riportate sono quelle risolte da **`proxy/bun.lock`** alla data del
documento. CI e build container usano `bun ci`. `package.json` dichiara in
prevalenza intervalli `^`; il lockfile fissa le versioni riproducibili.
`proxy/package-lock.json` è allineato alle stesse 71 dipendenze dirette e alle
risoluzioni non incorporate nei pacchetti. Le voci `inBundle` del pacchetto
opzionale WASM di Tailwind sono descritte dai rispettivi installer e possono
essere rappresentate diversamente: non modificarne manualmente versioni o
integrità per rendere identici i due grafi. Bun rimane il riferimento operativo.

### Runtime, interfaccia e funzionalità

| Tecnologia / pacchetto                                           | Versione         | Ruolo nel progetto                                                                            |
| ---------------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------- |
| `react`, `react-dom`                                             | `19.3.0`         | Rendering, componenti, hook e View Transitions                                                |
| `typescript`                                                     | `5.9.3`          | TS/TSX con controllo `strict`, `noImplicitAny`, JSX automatico e risoluzione `bundler`        |
| `@inertiajs/react`                                               | `3.7.1`          | Pagine, navigazione, form, proprietà server e polling                                         |
| `shadcn/ui`                                                      | Sorgenti locali  | Libreria di componenti dell'app, stile New York, basata su Radix                              |
| `tailwindcss`                                                    | `4.3.3`          | Utility CSS, responsive e token semantici                                                     |
| `tw-animate-css`                                                 | `1.4.0`          | Utility di animazione usate dai componenti                                                    |
| `class-variance-authority`                                       | `0.7.1`          | Varianti di pulsanti, badge e controlli                                                       |
| `clsx`                                                           | `2.1.1`          | Composizione condizionale delle classi                                                        |
| `tailwind-merge`                                                 | `3.7.0`          | Risoluzione dei conflitti tra utility tramite `cn()`                                          |
| `lucide-react`                                                   | `0.475.0`        | Icone principali                                                                              |
| `react-icons`                                                    | `5.7.0`          | Icone dei provider e utilizzi già presenti                                                    |
| `@fontsource-variable/source-sans-3`                             | `5.3.0`          | Font variabile dell'interfaccia                                                               |
| `@fontsource-variable/roboto-mono`                               | `5.3.0`          | Font variabile monospaziato                                                                   |
| `sonner`                                                         | `2.0.8`          | Notifiche toast                                                                               |
| `@tanstack/react-table`                                          | `8.21.3`         | Logica delle tabelle dati                                                                     |
| `ajv`                                                            | `8.17.1`         | Validazione client degli input OGC da JSON Schema                                             |
| `@uiw/react-json-view`                                           | `2.0.0-alpha.43` | Anteprime JSON                                                                                |
| `chart.js`                                                       | `4.5.1`          | Grafici dei risultati                                                                         |
| `maplibre-gl`                                                    | `5.24.0`         | Mappe e anteprime geospaziali                                                                 |
| `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link` | `3.31.3`         | Editor delle note                                                                             |
| `@laravel/passkeys`                                              | `0.2.0`          | Registrazione e autenticazione con passkey                                                    |
| `@laravel/echo-react`, `laravel-echo`                            | `2.5.0`          | Infrastruttura realtime configurata per Reverb                                                |
| `pusher-js`                                                      | `8.6.0`          | Client del protocollo usato dalla configurazione realtime                                     |
| `@headlessui/react`                                              | `2.2.10`         | Dipendenza dichiarata; nessun import diretto nei sorgenti applicativi alla data del documento |
| `laravel-precognition-react`                                     | `2.0.0`          | Dipendenza dichiarata; il form OGC attuale usa `useForm` Inertia e validazione AJV            |

Lo stato dei job OGC e il riscaldamento della cache vengono aggiornati tramite
**polling HTTP Inertia**. La presenza di Echo/Reverb non implica che questi
aggiornamenti usino WebSocket. Lo stato UI usa hook React e i meccanismi
applicativi condivisi; la localizzazione è implementata in `lib/i18n`.

### Primitive Radix installate direttamente

| Pacchetto                         | Versione |
| --------------------------------- | -------- |
| `@radix-ui/react-avatar`          | `1.2.6`  |
| `@radix-ui/react-checkbox`        | `1.3.11` |
| `@radix-ui/react-collapsible`     | `1.1.20` |
| `@radix-ui/react-dialog`          | `1.1.23` |
| `@radix-ui/react-dropdown-menu`   | `2.1.24` |
| `@radix-ui/react-label`           | `2.1.15` |
| `@radix-ui/react-navigation-menu` | `1.2.22` |
| `@radix-ui/react-popover`         | `1.1.23` |
| `@radix-ui/react-select`          | `2.3.7`  |
| `@radix-ui/react-separator`       | `1.1.15` |
| `@radix-ui/react-slot`            | `1.3.3`  |
| `@radix-ui/react-toggle`          | `1.1.18` |
| `@radix-ui/react-toggle-group`    | `1.1.19` |
| `@radix-ui/react-tooltip`         | `1.2.16` |

### Build e qualità del codice

| Pacchetto / strumento               | Versione                   | Ruolo                                                                  |
| ----------------------------------- | -------------------------- | ---------------------------------------------------------------------- |
| `vite`                              | `8.3.0`                    | Dev server e build, con bundling Rolldown                              |
| `@vitejs/plugin-react`              | `5.2.0`                    | Integrazione React                                                     |
| `babel-plugin-react-compiler`       | `1.0.0`                    | React Compiler, attivo in `vite.config.ts`                             |
| `@tailwindcss/vite`                 | `4.3.3`                    | Compilazione Tailwind                                                  |
| `@inertiajs/vite`                   | `3.7.1`                    | Integrazione delle pagine Inertia nella build                          |
| `laravel-vite-plugin`               | `3.2.0`                    | Entry point CSS/JS e refresh Laravel                                   |
| `@laravel/vite-plugin-wayfinder`    | `0.1.10`                   | Generazione degli helper di routing, con `formVariants: true`          |
| `eslint`, `@eslint/js`              | `9.39.5`                   | Analisi statica con flat config                                        |
| `typescript-eslint`                 | `8.70.0`                   | Regole e parser TypeScript                                             |
| `eslint-plugin-react`               | `7.37.5`                   | Regole React                                                           |
| `eslint-plugin-react-hooks`         | `7.1.1`                    | Regole degli hook                                                      |
| `eslint-plugin-import`              | `2.32.0`                   | Ordine e convenzioni degli import                                      |
| `eslint-import-resolver-typescript` | `4.4.5`                    | Risoluzione degli alias negli import                                   |
| `@stylistic/eslint-plugin`          | `5.10.0`                   | Convenzioni di stile                                                   |
| `eslint-config-prettier`            | `10.1.8`                   | Compatibilità tra lint e formattazione                                 |
| `prettier`                          | `3.9.6`                    | Formattazione                                                          |
| `prettier-plugin-tailwindcss`       | `0.6.14`                   | Ordinamento delle utility, anche in `cn`, `clsx` e `cva`               |
| `globals`                           | `15.15.0`                  | Definizioni degli ambienti per ESLint                                  |
| `@types/react`, `@types/react-dom`  | `19.3.0`                   | Tipi React                                                             |
| `@types/node`                       | `22.20.3`                  | Tipi Node; questa versione non fissa quella del runtime Node           |
| `concurrently`                      | `9.2.4`                    | Esecuzione coordinata di processi di sviluppo                          |
| Bun in CI                           | `1.4.2`, immagine Alpine   | Installazione, script e test frontend                                  |
| Node in CI                          | `nodejs-current` da Alpine | Runtime installato dal job; versione non fissata dal manifest frontend |

Le dipendenze native opzionali dichiarate sono `@rollup/rollup-linux-x64-gnu`
e `@rollup/rollup-win32-x64-msvc` `4.9.5`,
`@tailwindcss/oxide-linux-x64-gnu` e `@tailwindcss/oxide-win32-x64-msvc` `4.3.3`,
`lightningcss-linux-x64-gnu` e `lightningcss-win32-x64-msvc` `1.33.0`.
I pacchetti Rollup opzionali sono ancora nel manifest; la build Vite attuale
usa la configurazione `rolldownOptions`.

Questo inventario copre tutte le dipendenze frontend dirette; le dipendenze
transitive e i dettagli specifici delle piattaforme restano descritti nel lockfile.

## 12. Convenzioni di implementazione

- Il tema globale risiede in `resources/css/app.css`; le regole comuni usano
  `data-slot` e classi applicative come `.process-card` e `.main-navigation`.
- Le personalizzazioni che devono prevalere sulle utility generate stanno
  nell'attuale `@layer utilities`. Valutare ordine dei layer e specificità:
  aumentare la specificità in un layer precedente non supera un layer successivo.
- Il reset MapLibre è fuori dai layer perché deve prevalere sul CSS della
  libreria, inclusi gli stati di focus. Preservare questa intenzione.
- Le pagine compongono le varianti dei componenti; modifiche visive generali
  vanno implementate alla fonte, senza duplicare override pagina per pagina.
- Form OGC: riutilizzare `SchemaFieldRenderer`, `useOgcFormValidation`, AJV,
  `ProcessOutputSelector` e gli helper applicativi. Conservare errori e
  validazione server nel normale flusso Inertia.
- I testi dell'app passano da `useTranslation()`. Le nuove chiavi devono
  prevedere entrambe le lingue.
- MapLibre, Chart.js e JSON View hanno gruppi di chunk dedicati in Vite;
  mantenere la separazione dei moduli pesanti e i caricamenti differiti esistenti.
- Prettier usa apici singoli, punto e virgola, indentazione di quattro spazi
  e larghezza indicativa di 80 caratteri. I componenti `components/ui/*`
  sono esclusi dalle attuali configurazioni ESLint/Prettier: conservarne lo stile
  e verificarli anche visivamente e con TypeScript.
- Non modificare manualmente gli helper Wayfinder generati. Nuove dipendenze
  vanno valutate prima di ampliare lo stack.

## 13. Comandi e verifica

Eseguire i comandi frontend dalla directory `proxy/`.

| Comando                                     | Scopo                                                |
| ------------------------------------------- | ---------------------------------------------------- |
| `bun ci`                                    | Installazione riproducibile dal lockfile, come in CI |
| `bun run dev`                               | Dev server Vite                                      |
| `bun run build`                             | Build degli asset                                    |
| `bun run build:ssr`                         | Script presente per build client e SSR               |
| `bun run types:check`                       | TypeScript senza emissione di file                   |
| `bun run lint:check`                        | ESLint senza correzioni automatiche                  |
| `bun run format:check`                      | Prettier sui sorgenti `resources/`                   |
| `bun run lint`                              | ESLint con correzioni automatiche                    |
| `bun run format`                            | Prettier con scrittura dei sorgenti                  |
| `bun test tests/Frontend/ogc-chart.test.ts` | Esempio di test frontend mirato                      |
| `bun test`                                  | Suite frontend usata in CI                           |

Gli stessi script di `package.json` sono eseguibili con `npm run`, usando le
dipendenze già installate. Per installare le versioni descritte qui, il riferimento
è il flusso Bun del progetto.

I test applicativi sul layout e sul logo comprendono:

```bash
php artisan test --compact tests/Feature/SidebarLogoTest.php tests/Unit/ProcessUiLayoutTest.php
```

Per ogni modifica al design verificare le aree effettivamente coinvolte:

1. Tema chiaro e scuro, anche con testi e descrizioni lunghe.
2. Desktop, sidebar collassata e larghezza mobile; nessun overflow della pagina.
3. Hover, focus da tastiera, pressione, stato disabilitato, errore e selezione.
4. Assenza di angoli arrotondati, inclusi menu, toast, scrollbar e controlli mappa.
5. Leggibilità delle card in hover e funzionamento di link e overlay sopra il vetro.
6. Preferenze di movimento ridotto e interazione senza hover.
7. Build e controlli pertinenti; test mirati quando cambia il comportamento.

Le sole modifiche di stile o contenuto non richiedono nuovi test che replichino
classi CSS. Usare verifiche visive per la resa e test significativi per la logica.

## 14. Mappa dei riferimenti

| Area                                        | Fonte nel repository                                                                                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Token, forme, scrollbar, hover e animazioni | [app.css](proxy/resources/css/app.css)                                                                                                                           |
| Configurazione shadcn                       | [components.json](proxy/components.json)                                                                                                                         |
| Componenti base                             | [components/ui](proxy/resources/js/components/ui)                                                                                                                |
| Bootstrap frontend                          | [app.tsx](proxy/resources/js/app.tsx)                                                                                                                            |
| Layout dell'app                             | [layouts](proxy/resources/js/layouts)                                                                                                                            |
| Logo e sidebar                              | [AppLogoIcon](proxy/resources/js/components/app-logo-icon.tsx), [AppSidebar](proxy/resources/js/components/app-sidebar.tsx)                                      |
| Esempio di card processo                    | [Catalogo processi](proxy/resources/js/pages/processes/index.tsx)                                                                                                |
| Form dinamici                               | [DynamicProcessForm](proxy/resources/js/components/ogc/dynamic-process-form.tsx)                                                                                 |
| Tema e lingua                               | [useAppearance](proxy/resources/js/hooks/use-appearance.tsx), [useTranslation](proxy/resources/js/hooks/use-translation.ts), [i18n](proxy/resources/js/lib/i18n) |
| Movimento                                   | [motion.ts](proxy/resources/js/lib/motion.ts), [ContentTransition](proxy/resources/js/components/content-transition.tsx)                                         |
| Stati dei job                               | [jobs.ts](proxy/resources/js/lib/jobs.ts)                                                                                                                        |
| Anteprime e note                            | [components/ogc](proxy/resources/js/components/ogc)                                                                                                              |
| Dipendenze                                  | [package.json](proxy/package.json), [bun.lock](proxy/bun.lock)                                                                                                   |
| Build e alias                               | [vite.config.ts](proxy/vite.config.ts), [tsconfig.json](proxy/tsconfig.json)                                                                                     |
| Lint e formattazione                        | [eslint.config.js](proxy/eslint.config.js), [.prettierrc](proxy/.prettierrc), [.prettierignore](proxy/.prettierignore)                                           |
| Test frontend                               | [tests/Frontend](proxy/tests/Frontend)                                                                                                                           |
| Controlli CI                                | [.gitlab-ci.yml](.gitlab-ci.yml)                                                                                                                                 |
