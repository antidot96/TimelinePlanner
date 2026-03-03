# Timeline Planner

"resources x timeline" planning component in vanilla JavaScript + jQuery.

The component provides:

- a sticky resource column
- a scrollable or "fit to content" time grid depending on the view mode
- duration events (bars)
- point-in-time markers (non-interactive vertical lines)
- resource selection
- vertical resource reordering
- event creation by button or range selection
- event move / resize
- an integrated footer with view selectors
- a jQuery event bus

Delivered files:

- `timeline-planner.js`
- `timeline-planner.css`
- `demo.html`

## Dependencies

Required:

- jQuery 3.x

Used in this implementation:

- jQuery UI 1.13.3

jQuery UI feature used:

- `sortable` only, for vertical resource reordering

Event move / resize, view handling, and range selection are implemented natively (DOM + mouse).

## Conventions

- Dates use the `YYYY-MM-DD` format only
- No datetime support in this version
- `end` is treated as `inclusive`
- Editing snap is `1 day`
- The visible range is computed from `events` and `markers`
- The built-in language is controlled by `language` (`EN` by default) and can be fine-tuned with `translations`

## Functional Model

The component is driven by 2 distinct concepts:

- `timeScale`: `day | week | month`
- `viewMode`: `sliding | global | custom`

Meaning:

- `timeScale` defines the visual grid granularity
- `viewMode` defines how the visible range is computed

### View Modes

`sliding`

- horizontal scrolling is enabled
- fixed-width columns
- the initial range is computed from the min / max of `events` and `markers`, with a 7-day margin before and after
- when the horizontal scroll approaches an edge, the range is extended dynamically:
  - `day` -> +30 days
  - `week` -> +4 weeks
  - `month` -> +1 month

`global`

- no horizontal scrolling
- fit to content
- the visible range covers all `events` and `markers`
- 7-day margin before / after
- if the resulting duration is shorter than 30 days, the end is extended to the right until it reaches 30 days
- if there is no `event` and no `marker`, the component automatically falls back to `sliding`

`custom`

- no horizontal scrolling
- the user provides `customView.start` and `customView.end`
- the range is fit into the visible width
- if the duration is shorter than 30 days, the actual end date is extended to the right and the end field is updated
- in `day` display, the header automatically adapts its labels when columns become too narrow (number only, then fully hidden)

## Quick Integration

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

## Constructor

```js
var planner = new TimelinePlanner(containerSelectorOrElement, options);
```

Also exposes:

```js
planner.destroy();
```

## Data Structure

### Resource

```js
{
  id: "R1",
  label: "Resource name",
  order: 1,
  editable: true,
  typeId: "T1",
  meta: { anyCustomData: true }
}
```

### Event (bar)

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

### Marker (point marker)

```js
{
  id: "M1",
  date: "2026-02-15",
  label: "Work starts",
  color: "#cb4d42",
  lineStyle: "solid", // solid | dashed | dotted
  lineWidth: 2,
  meta: { anyCustomData: true }
}
```

`markers` are non-interactive and are included in `sliding` and `global` range calculations.

## Main Options

```js
{
  editable: true,
  controlledResources: false,
  controlledEvents: false,

  allowResourceReorder: true,
  allowCrossResourceEventMove: true,

  builtInContextMenu: false,
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
  footerHeight: 64,
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

Useful notes:

- `allowResourceReorder` cleanly disables the handle and `sortable`
- `allowCrossResourceEventMove: false` keeps time dragging enabled, but prevents changing resource
- `columnSizePreset` only affects `sliding`
- `language` selects the built-in pack (`EN`, `FR`, `ES`)
- `translations` partially merges your business labels into the selected pack
- `toolbarTitle: null` uses the built-in title of the current language
- in `global` and `custom`, column width is computed automatically so everything fits
- in `sliding`, automatic column extension is delayed (`slidingExtendDelayMs`) to avoid runaway growth
- in `sliding`, moving the pointer near the left / right edge of the timeline can also trigger extension, which is useful when there is no horizontal scrollbar yet
- `beforeEventChange(nextEvent, context)` is called before committing a drag / resize and before `updateEvent()`

## Language and Text

Available built-in packs:

- `EN` (default)
- `FR`
- `ES`

The active dictionary covers in particular:

- the built-in toolbar title
- the resource column label
- the add resource button
- footer labels
- visible footer selector values
- month abbreviations
- day initials and the week prefix
- built-in context menu labels
- validation and toast messages
- ARIA labels for the reorder handle and the add event button

Business-specific overrides are provided through `translations`:

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

`translations` is deeply merged with the selected pack. You can therefore provide only part of the keys.

## Integrated Footer

The component displays a fixed footer at the bottom of the planner.

It contains:

- the granularity selector (labels based on the current language)
- the view selector (labels based on the current language)
- in `custom` mode, the `start` / `end` fields (labels based on the current language)

Behavior:

- changing the view or granularity in the footer updates the component immediately
- if the custom end date is too short, it is automatically extended and then displayed again in the footer

## Native Validation

Built-in validation:

- `OVERLAP`: overlap is not allowed on the same resource
- `READ_ONLY`: action forbidden by `editable`, `resource.editable`, `event.editable`, or `can`
- `INVALID_DATE`: invalid date, inconsistent order, or missing target resource

On failure:

- visual revert of the interaction
- subtle internal toast
- `validationError` emission

Data loading:

- on initial load or through `setEvents()`, an invalid event is ignored
- `validationError` is emitted for diagnostics
- no visible toast is shown for these loading errors

## Permission Control

The component checks:

- `options.editable`
- `resource.editable`
- `event.editable`
- `options.can(action, ctx)`

Actions used by the component:

- `resource.create`
- `resource.edit`
- `resource.delete`
- `resource.reorder`
- `resource.action1`
- `resource.action2`
- `event.create`
- `event.edit`
- `event.delete`
- `event.move`
- `event.resize`
- `event.action1`
- `event.action2`

## Custom Rendering

Rendering callbacks:

- `renderResourceLabel(resource) => string | HTMLElement | jQuery`
- `renderEventContent(event) => string | HTMLElement | jQuery`
- `resourceClassNames(resource) => string | string[]`
- `eventClassNames(event) => string | string[]`
- `slotClassNames(dateIso, timeScale) => string | string[]`

Safety behavior:

- outside callbacks, default labels are rendered as text, not HTML
- if a callback returns a `string`, it is injected as HTML: only use trusted content
- to avoid ambiguity, prefer returning an `HTMLElement` or a jQuery object

## jQuery Events

All events are emitted on the container:

```js
$(container).on("resourceSelect", function (e, payload) {
  console.log(payload);
});
```

Minimum emitted events:

- `resourceSelect`
- `contextMenuRequested`
- `resourceCreateRequested`
- `eventCreateRequested`
- `eventEditRequested`
- `eventChangeRequested`
- `resourceOrderChangeRequested`
- `validationError`
- `viewChanged`

Additional / conditional events:

- `contextActionSelected` (built-in menu)
- `resourceEditRequested` (double-click on resource or menu action)
- `resourceDeleteRequested` (menu action)
- `eventDeleteRequested` (menu action)

Typical payloads:

- `resourceSelect`: `resource`, `resourceId`, `meta`, `selectedResourceIds`, `clientX`, `clientY`
- `contextMenuRequested`: `targetType`, `resource`, `event`, `resourceId`, `eventId`, `date`, `clientX`, `clientY`, `actions`
- `eventCreateRequested`:
  - via button: `resource`, `resourceId`, `suggestedStart`, `suggestedEnd`, `inputMethod: "button"`
  - via empty drag: `resource`, `resourceId`, `start`, `end`, `inputMethod: "range"`
  - via empty menu: `resource`, `resourceId`, `start`, `end`, `inputMethod: "contextMenu"`
- `eventChangeRequested`: `eventId`, `resourceId`, `oldEvent`, `nextEvent`, `changeType`, `resource`
- `resourceOrderChangeRequested`: `orderedResourceIds`, `oldOrder`, `newOrder`
- `validationError`: `code`, `message`, `context`, `resource`, `event`, `nextEvent`
- `viewChanged`: `timeScale`, `viewMode`, `visibleStart`, `visibleEnd`, `displayStart`, `displayEnd`, `scrollLeft`, `scrollTop`

## Public API

```js
planner.updateOptions(partialOptions);

planner.setTimeScale("day");      // day | week | month
planner.setScaleMode("day");      // alias of setTimeScale
planner.setViewMode("sliding");   // sliding | global | custom
planner.setCustomView({ start, end });
planner.setView({ start, end });  // alias of setCustomView
planner.setRange({ start, end }); // alias of setCustomView
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

planner.scrollToDate("2026-02-15", "center"); // active in sliding
planner.scrollToResource("R5");

planner.getState();
planner.destroy();
```

Return contract:

- `updateOptions()`, `set*()`, `scrollTo*()` return the instance
- `add*()`, `update*()`, and `remove*()` on resources / events / markers return a boolean
- `updateResource()`, `updateEvent()`, and `updateMarker()` behave like upserts when the ID does not exist yet

## getState()

`planner.getState()` returns in particular:

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
- the `resources`, `events`, and `markers` arrays

## Demo

Open `demo.html`.

The demo shows:

- 10 resources with `order` and `meta`
- several non-contiguous events
- vertical `markers`, including 2 on the same day to show offsetting
- the component's integrated footer for `day / week / month` and `sliding / global / custom`
- a technical configuration panel for `columnSizePreset` and drag / reorder flags
- creation by range selection
- move / resize
- reordering
- event payloads in a debug panel
- an intentional `OVERLAP` case

## Technical Notes

- Dates are handled in UTC at midnight to avoid timezone / DST-related shifts
- `sliding` extends the visible range dynamically during horizontal scrolling
- `global` and `custom` compute column width to remove horizontal scrolling
- `destroy()` cleans up the DOM, namespaced handlers, and the instance stored through jQuery
