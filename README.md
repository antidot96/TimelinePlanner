# Timeline Planner

Composant de planning "ressources x timeline" en JavaScript natif + jQuery.

Le composant fournit :

- une colonne sticky de ressources
- une grille temporelle scrollable ou "fit to content" selon le mode de vue
- des evenements de duree (barres)
- des markers ponctuels (lignes verticales non interactives)
- la selection de ressource
- le reorder vertical des ressources
- la creation d'evenements par bouton ou selection de plage
- le move / resize d'evenements
- une barre haute avec selecteurs de vue
- un bus d'evenements jQuery

Fichiers livres :

- `timeline-planner.js`
- `timeline-planner.css`
- `demo.html`

## Dependances

Requis :

- jQuery 3.x

Utilise dans cette implementation :

- jQuery UI 1.13.3

Feature jQuery UI utilisee :

- `sortable` uniquement, pour le reorder vertical des ressources

Le move / resize des evenements, les vues et la selection de plage sont geres en natif (DOM + souris).

## Conventions

- Dates au format `YYYY-MM-DD` uniquement
- Pas de support datetime dans cette version
- `end` est traite comme `inclusive`
- Le snap d'edition est de `1 jour`
- La plage visible est calculee depuis les `events` et `markers`
- La langue integree se pilote avec `language` (`EN` par defaut) et peut etre ajustee finement avec `translations`

## Modele fonctionnel

Le composant se pilote avec 2 notions distinctes :

- `timeScale` : `day | week | month`
- `viewMode` : `sliding | global | custom`

Interpretation :

- `timeScale` definit la granularite visuelle de la grille
- `viewMode` definit comment la plage visible est calculee

### View modes

`sliding`

- scroll horizontal autorise
- colonnes a largeur fixe
- la plage initiale est calculee depuis le min / max des `events` et `markers`, avec une marge de 7 jours avant et apres
- si on approche d'un bord au scroll horizontal, la plage est etendue dynamiquement :
  - `day` -> +30 jours
  - `week` -> +4 semaines
  - `month` -> +1 mois

`global`

- pas de scroll horizontal
- fit to content
- la plage visible englobe tous les `events` et `markers`
- marge de 7 jours avant / apres
- si la duree obtenue est inferieure a 30 jours, la fin est etendue a droite jusqu'a 30 jours
- s'il n'y a aucun `event` ni `marker`, le composant retombe automatiquement en `sliding`

`custom`

- pas de scroll horizontal
- l'utilisateur fournit `customView.start` et `customView.end`
- la plage est fit dans la largeur visible
- si la duree est inferieure a 30 jours, la date de fin reelle est etendue a droite et le champ de fin est mis a jour
- en affichage `day`, le header adapte automatiquement ses libelles si les colonnes deviennent trop etroites (numero seul, puis masquage complet)

## Integration rapide

```html
<link rel="stylesheet" href="https://code.jquery.com/ui/1.13.3/themes/base/jquery-ui.css">
<link rel="stylesheet" href="./timeline-planner.css">

<div id="planner"></div>

<script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
<script src="https://code.jquery.com/ui/1.13.3/jquery-ui.min.js"></script>
<script src="./timeline-planner.js"></script>
<script>
  var planner = new TimelinePlanner("#planner", {
    language: "FR",
    viewMode: "sliding",
    customView: { start: "2026-02-10", end: "2026-03-20" },
    resources: [
      { id: "R1", label: "Equipe A", order: 1, meta: { manager: "Lena" } }
    ],
    events: [
      { id: "E1", resourceId: "R1", start: "2026-02-01", end: "2026-02-05", meta: { label: "Lot A" } }
    ],
    markers: [
      { id: "M1", date: "2026-02-15", label: "Jalon", color: "#cb4d42", lineStyle: "dashed", lineWidth: 2 }
    ]
  });
</script>
```

## Constructeur

```js
var planner = new TimelinePlanner(containerSelectorOrElement, options);
```

Expose aussi :

```js
planner.destroy();
```

## Structure des donnees

### Ressource

```js
{
  id: "R1",
  label: "Nom ressource",
  order: 1,
  editable: true,
  typeId: "T1",
  meta: { anyCustomData: true }
}
```

### Evenement (barre)

```js
{
  id: "E1",
  resourceId: "R1",
  start: "2026-02-01",
  end: "2026-02-10",
  editable: true,
  meta: { anyCustomData: true }
}
```

### Marker (repere ponctuel)

```js
{
  id: "M1",
  date: "2026-02-15",
  label: "Debut travaux",
  color: "#cb4d42",
  lineStyle: "solid", // solid | dashed | dotted
  lineWidth: 2,
  meta: { anyCustomData: true }
}
```

Les `markers` sont non interactifs et sont pris en compte dans les calculs de `sliding` et `global`.

## Options principales

```js
{
  editable: true,
  controlledResources: false,
  controlledEvents: false,

  allowResourceReorder: true,
  allowCrossResourceEventMove: true,

  builtInContextMenu: false,
  contextMenu: {
    actions: {},
    targets: {},
    resolveActions: null
  },
  multiSelectResources: false,

  showTodayLine: true,

  language: "EN",      // EN | FR | ES
  translations: {},

  timeScale: "day",        // day | week | month
  viewMode: "sliding",     // sliding | global | custom
  columnSizePreset: "medium", // small | medium | large

  contentMarginDays: 7,
  fitMinDays: 30,
  slidingEdgeThresholdDays: 5,
  slidingExtendDelayMs: 1000,
  slidingPointerEdgeZonePx: 48,
  slidingExtendBy: {
    day: 30,
    week: 28,
    month: 30
  },

  customView: {
    start: "2026-02-10",
    end: "2026-03-20"
  },

  weekStartsOn: 1,
  rowHeight: 58,
  resourceColumnWidth: 280,
  headerHeight: 58,
  toolbarTitle: null,
  resourceRowActionsPosition: "inlineLabel",
  newEventDurationDays: 3,

  columnWidths: {
    day: { small: 24, medium: 34, large: 44 },
    week: { small: 14, medium: 18, large: 24 },
    month: { small: 8, medium: 11, large: 14 }
  },

  resources: [],
  events: [],
  markers: [],

  renderResourceLabel: function (resource) {},
  renderEventContent: function (event) {},
  resourceClassNames: function (resource) {},
  eventClassNames: function (event) {},
  slotClassNames: function (dateIso, timeScale) {},

  customValidateEvent: function (nextEvent, context) {},
  customValidateMode: "compose", // compose | replace
  can: function (action, ctx) {},
  beforeEventChange: function (nextEvent, context) {}
}
```

Notes utiles :

- `allowResourceReorder` desactive proprement le handle et `sortable`
- `allowCrossResourceEventMove: false` laisse le drag temporel actif, mais empeche de changer de ressource
- `columnSizePreset` n'agit que sur `sliding`
- `language` selectionne le pack integre (`EN`, `FR`, `ES`)
- `translations` fusionne partiellement vos libelles metier sur le pack choisi
- `toolbarTitle: null` utilise le titre integre de la langue courante
- `contextMenu` permet de configurer les actions visibles pour `resource`, `event` et `empty`
- `contextMenu.targets.resource`, `event` et `empty` remplacent chacun leur liste standard
- en `global` et `custom`, la largeur des colonnes est calculee automatiquement pour tout faire tenir
- en `sliding`, l'extension automatique des colonnes est temporisee (`slidingExtendDelayMs`) pour eviter un emballement
- en `sliding`, approcher le pointeur du bord gauche/droit de la timeline peut aussi declencher l'extension, utile quand il n'y a pas encore de scrollbar horizontale
- `beforeEventChange(nextEvent, context)` est appele avant le commit d'un drag / resize et avant `updateEvent()`

## Langue et textes

Packs integres disponibles :

- `EN` (par defaut)
- `FR`
- `ES`

Le dictionnaire actif couvre notamment :

- le titre integre du toolbar
- le libelle de la colonne ressources
- le bouton d'ajout de ressource
- les labels des controles de la barre haute
- les valeurs visibles des selecteurs de la barre haute
- les abrevations de mois
- les initiales de jours et le prefixe des semaines
- les libelles du menu contextuel integre
- les messages de validation et de toast
- les labels ARIA du handle de reorder et du bouton d'ajout d'evenement

Les surcharges metier se font via `translations` :

```js
var planner = new TimelinePlanner("#planner", {
  language: "FR",
  translations: {
    labels: {
      resources: "Lots",
      addResource: "Ajouter un lot"
    }
  }
});
```

`translations` est fusionne en profondeur avec le pack choisi. Vous pouvez donc ne fournir qu'une partie des cles.

## Context menu configurable

Le composant fournit un registre d'actions de context menu configurable sans casser les actions integrees par defaut.

Structure :

```js
contextMenu: {
  actions: {
    "resource.edit": {
      labelKey: "menu.resourceEdit",
      permission: "resource.edit",
      builtIn: true,
      mutable: true
    },
    "lot.openSheet": {
      label: "Ouvrir la fiche lot",
      iconClass: "icon-sheet",
      classNames: "is-accent",
      permission: "lot.openSheet",
      when: function (ctx) {
        return ctx.resource && ctx.resource.typeId === "LOT";
      }
    }
  },
  targets: {
    resource: ["resource.edit", "lot.openSheet", "resource.delete"],
    event: ["event.edit", "event.delete"],
    empty: ["event.create"]
  },
  resolveActions: function (targetType, ctx, actionIds) {
    return actionIds;
  }
}
```

Champs utiles d'une action :

- `label` : texte fixe
- `labelKey` : cle de traduction resolue depuis le dictionnaire actif
- `iconClass` : classe CSS ajoutee a l'icone de l'item
- `classNames` : classes CSS ajoutees a l'item de menu
- `permission` : nom technique passe a `can(action, ctx)` ; peut aussi etre une fonction supplementaire de filtrage
- `when(ctx)` : filtre contextuel local a l'action
- `mutable: true` : applique les gardes d'edition (`editable`, `resource.editable`, `event.editable`)
- `builtIn: true` : conserve le dispatch standard des actions integrees (`resourceEditRequested`, `eventDeleteRequested`, etc.)

Comportement :

- si aucune configuration n'est fournie, le menu utilise les actions integrees standard
- les actions non autorisees sont masquees
- `can(action, ctx)` continue de fonctionner ; `ctx.requestedAction` contient l'ID d'action de menu original
- `targets` determine quelles actions sont candidates par cible
- `resolveActions()` permet de reordonner ou remplacer dynamiquement la liste finale par cible

Actions integrees par defaut :

- `resource.edit`
- `resource.delete`
- `event.edit`
- `event.delete`
- `event.create`

## Barre haute

Le composant affiche une barre haute fixe au-dessus de la grille.

Il contient :

- le selecteur de granularite (libelles selon la langue courante)
- le selecteur de vue (libelles selon la langue courante)
- en mode `custom`, les champs `debut` / `fin` (libelles selon la langue courante)
- le titre du planner a gauche

L'en-tete sticky de la colonne ressources contient :

- le libelle de la colonne ressources
- le bouton principal d'ajout de ressource, affiche comme un bouton compact avec l'icone `+`

Comportement :

- changer de vue ou de granularite dans la barre haute met a jour le composant immediatement
- si la date de fin custom est trop courte, elle est automatiquement etendue puis reaffichee dans la barre haute

## Validation native

Validation integree :

- `OVERLAP` : chevauchement interdit sur une meme ressource
- `READ_ONLY` : action interdite par `editable`, `resource.editable`, `event.editable` ou `can`
- `INVALID_DATE` : date invalide, ordre incoherent ou ressource cible absente

En cas d'echec :

- revert visuel de l'interaction
- toast interne discret
- emission de `validationError`

Chargement des donnees :

- au chargement initial ou via `setEvents()`, un evenement invalide est ignore
- `validationError` est emis pour diagnostic
- aucun toast visuel n'est affiche pour ces erreurs de chargement

## Controle des droits

Le composant verifie :

- `options.editable`
- `resource.editable`
- `event.editable`
- `options.can(action, ctx)`

Actions utilisees par le composant :

- `resource.create`
- `resource.edit`
- `resource.delete`
- `resource.reorder`
- `event.create`
- `event.edit`
- `event.delete`
- `event.move`
- `event.resize`

Les actions custom de `contextMenu` peuvent utiliser leurs propres noms techniques.

## Rendu personnalisable

Callbacks de rendu :

- `renderResourceLabel(resource) => string | HTMLElement | jQuery`
- `renderEventContent(event) => string | HTMLElement | jQuery`
- `resourceClassNames(resource) => string | string[]`
- `eventClassNames(event) => string | string[]`
- `slotClassNames(dateIso, timeScale) => string | string[]`

Comportement de securite :

- hors callbacks, les labels par defaut sont rendus comme texte et non comme HTML
- si un callback retourne une `string`, elle est injectee comme HTML : n'utiliser que du contenu de confiance
- pour eviter toute ambiguite, preferer retourner un `HTMLElement` ou un objet jQuery

## Evenements jQuery

Tous les evenements sont emis sur le container :

```js
$(container).on("resourceSelect", function (e, payload) {
  console.log(payload);
});
```

Evenements minimum emis :

- `resourceSelect`
- `contextMenuRequested`
- `resourceCreateRequested`
- `eventCreateRequested`
- `eventEditRequested`
- `eventChangeRequested`
- `resourceOrderChangeRequested`
- `validationError`
- `viewChanged`

Evenements additionnels / conditionnels :

- `contextActionSelected` (menu integre, avec `actionId` et `actionItem`)
- `resourceEditRequested` (double-clic sur ressource ou action de menu)
- `resourceDeleteRequested` (action de menu)
- `eventDeleteRequested` (action de menu)

Payloads typiques :

- `resourceSelect` : `resource`, `resourceId`, `meta`, `selectedResourceIds`, `clientX`, `clientY`
- `contextMenuRequested` : `targetType`, `resource`, `event`, `resourceId`, `eventId`, `date`, `clientX`, `clientY`, `actions`, `actionItems`
- `eventCreateRequested` :
  - via bouton : `resource`, `resourceId`, `suggestedStart`, `suggestedEnd`, `inputMethod: "button"`
  - via drag vide : `resource`, `resourceId`, `start`, `end`, `inputMethod: "range"`
  - via menu vide : `resource`, `resourceId`, `start`, `end`, `inputMethod: "contextMenu"`
- `eventChangeRequested` : `eventId`, `resourceId`, `oldEvent`, `nextEvent`, `changeType`, `resource`
- `resourceOrderChangeRequested` : `orderedResourceIds`, `oldOrder`, `newOrder`
- `validationError` : `code`, `message`, `context`, `resource`, `event`, `nextEvent`
- `viewChanged` : `timeScale`, `viewMode`, `visibleStart`, `visibleEnd`, `displayStart`, `displayEnd`, `scrollLeft`, `scrollTop`

`actionItems` contient les actions resolues pour le menu :

```js
{
  id: "resource.edit",
  label: "Edit resource",
  iconClass: "icon-edit",
  classNames: "is-accent",
  builtIn: true,
  permission: "resource.edit"
}
```

## API publique

```js
planner.updateOptions(partialOptions);

planner.setTimeScale("day");      // day | week | month
planner.setScaleMode("day");      // alias de setTimeScale
planner.setViewMode("sliding");   // sliding | global | custom
planner.setCustomView({ start, end });
planner.setView({ start, end });  // alias de setCustomView
planner.setRange({ start, end }); // alias de setCustomView
planner.setColumnSizePreset("medium"); // small | medium | large

planner.setResources(resources);
planner.setEvents(events);
planner.setMarkers(markers);

planner.addResource(resource);
planner.updateResource(resource);
planner.removeResource(resourceId);

planner.addEvent(eventObject);
planner.updateEvent(eventObject);
planner.removeEvent(eventId);

planner.addMarker(marker);
planner.updateMarker(marker);
planner.removeMarker(markerId);

planner.scrollToDate("2026-02-15", "center"); // actif en sliding
planner.scrollToResource("R5");

planner.getState();
planner.destroy();
```

Contrat de retour :

- `updateOptions()`, `set*()`, `scrollTo*()` retournent l'instance
- `add*()`, `update*()` et `remove*()` sur les ressources / evenements / markers retournent un booleen
- `updateResource()`, `updateEvent()` et `updateMarker()` se comportent comme des upserts si l'ID n'existe pas encore

## getState()

`planner.getState()` renvoie notamment :

- `language`
- `timeScale`
- `viewMode`
- `columnSizePreset`
- `visibleStart`
- `visibleEnd`
- `displayStart`
- `displayEnd`
- `allowResourceReorder`
- `allowCrossResourceEventMove`
- `customView`
- les tableaux `resources`, `events`, `markers`

## Demo

Ouvrir `demo.html`.

La demo montre :

- 10 ressources avec `order` et `meta`
- plusieurs evenements non continus
- des `markers` verticaux, dont 2 le meme jour pour montrer le decalage
- la barre haute du composant pour `day / week / month` et `sliding / global / custom`
- un panneau de configuration technique pour `columnSizePreset` et les flags de drag / reorder
- la creation par selection de plage
- le move / resize
- le reorder
- les payloads d'evenements dans un panneau de debug
- un cas `OVERLAP` volontaire

## Notes techniques

- Les dates sont manipulees en UTC a minuit pour eviter les decalages lies au fuseau / DST
- `sliding` etend la plage visible dynamiquement au scroll horizontal
- `global` et `custom` calculent la largeur des colonnes pour supprimer le scroll horizontal
- `destroy()` nettoie le DOM, les handlers namespaces et l'instance stockee via jQuery
