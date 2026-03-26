(function (window, $) {
  "use strict";

  if (!$) {
    throw new Error("TimelinePlanner requires jQuery.");
  }

  var MS_PER_DAY = 24 * 60 * 60 * 1000;
  var INSTANCE_COUNTER = 0;

  function createUtcDate(year, month, day) {
    return new Date(Date.UTC(year, month - 1, day));
  }

  function getCurrentLocalUtcDate() {
    var now = new Date();

    return createUtcDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  function parseIsoDate(input) {
    var match;
    var year;
    var month;
    var day;
    var date;

    if (input instanceof Date) {
      return createUtcDate(input.getUTCFullYear(), input.getUTCMonth() + 1, input.getUTCDate());
    }

    if (typeof input !== "string") {
      return null;
    }

    match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);

    if (!match) {
      return null;
    }

    year = parseInt(match[1], 10);
    month = parseInt(match[2], 10);
    day = parseInt(match[3], 10);
    date = createUtcDate(year, month, day);

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return date;
  }

  function formatIsoDate(date) {
    var year;
    var month;
    var day;

    if (!(date instanceof Date)) {
      return "";
    }

    year = String(date.getUTCFullYear());
    month = String(date.getUTCMonth() + 1).padStart(2, "0");
    day = String(date.getUTCDate()).padStart(2, "0");

    return year + "-" + month + "-" + day;
  }

  function addDays(date, amount) {
    return new Date(date.getTime() + amount * MS_PER_DAY);
  }

  function addMonths(date, amount) {
    var firstDayOfTargetMonth = createUtcDate(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1 + amount,
      1
    );
    var lastDayOfTargetMonth = createUtcDate(
      firstDayOfTargetMonth.getUTCFullYear(),
      firstDayOfTargetMonth.getUTCMonth() + 2,
      0
    ).getUTCDate();

    return createUtcDate(
      firstDayOfTargetMonth.getUTCFullYear(),
      firstDayOfTargetMonth.getUTCMonth() + 1,
      Math.min(date.getUTCDate(), lastDayOfTargetMonth)
    );
  }

  function diffDays(start, end) {
    return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY);
  }

  function diffDaysInclusive(start, end) {
    return diffDays(start, end) + 1;
  }

  function clampDate(date, minDate, maxDate) {
    if (date.getTime() < minDate.getTime()) {
      return minDate;
    }

    if (date.getTime() > maxDate.getTime()) {
      return maxDate;
    }

    return date;
  }

  function startOfWeek(date, weekStartsOn) {
    var current = parseIsoDate(formatIsoDate(date));
    var weekday = current.getUTCDay();
    var normalizedStart = weekStartsOn % 7;
    var delta = (weekday - normalizedStart + 7) % 7;

    return addDays(current, -delta);
  }

  function startOfMonth(date) {
    return createUtcDate(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
  }

  function endOfMonth(date) {
    return createUtcDate(date.getUTCFullYear(), date.getUTCMonth() + 2, 0);
  }

  function getIsoWeekNumber(date, weekStartsOn) {
    var target = startOfWeek(date, weekStartsOn);
    var yearStart = startOfWeek(createUtcDate(target.getUTCFullYear(), 1, 1), weekStartsOn);

    return Math.floor(diffDays(yearStart, target) / 7) + 1;
  }

  function datesOverlap(startA, endA, startB, endB) {
    return startA.getTime() <= endB.getTime() && startB.getTime() <= endA.getTime();
  }

  function cloneData(value) {
    if ($.isArray(value)) {
      return $.map(value, function (item) {
        return cloneData(item);
      });
    }

    if ($.isPlainObject(value)) {
      return $.extend(true, {}, value);
    }

    return value;
  }

  function mergeOptions(base, patch) {
    var result = $.isPlainObject(base) ? $.extend(true, {}, base) : {};
    var key;
    var currentValue;
    var nextValue;

    patch = patch || {};

    for (key in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) {
        continue;
      }

      currentValue = result[key];
      nextValue = patch[key];

      if ($.isArray(nextValue)) {
        result[key] = nextValue.slice();
      } else if ($.isPlainObject(nextValue)) {
        result[key] = mergeOptions($.isPlainObject(currentValue) ? currentValue : {}, nextValue);
      } else {
        result[key] = nextValue;
      }
    }

    return result;
  }

  function getNestedValue(source, path) {
    var cursor = source;
    var parts;
    var index;

    if (!source || !path) {
      return undefined;
    }

    parts = String(path).split(".");

    for (index = 0; index < parts.length; index += 1) {
      if (cursor === null || cursor === undefined || !Object.prototype.hasOwnProperty.call(cursor, parts[index])) {
        return undefined;
      }

      cursor = cursor[parts[index]];
    }

    return cursor;
  }

  function createDefaultContextMenuConfig() {
    return {
      actions: {
        "resource.edit": {
          labelKey: "menu.resourceEdit",
          permission: "resource.edit",
          builtIn: true,
          mutable: true
        },
        "resource.delete": {
          labelKey: "menu.resourceDelete",
          permission: "resource.delete",
          builtIn: true,
          mutable: true
        },
        "event.edit": {
          labelKey: "menu.eventEdit",
          permission: "event.edit",
          builtIn: true,
          mutable: true
        },
        "event.delete": {
          labelKey: "menu.eventDelete",
          permission: "event.delete",
          builtIn: true,
          mutable: true
        },
        "event.create": {
          labelKey: "menu.eventCreate",
          permission: "event.create",
          builtIn: true,
          mutable: true
        }
      },
      targets: {
        resource: ["resource.edit", "resource.delete"],
        event: ["event.edit", "event.delete"],
        empty: ["event.create"]
      },
      resolveActions: null
    };
  }

  function normalizeClassNames(input) {
    if (!input) {
      return "";
    }

    if ($.isArray(input)) {
      return $.grep(input, function (item) {
        return !!item;
      }).join(" ");
    }

    return String(input);
  }

  function appendContent($target, content, allowHtmlStrings) {
    $target.empty();

    if (content === null || content === undefined) {
      return;
    }

    if (typeof content === "string") {
      if (allowHtmlStrings) {
        $target.html(content);
      } else {
        $target.text(content);
      }
      return;
    }

    if (content.jquery) {
      $target.append(content);
      return;
    }

    if (content.nodeType) {
      $target.append(content);
      return;
    }

    $target.text(String(content));
  }

  function isMutableAction(actionId) {
    return /(?:create|edit|delete|move|resize|reorder)/.test(actionId);
  }

  function getRecommendedTimeScale(totalDays) {
    if (totalDays <= 31) {
      return "day";
    }

    if (totalDays <= 100) {
      return "week";
    }

    return "month";
  }

  var BUILT_IN_LOCALES = {
    EN: {
      labels: {
        defaultToolbarTitle: "Timeline Planner",
        resources: "Resources",
        display: "Display",
        view: "View",
        start: "Start",
        end: "End",
        addResource: "Add Resource",
        addEventAria: "Add Event",
        reorderResourceAria: "Reorder Resource"
      },
      timeScaleOptions: {
        day: "Day",
        week: "Week",
        month: "Month"
      },
      viewModeOptions: {
        sliding: "Sliding",
        global: "Global",
        custom: "Custom"
      },
      calendar: {
        monthsShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        daysShort: ["S", "M", "T", "W", "T", "F", "S"],
        weekPrefix: "W"
      },
      menu: {
        resourceEdit: "Edit Resource",
        resourceDelete: "Delete Resource",
        resourceAction1: "Resource Action 1",
        resourceAction2: "Resource Action 2",
        eventEdit: "Edit Event",
        eventDelete: "Delete Event",
        eventAction1: "Event Action 1",
        eventAction2: "Event Action 2",
        eventCreate: "Create Event"
      },
      messages: {
        validationError: "Validation error.",
        actionNotAllowed: "Action not allowed.",
        invalidDates: "Dates are invalid.",
        targetResourceMissing: "The target resource could not be found.",
        editingForbidden: "Editing is not allowed.",
        overlapForbidden: "Overlap is not allowed on the same resource.",
        beforeEventChangeRejected: "The change was rejected by beforeEventChange."
      }
    },
    FR: {
      labels: {
        defaultToolbarTitle: "Planning",
        resources: "Ressources",
        display: "Affichage",
        view: "Vue",
        start: "Debut",
        end: "Fin",
        addResource: "Ajouter une ressource",
        addEventAria: "Ajouter un evenement",
        reorderResourceAria: "Reordonner la ressource"
      },
      timeScaleOptions: {
        day: "Jour",
        week: "Semaine",
        month: "Mois"
      },
      viewModeOptions: {
        sliding: "Glissante",
        global: "Globale",
        custom: "Personnalisee"
      },
      calendar: {
        monthsShort: ["Jan", "Fev", "Mar", "Avr", "Mai", "Juin", "Juil", "Aou", "Sep", "Oct", "Nov", "Dec"],
        daysShort: ["D", "L", "M", "M", "J", "V", "S"],
        weekPrefix: "S"
      },
      menu: {
        resourceEdit: "Modifier la ressource",
        resourceDelete: "Supprimer la ressource",
        resourceAction1: "Action ressource 1",
        resourceAction2: "Action ressource 2",
        eventEdit: "Modifier l'evenement",
        eventDelete: "Supprimer l'evenement",
        eventAction1: "Action evenement 1",
        eventAction2: "Action evenement 2",
        eventCreate: "Creer un evenement"
      },
      messages: {
        validationError: "Erreur de validation.",
        actionNotAllowed: "Action non autorisee.",
        invalidDates: "Les dates sont invalides.",
        targetResourceMissing: "La ressource cible est introuvable.",
        editingForbidden: "Edition interdite.",
        overlapForbidden: "Le chevauchement est interdit sur une meme ressource.",
        beforeEventChangeRejected: "Le changement a ete refuse par beforeEventChange."
      }
    },
    ES: {
      labels: {
        defaultToolbarTitle: "Planificador",
        resources: "Recursos",
        display: "Visualizacion",
        view: "Vista",
        start: "Inicio",
        end: "Fin",
        addResource: "Agregar un recurso",
        addEventAria: "Agregar un evento",
        reorderResourceAria: "Reordenar recurso"
      },
      timeScaleOptions: {
        day: "Dia",
        week: "Semana",
        month: "Mes"
      },
      viewModeOptions: {
        sliding: "Deslizante",
        global: "Global",
        custom: "Personalizada"
      },
      calendar: {
        monthsShort: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"],
        daysShort: ["D", "L", "M", "X", "J", "V", "S"],
        weekPrefix: "S"
      },
      menu: {
        resourceEdit: "Editar recurso",
        resourceDelete: "Eliminar recurso",
        resourceAction1: "Accion recurso 1",
        resourceAction2: "Accion recurso 2",
        eventEdit: "Editar evento",
        eventDelete: "Eliminar evento",
        eventAction1: "Accion evento 1",
        eventAction2: "Accion evento 2",
        eventCreate: "Crear evento"
      },
      messages: {
        validationError: "Error de validacion.",
        actionNotAllowed: "Accion no autorizada.",
        invalidDates: "Las fechas no son validas.",
        targetResourceMissing: "No se encontro el recurso destino.",
        editingForbidden: "Edicion no permitida.",
        overlapForbidden: "No se permite solapamiento en el mismo recurso.",
        beforeEventChangeRejected: "El cambio fue rechazado por beforeEventChange."
      }
    }
  };

  function TimelinePlanner(container, options) {
    var incomingOptions = options || {};

    if (
      !Object.prototype.hasOwnProperty.call(incomingOptions, "timeScale") &&
      Object.prototype.hasOwnProperty.call(incomingOptions, "scaleMode")
    ) {
      incomingOptions = $.extend({}, incomingOptions, {
        timeScale: incomingOptions.scaleMode
      });
    }

    if (!(this instanceof TimelinePlanner)) {
      return new TimelinePlanner(container, incomingOptions);
    }

    this.$host = $(container).first();

    if (!this.$host.length) {
      throw new Error("TimelinePlanner could not find the container.");
    }

    this.instanceId = "tp-" + (++INSTANCE_COUNTER);
    this.eventNamespace = "." + this.instanceId;
    this.destroyed = false;
    this.autoTimeScale = !(
      Object.prototype.hasOwnProperty.call(incomingOptions, "timeScale") ||
      Object.prototype.hasOwnProperty.call(incomingOptions, "scaleMode")
    );
    this.options = this._sanitizeOptions(mergeOptions(this._createDefaultOptions(), incomingOptions));

    this.resources = [];
    this.events = [];
    this.markers = [];
    this.resourceMap = {};
    this.eventMap = {};
    this.markerMap = {};
    this.selectedResourceIds = [];

    this.currentTimeScale = this.options.timeScale;
    this.currentViewMode = this.options.viewMode;
    this.displayRange = null;
    this.timelineDays = [];
    this.metrics = {
      dayWidth: 0,
      totalWidth: 0,
      availableTimelineWidth: 0
    };
    this.dragState = null;
    this.viewChangedTimer = null;
    this.slidingExtendTimer = null;
    this.pendingSlidingExtend = null;
    this.lastPointerClientX = null;
    this.pendingScrollTarget = null;
    this.lastVisibleAnchor = null;

    this.$root = null;
    this.$toolbar = null;
    this.$scroll = null;
    this.$header = null;
    this.$rows = null;
    this.$toastLayer = null;
    this.$contextMenu = null;
    this.locale = null;

    this.initialResources = this.options.resources || [];
    this.initialEvents = this.options.events || [];
    this.initialMarkers = this.options.markers || [];
    this._refreshLocale();

    this._buildShell();
    this._setResourcesInternal(this.initialResources);
    this._setEventsInternal(this.initialEvents);
    this._setMarkersInternal(this.initialMarkers);
    this._render();

    this.$host.data("timelinePlanner", this);
  }

  TimelinePlanner.prototype._createDefaultOptions = function () {
    var today = getCurrentLocalUtcDate();

    return {
      editable: true,
      controlledResources: false,
      controlledEvents: false,
      allowResourceReorder: true,
      allowCrossResourceEventMove: true,
      builtInContextMenu: false,
      contextMenu: createDefaultContextMenuConfig(),
      multiSelectResources: false,
      showTodayLine: true,
      language: "EN",
      translations: {},
      timeScale: "day",
      viewMode: "sliding",
      columnSizePreset: "medium",
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
      weekStartsOn: 1,
      rowHeight: 58,
      resourceColumnWidth: 280,
      columnWidths: {
        day: {
          small: 24,
          medium: 34,
          large: 44
        },
        week: {
          small: 14,
          medium: 18,
          large: 24
        },
        month: {
          small: 8,
          medium: 11,
          large: 14
        }
      },
      headerHeight: 58,
      footerHeight: 64,
      toolbarTitle: null,
      resourceRowActionsPosition: "inlineLabel",
      newEventDurationDays: 3,
      customView: {
        start: formatIsoDate(today),
        end: formatIsoDate(addDays(today, 20))
      },
      resources: [],
      events: [],
      markers: [],
      renderResourceLabel: null,
      renderEventContent: null,
      resourceClassNames: null,
      eventClassNames: null,
      slotClassNames: null,
      customValidateEvent: null,
      customValidateMode: "compose",
      can: null,
      beforeEventChange: null
    };
  };

  TimelinePlanner.prototype._sanitizeOptions = function (options) {
    var sanitized = $.extend(true, {}, options);
    var defaultOptions = this._createDefaultOptions();
    var normalizedLanguage;
    var validTimeScales = {
      day: true,
      week: true,
      month: true
    };
    var validViewModes = {
      sliding: true,
      global: true,
      custom: true
    };

    if (!validTimeScales[sanitized.timeScale]) {
      sanitized.timeScale = defaultOptions.timeScale;
    }

    if (!validViewModes[sanitized.viewMode]) {
      sanitized.viewMode = defaultOptions.viewMode;
    }

    if (["small", "medium", "large"].indexOf(sanitized.columnSizePreset) === -1) {
      sanitized.columnSizePreset = defaultOptions.columnSizePreset;
    }

    if (["compose", "replace"].indexOf(sanitized.customValidateMode) === -1) {
      sanitized.customValidateMode = defaultOptions.customValidateMode;
    }

    if (["left", "inlineLabel", "rightOfLabel"].indexOf(sanitized.resourceRowActionsPosition) === -1) {
      sanitized.resourceRowActionsPosition = defaultOptions.resourceRowActionsPosition;
    }

    normalizedLanguage = String(sanitized.language || defaultOptions.language).toUpperCase();

    if (!BUILT_IN_LOCALES[normalizedLanguage]) {
      normalizedLanguage = defaultOptions.language;
    }

    sanitized.language = normalizedLanguage;

    if (!$.isPlainObject(sanitized.translations)) {
      sanitized.translations = {};
    }

    if (!$.isPlainObject(sanitized.contextMenu)) {
      sanitized.contextMenu = createDefaultContextMenuConfig();
    } else {
      if (!$.isPlainObject(sanitized.contextMenu.actions)) {
        sanitized.contextMenu.actions = $.extend(true, {}, defaultOptions.contextMenu.actions);
      }

      if (!$.isPlainObject(sanitized.contextMenu.targets)) {
        sanitized.contextMenu.targets = $.extend(true, {}, defaultOptions.contextMenu.targets);
      }

      $.each(["resource", "event", "empty"], function (_, targetType) {
        if (!$.isArray(sanitized.contextMenu.targets[targetType])) {
          sanitized.contextMenu.targets[targetType] = defaultOptions.contextMenu.targets[targetType].slice();
        } else {
          sanitized.contextMenu.targets[targetType] = $.map(sanitized.contextMenu.targets[targetType], function (actionId) {
            if (actionId === null || actionId === undefined || actionId === "") {
              return null;
            }

            return String(actionId);
          });
        }
      });

      $.each(sanitized.contextMenu.actions, function (actionId, actionConfig) {
        if (!$.isPlainObject(actionConfig)) {
          delete sanitized.contextMenu.actions[actionId];
          return;
        }

        if (actionConfig.classNames !== undefined && actionConfig.classNames !== null) {
          actionConfig.classNames = normalizeClassNames(actionConfig.classNames);
        }

        if (actionConfig.iconClass !== undefined && actionConfig.iconClass !== null) {
          actionConfig.iconClass = String(actionConfig.iconClass);
        }
      });

      if (sanitized.contextMenu.resolveActions !== null && typeof sanitized.contextMenu.resolveActions !== "function") {
        sanitized.contextMenu.resolveActions = null;
      }
    }

    sanitized.contentMarginDays = Math.max(0, parseInt(sanitized.contentMarginDays, 10) || defaultOptions.contentMarginDays);
    sanitized.fitMinDays = Math.max(1, parseInt(sanitized.fitMinDays, 10) || defaultOptions.fitMinDays);
    sanitized.slidingEdgeThresholdDays = Math.max(1, parseInt(sanitized.slidingEdgeThresholdDays, 10) || defaultOptions.slidingEdgeThresholdDays);
    sanitized.slidingExtendDelayMs = Math.max(0, parseInt(sanitized.slidingExtendDelayMs, 10) || defaultOptions.slidingExtendDelayMs);
    sanitized.slidingPointerEdgeZonePx = Math.max(12, parseInt(sanitized.slidingPointerEdgeZonePx, 10) || defaultOptions.slidingPointerEdgeZonePx);
    sanitized.weekStartsOn = sanitized.weekStartsOn === 0 ? 0 : 1;
    sanitized.columnWidths = $.extend(true, {}, defaultOptions.columnWidths, sanitized.columnWidths || {});
    sanitized.slidingExtendBy = $.extend({}, defaultOptions.slidingExtendBy, sanitized.slidingExtendBy || {});

    return sanitized;
  };

  TimelinePlanner.prototype._refreshLocale = function () {
    this.locale = mergeOptions(
      BUILT_IN_LOCALES[this.options.language] || BUILT_IN_LOCALES.EN,
      this.options.translations || {}
    );
  };

  TimelinePlanner.prototype._buildShell = function () {
    this.$host.empty().addClass("tp-host");

    this.$root = $('<div class="tp-planner"></div>');
    this.$toolbar = $('<div class="tp-toolbar"></div>');
    this.$scroll = $('<div class="tp-scroll"></div>');
    this.$header = $('<div class="tp-header-row"></div>');
    this.$rows = $('<div class="tp-resource-rows"></div>');
    this.$toastLayer = $('<div class="tp-toast-layer" aria-live="polite"></div>');
    this.$contextMenu = $('<div class="tp-context-menu"></div>').hide();

    this.$scroll.append(this.$header, this.$rows);
    this.$root.append(this.$toolbar, this.$scroll, this.$toastLayer, this.$contextMenu);
    this.$host.append(this.$root);

    this._bindBaseEvents();
  };

  TimelinePlanner.prototype._bindBaseEvents = function () {
    var self = this;

    this.$root.on("click" + this.eventNamespace, ".tp-add-resource-btn", function (event) {
      event.preventDefault();
      self._hideContextMenu();

      if (!self._guardAction("resource.create", { targetType: "resource" })) {
        return;
      }

      self._emit("resourceCreateRequested", {
        targetType: "resource",
        clientX: event.clientX,
        clientY: event.clientY,
        suggestedOrder: self.resources.length + 1
      });
    });

    this.$scroll.on("click" + this.eventNamespace, ".tp-resource-cell", function (event) {
      if ($(event.target).closest(".tp-add-event-btn, .tp-resource-handle").length) {
        return;
      }

      self._selectResource($(this).closest(".tp-resource-row").data("resourceId"), event);
    });

    this.$scroll.on("dblclick" + this.eventNamespace, ".tp-resource-cell", function (event) {
      var resourceId = $(this).closest(".tp-resource-row").data("resourceId");
      var resource = self.resourceMap[resourceId];

      if (!resource || !self._guardAction("resource.edit", { targetType: "resource", resource: resource })) {
        return;
      }

      self._emit("resourceEditRequested", {
        targetType: "resource",
        resourceId: resourceId,
        resource: cloneData(resource),
        meta: cloneData(resource.meta),
        clientX: event.clientX,
        clientY: event.clientY,
        actions: self._getAllowedActions("resource", { resource: resource })
      });
    });

    this.$scroll.on("click" + this.eventNamespace, ".tp-add-event-btn", function (event) {
      var resourceId = $(this).closest(".tp-resource-row").data("resourceId");
      var resource = self.resourceMap[resourceId];
      var startDate;
      var suggestedEnd;

      event.preventDefault();
      event.stopPropagation();
      self._hideContextMenu();

      if (!resource || !self._guardAction("event.create", { targetType: "resource", resource: resource })) {
        return;
      }

      startDate = self._getSuggestedStartForNewEvent();
      suggestedEnd = addDays(startDate, Math.max(0, self.options.newEventDurationDays - 1));

      self._emit("eventCreateRequested", {
        targetType: "resource",
        resourceId: resourceId,
        resource: cloneData(resource),
        meta: cloneData(resource.meta),
        suggestedStart: formatIsoDate(startDate),
        suggestedEnd: formatIsoDate(suggestedEnd),
        inputMethod: "button",
        clientX: event.clientX,
        clientY: event.clientY
      });
    });

    this.$scroll.on("dblclick" + this.eventNamespace, ".tp-event-bar", function (event) {
      var eventId = $(this).data("eventId");
      var plannerEvent = self.eventMap[eventId];
      var resource = plannerEvent ? self.resourceMap[plannerEvent.resourceId] : null;

      if (!plannerEvent || !self._guardAction("event.edit", { targetType: "event", event: plannerEvent, resource: resource })) {
        return;
      }

      self._emit("eventEditRequested", {
        targetType: "event",
        eventId: plannerEvent.id,
        resourceId: plannerEvent.resourceId,
        event: cloneData(plannerEvent),
        resource: resource ? cloneData(resource) : null,
        meta: cloneData(plannerEvent.meta),
        clientX: event.clientX,
        clientY: event.clientY,
        actions: self._getAllowedActions("event", { event: plannerEvent, resource: resource })
      });
    });

    this.$scroll.on("contextmenu" + this.eventNamespace, ".tp-resource-cell, .tp-row-track, .tp-event-bar", function (event) {
      event.stopPropagation();
      self._handleContextMenu(event, $(this));
    });

    this.$scroll.on("mousedown" + this.eventNamespace, ".tp-row-track", function (event) {
      if (event.which !== 1 || $(event.target).closest(".tp-event-bar, .tp-add-event-btn, .ui-sortable-helper").length) {
        return;
      }

      self._startRangeSelection(event, $(this));
    });

    this.$scroll.on("mousedown" + this.eventNamespace, ".tp-event-bar", function (event) {
      if (event.which !== 1 || $(event.target).closest(".tp-resize-handle").length) {
        return;
      }

      self._startEventInteraction(event, $(this), "move");
    });

    this.$scroll.on("mousedown" + this.eventNamespace, ".tp-resize-handle", function (event) {
      if (event.which !== 1) {
        return;
      }

      event.stopPropagation();
      self._startEventInteraction(
        event,
        $(this).closest(".tp-event-bar"),
        $(this).data("edge") === "start" ? "resizeStart" : "resizeEnd"
      );
    });

    this.$scroll.on("scroll" + this.eventNamespace, function () {
      self._handleScroll();
    });

    this.$scroll.on("mousemove" + this.eventNamespace, function (event) {
      self._handleSlidingEdgePointer(event);
    });

    this.$scroll.on("mouseleave" + this.eventNamespace, function () {
      self.lastPointerClientX = null;
      self._syncSlidingExtendRequest(null);
    });

    this.$toolbar.on("change" + this.eventNamespace, ".tp-time-scale-select", function () {
      self.setTimeScale($(this).val(), true);
    });

    this.$toolbar.on("change" + this.eventNamespace, ".tp-view-mode-select", function () {
      self.setViewMode($(this).val());
    });

    this.$toolbar.on("change" + this.eventNamespace, ".tp-custom-start-input, .tp-custom-end-input", function () {
      self.setCustomView({
        start: self.$toolbar.find(".tp-custom-start-input").val(),
        end: self.$toolbar.find(".tp-custom-end-input").val()
      });
    });

    this.$contextMenu.on("click" + this.eventNamespace, ".tp-menu-item", function (event) {
      var actionId = $(this).data("actionId");
      var payload = self.$contextMenu.data("payload") || null;
      var actionItem = $(this).data("actionItem") || null;

      event.preventDefault();
      self._hideContextMenu();

      if (payload && actionId) {
        self._dispatchContextAction(actionId, payload, actionItem);
      }
    });

    $(window).on("resize" + this.eventNamespace, function () {
      self._render();
    });

    $(document).on("mousedown" + this.eventNamespace, function (event) {
      if (!$(event.target).closest(".tp-context-menu").length) {
        self._hideContextMenu();
      }
    });
  };

  TimelinePlanner.prototype._getTodayDate = function () {
    return getCurrentLocalUtcDate();
  };

  TimelinePlanner.prototype._getAvailableTimelineWidth = function () {
    return Math.max(320, this.$host.innerWidth() - this.options.resourceColumnWidth - 2);
  };

  TimelinePlanner.prototype._scheduleViewChanged = function () {
    var self = this;

    if (this.viewChangedTimer) {
      window.clearTimeout(this.viewChangedTimer);
    }

    this.viewChangedTimer = window.setTimeout(function () {
      self.viewChangedTimer = null;
      self._emitViewChanged();
    }, 16);
  };

  TimelinePlanner.prototype._handleScroll = function () {
    if (this.currentViewMode === "sliding") {
      this._maybeExtendSlidingRange();
    } else {
      this._syncSlidingExtendRequest(null);
    }

    this._hideContextMenu();
    this._scheduleViewChanged();
  };

  TimelinePlanner.prototype._handleSlidingEdgePointer = function (event) {
    var request;

    this.lastPointerClientX = event.clientX;

    if (this.currentViewMode !== "sliding" || this.dragState) {
      this._syncSlidingExtendRequest(null);
      return;
    }

    request = this._getPointerExtendRequest(event.clientX);
    this._syncSlidingExtendRequest(request);
  };

  TimelinePlanner.prototype._normalizeCustomView = function (view) {
    var today = this._getTodayDate();
    var start = parseIsoDate(view && view.start) || today;
    var end = parseIsoDate(view && view.end) || start;
    var minimumEnd;

    if (end.getTime() < start.getTime()) {
      end = start;
    }

    minimumEnd = addDays(start, this.options.fitMinDays - 1);

    if (end.getTime() < minimumEnd.getTime()) {
      end = minimumEnd;
    }

    return {
      start: formatIsoDate(start),
      end: formatIsoDate(end)
    };
  };

  TimelinePlanner.prototype._getContentBounds = function () {
    var minDate = null;
    var maxDate = null;
    var candidateStart;
    var candidateEnd;

    $.each(this.events, function (_, plannerEvent) {
      candidateStart = parseIsoDate(plannerEvent.start);
      candidateEnd = parseIsoDate(plannerEvent.end);

      if (!candidateStart || !candidateEnd) {
        return;
      }

      if (!minDate || candidateStart.getTime() < minDate.getTime()) {
        minDate = candidateStart;
      }

      if (!maxDate || candidateEnd.getTime() > maxDate.getTime()) {
        maxDate = candidateEnd;
      }
    });

    $.each(this.markers, function (_, marker) {
      var markerDate = parseIsoDate(marker.date);

      if (!markerDate) {
        return;
      }

      if (!minDate || markerDate.getTime() < minDate.getTime()) {
        minDate = markerDate;
      }

      if (!maxDate || markerDate.getTime() > maxDate.getTime()) {
        maxDate = markerDate;
      }
    });

    if (!minDate || !maxDate) {
      return null;
    }

    return {
      start: minDate,
      end: maxDate
    };
  };

  TimelinePlanner.prototype._ensureMinimumSpan = function (range) {
    var minimumDays = this.options.fitMinDays;
    var currentDays = diffDaysInclusive(range.start, range.end);

    if (currentDays >= minimumDays) {
      return {
        start: range.start,
        end: range.end
      };
    }

    return {
      start: range.start,
      end: addDays(range.end, minimumDays - currentDays)
    };
  };

  TimelinePlanner.prototype._getSlidingBaseRange = function () {
    var bounds = this._getContentBounds();
    var today = this._getTodayDate();
    var margin = this.options.contentMarginDays;
    var baseRange;
    var currentDays;
    var missingDays;
    var extraBefore;
    var extraAfter;

    if (bounds) {
      baseRange = {
        start: addDays(bounds.start, -margin),
        end: addDays(bounds.end, margin)
      };

      return this._ensureMinimumSpan(baseRange);
    }

    baseRange = {
      start: addDays(today, -margin),
      end: addDays(today, margin)
    };

    currentDays = diffDaysInclusive(baseRange.start, baseRange.end);

    if (currentDays >= this.options.fitMinDays) {
      return baseRange;
    }

    missingDays = this.options.fitMinDays - currentDays;
    extraBefore = Math.floor(missingDays / 2);
    extraAfter = missingDays - extraBefore;

    return {
      start: addDays(baseRange.start, -extraBefore),
      end: addDays(baseRange.end, extraAfter)
    };
  };

  TimelinePlanner.prototype._getGlobalRange = function () {
    var bounds = this._getContentBounds();
    var margin = this.options.contentMarginDays;

    if (!bounds) {
      return null;
    }

    return this._ensureMinimumSpan({
      start: addDays(bounds.start, -margin),
      end: addDays(bounds.end, margin)
    });
  };

  TimelinePlanner.prototype._resolveDisplayRange = function () {
    var customView;
    var globalRange;

    if (this.options.viewMode === "custom") {
      customView = this._normalizeCustomView(this.options.customView);
      this.options.customView = customView;

      return {
        start: parseIsoDate(customView.start),
        end: parseIsoDate(customView.end)
      };
    }

    if (this.options.viewMode === "global") {
      globalRange = this._getGlobalRange();

      if (globalRange) {
        return globalRange;
      }

      this.options.viewMode = "sliding";
    }

    return this._getSlidingBaseRange();
  };

  TimelinePlanner.prototype._getRecommendedScaleForViewMode = function (viewMode) {
    var targetRange;

    if (viewMode === "custom") {
      targetRange = this._normalizeCustomView(this.options.customView);

      return getRecommendedTimeScale(
        diffDaysInclusive(parseIsoDate(targetRange.start), parseIsoDate(targetRange.end))
      );
    }

    if (viewMode === "global") {
      targetRange = this._getGlobalRange() || this._getSlidingBaseRange();

      return getRecommendedTimeScale(diffDaysInclusive(targetRange.start, targetRange.end));
    }

    return this.options.timeScale;
  };

  TimelinePlanner.prototype._resolveTimeScale = function () {
    var explicitScale = this.options.timeScale;
    var totalDays = diffDaysInclusive(this.displayRange.start, this.displayRange.end);

    if ((this.options.viewMode === "global" || this.options.viewMode === "custom") && this.autoTimeScale) {
      return getRecommendedTimeScale(totalDays);
    }

    return explicitScale;
  };

  TimelinePlanner.prototype._resolveDayWidth = function () {
    var preset = this.options.columnSizePreset;
    var widths = this.options.columnWidths[this.currentTimeScale];
    var totalDays = this.timelineDays.length;
    var availableWidth = this.metrics.availableTimelineWidth;

    if (this.currentViewMode === "sliding") {
      return widths[preset];
    }

    return Math.max(4, availableWidth / Math.max(1, totalDays));
  };

  TimelinePlanner.prototype._buildTimelineDays = function () {
    var totalDays = diffDaysInclusive(this.displayRange.start, this.displayRange.end);
    var days = [];
    var index;

    for (index = 0; index < totalDays; index += 1) {
      days.push(addDays(this.displayRange.start, index));
    }

    return days;
  };

  TimelinePlanner.prototype._resolveMetrics = function () {
    this.metrics.availableTimelineWidth = this._getAvailableTimelineWidth();
    this.metrics.dayWidth = this._resolveDayWidth();
    this.metrics.totalWidth = this.currentViewMode === "sliding"
      ? Math.max(1, this.timelineDays.length * this.metrics.dayWidth)
      : Math.max(1, this.metrics.availableTimelineWidth);
  };

  TimelinePlanner.prototype._render = function () {
    var preservedScrollState = null;

    if (this.destroyed) {
      return;
    }

    this._syncSlidingExtendRequest(null);

    if (this.currentViewMode === "sliding" && this.displayRange && this.timelineDays.length) {
      preservedScrollState = {
        scrollLeft: this.$scroll.scrollLeft(),
        scrollTop: this.$scroll.scrollTop(),
        displayStart: this.displayRange.start,
        dayWidth: this.metrics.dayWidth
      };
    }

    this.displayRange = this._resolveDisplayRange();
    this.currentViewMode = this.options.viewMode;
    this.currentTimeScale = this._resolveTimeScale();
    this.options.timeScale = this.currentTimeScale;
    this.timelineDays = this._buildTimelineDays();
    this._resolveMetrics();

    this.$root
      .toggleClass("tp-mode-sliding", this.currentViewMode === "sliding")
      .toggleClass("tp-mode-fit", this.currentViewMode !== "sliding");
    this.$scroll.toggleClass("is-horizontal-locked", this.currentViewMode !== "sliding");

    this._renderToolbar();
    this._renderHeader();
    this._renderRows();
    this._initSortable();
    this._applyPostRenderScroll(preservedScrollState);
    this._emitViewChanged();
  };

  TimelinePlanner.prototype._applyPostRenderScroll = function (preservedScrollState) {
    var today = this._getTodayDate();
    var anchor = null;
    var left;
    var maxLeft;
    var oldOffsetDays;
    var startShiftDays;

    if (this.currentViewMode !== "sliding") {
      this.$scroll.scrollLeft(0);
      return;
    }

    if (this.pendingScrollTarget) {
      anchor = parseIsoDate(this.pendingScrollTarget);
      this.pendingScrollTarget = null;
    }

    if (anchor) {
      this.scrollToDate(formatIsoDate(anchor), "center", true);
    } else if (preservedScrollState) {
      oldOffsetDays = preservedScrollState.scrollLeft / Math.max(1, preservedScrollState.dayWidth);
      startShiftDays = diffDays(this.displayRange.start, preservedScrollState.displayStart);
      left = (startShiftDays + oldOffsetDays) * this.metrics.dayWidth;
      maxLeft = Math.max(0, this.metrics.totalWidth - this.metrics.availableTimelineWidth);
      left = Math.max(0, Math.min(left, maxLeft));

      this.$scroll.scrollLeft(left);
      this.$scroll.scrollTop(preservedScrollState.scrollTop);
    } else {
      this.scrollToDate(formatIsoDate(today), "center", true);
    }
  };

  TimelinePlanner.prototype._renderToolbar = function () {
    var toolbarTitle = this.options.toolbarTitle;
    var $wrap = $(
      '<div class="tp-toolbar-main">' +
        '<div class="tp-toolbar-title-group">' +
          '<div class="tp-toolbar-title"></div>' +
        "</div>" +
        '<div class="tp-toolbar-actions"></div>' +
      "</div>"
    );
    var $actions = $wrap.find(".tp-toolbar-actions");

    if (toolbarTitle === null || toolbarTitle === undefined) {
      toolbarTitle = this.locale.labels.defaultToolbarTitle;
    }

    $wrap.find(".tp-toolbar-title").text(toolbarTitle);
    this._appendToolbarViewControls($actions);

    this.$toolbar.empty().append($wrap);
  };

  TimelinePlanner.prototype._renderHeader = function () {
    var canCreate = this._isActionAllowed("resource.create", { targetType: "resource" });
    var $row = $('<div class="tp-grid-row tp-grid-row-header"></div>');
    var halfHeaderHeight = Math.max(24, Math.floor(this.options.headerHeight / 2));
    var $left = $('<div class="tp-resource-header"></div>').css({
      width: this.options.resourceColumnWidth + "px",
      minHeight: this.options.headerHeight + "px"
    });
    var $trackWrap = $('<div class="tp-header-track-wrap"></div>').css("minHeight", this.options.headerHeight + "px");
    var $track = $('<div class="tp-header-track"></div>').css({
      width: this.metrics.totalWidth + "px",
      minHeight: this.options.headerHeight + "px"
    });
    var $top = $('<div class="tp-header-band tp-header-band-top"></div>').css("minHeight", halfHeaderHeight + "px");
    var $bottom = $('<div class="tp-header-band tp-header-band-bottom"></div>').css("minHeight", halfHeaderHeight + "px");
    var topSegments = this._buildHeaderSegments("top");
    var bottomSegments = this._buildHeaderSegments("bottom");
    var index;
    var $headerMain = $('<div class="tp-resource-header-main"></div>');
    var $headerLabel = $('<span class="tp-resource-header-label"></span>').text(this.locale.labels.resources);

    $headerMain.append($headerLabel);

    if (canCreate) {
      $headerMain.append(
        $('<button type="button" class="tp-add-resource-btn tp-add-resource-btn-compact"></button>')
          .attr("aria-label", this.locale.labels.addResource)
          .append('<span class="tp-add-resource-btn-icon" aria-hidden="true">+</span>')
      );
    }

    $left.append($headerMain);

    for (index = 0; index < topSegments.length; index += 1) {
      $top.append(this._buildHeaderSegment(topSegments[index]));
    }

    for (index = 0; index < bottomSegments.length; index += 1) {
      $bottom.append(this._buildHeaderSegment(bottomSegments[index]));
    }

    $track.append($top, $bottom, this._buildHeaderMarkerLayer());

    if (this._isTodayVisible()) {
      $track.append(
        $('<div class="tp-today-line tp-header-today-line"></div>').css("left", this._getTodayLineLeft() + "px")
      );
    }

    $trackWrap.append($track);
    $row.append($left, $trackWrap);
    this.$header.empty().append($row);
  };

  TimelinePlanner.prototype._appendToolbarViewControls = function ($controls) {
    var customView = this._normalizeCustomView(this.options.customView);

    $controls.append(
      '<label class="tp-toolbar-field">' +
        '<span></span>' +
        '<select class="tp-time-scale-select">' +
          '<option value="day"></option>' +
          '<option value="week"></option>' +
          '<option value="month"></option>' +
        "</select>" +
      "</label>"
    );
    $controls.find(".tp-time-scale-select").prev("span").text(this.locale.labels.display);
    $controls.find('.tp-time-scale-select option[value="day"]').text(this.locale.timeScaleOptions.day);
    $controls.find('.tp-time-scale-select option[value="week"]').text(this.locale.timeScaleOptions.week);
    $controls.find('.tp-time-scale-select option[value="month"]').text(this.locale.timeScaleOptions.month);

    $controls.append(
      '<label class="tp-toolbar-field">' +
        '<span></span>' +
        '<select class="tp-view-mode-select">' +
          '<option value="sliding"></option>' +
          '<option value="global"></option>' +
          '<option value="custom"></option>' +
        "</select>" +
      "</label>"
    );
    $controls.find(".tp-view-mode-select").prev("span").text(this.locale.labels.view);
    $controls.find('.tp-view-mode-select option[value="sliding"]').text(this.locale.viewModeOptions.sliding);
    $controls.find('.tp-view-mode-select option[value="global"]').text(this.locale.viewModeOptions.global);
    $controls.find('.tp-view-mode-select option[value="custom"]').text(this.locale.viewModeOptions.custom);

    if (this.currentViewMode === "custom") {
      $controls.append(
        '<label class="tp-toolbar-field tp-toolbar-field-date">' +
          '<span></span>' +
          '<input type="date" class="tp-custom-start-input">' +
        "</label>"
      );
      $controls.append(
        '<label class="tp-toolbar-field tp-toolbar-field-date">' +
          '<span></span>' +
          '<input type="date" class="tp-custom-end-input">' +
        "</label>"
      );
      $controls.find(".tp-custom-start-input").prev("span").text(this.locale.labels.start);
      $controls.find(".tp-custom-end-input").prev("span").text(this.locale.labels.end);
    }
 
    $controls.find(".tp-time-scale-select").val(this.currentTimeScale);
    $controls.find(".tp-view-mode-select").val(this.currentViewMode);
    $controls.find(".tp-custom-start-input").val(customView.start);
    $controls.find(".tp-custom-end-input").val(customView.end);
  };

  TimelinePlanner.prototype._buildHeaderSegments = function (band) {
    var segments = [];
    var current = this.displayRange.start;
    var segmentStart;
    var segmentEnd;
    var label;
    var nextDay;

    if (this.currentTimeScale === "day" && band === "bottom") {
      while (current.getTime() <= this.displayRange.end.getTime()) {
        segments.push({
          label: this._getHeaderLabel(current, band),
          width: this.metrics.dayWidth
        });

        current = addDays(current, 1);
      }

      return segments;
    }

    while (current.getTime() <= this.displayRange.end.getTime()) {
      segmentStart = current;
      segmentEnd = current;
      label = this._getHeaderLabel(segmentStart, band);

      while (segmentEnd.getTime() <= this.displayRange.end.getTime()) {
        nextDay = addDays(segmentEnd, 1);

        if (
          nextDay.getTime() > this.displayRange.end.getTime() ||
          this._getHeaderLabel(nextDay, band) !== label
        ) {
          break;
        }

        segmentEnd = nextDay;
      }

      segments.push({
        label: label,
        width: diffDaysInclusive(segmentStart, segmentEnd) * this.metrics.dayWidth
      });

      current = addDays(segmentEnd, 1);
    }

    return segments;
  };

  TimelinePlanner.prototype._getHeaderLabel = function (date, band) {
    var shortDays = this.locale.calendar.daysShort;
    var shortMonths = this.locale.calendar.monthsShort;
    var weekPrefix = this.locale.calendar.weekPrefix || "W";

    if (this.currentTimeScale === "month") {
      return band === "top" ? String(date.getUTCFullYear()) : shortMonths[date.getUTCMonth()];
    }

    if (this.currentTimeScale === "week") {
      if (band === "top") {
        return shortMonths[date.getUTCMonth()] + " " + date.getUTCFullYear();
      }

      return weekPrefix + String(getIsoWeekNumber(date, this.options.weekStartsOn)).padStart(2, "0");
    }

    if (band === "top") {
      return shortMonths[date.getUTCMonth()] + " " + date.getUTCFullYear();
    }

    if (this.metrics.dayWidth < 11) {
      return "";
    }

    if (this.metrics.dayWidth < 24) {
      return String(date.getUTCDate()).padStart(2, "0");
    }

    return shortDays[date.getUTCDay()] + " " + String(date.getUTCDate()).padStart(2, "0");
  };

  TimelinePlanner.prototype._buildHeaderSegment = function (segment) {
    return $('<div class="tp-header-segment"></div>')
      .css("width", segment.width + "px")
      .text(segment.label);
  };

  TimelinePlanner.prototype._buildMarkerOffsets = function () {
    var counters = {};
    var offsets = {};

    $.each(this.markers, function (_, marker) {
      var key = marker.date;
      var nextIndex = counters[key] || 0;

      offsets[marker.id] = nextIndex * 4;
      counters[key] = nextIndex + 1;
    });

    return offsets;
  };

  TimelinePlanner.prototype._buildHeaderMarkerLayer = function () {
    var self = this;
    var offsets = this._buildMarkerOffsets();
    var $layer = $('<div class="tp-header-marker-layer"></div>').css("width", this.metrics.totalWidth + "px");

    $.each(this.markers, function (_, marker) {
      var markerDate = parseIsoDate(marker.date);
      var left;
      var style = marker.lineStyle || "solid";
      var width = Math.max(1, parseInt(marker.lineWidth, 10) || 2);
      var color = marker.color || "#cb4d42";

      if (!markerDate || markerDate.getTime() < self.displayRange.start.getTime() || markerDate.getTime() > self.displayRange.end.getTime()) {
        return;
      }

      left = diffDays(self.displayRange.start, markerDate) * self.metrics.dayWidth + (offsets[marker.id] || 0);

      $layer.append(
        $('<div class="tp-marker-header-line"></div>').css({
          left: left + "px",
          borderLeftColor: color,
          borderLeftStyle: style,
          borderLeftWidth: width + "px"
        })
      );
    });

    return $layer;
  };

  TimelinePlanner.prototype._renderRows = function () {
    var self = this;
    var slotsHtml = this._buildSlotsHtml();
    var $markerLayer;

    this.$rows.empty();

    $.each(this.resources, function (_, resource) {
      var $row = $('<div class="tp-grid-row tp-resource-row"></div>');
      var $resourceCell = self._buildResourceCell(resource);
      var $timelineCell = $('<div class="tp-timeline-cell"></div>');
      var $rowTrack = $('<div class="tp-row-track"></div>')
        .css({
          width: self.metrics.totalWidth + "px",
          minHeight: self.options.rowHeight + "px"
        })
        .attr("data-resource-id", resource.id)
        .data("resourceId", resource.id);

      $row.attr("data-resource-id", resource.id).data("resourceId", resource.id);

      if (self._isResourceSelected(resource.id)) {
        $row.addClass("is-selected");
      }

      $row.addClass(normalizeClassNames(self._getResourceClasses(resource)));
      $rowTrack.append(slotsHtml);

      if (self._isTodayVisible()) {
        $rowTrack.append(
          $('<div class="tp-today-line"></div>').css("left", self._getTodayLineLeft() + "px")
        );
      }

      $.each(self._getEventsForResource(resource.id), function (_, plannerEvent) {
        $rowTrack.append(self._buildEventBar(plannerEvent));
      });

      $timelineCell.append($rowTrack);
      $row.append($resourceCell, $timelineCell);
      self.$rows.append($row);
    });

    $markerLayer = this._buildBodyMarkerLayer();

    if ($markerLayer) {
      this.$rows.append($markerLayer);
    }
  };

  TimelinePlanner.prototype._buildBodyMarkerLayer = function () {
    var self = this;
    var offsets;
    var $layer;

    if (!this.resources.length || !this.markers.length) {
      return null;
    }

    offsets = this._buildMarkerOffsets();
    $layer = $('<div class="tp-marker-layer"></div>').css({
      left: this.options.resourceColumnWidth + "px",
      width: this.metrics.totalWidth + "px",
      height: (this.resources.length * this.options.rowHeight) + "px"
    });

    $.each(this.markers, function (_, marker) {
      var markerDate = parseIsoDate(marker.date);
      var left;
      var color;
      var style;
      var width;
      var $marker;

      if (!markerDate || markerDate.getTime() < self.displayRange.start.getTime() || markerDate.getTime() > self.displayRange.end.getTime()) {
        return;
      }

      left = diffDays(self.displayRange.start, markerDate) * self.metrics.dayWidth + (offsets[marker.id] || 0);
      color = marker.color || "#cb4d42";
      style = marker.lineStyle || "solid";
      width = Math.max(1, parseInt(marker.lineWidth, 10) || 2);
      $marker = $('<div class="tp-marker"></div>').css("left", left + "px");

      $marker.append(
        $('<div class="tp-marker-line"></div>').css({
          borderLeftColor: color,
          borderLeftStyle: style,
          borderLeftWidth: width + "px"
        })
      );

      $marker.append(
        $('<div class="tp-marker-label"></div>').css("color", color).text(marker.label || marker.id || marker.date)
      );

      $layer.append($marker);
    });

    return $layer;
  };

  TimelinePlanner.prototype._buildResourceCell = function (resource) {
    var actionPosition = this.options.resourceRowActionsPosition;
    var $cell = $('<div class="tp-resource-cell"></div>').css({
      width: this.options.resourceColumnWidth + "px",
      minHeight: this.options.rowHeight + "px"
    });
    var $inner = $('<div class="tp-resource-cell-inner"></div>').addClass("tp-actions-" + actionPosition);
    var $handle = $(
      '<button type="button" class="tp-resource-handle">' +
        '<span class="tp-resource-handle-icon" aria-hidden="true"></span>' +
      "</button>"
    );
    var $labelSlot = $('<div class="tp-resource-label-slot"></div>');
    var $label = $('<div class="tp-resource-label"></div>');
    var $action = $(
      '<button type="button" class="tp-add-event-btn">' +
        '<span class="tp-add-event-btn-icon" aria-hidden="true">+</span>' +
      "</button>"
    );
    var canCreate = this._isActionAllowed("event.create", { targetType: "resource", resource: resource });
    var canReorder = this._isActionAllowed("resource.reorder", { targetType: "resource", resource: resource });
    var content = this.options.renderResourceLabel
      ? this.options.renderResourceLabel(cloneData(resource))
      : resource.label;

    appendContent($label, content, !!this.options.renderResourceLabel);
    $labelSlot.append($label);
    $handle.attr("aria-label", this.locale.labels.reorderResourceAria);
    $action.attr("aria-label", this.locale.labels.addEventAria);

    if (!canCreate) {
      $action.addClass("is-disabled").prop("disabled", true);
    }

    if (!canReorder || !$.fn.sortable) {
      $handle.addClass("is-disabled").prop("disabled", true);
    }

    $inner.append($handle);

    if (actionPosition === "left") {
      $inner.append($action, $labelSlot);
    } else if (actionPosition === "rightOfLabel") {
      $inner.append($labelSlot, $action);
    } else {
      $labelSlot.append($action);
      $inner.append($labelSlot);
    }

    $cell.append($inner);
    return $cell;
  };

  TimelinePlanner.prototype._buildSlotsHtml = function () {
    var self = this;
    var html = '<div class="tp-slot-layer">';

    $.each(this.timelineDays, function (_, date) {
      var classes = ["tp-slot"];
      var customClasses = self.options.slotClassNames
        ? normalizeClassNames(self.options.slotClassNames(formatIsoDate(date), self.currentTimeScale))
        : "";

      if (date.getUTCDay() === 0 || date.getUTCDay() === 6) {
        classes.push("is-weekend");
      }

      if (date.getUTCDate() === 1) {
        classes.push("is-month-start");
      }

      if (customClasses) {
        classes.push(customClasses);
      }

      html += '<div class="' + classes.join(" ") + '" style="width:' + self.metrics.dayWidth + 'px"></div>';
    });

    html += "</div>";
    return html;
  };

  TimelinePlanner.prototype._buildEventBar = function (plannerEvent) {
    var rect = this._getEventRect(plannerEvent);
    var resource = this.resourceMap[plannerEvent.resourceId] || null;
    var isEditable = this._isActionAllowed("event.move", {
      targetType: "event",
      resource: resource,
      event: plannerEvent
    });
    var canResize = this._isActionAllowed("event.resize", {
      targetType: "event",
      resource: resource,
      event: plannerEvent
    });
    var $bar = $('<div class="tp-event-bar"></div>')
      .attr("data-event-id", plannerEvent.id)
      .attr("data-resource-id", plannerEvent.resourceId)
      .data("eventId", plannerEvent.id)
      .css({
        left: rect.left + "px",
        width: rect.width + "px"
      });
    var $body = $('<div class="tp-event-body"></div>');
    var content = this.options.renderEventContent
      ? this.options.renderEventContent(cloneData(plannerEvent))
      : plannerEvent.id;
    var classNames = normalizeClassNames(this._getEventClasses(plannerEvent));

    if (!isEditable) {
      $bar.addClass("is-readonly");
    }

    if (this._isResourceSelected(plannerEvent.resourceId)) {
      $bar.addClass("is-highlighted");
    }

    if (classNames) {
      $bar.addClass(classNames);
    }

    appendContent($body, content, !!this.options.renderEventContent);
    $bar.append($body);

    if (canResize) {
      $bar.append('<span class="tp-resize-handle tp-resize-left" data-edge="start" aria-hidden="true"></span>');
      $bar.append('<span class="tp-resize-handle tp-resize-right" data-edge="end" aria-hidden="true"></span>');
    }

    return $bar;
  };

  TimelinePlanner.prototype._getResourceClasses = function (resource) {
    return this.options.resourceClassNames
      ? this.options.resourceClassNames(cloneData(resource))
      : "";
  };

  TimelinePlanner.prototype._getEventClasses = function (plannerEvent) {
    return this.options.eventClassNames
      ? this.options.eventClassNames(cloneData(plannerEvent))
      : "";
  };

  TimelinePlanner.prototype._getEventsForResource = function (resourceId) {
    return $.grep(this.events, function (plannerEvent) {
      return plannerEvent.resourceId === resourceId;
    }).sort(function (left, right) {
      var leftStart = parseIsoDate(left.start);
      var rightStart = parseIsoDate(right.start);
      var compare = leftStart.getTime() - rightStart.getTime();

      if (compare !== 0) {
        return compare;
      }

      return String(left.id).localeCompare(String(right.id));
    });
  };

  TimelinePlanner.prototype._getEventRect = function (plannerEvent) {
    var start = parseIsoDate(plannerEvent.start);
    var end = parseIsoDate(plannerEvent.end);
    var visibleStart = this.displayRange.start;
    var visibleEnd = this.displayRange.end;
    var clampedStart = clampDate(start, visibleStart, visibleEnd);
    var clampedEnd = clampDate(end, visibleStart, visibleEnd);
    var left;
    var width;

    if (end.getTime() < visibleStart.getTime() || start.getTime() > visibleEnd.getTime()) {
      left = diffDays(visibleStart, start) * this.metrics.dayWidth;
      width = Math.max(this.metrics.dayWidth, diffDaysInclusive(start, end) * this.metrics.dayWidth);
    } else {
      left = diffDays(visibleStart, clampedStart) * this.metrics.dayWidth;
      width = Math.max(this.metrics.dayWidth, diffDaysInclusive(clampedStart, clampedEnd) * this.metrics.dayWidth);
    }

    return {
      left: left,
      width: width
    };
  };

  TimelinePlanner.prototype._isTodayVisible = function () {
    var today = this._getTodayDate();

    if (!this.options.showTodayLine) {
      return false;
    }

    return today.getTime() >= this.displayRange.start.getTime() &&
      today.getTime() <= this.displayRange.end.getTime();
  };

  TimelinePlanner.prototype._getTodayLineLeft = function () {
    return (
      diffDays(this.displayRange.start, this._getTodayDate()) * this.metrics.dayWidth +
      (this.metrics.dayWidth / 2) -
      1
    );
  };

  TimelinePlanner.prototype._pointerToDate = function ($track, clientX) {
    var rect = $track[0].getBoundingClientRect();
    var localX = clientX - rect.left;
    var dayIndex = Math.max(0, Math.min(this.timelineDays.length - 1, Math.floor(localX / this.metrics.dayWidth)));

    return addDays(this.displayRange.start, dayIndex);
  };

  TimelinePlanner.prototype._selectResource = function (resourceId, originalEvent) {
    var resource = this.resourceMap[resourceId];
    var selectedIndex = $.inArray(resourceId, this.selectedResourceIds);
    var nextSelection;

    if (!resource) {
      return;
    }

    if (this.options.multiSelectResources && (originalEvent.ctrlKey || originalEvent.metaKey)) {
      nextSelection = this.selectedResourceIds.slice();

      if (selectedIndex >= 0) {
        nextSelection.splice(selectedIndex, 1);
      } else {
        nextSelection.push(resourceId);
      }
    } else {
      nextSelection = [resourceId];
    }

    this.selectedResourceIds = nextSelection;
    this._renderRows();

    this._emit("resourceSelect", {
      targetType: "resource",
      resourceId: resourceId,
      resource: cloneData(resource),
      meta: cloneData(resource.meta),
      selectedResourceIds: nextSelection.slice(),
      clientX: originalEvent.clientX,
      clientY: originalEvent.clientY
    });
  };

  TimelinePlanner.prototype._isResourceSelected = function (resourceId) {
    return $.inArray(resourceId, this.selectedResourceIds) >= 0;
  };

  TimelinePlanner.prototype._handleContextMenu = function (event, $target) {
    var payload = null;
    var actionItems;
    var resourceId;
    var eventId;
    var resource;
    var plannerEvent;
    var clickedDate;

    event.preventDefault();
    this._hideContextMenu();

    if ($target.hasClass("tp-row-track")) {
      resourceId = $target.data("resourceId");
      resource = this.resourceMap[resourceId];
      clickedDate = this._pointerToDate($target, event.clientX);
      actionItems = this._resolveContextActionItems("empty", { resource: resource, date: clickedDate ? formatIsoDate(clickedDate) : null });
      payload = {
        targetType: "empty",
        resourceId: resource ? resource.id : null,
        resource: resource ? cloneData(resource) : null,
        date: clickedDate ? formatIsoDate(clickedDate) : null,
        meta: resource ? cloneData(resource.meta) : null,
        clientX: event.clientX,
        clientY: event.clientY,
        actions: this._getActionIds(actionItems),
        actionItems: cloneData(actionItems)
      };
    } else if ($target.hasClass("tp-resource-cell")) {
      resourceId = $target.closest(".tp-resource-row").data("resourceId");
      resource = this.resourceMap[resourceId];
      actionItems = this._resolveContextActionItems("resource", { resource: resource });
      payload = {
        targetType: "resource",
        resourceId: resource ? resource.id : null,
        resource: resource ? cloneData(resource) : null,
        meta: resource ? cloneData(resource.meta) : null,
        clientX: event.clientX,
        clientY: event.clientY,
        actions: this._getActionIds(actionItems),
        actionItems: cloneData(actionItems)
      };
    } else if ($target.hasClass("tp-event-bar")) {
      eventId = $target.data("eventId");
      plannerEvent = this.eventMap[eventId];
      resource = plannerEvent ? this.resourceMap[plannerEvent.resourceId] : null;
      actionItems = this._resolveContextActionItems("event", { event: plannerEvent, resource: resource });
      payload = {
        targetType: "event",
        eventId: plannerEvent ? plannerEvent.id : null,
        resourceId: resource ? resource.id : null,
        event: plannerEvent ? cloneData(plannerEvent) : null,
        resource: resource ? cloneData(resource) : null,
        meta: plannerEvent ? cloneData(plannerEvent.meta) : null,
        clientX: event.clientX,
        clientY: event.clientY,
        actions: this._getActionIds(actionItems),
        actionItems: cloneData(actionItems)
      };
    }

    if (!payload) {
      return;
    }

    this._emit("contextMenuRequested", payload);

    if (this.options.builtInContextMenu) {
      this._showContextMenu(payload);
    }
  };

  TimelinePlanner.prototype._getAllowedActions = function (targetType, ctx) {
    return this._getActionIds(this._resolveContextActionItems(targetType, ctx));
  };

  TimelinePlanner.prototype._getActionIds = function (actionItems) {
    return $.map(actionItems || [], function (actionItem) {
      return actionItem && actionItem.id ? actionItem.id : null;
    });
  };

  TimelinePlanner.prototype._resolveContextActionItems = function (targetType, ctx) {
    var config = this.options.contextMenu || {};
    var registry = config.actions || {};
    var targetMap = config.targets || {};
    var actionIds = $.isArray(targetMap[targetType]) ? targetMap[targetType].slice() : [];
    var baseCtx = $.extend({ targetType: targetType }, ctx || {});
    var self = this;
    var seen = {};
    var resolvedItems = [];
    var resolvedIds;

    if (typeof config.resolveActions === "function") {
      resolvedIds = config.resolveActions(targetType, cloneData(baseCtx), actionIds.slice());

      if ($.isArray(resolvedIds)) {
        actionIds = resolvedIds.slice();
      }
    }

    $.each(actionIds, function (_, actionId) {
      var normalizedId;
      var actionDefinition;
      var actionItem;

      if (actionId === null || actionId === undefined || actionId === "") {
        return;
      }

      normalizedId = String(actionId);

      if (seen[normalizedId]) {
        return;
      }

      seen[normalizedId] = true;
      actionDefinition = $.isPlainObject(registry[normalizedId]) ? registry[normalizedId] : null;

      if (!actionDefinition) {
        return;
      }

      actionItem = self._resolveContextActionItem(normalizedId, actionDefinition, baseCtx);

      if (actionItem) {
        resolvedItems.push(actionItem);
      }
    });

    return resolvedItems;
  };

  TimelinePlanner.prototype._resolveContextActionItem = function (actionId, actionDefinition, ctx) {
    var label;

    if (typeof actionDefinition.when === "function" &&
      actionDefinition.when(cloneData($.extend({}, ctx || {}, { actionId: actionId }))) === false) {
      return null;
    }

    if (!this._isContextActionAllowed(actionId, actionDefinition, ctx)) {
      return null;
    }

    label = this._resolveContextActionLabel(actionId, actionDefinition);

    return {
      id: actionId,
      label: label,
      iconClass: actionDefinition.iconClass ? String(actionDefinition.iconClass) : "",
      classNames: normalizeClassNames(actionDefinition.classNames),
      builtIn: actionDefinition.builtIn === true,
      permission: typeof actionDefinition.permission === "string" ? actionDefinition.permission : actionId
    };
  };

  TimelinePlanner.prototype._resolveContextActionLabel = function (actionId, actionDefinition) {
    var localized;

    if (actionDefinition && actionDefinition.label !== undefined && actionDefinition.label !== null) {
      return String(actionDefinition.label);
    }

    if (actionDefinition && actionDefinition.labelKey) {
      localized = getNestedValue(this.locale, actionDefinition.labelKey);

      if (localized !== undefined && localized !== null && localized !== "") {
        return String(localized);
      }
    }

    return this._getActionLabel(actionId);
  };

  TimelinePlanner.prototype._isContextActionAllowed = function (actionId, actionDefinition, ctx) {
    var permissionAction = actionId;
    var guardCtx = $.extend({}, ctx || {}, {
      targetType: ctx && ctx.targetType ? ctx.targetType : null,
      mutable: actionDefinition && actionDefinition.mutable === true,
      requestedAction: actionId
    });

    if (actionDefinition && typeof actionDefinition.permission === "string" && actionDefinition.permission) {
      permissionAction = actionDefinition.permission;
    }

    if (!this._isActionAllowed(permissionAction, guardCtx)) {
      return false;
    }

    if (actionDefinition && typeof actionDefinition.permission === "function") {
      return actionDefinition.permission(cloneData(guardCtx), actionId, cloneData(actionDefinition)) !== false;
    }

    return true;
  };

  TimelinePlanner.prototype._showContextMenu = function (payload) {
    var self = this;
    var $list = $('<ul class="tp-menu-list"></ul>');
    var actionItems = payload && payload.actionItems ? payload.actionItems : [];

    if (!actionItems.length) {
      return;
    }

    $.each(actionItems, function (_, actionItem) {
      var $item = $('<li class="tp-menu-item"></li>')
        .attr("data-action-id", actionItem.id)
        .data("actionId", actionItem.id)
        .data("actionItem", cloneData(actionItem));
      var classNames = normalizeClassNames(actionItem.classNames);

      if (classNames) {
        $item.addClass(classNames);
      }

      if (actionItem.iconClass) {
        $item.append(
          $('<span class="tp-menu-item-icon" aria-hidden="true"></span>').addClass(actionItem.iconClass)
        );
      }

      $item.append(
        $('<span class="tp-menu-item-label"></span>').text(actionItem.label || self._getActionLabel(actionItem.id))
      );

      $list.append($item);
    });

    this.$contextMenu
      .empty()
      .append($list)
      .css({
        left: payload.clientX + "px",
        top: payload.clientY + "px"
      })
      .data("payload", payload)
      .show();
  };

  TimelinePlanner.prototype._hideContextMenu = function () {
    this.$contextMenu.hide().empty().removeData("payload");
  };

  TimelinePlanner.prototype._getActionLabel = function (actionId) {
    var map = {
      "resource.edit": this.locale.menu.resourceEdit,
      "resource.delete": this.locale.menu.resourceDelete,
      "resource.action1": this.locale.menu.resourceAction1,
      "resource.action2": this.locale.menu.resourceAction2,
      "event.edit": this.locale.menu.eventEdit,
      "event.delete": this.locale.menu.eventDelete,
      "event.action1": this.locale.menu.eventAction1,
      "event.action2": this.locale.menu.eventAction2,
      "event.create": this.locale.menu.eventCreate
    };

    return map[actionId] || actionId;
  };

  TimelinePlanner.prototype._dispatchStandardAction = function (actionId, payload) {
    if (actionId === "event.edit") {
      this._emit("eventEditRequested", payload);
      return;
    }

    if (actionId === "event.delete") {
      this._emit("eventDeleteRequested", payload);
      return;
    }

    if (actionId === "resource.edit") {
      this._emit("resourceEditRequested", payload);
      return;
    }

    if (actionId === "resource.delete") {
      this._emit("resourceDeleteRequested", payload);
      return;
    }

    if (actionId === "event.create") {
      this._emit("eventCreateRequested", {
        targetType: "empty",
        resourceId: payload.resourceId,
        resource: payload.resource ? cloneData(payload.resource) : null,
        start: payload.date,
        end: payload.date,
        inputMethod: "contextMenu",
        clientX: payload.clientX,
        clientY: payload.clientY
      });
    }
  };

  TimelinePlanner.prototype._dispatchContextAction = function (actionId, payload, actionItem) {
    var builtInItem = actionItem || this._findContextActionItem(payload, actionId);

    this._emit("contextActionSelected", $.extend({}, payload, {
      actionId: actionId,
      actionItem: builtInItem
    }));

    if (builtInItem && builtInItem.builtIn === true) {
      this._dispatchStandardAction(actionId, payload);
      return;
    }

    if (actionId === "event.edit" || actionId === "event.delete" || actionId === "resource.edit" ||
      actionId === "resource.delete" || actionId === "event.create") {
      this._dispatchStandardAction(actionId, payload);
    }
  };

  TimelinePlanner.prototype._findContextActionItem = function (payload, actionId) {
    var found = null;

    $.each(payload && payload.actionItems ? payload.actionItems : [], function (_, actionItem) {
      if (actionItem && actionItem.id === actionId) {
        found = actionItem;
        return false;
      }
    });

    return found ? cloneData(found) : null;
  };

  TimelinePlanner.prototype._startRangeSelection = function (event, $track) {
    var resourceId = $track.data("resourceId");
    var resource = this.resourceMap[resourceId];
    var startDate;
    var $ghost;
    var self = this;

    if (!resource || !this._guardAction("event.create", { targetType: "empty", resource: resource })) {
      return;
    }

    startDate = this._pointerToDate($track, event.clientX);
    $ghost = $('<div class="tp-range-ghost"></div>');
    $track.append($ghost);

    this.dragState = {
      kind: "range",
      resourceId: resourceId,
      resource: resource,
      $track: $track,
      $ghost: $ghost,
      startDate: startDate,
      endDate: startDate,
      moved: false
    };

    this._updateRangeGhost(startDate, startDate);

    $(document)
      .on("mousemove" + this.eventNamespace, function (moveEvent) {
        var currentDate;

        if (!self.dragState || self.dragState.kind !== "range") {
          return;
        }

        currentDate = self._pointerToDate($track, moveEvent.clientX);
        self.dragState.endDate = currentDate;
        self.dragState.moved = self.dragState.moved || Math.abs(moveEvent.clientX - event.clientX) > 4;
        self._updateRangeGhost(self.dragState.startDate, currentDate);
      })
      .on("mouseup" + this.eventNamespace, function (upEvent) {
        self._finishRangeSelection(upEvent);
      });
  };

  TimelinePlanner.prototype._updateRangeGhost = function (dateA, dateB) {
    var start = dateA.getTime() <= dateB.getTime() ? dateA : dateB;
    var end = dateA.getTime() <= dateB.getTime() ? dateB : dateA;
    var left = diffDays(this.displayRange.start, start) * this.metrics.dayWidth;
    var width = diffDaysInclusive(start, end) * this.metrics.dayWidth;

    if (!this.dragState || !this.dragState.$ghost) {
      return;
    }

    this.dragState.$ghost.css({
      left: left + "px",
      width: width + "px"
    });
  };

  TimelinePlanner.prototype._finishRangeSelection = function (mouseEvent) {
    var drag = this.dragState;
    var start;
    var end;
    var draftEvent;
    var validation;

    $(document).off("mousemove" + this.eventNamespace).off("mouseup" + this.eventNamespace);

    if (!drag || drag.kind !== "range") {
      return;
    }

    start = drag.startDate.getTime() <= drag.endDate.getTime() ? drag.startDate : drag.endDate;
    end = drag.startDate.getTime() <= drag.endDate.getTime() ? drag.endDate : drag.startDate;

    drag.$ghost.remove();
    this.dragState = null;

    if (!drag.moved) {
      return;
    }

    draftEvent = {
      id: "__draft__",
      resourceId: drag.resourceId,
      start: formatIsoDate(start),
      end: formatIsoDate(end),
      editable: true,
      meta: {}
    };

    validation = this._validateEvent(draftEvent, {
      action: "event.create",
      targetType: "empty",
      resource: drag.resource,
      ignoreEventId: "__draft__"
    });

    if (!validation.ok) {
      this._handleValidationError(validation, {
        action: "event.create",
        resource: drag.resource,
        nextEvent: draftEvent,
        clientX: mouseEvent.clientX,
        clientY: mouseEvent.clientY
      });
      return;
    }

    this._emit("eventCreateRequested", {
      targetType: "empty",
      resourceId: drag.resourceId,
      resource: cloneData(drag.resource),
      start: draftEvent.start,
      end: draftEvent.end,
      inputMethod: "range",
      clientX: mouseEvent.clientX,
      clientY: mouseEvent.clientY
    });
  };

  TimelinePlanner.prototype._startEventInteraction = function (event, $bar, mode) {
    var eventId = $bar.data("eventId");
    var plannerEvent = this.eventMap[eventId];
    var resource = plannerEvent ? this.resourceMap[plannerEvent.resourceId] : null;
    var actionId = mode === "move" ? "event.move" : "event.resize";
    var preview;
    var self = this;

    if (!plannerEvent || !this._guardAction(actionId, { targetType: "event", event: plannerEvent, resource: resource })) {
      return;
    }

    preview = $bar.clone(false);
    preview.addClass("is-preview").removeAttr("data-event-id").removeData("eventId");
    $bar.addClass("is-hidden-origin");
    $bar.closest(".tp-row-track").append(preview);

    this.dragState = {
      kind: "event",
      mode: mode,
      startClientX: event.clientX,
      originalEvent: cloneData(plannerEvent),
      currentDraft: cloneData(plannerEvent),
      $originBar: $bar,
      $preview: preview
    };

    this._updateEventPreview(cloneData(plannerEvent), null);

    $(document)
      .on("mousemove" + this.eventNamespace, function (moveEvent) {
        self._updateEventInteraction(moveEvent);
      })
      .on("mouseup" + this.eventNamespace, function (upEvent) {
        self._finishEventInteraction(upEvent);
      });
  };

  TimelinePlanner.prototype._updateEventInteraction = function (event) {
    var drag = this.dragState;
    var deltaDays;
    var nextEvent;
    var startDate;
    var endDate;
    var targetResourceId;

    if (!drag || drag.kind !== "event") {
      return;
    }

    deltaDays = Math.round((event.clientX - drag.startClientX) / this.metrics.dayWidth);
    startDate = parseIsoDate(drag.originalEvent.start);
    endDate = parseIsoDate(drag.originalEvent.end);
    nextEvent = cloneData(drag.originalEvent);

    if (drag.mode === "move") {
      nextEvent.start = formatIsoDate(addDays(startDate, deltaDays));
      nextEvent.end = formatIsoDate(addDays(endDate, deltaDays));
      targetResourceId = this.options.allowCrossResourceEventMove
        ? (this._findResourceIdAtClientY(event.clientY) || drag.originalEvent.resourceId)
        : drag.originalEvent.resourceId;
      nextEvent.resourceId = targetResourceId;
    } else if (drag.mode === "resizeStart") {
      nextEvent.start = formatIsoDate(addDays(startDate, deltaDays));

      if (parseIsoDate(nextEvent.start).getTime() > endDate.getTime()) {
        nextEvent.start = formatIsoDate(endDate);
      }
    } else {
      nextEvent.end = formatIsoDate(addDays(endDate, deltaDays));

      if (parseIsoDate(nextEvent.end).getTime() < startDate.getTime()) {
        nextEvent.end = formatIsoDate(startDate);
      }
    }

    drag.currentDraft = nextEvent;
    this._updateEventPreview(nextEvent, drag.originalEvent.id);
  };

  TimelinePlanner.prototype._updateEventPreview = function (draftEvent, ignoreEventId) {
    var drag = this.dragState;
    var $targetTrack;
    var validation;
    var rect;

    if (!drag || drag.kind !== "event") {
      return;
    }

    $targetTrack = this.$rows.find('.tp-row-track[data-resource-id="' + draftEvent.resourceId + '"]');

    if ($targetTrack.length && drag.$preview.parent()[0] !== $targetTrack[0]) {
      drag.$preview.appendTo($targetTrack);
    }

    rect = this._getEventRect(draftEvent);
    validation = this._validateEvent(draftEvent, {
      action: drag.mode === "move" ? "event.move" : "event.resize",
      targetType: "event",
      event: drag.originalEvent,
      resource: this.resourceMap[draftEvent.resourceId] || null,
      ignoreEventId: ignoreEventId || draftEvent.id
    });

    drag.$preview
      .css({
        left: rect.left + "px",
        width: rect.width + "px"
      })
      .toggleClass("is-invalid", !validation.ok);
  };

  TimelinePlanner.prototype._inferEventChangeType = function (oldEvent, nextEvent) {
    var oldStart;
    var oldEnd;
    var nextStart;
    var nextEnd;
    var oldDuration;
    var nextDuration;

    if (!oldEvent) {
      return "update";
    }

    if (oldEvent.resourceId !== nextEvent.resourceId) {
      return "move";
    }

    oldStart = parseIsoDate(oldEvent.start);
    oldEnd = parseIsoDate(oldEvent.end);
    nextStart = parseIsoDate(nextEvent.start);
    nextEnd = parseIsoDate(nextEvent.end);

    if (!oldStart || !oldEnd || !nextStart || !nextEnd) {
      return "update";
    }

    oldDuration = diffDaysInclusive(oldStart, oldEnd);
    nextDuration = diffDaysInclusive(nextStart, nextEnd);

    if (oldDuration !== nextDuration) {
      return "resize";
    }

    if (
      oldStart.getTime() !== nextStart.getTime() ||
      oldEnd.getTime() !== nextEnd.getTime()
    ) {
      return "move";
    }

    return "update";
  };

  TimelinePlanner.prototype._runBeforeEventChangeHook = function (nextEvent, oldEvent, explicitChangeType) {
    var changeType = explicitChangeType || this._inferEventChangeType(oldEvent, nextEvent);
    var beforeResult;

    if (typeof this.options.beforeEventChange !== "function") {
      return {
        ok: true,
        changeType: changeType
      };
    }

    beforeResult = this.options.beforeEventChange(cloneData(nextEvent), {
      changeType: changeType,
      oldEvent: oldEvent ? cloneData(oldEvent) : null,
      resource: cloneData(this.resourceMap[nextEvent.resourceId] || null)
    });

    if (beforeResult === false) {
      return {
        ok: false,
        code: "READ_ONLY",
        message: this.locale.messages.beforeEventChangeRejected,
        changeType: changeType
      };
    }

    if ($.isPlainObject(beforeResult) && beforeResult.ok === false) {
      return $.extend({}, beforeResult, {
        changeType: changeType
      });
    }

    return {
      ok: true,
      changeType: changeType
    };
  };

  TimelinePlanner.prototype._finishEventInteraction = function (mouseEvent) {
    var drag = this.dragState;
    var validation;
    var beforeHookResult;
    var payload;
    var changeType;

    $(document).off("mousemove" + this.eventNamespace).off("mouseup" + this.eventNamespace);

    if (!drag || drag.kind !== "event") {
      return;
    }

    validation = this._validateEvent(drag.currentDraft, {
      action: drag.mode === "move" ? "event.move" : "event.resize",
      targetType: "event",
      event: drag.originalEvent,
      resource: this.resourceMap[drag.currentDraft.resourceId] || null,
      ignoreEventId: drag.originalEvent.id
    });

    if (validation.ok) {
      beforeHookResult = this._runBeforeEventChangeHook(
        drag.currentDraft,
        drag.originalEvent,
        drag.mode === "move" ? "move" : "resize"
      );

      if (!beforeHookResult.ok) {
        validation = beforeHookResult;
      } else {
        changeType = beforeHookResult.changeType;
      }
    }

    if (!validation.ok) {
      this._handleValidationError(validation, {
        action: drag.mode === "move" ? "event.move" : "event.resize",
        event: drag.originalEvent,
        nextEvent: drag.currentDraft,
        resource: this.resourceMap[drag.currentDraft.resourceId] || null,
        clientX: mouseEvent.clientX,
        clientY: mouseEvent.clientY
      });
      this._cleanupEventDrag();
      return;
    }

    changeType = changeType || (drag.mode === "move" ? "move" : "resize");

    if (!this.options.controlledEvents) {
      this._replaceEventInternal(drag.currentDraft);
      this._render();
    }

    payload = {
      targetType: "event",
      changeType: changeType,
      eventId: drag.originalEvent.id,
      resourceId: drag.currentDraft.resourceId,
      oldEvent: cloneData(drag.originalEvent),
      nextEvent: cloneData(drag.currentDraft),
      event: cloneData(drag.currentDraft),
      resource: cloneData(this.resourceMap[drag.currentDraft.resourceId] || null),
      clientX: mouseEvent.clientX,
      clientY: mouseEvent.clientY
    };

    this._emit("eventChangeRequested", payload);
    this._cleanupEventDrag();
  };

  TimelinePlanner.prototype._cleanupEventDrag = function () {
    if (!this.dragState || this.dragState.kind !== "event") {
      this.dragState = null;
      return;
    }

    if (this.dragState.$preview) {
      this.dragState.$preview.remove();
    }

    if (this.dragState.$originBar) {
      this.dragState.$originBar.removeClass("is-hidden-origin");
    }

    this.dragState = null;
  };

  TimelinePlanner.prototype._findResourceIdAtClientY = function (clientY) {
    var found = null;

    this.$rows.children(".tp-resource-row").each(function () {
      var rect = this.getBoundingClientRect();

      if (clientY >= rect.top && clientY <= rect.bottom) {
        found = $(this).data("resourceId");
        return false;
      }
    });

    return found;
  };

  TimelinePlanner.prototype._getSuggestedStartForNewEvent = function () {
    return this._getVisibleRange().start;
  };

  TimelinePlanner.prototype._getVisibleRange = function () {
    var scrollLeft;
    var viewportWidth;
    var startIndex;
    var endIndex;

    if (this.currentViewMode !== "sliding") {
      return {
        start: this.displayRange.start,
        end: this.displayRange.end
      };
    }

    scrollLeft = this.$scroll.scrollLeft();
    viewportWidth = Math.max(1, this.metrics.availableTimelineWidth);
    startIndex = Math.max(0, Math.floor(scrollLeft / this.metrics.dayWidth));
    endIndex = Math.min(
      this.timelineDays.length - 1,
      Math.floor((scrollLeft + viewportWidth - 1) / this.metrics.dayWidth)
    );

    return {
      start: addDays(this.displayRange.start, startIndex),
      end: addDays(this.displayRange.start, endIndex)
    };
  };

  TimelinePlanner.prototype._emitViewChanged = function () {
    var visible = this._getVisibleRange();

    this._emit("viewChanged", {
      timeScale: this.currentTimeScale,
      viewMode: this.currentViewMode,
      visibleStart: formatIsoDate(visible.start),
      visibleEnd: formatIsoDate(visible.end),
      displayStart: formatIsoDate(this.displayRange.start),
      displayEnd: formatIsoDate(this.displayRange.end),
      scrollLeft: this.$scroll.scrollLeft(),
      scrollTop: this.$scroll.scrollTop()
    });
  };

  TimelinePlanner.prototype._emit = function (eventName, payload) {
    this.$host.trigger(eventName, [payload]);
  };

  TimelinePlanner.prototype._isActionAllowed = function (actionId, ctx) {
    var mutable = ctx && ctx.mutable === true ? true : isMutableAction(actionId);
    var resource = ctx && ctx.resource ? ctx.resource : null;
    var plannerEvent = ctx && ctx.event ? ctx.event : null;
    var allowed = true;

    if (actionId === "resource.reorder" && this.options.allowResourceReorder === false) {
      return false;
    }

    if (mutable && this.options.editable === false) {
      return false;
    }

    if (mutable && resource && resource.editable === false) {
      return false;
    }

    if (mutable && plannerEvent && plannerEvent.editable === false) {
      return false;
    }

    if (typeof this.options.can === "function") {
      allowed = this.options.can(actionId, $.extend({}, ctx || {}, {
        action: actionId,
        targetType: ctx && ctx.targetType ? ctx.targetType : null
      }));
    }

    return allowed !== false;
  };

  TimelinePlanner.prototype._guardAction = function (actionId, ctx) {
    if (this._isActionAllowed(actionId, ctx || {})) {
      return true;
    }

    this._handleValidationError(
      {
        ok: false,
        code: "READ_ONLY",
        message: this.locale.messages.actionNotAllowed
      },
      $.extend({}, ctx || {}, { action: actionId })
    );

    return false;
  };

  TimelinePlanner.prototype._validateEvent = function (nextEvent, context) {
    var baseValidation = {
      ok: true
    };
    var builtInResult;
    var customResult;

    context = context || {};

    if (this.options.customValidateMode !== "replace") {
      builtInResult = this._runBuiltInValidation(nextEvent, context);

      if (!builtInResult.ok) {
        return builtInResult;
      }

      baseValidation = builtInResult;
    }

    if (typeof this.options.customValidateEvent === "function") {
      customResult = this.options.customValidateEvent(cloneData(nextEvent), cloneData(context));

      if ($.isPlainObject(customResult) && customResult.ok === false) {
        return customResult;
      }
    }

    return baseValidation;
  };

  TimelinePlanner.prototype._runBuiltInValidation = function (nextEvent, context) {
    var start = parseIsoDate(nextEvent.start);
    var end = parseIsoDate(nextEvent.end);
    var resource = this.resourceMap[nextEvent.resourceId] || context.resource || null;
    var siblings;
    var index;

    if (!start || !end || end.getTime() < start.getTime()) {
      return {
        ok: false,
        code: "INVALID_DATE",
        message: this.locale.messages.invalidDates
      };
    }

    if (!resource) {
      return {
        ok: false,
        code: "INVALID_DATE",
        message: this.locale.messages.targetResourceMissing
      };
    }

    if (!this._isActionAllowed(context.action || "event.edit", {
      targetType: context.targetType || "event",
      resource: resource,
      event: context.event || nextEvent
    })) {
      return {
        ok: false,
        code: "READ_ONLY",
        message: this.locale.messages.editingForbidden
      };
    }

    siblings = this._getEventsForResource(nextEvent.resourceId);

    for (index = 0; index < siblings.length; index += 1) {
      if (context.ignoreEventId && siblings[index].id === context.ignoreEventId) {
        continue;
      }

      if (
        datesOverlap(
          start,
          end,
          parseIsoDate(siblings[index].start),
          parseIsoDate(siblings[index].end)
        )
      ) {
        return {
          ok: false,
          code: "OVERLAP",
          message: this.locale.messages.overlapForbidden
        };
      }
    }

    return {
      ok: true
    };
  };

  TimelinePlanner.prototype._handleValidationError = function (validation, context) {
    var shouldShowToast = !(context && context.silent === true);
    var payload = {
      code: validation.code || "UNKNOWN",
      message: validation.message || this.locale.messages.validationError,
      context: cloneData(context || {}),
      resource: context && context.resource ? cloneData(context.resource) : null,
      event: context && context.event ? cloneData(context.event) : null,
      nextEvent: context && context.nextEvent ? cloneData(context.nextEvent) : null,
      clientX: context && context.clientX !== undefined ? context.clientX : null,
      clientY: context && context.clientY !== undefined ? context.clientY : null
    };

    if (shouldShowToast) {
      this._showToast(payload.message, "error");
    }

    this._emit("validationError", payload);
  };

  TimelinePlanner.prototype._showToast = function (message, tone) {
    var $toast = $('<div class="tp-toast"></div>').addClass("is-" + (tone || "info")).text(message);

    this.$toastLayer.append($toast);

    window.setTimeout(function () {
      $toast.addClass("is-leaving");
      window.setTimeout(function () {
        $toast.remove();
      }, 180);
    }, 2400);
  };

  TimelinePlanner.prototype._initSortable = function () {
    var self = this;

    if (this.$rows.data("ui-sortable")) {
      this.$rows.sortable("destroy");
    }

    if (!$.fn.sortable || !this._isActionAllowed("resource.reorder", { targetType: "resource" })) {
      return;
    }

    this.$rows.sortable({
      axis: "y",
      items: "> .tp-resource-row",
      handle: ".tp-resource-handle:not(.is-disabled)",
      cancel: ".tp-add-event-btn, .tp-resource-handle.is-disabled",
      placeholder: "tp-resource-placeholder",
      tolerance: "pointer",
      helper: "clone",
      start: function () {
        self._hideContextMenu();
      },
      update: function () {
        var oldOrder = $.map(self.resources, function (resource) {
          return resource.id;
        });
        var newOrder = self.$rows
          .children(".tp-resource-row")
          .map(function () {
            return $(this).data("resourceId");
          })
          .get();

        if (!self.options.controlledResources) {
          self._applyResourceOrder(newOrder);
        } else {
          self._renderRows();
        }

        self._emit("resourceOrderChangeRequested", {
          orderedResourceIds: newOrder.slice(),
          oldOrder: oldOrder.slice(),
          newOrder: newOrder.slice()
        });
      }
    });
  };

  TimelinePlanner.prototype._getScrollExtendRequest = function () {
    var visible = this._getVisibleRange();
    var threshold = this.options.slidingEdgeThresholdDays;
    var extendLeft = diffDays(this.displayRange.start, visible.start) <= threshold;
    var extendRight = diffDays(visible.end, this.displayRange.end) <= threshold;

    if (this.currentViewMode !== "sliding" || (!extendLeft && !extendRight)) {
      return null;
    }

    return {
      extendLeft: extendLeft,
      extendRight: extendRight,
      preserveDate: visible.start,
      source: "scroll"
    };
  };

  TimelinePlanner.prototype._getPointerExtendRequest = function (clientX) {
    var edgeRequest;
    var rect;
    var timelineLeft;
    var visibleRight;
    var rightTriggerStart;
    var zone;

    if (this.currentViewMode !== "sliding" || clientX === null || clientX === undefined) {
      return null;
    }

    edgeRequest = this._getScrollExtendRequest();

    if (!edgeRequest || !this.$scroll || !this.$scroll.length) {
      return null;
    }

    rect = this.$scroll[0].getBoundingClientRect();
    timelineLeft = rect.left + this.options.resourceColumnWidth;
    visibleRight = Math.min(
      rect.right,
      timelineLeft + Math.min(this.metrics.totalWidth, this.metrics.availableTimelineWidth)
    );
    rightTriggerStart = Math.max(
      timelineLeft,
      visibleRight - this.options.slidingPointerEdgeZonePx
    );
    zone = this.options.slidingPointerEdgeZonePx;

    if (clientX < timelineLeft || clientX > rect.right) {
      return null;
    }

    if (clientX <= Math.min(rect.right, timelineLeft + zone)) {
      if (!edgeRequest.extendLeft) {
        return null;
      }

      return {
        extendLeft: true,
        extendRight: false,
        preserveDate: edgeRequest.preserveDate,
        source: "pointer"
      };
    }

    if (clientX >= rightTriggerStart) {
      if (!edgeRequest.extendRight) {
        return null;
      }

      return {
        extendLeft: false,
        extendRight: true,
        preserveDate: edgeRequest.preserveDate,
        source: "pointer"
      };
    }

    return null;
  };

  TimelinePlanner.prototype._syncSlidingExtendRequest = function (request) {
    var self = this;

    if (this.slidingExtendTimer && (!request || this.currentViewMode !== "sliding")) {
      window.clearTimeout(this.slidingExtendTimer);
      this.slidingExtendTimer = null;
      this.pendingSlidingExtend = null;
      return;
    }

    if (!request || this.currentViewMode !== "sliding") {
      this.pendingSlidingExtend = null;
      return;
    }

    this.pendingSlidingExtend = request;

    if (this.slidingExtendTimer) {
      return;
    }

    this.slidingExtendTimer = window.setTimeout(function () {
      var nextRequest = self.pendingSlidingExtend;

      self.slidingExtendTimer = null;
      self.pendingSlidingExtend = null;

      if (!nextRequest || self.currentViewMode !== "sliding") {
        return;
      }

      self._applySlidingRangeExtension(nextRequest);

      if (nextRequest.source === "pointer" && self.lastPointerClientX !== null) {
        self._syncSlidingExtendRequest(self._getPointerExtendRequest(self.lastPointerClientX));
      }
    }, this.options.slidingExtendDelayMs);
  };

  TimelinePlanner.prototype._maybeExtendSlidingRange = function () {
    this._syncSlidingExtendRequest(this._getScrollExtendRequest());
  };

  TimelinePlanner.prototype._applySlidingRangeExtension = function (request) {
    var extraBefore = 0;
    var extraAfter = 0;
    var newStart = this.displayRange.start;
    var newEnd = this.displayRange.end;
    var oldStart = this.displayRange.start;
    var preserveDate;

    if (!request || (!request.extendLeft && !request.extendRight)) {
      return;
    }

    preserveDate = request.preserveDate || this._getVisibleRange().start;

    if (request.extendLeft) {
      if (this.currentTimeScale === "month") {
        newStart = addMonths(this.displayRange.start, -1);
      } else {
        extraBefore = this.currentTimeScale === "week" ? this.options.slidingExtendBy.week : this.options.slidingExtendBy.day;
        newStart = addDays(this.displayRange.start, -extraBefore);
      }
    }

    if (request.extendRight) {
      if (this.currentTimeScale === "month") {
        newEnd = endOfMonth(addMonths(this.displayRange.end, 1));
      } else {
        extraAfter = this.currentTimeScale === "week" ? this.options.slidingExtendBy.week : this.options.slidingExtendBy.day;
        newEnd = addDays(this.displayRange.end, extraAfter);
      }
    }

    this.displayRange = {
      start: newStart,
      end: newEnd
    };
    this.timelineDays = this._buildTimelineDays();
    this._resolveMetrics();
    this._renderHeader();
    this._renderRows();
    this._initSortable();

    if (oldStart.getTime() !== newStart.getTime()) {
      this.scrollToDate(formatIsoDate(preserveDate), "start", true);
    }
  };

  TimelinePlanner.prototype._extendSlidingRangeToInclude = function (date) {
    var nextStart = this.displayRange.start;
    var nextEnd = this.displayRange.end;

    this._syncSlidingExtendRequest(null);

    if (date.getTime() < nextStart.getTime()) {
      nextStart = date;
    }

    if (date.getTime() > nextEnd.getTime()) {
      nextEnd = date;
    }

    this.displayRange = this._ensureMinimumSpan({
      start: nextStart,
      end: nextEnd
    });
    this.timelineDays = this._buildTimelineDays();
    this._resolveMetrics();
    this._renderHeader();
    this._renderRows();
    this._initSortable();
  };

  TimelinePlanner.prototype._applyResourceOrder = function (orderedIds) {
    var orderLookup = {};
    var nextResources;
    var index;

    for (index = 0; index < orderedIds.length; index += 1) {
      orderLookup[orderedIds[index]] = index + 1;
    }

    nextResources = this.resources.slice().sort(function (left, right) {
      return orderLookup[left.id] - orderLookup[right.id];
    });

    $.each(nextResources, function (idx, resource) {
      resource.order = idx + 1;
    });

    this.resources = nextResources;
    this._rebuildMaps();
    this._syncOptionData();
    this._renderRows();
  };

  TimelinePlanner.prototype._syncOptionData = function () {
    this.options.resources = $.map(this.resources, function (resource) {
      return cloneData(resource);
    });
    this.options.events = $.map(this.events, function (plannerEvent) {
      return cloneData(plannerEvent);
    });
    this.options.markers = $.map(this.markers, function (marker) {
      return cloneData(marker);
    });
  };

  TimelinePlanner.prototype._rebuildMaps = function () {
    var self = this;

    this.resourceMap = {};
    this.eventMap = {};
    this.markerMap = {};

    $.each(this.resources, function (_, resource) {
      self.resourceMap[resource.id] = resource;
    });

    $.each(this.events, function (_, plannerEvent) {
      self.eventMap[plannerEvent.id] = plannerEvent;
    });

    $.each(this.markers, function (_, marker) {
      self.markerMap[marker.id] = marker;
    });
  };

  TimelinePlanner.prototype._setResourcesInternal = function (resources) {
    var normalized = [];

    $.each(resources || [], function (index, item) {
      var resource = cloneData(item || {});

      if (!resource.id) {
        return;
      }

      resource.label = resource.label || resource.id;
      resource.order = resource.order !== undefined ? resource.order : index + 1;
      normalized.push(resource);
    });

    normalized.sort(function (left, right) {
      if (left.order !== right.order) {
        return left.order - right.order;
      }

      return String(left.label).localeCompare(String(right.label));
    });

    this.resources = normalized;
    this.selectedResourceIds = $.grep(this.selectedResourceIds, function (resourceId) {
      return $.grep(normalized, function (resource) {
        return resource.id === resourceId;
      }).length > 0;
    });
    this._rebuildMaps();
    this._syncOptionData();
  };

  TimelinePlanner.prototype._replaceEventInternal = function (nextEvent) {
    var updated = false;

    this.events = $.map(this.events, function (plannerEvent) {
      if (plannerEvent.id === nextEvent.id) {
        updated = true;
        return cloneData(nextEvent);
      }

      return plannerEvent;
    });

    if (!updated) {
      this.events.push(cloneData(nextEvent));
    }

    this._rebuildMaps();
    this._syncOptionData();
  };

  TimelinePlanner.prototype._setEventsInternal = function (events) {
    var accepted = [];
    var self = this;

    $.each(events || [], function (_, item) {
      var plannerEvent = cloneData(item || {});
      var validation;
      var previousEvents;

      if (!plannerEvent.id || !plannerEvent.resourceId) {
        return;
      }

      previousEvents = self.events;
      self.events = accepted;
      validation = self._validateEvent(plannerEvent, {
        action: "event.load",
        targetType: "event",
        resource: self.resourceMap[plannerEvent.resourceId] || null,
        ignoreEventId: plannerEvent.id
      });
      self.events = previousEvents;

      if (!validation.ok) {
        self._handleValidationError(validation, {
          action: "event.load",
          silent: true,
          event: plannerEvent,
          nextEvent: plannerEvent,
          resource: self.resourceMap[plannerEvent.resourceId] || null
        });
        return;
      }

      accepted.push(plannerEvent);
    });

    this.events = accepted;
    this._rebuildMaps();
    this._syncOptionData();
  };

  TimelinePlanner.prototype._setMarkersInternal = function (markers) {
    var accepted = [];

    $.each(markers || [], function (_, item) {
      var marker = cloneData(item || {});

      if (!marker.id || !parseIsoDate(marker.date)) {
        return;
      }

      marker.label = marker.label || marker.id;
      marker.lineStyle = marker.lineStyle || "solid";
      marker.lineWidth = Math.max(1, parseInt(marker.lineWidth, 10) || 2);
      accepted.push(marker);
    });

    accepted.sort(function (left, right) {
      var leftDate = parseIsoDate(left.date);
      var rightDate = parseIsoDate(right.date);
      var compare = leftDate.getTime() - rightDate.getTime();

      if (compare !== 0) {
        return compare;
      }

      return String(left.id).localeCompare(String(right.id));
    });

    this.markers = accepted;
    this._rebuildMaps();
    this._syncOptionData();
  };

  TimelinePlanner.prototype.updateOptions = function (partialOptions) {
    var patch = partialOptions || {};
    var merged;

    if (
      !Object.prototype.hasOwnProperty.call(patch, "timeScale") &&
      Object.prototype.hasOwnProperty.call(patch, "scaleMode")
    ) {
      patch = $.extend({}, patch, {
        timeScale: patch.scaleMode
      });
    }

    merged = mergeOptions(this.options, patch);

    if (Object.prototype.hasOwnProperty.call(patch, "timeScale")) {
      this.autoTimeScale = false;
    }

    this.options = this._sanitizeOptions(merged);
    this._refreshLocale();

    if (Object.prototype.hasOwnProperty.call(patch, "resources")) {
      this._setResourcesInternal(patch.resources || []);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "events")) {
      this._setEventsInternal(patch.events || []);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "markers")) {
      this._setMarkersInternal(patch.markers || []);
    }

    if (Object.prototype.hasOwnProperty.call(patch, "customView")) {
      this.options.customView = this._normalizeCustomView(patch.customView);
    }

    this._render();
    return this;
  };

  TimelinePlanner.prototype.setRange = function (range) {
    return this.setCustomView(range);
  };

  TimelinePlanner.prototype.setCustomView = function (view) {
    this.options.customView = this._normalizeCustomView(view || {});

    if (this.options.viewMode === "custom") {
      this._render();
    } else {
      this._renderToolbar();
    }

    return this;
  };

  TimelinePlanner.prototype.setView = function (view) {
    return this.setCustomView(view);
  };

  TimelinePlanner.prototype.setTimeScale = function (timeScale, initiatedByUser) {
    if (["day", "week", "month"].indexOf(timeScale) === -1) {
      return this;
    }

    this.options.timeScale = timeScale;

    if (initiatedByUser !== false) {
      this.autoTimeScale = false;
    }

    this._render();
    return this;
  };

  TimelinePlanner.prototype.setScaleMode = function (scaleMode) {
    return this.setTimeScale(scaleMode, true);
  };

  TimelinePlanner.prototype.setViewMode = function (viewMode) {
    if (["sliding", "global", "custom"].indexOf(viewMode) === -1) {
      return this;
    }

    this.options.viewMode = viewMode;

    if ((viewMode === "global" || viewMode === "custom") && this.autoTimeScale) {
      this.options.timeScale = this._getRecommendedScaleForViewMode(viewMode);
    }

    this._render();
    return this;
  };

  TimelinePlanner.prototype.setColumnSizePreset = function (preset) {
    if (["small", "medium", "large"].indexOf(preset) === -1) {
      return this;
    }

    this.options.columnSizePreset = preset;
    this._render();
    return this;
  };

  TimelinePlanner.prototype.setResources = function (resources) {
    this._setResourcesInternal(resources || []);
    this._render();
    return this;
  };

  TimelinePlanner.prototype.setEvents = function (events) {
    this._setEventsInternal(events || []);
    this._render();
    return this;
  };

  TimelinePlanner.prototype.setMarkers = function (markers) {
    this._setMarkersInternal(markers || []);
    this._render();
    return this;
  };

  TimelinePlanner.prototype.addResource = function (resource) {
    var nextResources = this.resources.slice();

    if (!resource || !resource.id) {
      return false;
    }

    nextResources.push(cloneData(resource));
    this._setResourcesInternal(nextResources);
    this._render();
    return true;
  };

  TimelinePlanner.prototype.updateResource = function (resource) {
    if (!resource || !resource.id) {
      return false;
    }

    var updated = false;
    var nextResources = $.map(this.resources, function (current) {
      if (current.id === resource.id) {
        updated = true;
        return $.extend(true, {}, current, cloneData(resource));
      }

      return cloneData(current);
    });

    if (!updated) {
      nextResources.push(cloneData(resource));
    }

    this._setResourcesInternal(nextResources);
    this._render();
    return true;
  };

  TimelinePlanner.prototype.removeResource = function (resourceId) {
    var removed = false;
    var nextResources = [];
    var nextEvents = [];

    $.each(this.resources, function (_, resource) {
      if (resource.id === resourceId) {
        removed = true;
        return;
      }

      nextResources.push(cloneData(resource));
    });

    $.each(this.events, function (_, plannerEvent) {
      if (plannerEvent.resourceId !== resourceId) {
        nextEvents.push(cloneData(plannerEvent));
      }
    });

    if (!removed) {
      return false;
    }

    this._setResourcesInternal(nextResources);
    this._setEventsInternal(nextEvents);
    this._render();
    return true;
  };

  TimelinePlanner.prototype.addEvent = function (plannerEvent) {
    if (!plannerEvent || !plannerEvent.id || !plannerEvent.resourceId) {
      return false;
    }

    var validation = this._validateEvent(plannerEvent, {
      action: "event.create",
      targetType: "event",
      resource: this.resourceMap[plannerEvent.resourceId] || null,
      ignoreEventId: plannerEvent.id
    });

    if (!validation.ok) {
      this._handleValidationError(validation, {
        action: "event.create",
        nextEvent: plannerEvent,
        resource: this.resourceMap[plannerEvent.resourceId] || null
      });
      return false;
    }

    this.events.push(cloneData(plannerEvent));
    this._rebuildMaps();
    this._syncOptionData();
    this._render();
    return true;
  };

  TimelinePlanner.prototype.updateEvent = function (plannerEvent) {
    if (!plannerEvent || !plannerEvent.id || !plannerEvent.resourceId) {
      return false;
    }

    var currentEvent = this.eventMap[plannerEvent.id] || null;
    var validation = this._validateEvent(plannerEvent, {
      action: "event.edit",
      targetType: "event",
      resource: this.resourceMap[plannerEvent.resourceId] || null,
      event: currentEvent,
      ignoreEventId: plannerEvent.id
    });
    var beforeHookResult;

    if (!validation.ok) {
      this._handleValidationError(validation, {
        action: "event.edit",
        event: currentEvent,
        nextEvent: plannerEvent,
        resource: this.resourceMap[plannerEvent.resourceId] || null
      });
      return false;
    }

    beforeHookResult = this._runBeforeEventChangeHook(
      plannerEvent,
      currentEvent,
      currentEvent ? null : "update"
    );

    if (!beforeHookResult.ok) {
      this._handleValidationError(beforeHookResult, {
        action: "event.edit",
        event: currentEvent,
        nextEvent: plannerEvent,
        resource: this.resourceMap[plannerEvent.resourceId] || null
      });
      return false;
    }

    this._replaceEventInternal(plannerEvent);
    this._render();
    return true;
  };

  TimelinePlanner.prototype.removeEvent = function (eventId) {
    var removed = false;

    this.events = $.grep(this.events, function (plannerEvent) {
      if (plannerEvent.id === eventId) {
        removed = true;
        return false;
      }

      return true;
    });

    if (!removed) {
      return false;
    }

    this._rebuildMaps();
    this._syncOptionData();
    this._render();
    return true;
  };

  TimelinePlanner.prototype.addMarker = function (marker) {
    var nextMarkers = this.markers.slice();

    if (!marker || !marker.id || !parseIsoDate(marker.date)) {
      return false;
    }

    nextMarkers.push(cloneData(marker));
    this._setMarkersInternal(nextMarkers);
    this._render();
    return true;
  };

  TimelinePlanner.prototype.updateMarker = function (marker) {
    if (!marker || !marker.id || !parseIsoDate(marker.date)) {
      return false;
    }

    var updated = false;
    var nextMarkers = $.map(this.markers, function (current) {
      if (current.id === marker.id) {
        updated = true;
        return $.extend(true, {}, current, cloneData(marker));
      }

      return cloneData(current);
    });

    if (!updated) {
      nextMarkers.push(cloneData(marker));
    }

    this._setMarkersInternal(nextMarkers);
    this._render();
    return true;
  };

  TimelinePlanner.prototype.removeMarker = function (markerId) {
    var removed = false;

    this.markers = $.grep(this.markers, function (marker) {
      if (marker.id === markerId) {
        removed = true;
        return false;
      }

      return true;
    });

    if (!removed) {
      return false;
    }

    this._rebuildMaps();
    this._syncOptionData();
    this._render();
    return true;
  };

  TimelinePlanner.prototype.scrollToDate = function (dateIso, align, silent) {
    var date = parseIsoDate(dateIso);
    var viewportWidth = this.metrics.availableTimelineWidth;
    var dateIndex;
    var left;

    if (!date || this.currentViewMode !== "sliding") {
      return this;
    }

    if (date.getTime() < this.displayRange.start.getTime() || date.getTime() > this.displayRange.end.getTime()) {
      this._extendSlidingRangeToInclude(date);
    }

    dateIndex = diffDays(this.displayRange.start, date);
    left = dateIndex * this.metrics.dayWidth;

    if (align === "center") {
      left = left - Math.floor((viewportWidth - this.metrics.dayWidth) / 2);
    } else if (align === "end") {
      left = left - viewportWidth + this.metrics.dayWidth;
    }

    left = Math.max(0, Math.min(left, Math.max(0, this.metrics.totalWidth - viewportWidth)));
    this.$scroll.scrollLeft(left);

    if (!silent) {
      this._emitViewChanged();
    }

    return this;
  };

  TimelinePlanner.prototype.scrollToResource = function (resourceId) {
    var $row = this.$rows.find('.tp-resource-row[data-resource-id="' + resourceId + '"]');
    var targetTop;

    if (!$row.length) {
      return this;
    }

    targetTop = Math.max(0, $row[0].offsetTop - this.$header.outerHeight());
    this.$scroll.scrollTop(targetTop);
    this._emitViewChanged();
    return this;
  };

  TimelinePlanner.prototype.getState = function () {
    var visible = this._getVisibleRange();

    return {
      selectedResourceIds: this.selectedResourceIds.slice(),
      selectedResourceId: this.selectedResourceIds.length ? this.selectedResourceIds[0] : null,
      language: this.options.language,
      visibleStart: formatIsoDate(visible.start),
      visibleEnd: formatIsoDate(visible.end),
      displayStart: formatIsoDate(this.displayRange.start),
      displayEnd: formatIsoDate(this.displayRange.end),
      timeScale: this.currentTimeScale,
      viewMode: this.currentViewMode,
      columnSizePreset: this.options.columnSizePreset,
      allowResourceReorder: this.options.allowResourceReorder,
      allowCrossResourceEventMove: this.options.allowCrossResourceEventMove,
      customView: cloneData(this.options.customView),
      resources: $.map(this.resources, function (resource) {
        return cloneData(resource);
      }),
      events: $.map(this.events, function (plannerEvent) {
        return cloneData(plannerEvent);
      }),
      markers: $.map(this.markers, function (marker) {
        return cloneData(marker);
      })
    };
  };

  TimelinePlanner.prototype.destroy = function () {
    if (this.destroyed) {
      return;
    }

    if (this.$rows && this.$rows.data("ui-sortable")) {
      this.$rows.sortable("destroy");
    }

    $(window).off(this.eventNamespace);
    $(document).off(this.eventNamespace);

    if (this.viewChangedTimer) {
      window.clearTimeout(this.viewChangedTimer);
      this.viewChangedTimer = null;
    }

    if (this.slidingExtendTimer) {
      window.clearTimeout(this.slidingExtendTimer);
      this.slidingExtendTimer = null;
    }

    this.pendingSlidingExtend = null;
    this.lastPointerClientX = null;

    this.$host.removeData("timelinePlanner").removeClass("tp-host").empty();
    this.destroyed = true;
  };

  window.TimelinePlanner = TimelinePlanner;
})(window, window.jQuery);
