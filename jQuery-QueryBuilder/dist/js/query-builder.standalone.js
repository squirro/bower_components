/*!
 * jQuery QueryBuilder 2.5.0
 * Copyright 2014-2017 Damien "Mistic" Sorel (http://www.strangeplanet.fr)
 * Licensed under MIT (http://opensource.org/licenses/MIT)
 */
/**
 * @typedef {object} Filter
 * @memberof QueryBuilder
 * @description See {@link http://querybuilder.js.org/index.html#filters}
 */

/**
 * @typedef {object} Operator
 * @memberof QueryBuilder
 * @description See {@link http://querybuilder.js.org/index.html#operators}
 */

/**
 * @param {jQuery} $el
 * @param {object} options - see {@link http://querybuilder.js.org/#options}
 * @constructor
 */
var QueryBuilder = function($el, options) {
    $el[0].queryBuilder = this;

    /**
     * Element container
     * @member {jQuery}
     * @readonly
     */
    this.$el = $el;

    /**
     * Configuration object
     * @member {object}
     * @readonly
     */
    this.settings = $.extendext(true, 'replace', {}, QueryBuilder.DEFAULTS, options);

    /**
     * Internal model
     * @member {Model}
     * @readonly
     */
    this.model = new Model();

    /**
     * Internal status
     * @member {object}
     * @property {string} id - id of the container
     * @property {boolean} generated_id - if the container id has been generated
     * @property {int} group_id - current group id
     * @property {int} rule_id - current rule id
     * @property {boolean} has_optgroup - if filters have optgroups
     * @property {boolean} has_operator_optgroup - if operators have optgroups
     * @readonly
     * @private
     */
    this.status = {
        id: null,
        generated_id: false,
        group_id: 0,
        rule_id: 0,
        has_optgroup: false,
        has_operator_optgroup: false
    };

    /**
     * List of filters
     * @member {QueryBuilder.Filter[]}
     * @readonly
     */
    this.filters = this.settings.filters;

    /**
     * List of icons
     * @member {object.<string, string>}
     * @readonly
     */
    this.icons = this.settings.icons;

    /**
     * List of operators
     * @member {QueryBuilder.Operator[]}
     * @readonly
     */
    this.operators = this.settings.operators;

    /**
     * List of templates
     * @member {object.<string, function>}
     * @readonly
     */
    this.templates = this.settings.templates;

    /**
     * Plugins configuration
     * @member {object.<string, object>}
     * @readonly
     */
    this.plugins = this.settings.plugins;

    /**
     * Translations object
     * @member {object}
     * @readonly
     */
    this.lang = null;

    // translations : english << 'lang_code' << custom
    if (QueryBuilder.regional['en'] === undefined) {
        Utils.error('Config', '"i18n/en.js" not loaded.');
    }
    this.lang = $.extendext(true, 'replace', {}, QueryBuilder.regional['en'], QueryBuilder.regional[this.settings.lang_code], this.settings.lang);

    // "allow_groups" can be boolean or int
    if (this.settings.allow_groups === false) {
        this.settings.allow_groups = 0;
    }
    else if (this.settings.allow_groups === true) {
        this.settings.allow_groups = -1;
    }

    // init templates
    Object.keys(this.templates).forEach(function(tpl) {
        if (!this.templates[tpl]) {
            this.templates[tpl] = QueryBuilder.templates[tpl];
        }
        if (typeof this.templates[tpl] == 'string') {
            this.templates[tpl] = doT.template(this.templates[tpl]);
        }
    }, this);

    // ensure we have a container id
    if (!this.$el.attr('id')) {
        this.$el.attr('id', 'qb_' + Math.floor(Math.random() * 99999));
        this.status.generated_id = true;
    }
    this.status.id = this.$el.attr('id');

    // INIT
    this.$el.addClass('query-builder form-inline');

    this.filters = this.checkFilters(this.filters);
    this.operators = this.checkOperators(this.operators);
    this.bindEvents();
    this.initPlugins();
};

$.extend(QueryBuilder.prototype, /** @lends QueryBuilder.prototype */ {
    /**
     * Triggers an event on the builder container
     * @param {string} type
     * @returns {$.Event}
     */
    trigger: function(type) {
        var event = new $.Event(this._tojQueryEvent(type), {
            builder: this
        });

        this.$el.triggerHandler(event, Array.prototype.slice.call(arguments, 1));

        return event;
    },

    /**
     * Triggers an event on the builder container and returns the modified value
     * @param {string} type
     * @param {*} value
     * @returns {*}
     */
    change: function(type, value) {
        var event = new $.Event(this._tojQueryEvent(type, true), {
            builder: this,
            value: value
        });

        this.$el.triggerHandler(event, Array.prototype.slice.call(arguments, 2));

        return event.value;
    },

    /**
     * Attaches an event listener on the builder container
     * @param {string} type
     * @param {function} cb
     * @returns {QueryBuilder}
     */
    on: function(type, cb) {
        this.$el.on(this._tojQueryEvent(type), cb);
        return this;
    },

    /**
     * Removes an event listener from the builder container
     * @param {string} type
     * @param {function} [cb]
     * @returns {QueryBuilder}
     */
    off: function(type, cb) {
        this.$el.off(this._tojQueryEvent(type), cb);
        return this;
    },

    /**
     * Attaches an event listener called once on the builder container
     * @param {string} type
     * @param {function} cb
     * @returns {QueryBuilder}
     */
    once: function(type, cb) {
        this.$el.one(this._tojQueryEvent(type), cb);
        return this;
    },

    /**
     * Appends `.queryBuilder` and optionally `.filter` to the events names
     * @param {string} name
     * @param {boolean} [filter=false]
     * @returns {string}
     * @private
     */
    _tojQueryEvent: function(name, filter) {
        return name.split(' ').map(function(type) {
            return type + '.queryBuilder' + (filter ? '.filter' : '');
        }).join(' ');
    }
});


/**
 * Allowed types and their internal representation
 * @type {object.<string, string>}
 * @readonly
 * @private
 */
QueryBuilder.types = {
    'string':   'string',
    'integer':  'number',
    'double':   'number',
    'date':     'datetime',
    'time':     'datetime',
    'datetime': 'datetime',
    'boolean':  'boolean'
};

/**
 * Allowed inputs
 * @type {string[]}
 * @readonly
 * @private
 */
QueryBuilder.inputs = [
    'text',
    'number',
    'textarea',
    'radio',
    'checkbox',
    'select'
];

/**
 * Runtime modifiable options with `setOptions` method
 * @type {string[]}
 * @readonly
 * @private
 */
QueryBuilder.modifiable_options = [
    'display_errors',
    'allow_groups',
    'allow_empty',
    'default_condition',
    'default_filter'
];

/**
 * CSS selectors for common components
 * @type {object.<string, string>}
 * @readonly
 */
QueryBuilder.selectors = {
    group_container:      '.rules-group-container',
    rule_container:       '.rule-container',
    filter_container:     '.rule-filter-container',
    operator_container:   '.rule-operator-container',
    value_container:      '.rule-value-container',
    error_container:      '.error-container',
    condition_container:  '.rules-group-header .group-conditions',

    rule_header:          '.rule-header',
    group_header:         '.rules-group-header',
    group_actions:        '.group-actions',
    rule_actions:         '.rule-actions',

    rules_list:           '.rules-group-body>.rules-list',

    group_condition:      '.rules-group-header [name$=_cond]',
    rule_filter:          '.rule-filter-container [name$=_filter]',
    rule_operator:        '.rule-operator-container [name$=_operator]',
    rule_value:           '.rule-value-container [name*=_value_]',

    add_rule:             '[data-add=rule]',
    delete_rule:          '[data-delete=rule]',
    add_group:            '[data-add=group]',
    delete_group:         '[data-delete=group]'
};

/**
 * Template strings (see template.js)
 * @type {object.<string, string>}
 * @readonly
 */
QueryBuilder.templates = {};

/**
 * Localized strings (see i18n/)
 * @type {object.<string, object>}
 * @readonly
 */
QueryBuilder.regional = {};

/**
 * Default operators
 * @type {object.<string, object>}
 * @readonly
 */
QueryBuilder.OPERATORS = {
    equal:            { type: 'equal',            nb_inputs: 1, multiple: false, apply_to: ['string', 'number', 'datetime', 'boolean'] },
    not_equal:        { type: 'not_equal',        nb_inputs: 1, multiple: false, apply_to: ['string', 'number', 'datetime', 'boolean'] },
    in:               { type: 'in',               nb_inputs: 1, multiple: true,  apply_to: ['string', 'number', 'datetime'] },
    not_in:           { type: 'not_in',           nb_inputs: 1, multiple: true,  apply_to: ['string', 'number', 'datetime'] },
    less:             { type: 'less',             nb_inputs: 1, multiple: false, apply_to: ['number', 'datetime'] },
    less_or_equal:    { type: 'less_or_equal',    nb_inputs: 1, multiple: false, apply_to: ['number', 'datetime'] },
    greater:          { type: 'greater',          nb_inputs: 1, multiple: false, apply_to: ['number', 'datetime'] },
    greater_or_equal: { type: 'greater_or_equal', nb_inputs: 1, multiple: false, apply_to: ['number', 'datetime'] },
    between:          { type: 'between',          nb_inputs: 2, multiple: false, apply_to: ['number', 'datetime'] },
    not_between:      { type: 'not_between',      nb_inputs: 2, multiple: false, apply_to: ['number', 'datetime'] },
    begins_with:      { type: 'begins_with',      nb_inputs: 1, multiple: false, apply_to: ['string'] },
    not_begins_with:  { type: 'not_begins_with',  nb_inputs: 1, multiple: false, apply_to: ['string'] },
    contains:         { type: 'contains',         nb_inputs: 1, multiple: false, apply_to: ['string'] },
    not_contains:     { type: 'not_contains',     nb_inputs: 1, multiple: false, apply_to: ['string'] },
    ends_with:        { type: 'ends_with',        nb_inputs: 1, multiple: false, apply_to: ['string'] },
    not_ends_with:    { type: 'not_ends_with',    nb_inputs: 1, multiple: false, apply_to: ['string'] },
    is_empty:         { type: 'is_empty',         nb_inputs: 0, multiple: false, apply_to: ['string'] },
    is_not_empty:     { type: 'is_not_empty',     nb_inputs: 0, multiple: false, apply_to: ['string'] },
    is_null:          { type: 'is_null',          nb_inputs: 0, multiple: false, apply_to: ['string', 'number', 'datetime', 'boolean'] },
    is_not_null:      { type: 'is_not_null',      nb_inputs: 0, multiple: false, apply_to: ['string', 'number', 'datetime', 'boolean'] }
};

/**
 * Default configuration
 * @type {object}
 * @readonly
 */
QueryBuilder.DEFAULTS = {
    filters: [],
    plugins: [],

    sort_filters: false,
    display_errors: true,
    allow_groups: -1,
    allow_empty: false,
    conditions: ['AND', 'OR'],
    default_condition: 'AND',
    inputs_separator: ' , ',
    select_placeholder: '------',
    display_empty_filter: true,
    default_filter: null,
    optgroups: {},

    default_rule_flags: {
        filter_readonly: false,
        operator_readonly: false,
        value_readonly: false,
        no_delete: false
    },

    default_group_flags: {
        condition_readonly: false,
        no_add_rule: false,
        no_add_group: false,
        no_delete: false
    },

    templates: {
        group: null,
        rule: null,
        filterSelect: null,
        operatorSelect: null
    },

    lang_code: 'en',
    lang: {},

    operators: [
        'equal',
        'not_equal',
        'in',
        'not_in',
        'less',
        'less_or_equal',
        'greater',
        'greater_or_equal',
        'between',
        'not_between',
        'begins_with',
        'not_begins_with',
        'contains',
        'not_contains',
        'ends_with',
        'not_ends_with',
        'is_empty',
        'is_not_empty',
        'is_null',
        'is_not_null'
    ],

    icons: {
        add_group:    'glyphicon glyphicon-plus-sign',
        add_rule:     'glyphicon glyphicon-plus',
        remove_group: 'glyphicon glyphicon-remove',
        remove_rule:  'glyphicon glyphicon-remove',
        error:        'glyphicon glyphicon-warning-sign'
    }
};


/**
 * @module plugins
 */

/**
 * Definition of available plugins
 * @type {object.<String, object>}
 */
QueryBuilder.plugins = {};

/**
 * Gets or extends the default configuration
 * @param {object} [options] - new configuration
 * @returns {undefined|object} nothing or configuration object (copy)
 */
QueryBuilder.defaults = function(options) {
    if (typeof options == 'object') {
        $.extendext(true, 'replace', QueryBuilder.DEFAULTS, options);
    }
    else if (typeof options == 'string') {
        if (typeof QueryBuilder.DEFAULTS[options] == 'object') {
            return $.extend(true, {}, QueryBuilder.DEFAULTS[options]);
        }
        else {
            return QueryBuilder.DEFAULTS[options];
        }
    }
    else {
        return $.extend(true, {}, QueryBuilder.DEFAULTS);
    }
};

/**
 * Registers a new plugin
 * @param {string} name
 * @param {function} fct - init function
 * @param {object} [def] - default options
 */
QueryBuilder.define = function(name, fct, def) {
    QueryBuilder.plugins[name] = {
        fct: fct,
        def: def || {}
    };
};

/**
 * Adds new methods to QueryBuilder prototype
 * @param {object.<string, function>} methods
 */
QueryBuilder.extend = function(methods) {
    $.extend(QueryBuilder.prototype, methods);
};

/**
 * Initializes plugins for an instance
 * @throws ConfigError
 * @private
 */
QueryBuilder.prototype.initPlugins = function() {
    if (!this.plugins) {
        return;
    }

    if ($.isArray(this.plugins)) {
        var tmp = {};
        this.plugins.forEach(function(plugin) {
            tmp[plugin] = null;
        });
        this.plugins = tmp;
    }

    Object.keys(this.plugins).forEach(function(plugin) {
        if (plugin in QueryBuilder.plugins) {
            this.plugins[plugin] = $.extend(true, {},
                QueryBuilder.plugins[plugin].def,
                this.plugins[plugin] || {}
            );

            QueryBuilder.plugins[plugin].fct.call(this, this.plugins[plugin]);
        }
        else {
            Utils.error('Config', 'Unable to find plugin "{0}"', plugin);
        }
    }, this);
};

/**
 * Returns the config of a plugin, if the plugin is not loaded, returns the default config.
 * @param {string} name
 * @param {string} [property]
 * @throws ConfigError
 * @returns {*}
 */
QueryBuilder.prototype.getPluginOptions = function(name, property) {
    var plugin;
    if (this.plugins && this.plugins[name]) {
        plugin = this.plugins[name];
    }
    else if (QueryBuilder.plugins[name]) {
        plugin = QueryBuilder.plugins[name].def;
    }

    if (plugin) {
        if (property) {
            return plugin[property];
        }
        else {
            return plugin;
        }
    }
    else {
        Utils.error('Config', 'Unable to find plugin "{0}"', name);
    }
};


/**
 * Final initialisation of the builder
 * @param {object} [rules]
 * @fires QueryBuilder.afterInit
 * @private
 */
QueryBuilder.prototype.init = function(rules) {
    /**
     * When the initilization is done, just before creating the root group
     * @event afterInit
     * @memberof QueryBuilder
     */
    this.trigger('afterInit');

    if (rules) {
        this.setRules(rules);
        delete this.settings.rules;
    }
    else {
        this.setRoot(true);
    }
};

/**
 * Checks the configuration of each filter
 * @param {QueryBuilder.Filter[]} filters
 * @returns {QueryBuilder.Filter[]}
 * @throws ConfigError
 */
QueryBuilder.prototype.checkFilters = function(filters) {
    var definedFilters = [];

    if (!filters || filters.length === 0) {
        Utils.error('Config', 'Missing filters list');
    }

    filters.forEach(function(filter, i) {
        if (!filter.id) {
            Utils.error('Config', 'Missing filter {0} id', i);
        }
        if (definedFilters.indexOf(filter.id) != -1) {
            Utils.error('Config', 'Filter "{0}" already defined', filter.id);
        }
        definedFilters.push(filter.id);

        if (!filter.type) {
            filter.type = 'string';
        }
        else if (!QueryBuilder.types[filter.type]) {
            Utils.error('Config', 'Invalid type "{0}"', filter.type);
        }

        if (!filter.input) {
            filter.input = QueryBuilder.types[filter.type] === 'number' ? 'number' : 'text';
        }
        else if (typeof filter.input != 'function' && QueryBuilder.inputs.indexOf(filter.input) == -1) {
            Utils.error('Config', 'Invalid input "{0}"', filter.input);
        }

        if (filter.operators) {
            filter.operators.forEach(function(operator) {
                if (typeof operator != 'string') {
                    Utils.error('Config', 'Filter operators must be global operators types (string)');
                }
            });
        }

        if (!filter.field) {
            filter.field = filter.id;
        }
        if (!filter.label) {
            filter.label = filter.field;
        }

        if (!filter.optgroup) {
            filter.optgroup = null;
        }
        else {
            this.status.has_optgroup = true;

            // register optgroup if needed
            if (!this.settings.optgroups[filter.optgroup]) {
                this.settings.optgroups[filter.optgroup] = filter.optgroup;
            }
        }

        switch (filter.input) {
            case 'radio':
            case 'checkbox':
                if (!filter.values || filter.values.length < 1) {
                    Utils.error('Config', 'Missing filter "{0}" values', filter.id);
                }
                break;

            case 'select':
                if (filter.placeholder) {
                    if (filter.placeholder_value === undefined) {
                        filter.placeholder_value = -1;
                    }
                    Utils.iterateOptions(filter.values, function(key) {
                        if (key == filter.placeholder_value) {
                            Utils.error('Config', 'Placeholder of filter "{0}" overlaps with one of its values', filter.id);
                        }
                    });
                }
                break;
        }
    }, this);

    if (this.settings.sort_filters) {
        if (typeof this.settings.sort_filters == 'function') {
            filters.sort(this.settings.sort_filters);
        }
        else {
            var self = this;
            filters.sort(function(a, b) {
                return self.translate(a.label).localeCompare(self.translate(b.label));
            });
        }
    }

    if (this.status.has_optgroup) {
        filters = Utils.groupSort(filters, 'optgroup');
    }

    return filters;
};

/**
 * Checks the configuration of each operator
 * @param {QueryBuilder.Operator[]} operators
 * @returns {QueryBuilder.Operator[]}
 * @throws ConfigError
 */
QueryBuilder.prototype.checkOperators = function(operators) {
    var definedOperators = [];

    operators.forEach(function(operator, i) {
        if (typeof operator == 'string') {
            if (!QueryBuilder.OPERATORS[operator]) {
                Utils.error('Config', 'Unknown operator "{0}"', operator);
            }

            operators[i] = operator = $.extendext(true, 'replace', {}, QueryBuilder.OPERATORS[operator]);
        }
        else {
            if (!operator.type) {
                Utils.error('Config', 'Missing "type" for operator {0}', i);
            }

            if (QueryBuilder.OPERATORS[operator.type]) {
                operators[i] = operator = $.extendext(true, 'replace', {}, QueryBuilder.OPERATORS[operator.type], operator);
            }

            if (operator.nb_inputs === undefined || operator.apply_to === undefined) {
                Utils.error('Config', 'Missing "nb_inputs" and/or "apply_to" for operator "{0}"', operator.type);
            }
        }

        if (definedOperators.indexOf(operator.type) != -1) {
            Utils.error('Config', 'Operator "{0}" already defined', operator.type);
        }
        definedOperators.push(operator.type);

        if (!operator.optgroup) {
            operator.optgroup = null;
        }
        else {
            this.status.has_operator_optgroup = true;

            // register optgroup if needed
            if (!this.settings.optgroups[operator.optgroup]) {
                this.settings.optgroups[operator.optgroup] = operator.optgroup;
            }
        }
    }, this);

    if (this.status.has_operator_optgroup) {
        operators = Utils.groupSort(operators, 'optgroup');
    }

    return operators;
};

/**
 * Adds all events listeners to the builder
 * @private
 */
QueryBuilder.prototype.bindEvents = function() {
    var self = this;
    var Selectors = QueryBuilder.selectors;

    // group condition change
    this.$el.on('change.queryBuilder', Selectors.group_condition, function() {
        if ($(this).is(':checked')) {
            var $group = $(this).closest(Selectors.group_container);
            self.getModel($group).condition = $(this).val();
        }
    });

    // rule filter change
    this.$el.on('change.queryBuilder', Selectors.rule_filter, function() {
        var $rule = $(this).closest(Selectors.rule_container);
        self.getModel($rule).filter = self.getFilterById($(this).val());
    });

    // rule operator change
    this.$el.on('change.queryBuilder', Selectors.rule_operator, function() {
        var $rule = $(this).closest(Selectors.rule_container);
        self.getModel($rule).operator = self.getOperatorByType($(this).val());
    });

    // add rule button
    this.$el.on('click.queryBuilder', Selectors.add_rule, function() {
        var $group = $(this).closest(Selectors.group_container);
        self.addRule(self.getModel($group));
    });

    // delete rule button
    this.$el.on('click.queryBuilder', Selectors.delete_rule, function() {
        var $rule = $(this).closest(Selectors.rule_container);
        self.deleteRule(self.getModel($rule));
    });

    if (this.settings.allow_groups !== 0) {
        // add group button
        this.$el.on('click.queryBuilder', Selectors.add_group, function() {
            var $group = $(this).closest(Selectors.group_container);
            self.addGroup(self.getModel($group));
        });

        // delete group button
        this.$el.on('click.queryBuilder', Selectors.delete_group, function() {
            var $group = $(this).closest(Selectors.group_container);
            self.deleteGroup(self.getModel($group));
        });
    }

    // model events
    this.model.on({
        'drop': function(e, node) {
            node.$el.remove();
            self.refreshGroupsConditions();
        },
        'add': function(e, parent, node, index) {
            if (index === 0) {
                node.$el.prependTo(parent.$el.find('>' + QueryBuilder.selectors.rules_list));
            }
            else {
                node.$el.insertAfter(parent.rules[index - 1].$el);
            }
            self.refreshGroupsConditions();
        },
        'move': function(e, node, group, index) {
            node.$el.detach();

            if (index === 0) {
                node.$el.prependTo(group.$el.find('>' + QueryBuilder.selectors.rules_list));
            }
            else {
                node.$el.insertAfter(group.rules[index - 1].$el);
            }
            self.refreshGroupsConditions();
        },
        'update': function(e, node, field, value, oldValue) {
            if (node instanceof Rule) {
                switch (field) {
                    case 'error':
                        self.updateError(node);
                        break;

                    case 'flags':
                        self.applyRuleFlags(node);
                        break;

                    case 'filter':
                        self.updateRuleFilter(node, oldValue);
                        break;

                    case 'operator':
                        self.updateRuleOperator(node, oldValue);
                        break;

                    case 'value':
                        self.updateRuleValue(node);
                        break;
                }
            }
            else {
                switch (field) {
                    case 'error':
                        self.updateError(node);
                        break;

                    case 'flags':
                        self.applyGroupFlags(node);
                        break;

                    case 'condition':
                        self.updateGroupCondition(node);
                        break;
                }
            }
        }
    });
};

/**
 * Creates the root group
 * @param {boolean} [addRule=true] - adds a default empty rule
 * @param {object} [data] - group custom data
 * @param {object} [flags] - flags to apply to the group
 * @returns {Group} root group
 * @fires QueryBuilder.afterAddGroup
 */
QueryBuilder.prototype.setRoot = function(addRule, data, flags) {
    addRule = (addRule === undefined || addRule === true);

    var group_id = this.nextGroupId();
    var $group = $(this.getGroupTemplate(group_id, 1));

    this.$el.append($group);
    this.model.root = new Group(null, $group);
    this.model.root.model = this.model;

    this.model.root.data = data;
    this.model.root.__.flags = $.extend({}, this.settings.default_group_flags, flags);

    this.trigger('afterAddGroup', this.model.root);

    this.model.root.condition = this.settings.default_condition;

    if (addRule) {
        this.addRule(this.model.root);
    }

    return this.model.root;
};

/**
 * Adds a new group
 * @param {Group} parent
 * @param {boolean} [addRule=true] - adds a default empty rule
 * @param {object} [data] - group custom data
 * @param {object} [flags] - flags to apply to the group
 * @returns {Group}
 * @fires QueryBuilder.beforeAddGroup
 * @fires QueryBuilder.afterAddGroup
 */
QueryBuilder.prototype.addGroup = function(parent, addRule, data, flags) {
    addRule = (addRule === undefined || addRule === true);

    var level = parent.level + 1;

    /**
     * Just before adding a group, can be prevented.
     * @event beforeAddGroup
     * @memberof QueryBuilder
     * @param {Group} parent
     * @param {boolean} addRule - if an empty rule will be added in the group
     * @param {int} level - nesting level of the group, 1 is the root group
     */
    var e = this.trigger('beforeAddGroup', parent, addRule, level);
    if (e.isDefaultPrevented()) {
        return null;
    }

    var group_id = this.nextGroupId();
    var $group = $(this.getGroupTemplate(group_id, level));
    var model = parent.addGroup($group);

    model.data = data;
    model.__.flags = $.extend({}, this.settings.default_group_flags, flags);

    /**
     * Just after adding a group
     * @event afterAddGroup
     * @memberof QueryBuilder
     * @param {Group} group
     */
    this.trigger('afterAddGroup', model);

    model.condition = this.settings.default_condition;

    if (addRule) {
        this.addRule(model);
    }

    return model;
};

/**
 * Tries to delete a group. The group is not deleted if at least one rule is flagged `no_delete`.
 * @param {Group} group
 * @returns {boolean} if the group has been deleted
 * @fires QueryBuilder.beforeDeleteGroup
 * @fires QueryBuilder.afterDeleteGroup
 */
QueryBuilder.prototype.deleteGroup = function(group) {
    if (group.isRoot()) {
        return false;
    }

    /**
     * Just before deleting a group, can be prevented
     * @event beforeDeleteGroup
     * @memberof QueryBuilder
     * @param {Group} parent
     */
    var e = this.trigger('beforeDeleteGroup', group);
    if (e.isDefaultPrevented()) {
        return false;
    }

    var del = true;

    group.each('reverse', function(rule) {
        del &= this.deleteRule(rule);
    }, function(group) {
        del &= this.deleteGroup(group);
    }, this);

    if (del) {
        group.drop();

        /**
         * Just after deleting a group
         * @event afterDeleteGroup
         * @memberof QueryBuilder
         */
        this.trigger('afterDeleteGroup');
    }

    return del;
};

/**
 * Performs actions when a group's condition changes
 * @param {Group} group
 * @fires QueryBuilder.afterUpdateGroupCondition
 * @private
 */
QueryBuilder.prototype.updateGroupCondition = function(group) {
    group.$el.find('>' + QueryBuilder.selectors.group_condition).each(function() {
        var $this = $(this);
        $this.prop('checked', $this.val() === group.condition);
        $this.parent().toggleClass('active', $this.val() === group.condition);
    });

    /**
     * After the group condition has been modified
     * @event afterUpdateGroupCondition
     * @memberof QueryBuilder
     * @param {Group} group
     */
    this.trigger('afterUpdateGroupCondition', group);
};

/**
 * Updates the visibility of conditions based on number of rules inside each group
 * @private
 */
QueryBuilder.prototype.refreshGroupsConditions = function() {
    (function walk(group) {
        if (!group.flags || (group.flags && !group.flags.condition_readonly)) {
            group.$el.find('>' + QueryBuilder.selectors.group_condition).prop('disabled', group.rules.length <= 1)
                .parent().toggleClass('disabled', group.rules.length <= 1);
        }

        group.each(null, function(group) {
            walk(group);
        }, this);
    }(this.model.root));
};

/**
 * Adds a new rule
 * @param {Group} parent
 * @param {object} [data] - rule custom data
 * @param {object} [flags] - flags to apply to the rule
 * @returns {Rule}
 * @fires QueryBuilder.beforeAddRule
 * @fires QueryBuilder.afterAddRule
 * @fires QueryBuilder.changer:getDefaultFilter
 */
QueryBuilder.prototype.addRule = function(parent, data, flags) {
    /**
     * Just before adding a rule, can be prevented
     * @event beforeAddRule
     * @memberof QueryBuilder
     * @param {Group} parent
     */
    var e = this.trigger('beforeAddRule', parent);
    if (e.isDefaultPrevented()) {
        return null;
    }

    var rule_id = this.nextRuleId();
    var $rule = $(this.getRuleTemplate(rule_id));
    var model = parent.addRule($rule);

    if (data !== undefined) {
        model.data = data;
    }

    model.__.flags = $.extend({}, this.settings.default_rule_flags, flags);

    /**
     * Just after adding a rule
     * @event afterAddRule
     * @memberof QueryBuilder
     * @param {Rule} rule
     */
    this.trigger('afterAddRule', model);

    this.createRuleFilters(model);

    if (this.settings.default_filter || !this.settings.display_empty_filter) {
        /**
         * Modifies the default filter for a rule
         * @event changer:getDefaultFilter
         * @memberof QueryBuilder
         * @param {QueryBuilder.Filter} filter
         * @param {Rule} rule
         * @returns {QueryBuilder.Filter}
         */
        model.filter = this.change('getDefaultFilter',
            this.getFilterById(this.settings.default_filter || this.filters[0].id),
            model
        );
    }

    return model;
};

/**
 * Tries to delete a rule
 * @param {Rule} rule
 * @returns {boolean} if the rule has been deleted
 * @fires QueryBuilder.beforeDeleteRule
 * @fires QueryBuilder.afterDeleteRule
 */
QueryBuilder.prototype.deleteRule = function(rule) {
    if (rule.flags.no_delete) {
        return false;
    }

    /**
     * Just before deleting a rule, can be prevented
     * @event beforeDeleteRule
     * @memberof QueryBuilder
     * @param {Rule} rule
     */
    var e = this.trigger('beforeDeleteRule', rule);
    if (e.isDefaultPrevented()) {
        return false;
    }

    rule.drop();

    /**
     * Just after deleting a rule
     * @event afterDeleteRule
     * @memberof QueryBuilder
     */
    this.trigger('afterDeleteRule');

    return true;
};

/**
 * Creates the filters for a rule
 * @param {Rule} rule
 * @fires QueryBuilder.changer:getRuleFilters
 * @fires QueryBuilder.afterCreateRuleFilters
 * @private
 */
QueryBuilder.prototype.createRuleFilters = function(rule) {
    /**
     * Modifies the list a filters available for a rule
     * @event changer:getRuleFilters
     * @memberof QueryBuilder
     * @param {QueryBuilder.Filter[]} filters
     * @param {Rule} rule
     * @returns {QueryBuilder.Filter[]}
     */
    var filters = this.change('getRuleFilters', this.filters, rule);
    var $filterSelect = $(this.getRuleFilterSelect(rule, filters));

    rule.$el.find(QueryBuilder.selectors.filter_container).html($filterSelect);

    /**
     * After creating the dropdown for filters
     * @event afterCreateRuleFilters
     * @memberof QueryBuilder
     * @param {Rule} rule
     */
    this.trigger('afterCreateRuleFilters', rule);
};

/**
 * Creates the operators for a rule and init the rule operator
 * @param {Rule} rule
 * @fires QueryBuilder.afterCreateRuleOperators
 * @private
 */
QueryBuilder.prototype.createRuleOperators = function(rule) {
    var $operatorContainer = rule.$el.find(QueryBuilder.selectors.operator_container).empty();

    if (!rule.filter) {
        return;
    }

    var operators = this.getOperators(rule.filter);
    var $operatorSelect = $(this.getRuleOperatorSelect(rule, operators));

    $operatorContainer.html($operatorSelect);

    // set the operator without triggering update event
    rule.__.operator = operators[0];

    /**
     * After creating the dropdown for operators
     * @event afterCreateRuleOperators
     * @memberof QueryBuilder
     * @param {Rule} rule
     * @param {QueryBuilder.Operator[]} operators - allowed operators for this rule
     */
    this.trigger('afterCreateRuleOperators', rule, operators);
};

/**
 * Creates the main input for a rule
 * @param {Rule} rule
 * @fires QueryBuilder.afterCreateRuleInput
 * @private
 */
QueryBuilder.prototype.createRuleInput = function(rule) {
    var $valueContainer = rule.$el.find(QueryBuilder.selectors.value_container).empty();

    rule.__.value = undefined;

    if (!rule.filter || !rule.operator || rule.operator.nb_inputs === 0) {
        return;
    }

    var self = this;
    var $inputs = $();
    var filter = rule.filter;

    for (var i = 0; i < rule.operator.nb_inputs; i++) {
        var $ruleInput = $(this.getRuleInput(rule, i));
        if (i > 0) $valueContainer.append(this.settings.inputs_separator);
        $valueContainer.append($ruleInput);
        $inputs = $inputs.add($ruleInput);
    }

    $valueContainer.show();

    $inputs.on('change ' + (filter.input_event || ''), function() {
        if (!this._updating_input) {
            rule._updating_value = true;
            rule.value = self.getRuleInputValue(rule);
            rule._updating_value = false;
        }
    });

    if (filter.plugin) {
        $inputs[filter.plugin](filter.plugin_config || {});
    }

    /**
     * After creating the input for a rule and initializing optional plugin
     * @event afterCreateRuleInput
     * @memberof QueryBuilder
     * @param {Rule} rule
     */
    this.trigger('afterCreateRuleInput', rule);

    if (filter.default_value !== undefined) {
        rule.value = filter.default_value;
    }
    else {
        rule._updating_value = true;
        rule.value = self.getRuleInputValue(rule);
        rule._updating_value = false;
    }
};

/**
 * Performs action when a rule's filter changes
 * @param {Rule} rule
 * @param {object} previousFilter
 * @fires QueryBuilder.afterUpdateRuleFilter
 * @private
 */
QueryBuilder.prototype.updateRuleFilter = function(rule, previousFilter) {
    this.createRuleOperators(rule);
    this.createRuleInput(rule);

    rule.$el.find(QueryBuilder.selectors.rule_filter).val(rule.filter ? rule.filter.id : '-1');

    // clear rule data if the filter changed
    if (previousFilter && rule.filter && previousFilter.id !== rule.filter.id) {
        rule.data = undefined;
    }

    /**
     * After the filter has been updated and the operators and input re-created
     * @event afterUpdateRuleFilter
     * @memberof QueryBuilder
     * @param {Rule} rule
     */
    this.trigger('afterUpdateRuleFilter', rule);
};

/**
 * Performs actions when a rule's operator changes
 * @param {Rule} rule
 * @param {object} previousOperator
 * @fires QueryBuilder.afterUpdateRuleOperator
 * @private
 */
QueryBuilder.prototype.updateRuleOperator = function(rule, previousOperator) {
    var $valueContainer = rule.$el.find(QueryBuilder.selectors.value_container);

    if (!rule.operator || rule.operator.nb_inputs === 0) {
        $valueContainer.hide();

        rule.__.value = undefined;
    }
    else {
        $valueContainer.show();

        if ($valueContainer.is(':empty') || !previousOperator ||
            rule.operator.nb_inputs !== previousOperator.nb_inputs ||
            rule.operator.optgroup !== previousOperator.optgroup
        ) {
            this.createRuleInput(rule);
        }
    }

    if (rule.operator) {
        rule.$el.find(QueryBuilder.selectors.rule_operator).val(rule.operator.type);
    }

    /**
     *  After the operator has been updated and the input optionally re-created
     * @event afterUpdateRuleOperator
     * @memberof QueryBuilder
     * @param {Rule} rule
     */
    this.trigger('afterUpdateRuleOperator', rule);

    this.updateRuleValue(rule);
};

/**
 * Performs actions when rule's value changes
 * @param {Rule} rule
 * @fires QueryBuilder.afterUpdateRuleValue
 * @private
 */
QueryBuilder.prototype.updateRuleValue = function(rule) {
    if (!rule._updating_value) {
        this.setRuleInputValue(rule, rule.value);
    }

    /**
     * After the rule value has been modified
     * @event afterUpdateRuleValue
     * @memberof QueryBuilder
     * @param {Rule} rule
     */
    this.trigger('afterUpdateRuleValue', rule);
};

/**
 * Changes a rule's properties depending on its flags
 * @param {Rule} rule
 * @fires QueryBuilder.afterApplyRuleFlags
 * @private
 */
QueryBuilder.prototype.applyRuleFlags = function(rule) {
    var flags = rule.flags;
    var Selectors = QueryBuilder.selectors;

    if (flags.filter_readonly) {
        rule.$el.find(Selectors.rule_filter).prop('disabled', true);
    }
    if (flags.operator_readonly) {
        rule.$el.find(Selectors.rule_operator).prop('disabled', true);
    }
    if (flags.value_readonly) {
        rule.$el.find(Selectors.rule_value).prop('disabled', true);
    }
    if (flags.no_delete) {
        rule.$el.find(Selectors.delete_rule).remove();
    }

    /**
     * After rule's flags has been applied
     * @event afterApplyRuleFlags
     * @memberof QueryBuilder
     * @param {Rule} rule
     */
    this.trigger('afterApplyRuleFlags', rule);
};

/**
 * Changes group's properties depending on its flags
 * @param {Group} group
 * @fires QueryBuilder.afterApplyGroupFlags
 * @private
 */
QueryBuilder.prototype.applyGroupFlags = function(group) {
    var flags = group.flags;
    var Selectors = QueryBuilder.selectors;

    if (flags.condition_readonly) {
        group.$el.find('>' + Selectors.group_condition).prop('disabled', true)
            .parent().addClass('readonly');
    }
    if (flags.no_add_rule) {
        group.$el.find(Selectors.add_rule).remove();
    }
    if (flags.no_add_group) {
        group.$el.find(Selectors.add_group).remove();
    }
    if (flags.no_delete) {
        group.$el.find(Selectors.delete_group).remove();
    }

    /**
     * After group's flags has been applied
     * @event afterApplyGroupFlags
     * @memberof QueryBuilder
     * @param {Group} group
     */
    this.trigger('afterApplyGroupFlags', group);
};

/**
 * Clears all errors markers
 * @param {Node} [node] default is root Group
 */
QueryBuilder.prototype.clearErrors = function(node) {
    node = node || this.model.root;

    if (!node) {
        return;
    }

    node.error = null;

    if (node instanceof Group) {
        node.each(function(rule) {
            rule.error = null;
        }, function(group) {
            this.clearErrors(group);
        }, this);
    }
};

/**
 * Adds/Removes error on a Rule or Group
 * @param {Node} node
 * @fires QueryBuilder.changer:displayError
 * @private
 */
QueryBuilder.prototype.updateError = function(node) {
    if (this.settings.display_errors) {
        if (node.error === null) {
            node.$el.removeClass('has-error');
        }
        else {
            var errorMessage = this.translate('errors', node.error[0]);
            errorMessage = Utils.fmt(errorMessage, node.error.slice(1));

            /**
             * Modifies an error message before display
             * @event changer:displayError
             * @memberof QueryBuilder
             * @param {string} errorMessage - the error message (translated and formatted)
             * @param {array} error - the raw error array (error code and optional arguments)
             * @param {Node} node
             * @returns {string}
             */
            errorMessage = this.change('displayError', errorMessage, node.error, node);

            node.$el.addClass('has-error')
                .find(QueryBuilder.selectors.error_container).eq(0)
                .attr('title', errorMessage);
        }
    }
};

/**
 * Triggers a validation error event
 * @param {Node} node
 * @param {string|array} error
 * @param {*} value
 * @fires QueryBuilder.validationError
 * @private
 */
QueryBuilder.prototype.triggerValidationError = function(node, error, value) {
    if (!$.isArray(error)) {
        error = [error];
    }

    /**
     * Fired when a validation error occurred, can be prevented
     * @event validationError
     * @memberof QueryBuilder
     * @param {Node} node
     * @param {string} error
     * @param {*} value
     */
    var e = this.trigger('validationError', node, error, value);
    if (!e.isDefaultPrevented()) {
        node.error = error;
    }
};


/**
 * Destroys the builder
 * @fires QueryBuilder.beforeDestroy
 */
QueryBuilder.prototype.destroy = function() {
    /**
     * Before the {@link QueryBuilder#destroy} method
     * @event beforeDestroy
     * @memberof QueryBuilder
     */
    this.trigger('beforeDestroy');

    if (this.status.generated_id) {
        this.$el.removeAttr('id');
    }

    this.clear();
    this.model = null;

    this.$el
        .off('.queryBuilder')
        .removeClass('query-builder')
        .removeData('queryBuilder');

    delete this.$el[0].queryBuilder;
};

/**
 * Clear all rules and resets the root group
 * @fires QueryBuilder.beforeReset
 * @fires QueryBuilder.afterReset
 */
QueryBuilder.prototype.reset = function() {
    /**
     * Before the {@link QueryBuilder#reset} method, can be prevented
     * @event beforeReset
     * @memberof QueryBuilder
     */
    var e = this.trigger('beforeReset');
    if (e.isDefaultPrevented()) {
        return;
    }

    this.status.group_id = 1;
    this.status.rule_id = 0;

    this.model.root.empty();

    this.addRule(this.model.root);

    /**
     * After the {@link QueryBuilder#reset} method
     * @event afterReset
     * @memberof QueryBuilder
     */
    this.trigger('afterReset');
};

/**
 * Clears all rules and removes the root group
 * @fires QueryBuilder.beforeClear
 * @fires QueryBuilder.afterClear
 */
QueryBuilder.prototype.clear = function() {
    /**
     * Before the {@link QueryBuilder#clear} method, can be prevented
     * @event beforeClear
     * @memberof QueryBuilder
     */
    var e = this.trigger('beforeClear');
    if (e.isDefaultPrevented()) {
        return;
    }

    this.status.group_id = 0;
    this.status.rule_id = 0;

    if (this.model.root) {
        this.model.root.drop();
        this.model.root = null;
    }

    /**
     * After the {@link QueryBuilder#clear} method
     * @event afterClear
     * @memberof QueryBuilder
     */
    this.trigger('afterClear');
};

/**
 * Modifies the builder configuration.<br>
 * Only options defined in QueryBuilder.modifiable_options are modifiable
 * @param {object} options
 */
QueryBuilder.prototype.setOptions = function(options) {
    $.each(options, function(opt, value) {
        if (QueryBuilder.modifiable_options.indexOf(opt) !== -1) {
            this.settings[opt] = value;
        }
    }.bind(this));
};

/**
 * Returns the model associated to a DOM object, or the root model
 * @param {jQuery} [target]
 * @returns {Node}
 */
QueryBuilder.prototype.getModel = function(target) {
    if (!target) {
        return this.model.root;
    }
    else if (target instanceof Node) {
        return target;
    }
    else {
        return $(target).data('queryBuilderModel');
    }
};

/**
 * Validates the whole builder
 * @param {object} [options]
 * @param {boolean} [options.skip_empty=false] - skips validating rules that have no filter selected
 * @returns {boolean}
 * @fires QueryBuilder.changer:validate
 */
QueryBuilder.prototype.validate = function(options) {
    options = $.extend({
        skip_empty: false
    }, options);

    this.clearErrors();

    var self = this;

    var valid = (function parse(group) {
        var done = 0;
        var errors = 0;

        group.each(function(rule) {
            if (!rule.filter && options.skip_empty) {
                return;
            }

            if (!rule.filter) {
                self.triggerValidationError(rule, 'no_filter', null);
                errors++;
                return;
            }

            if (!rule.operator) {
                self.triggerValidationError(rule, 'no_operator', null);
                errors++;
                return;
            }

            if (rule.operator.nb_inputs !== 0) {
                var valid = self.validateValue(rule, rule.value);

                if (valid !== true) {
                    self.triggerValidationError(rule, valid, rule.value);
                    errors++;
                    return;
                }
            }

            done++;

        }, function(group) {
            var res = parse(group);
            if (res === true) {
                done++;
            }
            else if (res === false) {
                errors++;
            }
        });

        if (errors > 0) {
            return false;
        }
        else if (done === 0 && !group.isRoot() && options.skip_empty) {
            return null;
        }
        else if (done === 0 && (!self.settings.allow_empty || !group.isRoot())) {
            self.triggerValidationError(group, 'empty_group', null);
            return false;
        }

        return true;

    }(this.model.root));

    /**
     * Modifies the result of the {@link QueryBuilder#validate} method
     * @event changer:validate
     * @memberof QueryBuilder
     * @param {boolean} valid
     * @returns {boolean}
     */
    return this.change('validate', valid);
};

/**
 * Gets an object representing current rules
 * @param {object} [options]
 * @param {boolean|string} [options.get_flags=false] - export flags, true: only changes from default flags or 'all'
 * @param {boolean} [options.allow_invalid=false] - returns rules even if they are invalid
 * @param {boolean} [options.skip_empty=false] - remove rules that have no filter selected
 * @returns {object}
 * @fires QueryBuilder.changer:ruleToJson
 * @fires QueryBuilder.changer:groupToJson
 * @fires QueryBuilder.changer:getRules
 */
QueryBuilder.prototype.getRules = function(options) {
    options = $.extend({
        get_flags: false,
        allow_invalid: false,
        skip_empty: false
    }, options);

    var valid = this.validate(options);
    if (!valid && !options.allow_invalid) {
        return null;
    }

    var self = this;

    var out = (function parse(group) {
        var groupData = {
            condition: group.condition,
            rules: []
        };

        if (group.data) {
            groupData.data = $.extendext(true, 'replace', {}, group.data);
        }

        if (options.get_flags) {
            var flags = self.getGroupFlags(group.flags, options.get_flags === 'all');
            if (!$.isEmptyObject(flags)) {
                groupData.flags = flags;
            }
        }

        group.each(function(rule) {
            if (!rule.filter && options.skip_empty) {
                return;
            }

            var value = null;
            if (!rule.operator || rule.operator.nb_inputs !== 0) {
                value = rule.value;
            }

            var ruleData = {
                id: rule.filter ? rule.filter.id : null,
                field: rule.filter ? rule.filter.field : null,
                type: rule.filter ? rule.filter.type : null,
                input: rule.filter ? rule.filter.input : null,
                operator: rule.operator ? rule.operator.type : null,
                value: value
            };

            if (rule.filter && rule.filter.data || rule.data) {
                ruleData.data = $.extendext(true, 'replace', {}, rule.filter.data, rule.data);
            }

            if (options.get_flags) {
                var flags = self.getRuleFlags(rule.flags, options.get_flags === 'all');
                if (!$.isEmptyObject(flags)) {
                    ruleData.flags = flags;
                }
            }

            /**
             * Modifies the JSON generated from a Rule object
             * @event changer:ruleToJson
             * @memberof QueryBuilder
             * @param {object} json
             * @param {Rule} rule
             * @returns {object}
             */
            groupData.rules.push(self.change('ruleToJson', ruleData, rule));

        }, function(model) {
            var data = parse(model);
            if (data.rules.length !== 0 || !options.skip_empty) {
                groupData.rules.push(data);
            }
        }, this);

        /**
         * Modifies the JSON generated from a Group object
         * @event changer:groupToJson
         * @memberof QueryBuilder
         * @param {object} json
         * @param {Group} group
         * @returns {object}
         */
        return self.change('groupToJson', groupData, group);

    }(this.model.root));

    out.valid = valid;

    /**
     * Modifies the result of the {@link QueryBuilder#getRules} method
     * @event changer:getRules
     * @memberof QueryBuilder
     * @param {object} json
     * @returns {object}
     */
    return this.change('getRules', out);
};

/**
 * Sets rules from object
 * @param {object} data
 * @param {object} [options]
 * @param {boolean} [options.allow_invalid=false] - silent-fail if the data are invalid
 * @throws RulesError, UndefinedConditionError
 * @fires QueryBuilder.changer:setRules
 * @fires QueryBuilder.changer:jsonToRule
 * @fires QueryBuilder.changer:jsonToGroup
 * @fires QueryBuilder.afterSetRules
 */
QueryBuilder.prototype.setRules = function(data, options) {
    options = $.extend({
        allow_invalid: false
    }, options);

    if ($.isArray(data)) {
        data = {
            condition: this.settings.default_condition,
            rules: data
        };
    }

    if (!data || !data.rules || (data.rules.length === 0 && !this.settings.allow_empty)) {
        Utils.error('RulesParse', 'Incorrect data object passed');
    }

    this.clear();
    this.setRoot(false, data.data, this.parseGroupFlags(data));
    this.applyGroupFlags(this.model.root);

    /**
     * Modifies data before the {@link QueryBuilder#setRules} method
     * @event changer:setRules
     * @memberof QueryBuilder
     * @param {object} json
     * @param {object} options
     * @returns {object}
     */
    data = this.change('setRules', data, options);

    var self = this;

    (function add(data, group) {
        if (group === null) {
            return;
        }

        if (data.condition === undefined) {
            data.condition = self.settings.default_condition;
        }
        else if (self.settings.conditions.indexOf(data.condition) == -1) {
            Utils.error(!options.allow_invalid, 'UndefinedCondition', 'Invalid condition "{0}"', data.condition);
            data.condition = self.settings.default_condition;
        }

        group.condition = data.condition;

        data.rules.forEach(function(item) {
            var model;

            if (item.rules !== undefined) {
                if (self.settings.allow_groups !== -1 && self.settings.allow_groups < group.level) {
                    Utils.error(!options.allow_invalid, 'RulesParse', 'No more than {0} groups are allowed', self.settings.allow_groups);
                    self.reset();
                }
                else {
                    model = self.addGroup(group, false, item.data, self.parseGroupFlags(item));
                    if (model === null) {
                        return;
                    }

                    self.applyGroupFlags(model);

                    add(item, model);
                }
            }
            else {
                if (!item.empty) {
                    if (item.id === undefined) {
                        Utils.error(!options.allow_invalid, 'RulesParse', 'Missing rule field id');
                        item.empty = true;
                    }
                    if (item.operator === undefined) {
                        item.operator = 'equal';
                    }
                }

                model = self.addRule(group, item.data, self.parseRuleFlags(item));
                if (model === null) {
                    return;
                }

                if (!item.empty) {
                    model.filter = self.getFilterById(item.id, !options.allow_invalid);

                    if (model.filter) {
                        model.operator = self.getOperatorByType(item.operator, !options.allow_invalid);

                        if (!model.operator) {
                            model.operator = self.getOperators(model.filter)[0];
                        }

                        if (model.operator && model.operator.nb_inputs !== 0 && item.value !== undefined) {
                            model.value = item.value;
                        }
                    }
                }

                self.applyRuleFlags(model);

                /**
                 * Modifies the Rule object generated from the JSON
                 * @event changer:jsonToRule
                 * @memberof QueryBuilder
                 * @param {Rule} rule
                 * @param {object} json
                 * @returns {Rule} the same rule
                 */
                if (self.change('jsonToRule', model, item) != model) {
                    Utils.error('RulesParse', 'Plugin tried to change rule reference');
                }
            }
        });

        /**
         * Modifies the Group object generated from the JSON
         * @event changer:jsonToGroup
         * @memberof QueryBuilder
         * @param {Group} group
         * @param {object} json
         * @returns {Group} the same group
         */
        if (self.change('jsonToGroup', group, data) != group) {
            Utils.error('RulesParse', 'Plugin tried to change group reference');
        }

    }(data, this.model.root));

    /**
     * After the {@link QueryBuilder#setRules} method
     * @event afterSetRules
     * @memberof QueryBuilder
     */
    this.trigger('afterSetRules');
};


/**
 * Performs value validation
 * @param {Rule} rule
 * @param {string|string[]} value
 * @returns {array|boolean} true or error array
 * @fires QueryBuilder.changer:validateValue
 */
QueryBuilder.prototype.validateValue = function(rule, value) {
    var validation = rule.filter.validation || {};
    var result = true;

    if (validation.callback) {
        result = validation.callback.call(this, value, rule);
    }
    else {
        result = this._validateValue(rule, value);
    }

    /**
     * Modifies the result of the rule validation method
     * @event changer:validateValue
     * @memberof QueryBuilder
     * @param {array|boolean} result - true or an error array
     * @param {*} value
     * @param {Rule} rule
     * @returns {array|boolean}
     */
    return this.change('validateValue', result, value, rule);
};

/**
 * Default validation function
 * @param {Rule} rule
 * @param {string|string[]} value
 * @returns {array|boolean} true or error array
 * @throws ConfigError
 * @private
 */
QueryBuilder.prototype._validateValue = function(rule, value) {
    var filter = rule.filter;
    var operator = rule.operator;
    var validation = filter.validation || {};
    var result = true;
    var tmp, tempValue;

    if (rule.operator.nb_inputs === 1) {
        value = [value];
    }

    for (var i = 0; i < operator.nb_inputs; i++) {
        if (!operator.multiple && $.isArray(value[i]) && value[i].length > 1) {
            result = ['operator_not_multiple', operator.type, this.translate('operators', operator.type)];
            break;
        }

        switch (filter.input) {
            case 'radio':
                if (value[i] === undefined || value[i].length === 0) {
                    if (!validation.allow_empty_value) {
                        result = ['radio_empty'];
                    }
                    break;
                }
                break;

            case 'checkbox':
                if (value[i] === undefined || value[i].length === 0) {
                    if (!validation.allow_empty_value) {
                        result = ['checkbox_empty'];
                    }
                    break;
                }
                break;

            case 'select':
                if (value[i] === undefined || value[i].length === 0 || (filter.placeholder && value[i] == filter.placeholder_value)) {
                    if (!validation.allow_empty_value) {
                        result = ['select_empty'];
                    }
                    break;
                }
                break;

            default:
                tempValue = $.isArray(value[i]) ? value[i] : [value[i]];

                for (var j = 0; j < tempValue.length; j++) {
                    switch (QueryBuilder.types[filter.type]) {
                        case 'string':
                            if (tempValue[j] === undefined || tempValue[j].length === 0) {
                                if (!validation.allow_empty_value) {
                                    result = ['string_empty'];
                                }
                                break;
                            }
                            if (validation.min !== undefined) {
                                if (tempValue[j].length < parseInt(validation.min)) {
                                    result = [this.getValidationMessage(validation, 'min', 'string_exceed_min_length'), validation.min];
                                    break;
                                }
                            }
                            if (validation.max !== undefined) {
                                if (tempValue[j].length > parseInt(validation.max)) {
                                    result = [this.getValidationMessage(validation, 'max', 'string_exceed_max_length'), validation.max];
                                    break;
                                }
                            }
                            if (validation.format) {
                                if (typeof validation.format == 'string') {
                                    validation.format = new RegExp(validation.format);
                                }
                                if (!validation.format.test(tempValue[j])) {
                                    result = [this.getValidationMessage(validation, 'format', 'string_invalid_format'), validation.format];
                                    break;
                                }
                            }
                            break;

                        case 'number':
                            if (tempValue[j] === undefined || tempValue[j].length === 0) {
                                if (!validation.allow_empty_value) {
                                    result = ['number_nan'];
                                }
                                break;
                            }
                            if (isNaN(tempValue[j])) {
                                result = ['number_nan'];
                                break;
                            }
                            if (filter.type == 'integer') {
                                if (parseInt(tempValue[j]) != tempValue[j]) {
                                    result = ['number_not_integer'];
                                    break;
                                }
                            }
                            else {
                                if (parseFloat(tempValue[j]) != tempValue[j]) {
                                    result = ['number_not_double'];
                                    break;
                                }
                            }
                            if (validation.min !== undefined) {
                                if (tempValue[j] < parseFloat(validation.min)) {
                                    result = [this.getValidationMessage(validation, 'min', 'number_exceed_min'), validation.min];
                                    break;
                                }
                            }
                            if (validation.max !== undefined) {
                                if (tempValue[j] > parseFloat(validation.max)) {
                                    result = [this.getValidationMessage(validation, 'max', 'number_exceed_max'), validation.max];
                                    break;
                                }
                            }
                            if (validation.step !== undefined && validation.step !== 'any') {
                                var v = (tempValue[j] / validation.step).toPrecision(14);
                                if (parseInt(v) != v) {
                                    result = [this.getValidationMessage(validation, 'step', 'number_wrong_step'), validation.step];
                                    break;
                                }
                            }
                            break;

                        case 'datetime':
                            if (tempValue[j] === undefined || tempValue[j].length === 0) {
                                if (!validation.allow_empty_value) {
                                    result = ['datetime_empty'];
                                }
                                break;
                            }

                            // we need MomentJS
                            if (validation.format) {
                                if (!('moment' in window)) {
                                    Utils.error('MissingLibrary', 'MomentJS is required for Date/Time validation. Get it here http://momentjs.com');
                                }

                                var datetime = moment(tempValue[j], validation.format);
                                if (!datetime.isValid()) {
                                    result = [this.getValidationMessage(validation, 'format', 'datetime_invalid'), validation.format];
                                    break;
                                }
                                else {
                                    if (validation.min) {
                                        if (datetime < moment(validation.min, validation.format)) {
                                            result = [this.getValidationMessage(validation, 'min', 'datetime_exceed_min'), validation.min];
                                            break;
                                        }
                                    }
                                    if (validation.max) {
                                        if (datetime > moment(validation.max, validation.format)) {
                                            result = [this.getValidationMessage(validation, 'max', 'datetime_exceed_max'), validation.max];
                                            break;
                                        }
                                    }
                                }
                            }
                            break;

                        case 'boolean':
                            if (tempValue[j] === undefined || tempValue[j].length === 0) {
                                if (!validation.allow_empty_value) {
                                    result = ['boolean_not_valid'];
                                }
                                break;
                            }
                            tmp = ('' + tempValue[j]).trim().toLowerCase();
                            if (tmp !== 'true' && tmp !== 'false' && tmp !== '1' && tmp !== '0' && tempValue[j] !== 1 && tempValue[j] !== 0) {
                                result = ['boolean_not_valid'];
                                break;
                            }
                    }

                    if (result !== true) {
                        break;
                    }
                }
        }

        if (result !== true) {
            break;
        }
    }

    return result;
};

/**
 * Returns an incremented group ID
 * @returns {string}
 * @private
 */
QueryBuilder.prototype.nextGroupId = function() {
    return this.status.id + '_group_' + (this.status.group_id++);
};

/**
 * Returns an incremented rule ID
 * @returns {string}
 * @private
 */
QueryBuilder.prototype.nextRuleId = function() {
    return this.status.id + '_rule_' + (this.status.rule_id++);
};

/**
 * Returns the operators for a filter
 * @param {string|object} filter - filter id or filter object
 * @returns {object[]}
 * @fires QueryBuilder.changer:getOperators
 * @private
 */
QueryBuilder.prototype.getOperators = function(filter) {
    if (typeof filter == 'string') {
        filter = this.getFilterById(filter);
    }

    var result = [];

    for (var i = 0, l = this.operators.length; i < l; i++) {
        // filter operators check
        if (filter.operators) {
            if (filter.operators.indexOf(this.operators[i].type) == -1) {
                continue;
            }
        }
        // type check
        else if (this.operators[i].apply_to.indexOf(QueryBuilder.types[filter.type]) == -1) {
            continue;
        }

        result.push(this.operators[i]);
    }

    // keep sort order defined for the filter
    if (filter.operators) {
        result.sort(function(a, b) {
            return filter.operators.indexOf(a.type) - filter.operators.indexOf(b.type);
        });
    }

    /**
     * Modifies the operators available for a filter
     * @event changer:getOperators
     * @memberof QueryBuilder
     * @param {QueryBuilder.Operator[]} operators
     * @param {QueryBuilder.Filter} filter
     * @returns {QueryBuilder.Operator[]}
     */
    return this.change('getOperators', result, filter);
};

/**
 * Returns a particular filter by its id
 * @param {string} id
 * @param {boolean} [doThrow=true]
 * @returns {object|null}
 * @throws UndefinedFilterError
 * @private
 */
QueryBuilder.prototype.getFilterById = function(id, doThrow) {
    if (id == '-1') {
        return null;
    }

    for (var i = 0, l = this.filters.length; i < l; i++) {
        if (this.filters[i].id == id) {
            return this.filters[i];
        }
    }

    Utils.error(doThrow !== false, 'UndefinedFilter', 'Undefined filter "{0}"', id);

    return null;
};

/**
 * Returns a particular operator by its type
 * @param {string} type
 * @param {boolean} [doThrow=true]
 * @returns {object|null}
 * @throws UndefinedOperatorError
 * @private
 */
QueryBuilder.prototype.getOperatorByType = function(type, doThrow) {
    if (type == '-1') {
        return null;
    }

    for (var i = 0, l = this.operators.length; i < l; i++) {
        if (this.operators[i].type == type) {
            return this.operators[i];
        }
    }

    Utils.error(doThrow !== false, 'UndefinedOperator', 'Undefined operator "{0}"', type);

    return null;
};

/**
 * Returns rule's current input value
 * @param {Rule} rule
 * @returns {*}
 * @fires QueryBuilder.changer:getRuleValue
 * @private
 */
QueryBuilder.prototype.getRuleInputValue = function(rule) {
    var filter = rule.filter;
    var operator = rule.operator;
    var value = [];

    if (filter.valueGetter) {
        value = filter.valueGetter.call(this, rule);
    }
    else {
        var $value = rule.$el.find(QueryBuilder.selectors.value_container);

        for (var i = 0; i < operator.nb_inputs; i++) {
            var name = Utils.escapeElementId(rule.id + '_value_' + i);
            var tmp;

            switch (filter.input) {
                case 'radio':
                    value.push($value.find('[name=' + name + ']:checked').val());
                    break;

                case 'checkbox':
                    tmp = [];
                    // jshint loopfunc:true
                    $value.find('[name=' + name + ']:checked').each(function() {
                        tmp.push($(this).val());
                    });
                    // jshint loopfunc:false
                    value.push(tmp);
                    break;

                case 'select':
                    if (filter.multiple) {
                        tmp = [];
                        // jshint loopfunc:true
                        $value.find('[name=' + name + '] option:selected').each(function() {
                            tmp.push($(this).val());
                        });
                        // jshint loopfunc:false
                        value.push(tmp);
                    }
                    else {
                        value.push($value.find('[name=' + name + '] option:selected').val());
                    }
                    break;

                default:
                    value.push($value.find('[name=' + name + ']').val());
            }
        }

        if (operator.multiple && filter.value_separator) {
            value = value.map(function(val) {
                return val.split(filter.value_separator);
            });
        }

        if (operator.nb_inputs === 1) {
            value = value[0];
        }

        // @deprecated
        if (filter.valueParser) {
            value = filter.valueParser.call(this, rule, value);
        }
    }

    /**
     * Modifies the rule's value grabbed from the DOM
     * @event changer:getRuleValue
     * @memberof QueryBuilder
     * @param {*} value
     * @param {Rule} rule
     * @returns {*}
     */
    return this.change('getRuleValue', value, rule);
};

/**
 * Sets the value of a rule's input
 * @param {Rule} rule
 * @param {*} value
 * @private
 */
QueryBuilder.prototype.setRuleInputValue = function(rule, value) {
    var filter = rule.filter;
    var operator = rule.operator;

    if (!filter || !operator) {
        return;
    }

    this._updating_input = true;

    if (filter.valueSetter) {
        filter.valueSetter.call(this, rule, value);
    }
    else {
        var $value = rule.$el.find(QueryBuilder.selectors.value_container);

        if (operator.nb_inputs == 1) {
            value = [value];
        }

        for (var i = 0; i < operator.nb_inputs; i++) {
            var name = Utils.escapeElementId(rule.id + '_value_' + i);

            switch (filter.input) {
                case 'radio':
                    $value.find('[name=' + name + '][value="' + value[i] + '"]').prop('checked', true).trigger('change');
                    break;

                case 'checkbox':
                    if (!$.isArray(value[i])) {
                        value[i] = [value[i]];
                    }
                    // jshint loopfunc:true
                    value[i].forEach(function(value) {
                        $value.find('[name=' + name + '][value="' + value + '"]').prop('checked', true).trigger('change');
                    });
                    // jshint loopfunc:false
                    break;

                default:
                    if (operator.multiple && filter.value_separator && $.isArray(value[i])) {
                        value[i] = value[i].join(filter.value_separator);
                    }
                    $value.find('[name=' + name + ']').val(value[i]).trigger('change');
                    break;
            }
        }
    }

    this._updating_input = false;
};

/**
 * Parses rule flags
 * @param {object} rule
 * @returns {object}
 * @fires QueryBuilder.changer:parseRuleFlags
 * @private
 */
QueryBuilder.prototype.parseRuleFlags = function(rule) {
    var flags = $.extend({}, this.settings.default_rule_flags);

    if (rule.readonly) {
        $.extend(flags, {
            filter_readonly: true,
            operator_readonly: true,
            value_readonly: true,
            no_delete: true
        });
    }

    if (rule.flags) {
        $.extend(flags, rule.flags);
    }

    /**
     * Modifies the consolidated rule's flags
     * @event changer:parseRuleFlags
     * @memberof QueryBuilder
     * @param {object} flags
     * @param {object} rule - <b>not</b> a Rule object
     * @returns {object}
     */
    return this.change('parseRuleFlags', flags, rule);
};

/**
 * Gets a copy of flags of a rule
 * @param {object} flags
 * @param {boolean} [all=false] - return all flags or only changes from default flags
 * @returns {object}
 * @private
 */
QueryBuilder.prototype.getRuleFlags = function(flags, all) {
    if (all) {
        return $.extend({}, flags);
    }
    else {
        var ret = {};
        $.each(this.settings.default_rule_flags, function(key, value) {
            if (flags[key] !== value) {
                ret[key] = flags[key];
            }
        });
        return ret;
    }
};

/**
 * Parses group flags
 * @param {object} group
 * @returns {object}
 * @fires QueryBuilder.changer:parseGroupFlags
 * @private
 */
QueryBuilder.prototype.parseGroupFlags = function(group) {
    var flags = $.extend({}, this.settings.default_group_flags);

    if (group.readonly) {
        $.extend(flags, {
            condition_readonly: true,
            no_add_rule: true,
            no_add_group: true,
            no_delete: true
        });
    }

    if (group.flags) {
        $.extend(flags, group.flags);
    }

    /**
     * Modifies the consolidated group's flags
     * @event changer:parseGroupFlags
     * @memberof QueryBuilder
     * @param {object} flags
     * @param {object} group - <b>not</b> a Group object
     * @returns {object}
     */
    return this.change('parseGroupFlags', flags, group);
};

/**
 * Gets a copy of flags of a group
 * @param {object} flags
 * @param {boolean} [all=false] - return all flags or only changes from default flags
 * @returns {object}
 * @private
 */
QueryBuilder.prototype.getGroupFlags = function(flags, all) {
    if (all) {
        return $.extend({}, flags);
    }
    else {
        var ret = {};
        $.each(this.settings.default_group_flags, function(key, value) {
            if (flags[key] !== value) {
                ret[key] = flags[key];
            }
        });
        return ret;
    }
};

/**
 * Translate a label either by looking in the `lang` object or in itself if it's an object where keys are language codes
 * @param {string} [category]
 * @param {string|object} key
 * @returns {string}
 * @fires QueryBuilder.changer:translate
 */
QueryBuilder.prototype.translate = function(category, key) {
    if (!key) {
        key = category;
        category = undefined;
    }

    var translation;
    if (typeof key === 'object') {
        translation = key[this.settings.lang_code] || key['en'];
    }
    else {
        translation = (category ? this.lang[category] : this.lang)[key] || key;
    }

    /**
     * Modifies the translated label
     * @event changer:translate
     * @memberof QueryBuilder
     * @param {string} translation
     * @param {string|object} key
     * @param {string} [category]
     * @returns {string}
     */
    return this.change('translate', translation, key, category);
};

/**
 * Returns a validation message
 * @param {object} validation
 * @param {string} type
 * @param {string} def
 * @returns {string}
 * @private
 */
QueryBuilder.prototype.getValidationMessage = function(validation, type, def) {
    return validation.messages && validation.messages[type] || def;
};


QueryBuilder.templates.group = '\
<dl id="{{= it.group_id }}" class="rules-group-container"> \
  <dt class="rules-group-header"> \
    <div class="btn-group pull-right group-actions"> \
      <button type="button" class="btn btn-xs btn-success" data-add="rule"> \
        <i class="material-icons">add_circle_outline</i> {{= it.translate("add_rule") }} \
      </button> \
      {{? it.settings.allow_groups===-1 || it.settings.allow_groups>=it.level }} \
        <button type="button" class="btn btn-xs btn-success" data-add="group"> \
          <i class="material-icons">add_circle_outline</i> {{= it.translate("add_group") }} \
        </button> \
      {{?}} \
      {{? it.level>1 }} \
        <button type="button" class="btn btn-xs btn-danger" data-delete="group"> \
          <i class="material-icons">delete</i> {{= it.translate("delete_group") }} \
        </button> \
      {{?}} \
    </div> \
    <div class="btn-group group-conditions"> \
      {{~ it.conditions: condition }} \
        <label class="btn btn-xs btn-primary"> \
          <input type="radio" name="{{= it.group_id }}_cond" value="{{= condition }}"> {{= it.translate("conditions", condition) }} \
        </label> \
      {{~}} \
    </div> \
    {{? it.settings.display_errors }} \
      <div class="error-container"><i class="material-icons">error_outline</i></div> \
    {{?}} \
  </dt> \
  <dd class=rules-group-body> \
    <ul class=rules-list></ul> \
  </dd> \
</dl>';

QueryBuilder.templates.rule = '\
<li id="{{= it.rule_id }}" class="rule-container"> \
  <div class="rule-header"> \
    <div class="btn-group pull-right rule-actions"> \
      <button type="button" class="btn btn-xs btn-danger" data-delete="rule"> \
        <i class="material-icons">delete</i> {{= it.translate("delete_rule") }} \
      </button> \
    </div> \
  </div> \
  {{? it.settings.display_errors }} \
    <div class="error-container"><i class="material-icons">error_outline</i></div> \
  {{?}} \
  <div class="rule-filter-container"></div> \
  <div class="rule-operator-container"></div> \
  <div class="rule-value-container"></div> \
</li>';

QueryBuilder.templates.filterSelect = '\
{{ var optgroup = null; }} \
<select class="form-control" name="{{= it.rule.id }}_filter"> \
  {{? it.settings.display_empty_filter }} \
    <option value="-1">{{= it.settings.select_placeholder }}</option> \
  {{?}} \
  {{~ it.filters: filter }} \
    {{? optgroup !== filter.optgroup }} \
      {{? optgroup !== null }}</optgroup>{{?}} \
      {{? (optgroup = filter.optgroup) !== null }} \
        <optgroup label="{{= it.translate(it.settings.optgroups[optgroup]) }}"> \
      {{?}} \
    {{?}} \
    <option value="{{= filter.id }}">{{= it.translate(filter.label) }}</option> \
  {{~}} \
  {{? optgroup !== null }}</optgroup>{{?}} \
</select>';

QueryBuilder.templates.operatorSelect = '\
{{? it.operators.length === 1 }} \
<span> \
{{= it.translate("operators", it.operators[0].type) }} \
</span> \
{{?}} \
{{ var optgroup = null; }} \
<select class="form-control {{? it.operators.length === 1 }}hide{{?}}" name="{{= it.rule.id }}_operator"> \
  {{~ it.operators: operator }} \
    {{? optgroup !== operator.optgroup }} \
      {{? optgroup !== null }}</optgroup>{{?}} \
      {{? (optgroup = operator.optgroup) !== null }} \
        <optgroup label="{{= it.translate(it.settings.optgroups[optgroup]) }}"> \
      {{?}} \
    {{?}} \
    <option value="{{= operator.type }}">{{= it.translate("operators", operator.type) }}</option> \
  {{~}} \
  {{? optgroup !== null }}</optgroup>{{?}} \
</select>';

/**
 * Returns group's HTML
 * @param {string} group_id
 * @param {int} level
 * @returns {string}
 * @fires QueryBuilder.changer:getGroupTemplate
 * @private
 */
QueryBuilder.prototype.getGroupTemplate = function(group_id, level) {
    var h = this.templates.group({
        builder: this,
        group_id: group_id,
        level: level,
        conditions: this.settings.conditions,
        icons: this.icons,
        settings: this.settings,
        translate: this.translate.bind(this)
    });

    /**
     * Modifies the raw HTML of a group
     * @event changer:getGroupTemplate
     * @memberof QueryBuilder
     * @param {string} html
     * @param {int} level
     * @returns {string}
     */
    return this.change('getGroupTemplate', h, level);
};

/**
 * Returns rule's HTML
 * @param {string} rule_id
 * @returns {string}
 * @fires QueryBuilder.changer:getRuleTemplate
 * @private
 */
QueryBuilder.prototype.getRuleTemplate = function(rule_id) {
    var h = this.templates.rule({
        builder: this,
        rule_id: rule_id,
        icons: this.icons,
        settings: this.settings,
        translate: this.translate.bind(this)
    });

    /**
     * Modifies the raw HTML of a rule
     * @event changer:getRuleTemplate
     * @memberof QueryBuilder
     * @param {string} html
     * @returns {string}
     */
    return this.change('getRuleTemplate', h);
};

/**
 * Returns rule's filter HTML
 * @param {Rule} rule
 * @param {object[]} filters
 * @returns {string}
 * @fires QueryBuilder.changer:getRuleFilterTemplate
 * @private
 */
QueryBuilder.prototype.getRuleFilterSelect = function(rule, filters) {
    var h = this.templates.filterSelect({
        builder: this,
        rule: rule,
        filters: filters,
        icons: this.icons,
        settings: this.settings,
        translate: this.translate.bind(this)
    });

    /**
     * Modifies the raw HTML of the rule's filter dropdown
     * @event changer:getRuleFilterSelect
     * @memberof QueryBuilder
     * @param {string} html
     * @param {Rule} rule
     * @param {QueryBuilder.Filter[]} filters
     * @returns {string}
     */
    return this.change('getRuleFilterSelect', h, rule, filters);
};

/**
 * Returns rule's operator HTML
 * @param {Rule} rule
 * @param {object[]} operators
 * @returns {string}
 * @fires QueryBuilder.changer:getRuleOperatorTemplate
 * @private
 */
QueryBuilder.prototype.getRuleOperatorSelect = function(rule, operators) {
    var h = this.templates.operatorSelect({
        builder: this,
        rule: rule,
        operators: operators,
        icons: this.icons,
        settings: this.settings,
        translate: this.translate.bind(this)
    });

    /**
     * Modifies the raw HTML of the rule's operator dropdown
     * @event changer:getRuleOperatorSelect
     * @memberof QueryBuilder
     * @param {string} html
     * @param {Rule} rule
     * @param {QueryBuilder.Operator[]} operators
     * @returns {string}
     */
    return this.change('getRuleOperatorSelect', h, rule, operators);
};

/**
 * Returns the rule's value HTML
 * @param {Rule} rule
 * @param {int} value_id
 * @returns {string}
 * @fires QueryBuilder.changer:getRuleInput
 * @private
 */
QueryBuilder.prototype.getRuleInput = function(rule, value_id) {
    var filter = rule.filter;
    var validation = rule.filter.validation || {};
    var name = rule.id + '_value_' + value_id;
    var c = filter.vertical ? ' class=block' : '';
    var h = '';

    if (typeof filter.input == 'function') {
        h = filter.input.call(this, rule, name);
    }
    else {
        var placeholder = filter.placeholder;
        var placeholder_value = filter.placeholder_value;

        if (placeholder instanceof Array) {
            placeholder = placeholder[value_id];
        }
        if (placeholder_value instanceof Array) {
            placeholder_value = placeholder_value[value_id];
        }

        switch (filter.input) {
            case 'radio':
            case 'checkbox':
                Utils.iterateOptions(filter.values, function(key, val) {
                    h += '<label' + c + '><input type="' + filter.input + '" name="' + name + '" value="' + key + '"> ' + val + '</label> ';
                });
                break;

            case 'select':
                h += '<select class="form-control" name="' + name + '"' + (filter.multiple ? ' multiple' : '') + '>';
                if (placeholder) {
                    h += '<option value="' + placeholder_value + '" disabled selected>' + placeholder + '</option>';
                }
                Utils.iterateOptions(filter.values, function(key, val) {
                    h += '<option value="' + key + '">' + val + '</option> ';
                });
                h += '</select>';
                break;

            case 'textarea':
                h += '<textarea class="form-control" name="' + name + '"';
                if (filter.size) h += ' cols="' + filter.size + '"';
                if (filter.rows) h += ' rows="' + filter.rows + '"';
                if (validation.min !== undefined) h += ' minlength="' + validation.min + '"';
                if (validation.max !== undefined) h += ' maxlength="' + validation.max + '"';
                if (placeholder) h += ' placeholder="' + placeholder + '"';
                h += '></textarea>';
                break;

            case 'number':
                h += '<input class="form-control" type="number" name="' + name + '"';
                if (validation.step !== undefined) h += ' step="' + validation.step + '"';
                if (validation.min !== undefined) h += ' min="' + validation.min + '"';
                if (validation.max !== undefined) h += ' max="' + validation.max + '"';
                if (placeholder) h += ' placeholder="' + placeholder + '"';
                if (filter.size) h += ' size="' + filter.size + '"';
                h += '>';
                break;

            default:
                h += '<input class="form-control" type="text" name="' + name + '"';
                if (placeholder) h += ' placeholder="' + placeholder + '"';
                if (filter.type === 'string' && validation.min !== undefined) h += ' minlength="' + validation.min + '"';
                if (filter.type === 'string' && validation.max !== undefined) h += ' maxlength="' + validation.max + '"';
                if (filter.size) h += ' size="' + filter.size + '"';
                h += '>';
        }
    }

    /**
     * Modifies the raw HTML of the rule's input
     * @event changer:getRuleInput
     * @memberof QueryBuilder
     * @param {string} html
     * @param {Rule} rule
     * @param {string} name - the name that the input must have
     * @returns {string}
     */
    return this.change('getRuleInput', h, rule, name);
};


/**
 * @namespace
 */
var Utils = {};

/**
 * @member {object}
 * @memberof QueryBuilder
 * @see Utils
 */
QueryBuilder.utils = Utils;

/**
 * @callback Utils#OptionsIteratee
 * @param {string} key
 * @param {string} value
 */

/**
 * Iterates over radio/checkbox/selection options, it accept three formats
 *
 * @example
 * // array of values
 * options = ['one', 'two', 'three']
 * @example
 * // simple key-value map
 * options = {1: 'one', 2: 'two', 3: 'three'}
 * @example
 * // array of 1-element maps
 * options = [{1: 'one'}, {2: 'two'}, {3: 'three'}]
 *
 * @param {object|array} options
 * @param {Utils#OptionsIteratee} tpl
 */
Utils.iterateOptions = function(options, tpl) {
    if (options) {
        if ($.isArray(options)) {
            options.forEach(function(entry) {
                // array of one-element maps
                if ($.isPlainObject(entry)) {
                    $.each(entry, function(key, val) {
                        tpl(key, val);
                        return false; // break after first entry
                    });
                }
                // array of values
                else {
                    tpl(entry, entry);
                }
            });
        }
        // unordered map
        else {
            $.each(options, function(key, val) {
                tpl(key, val);
            });
        }
    }
};

/**
 * Replaces {0}, {1}, ... in a string
 * @param {string} str
 * @param {...*} args
 * @returns {string}
 */
Utils.fmt = function(str, args) {
    if (!Array.isArray(args)) {
        args = Array.prototype.slice.call(arguments, 1);
    }

    return str.replace(/{([0-9]+)}/g, function(m, i) {
        return args[parseInt(i)];
    });
};

/**
 * Throws an Error object with custom name or logs an error
 * @param {boolean} [doThrow=true]
 * @param {string} type
 * @param {string} message
 * @param {...*} args
 */
Utils.error = function() {
    var i = 0;
    var doThrow = typeof arguments[i] === 'boolean' ? arguments[i++] : true;
    var type = arguments[i++];
    var message = arguments[i++];
    var args = Array.isArray(arguments[i]) ? arguments[i] : Array.prototype.slice.call(arguments, i);

    if (doThrow) {
        var err = new Error(Utils.fmt(message, args));
        err.name = type + 'Error';
        err.args = args;
        throw err;
    }
    else {
        console.error(type + 'Error: ' + Utils.fmt(message, args));
    }
};

/**
 * Changes the type of a value to int, float or bool
 * @param {*} value
 * @param {string} type - 'integer', 'double', 'boolean' or anything else (passthrough)
 * @param {boolean} [boolAsInt=false] - return 0 or 1 for booleans
 * @returns {*}
 */
Utils.changeType = function(value, type, boolAsInt) {
    switch (type) {
        // @formatter:off
    case 'integer': return parseInt(value);
    case 'double': return parseFloat(value);
    case 'boolean':
        var bool = value.trim().toLowerCase() === 'true' || value.trim() === '1' || value === 1;
        return boolAsInt ? (bool ? 1 : 0) : bool;
    default: return value;
    // @formatter:on
    }
};

/**
 * Escapes a string like PHP's mysql_real_escape_string does
 * @param {string} value
 * @returns {string}
 */
Utils.escapeString = function(value) {
    if (typeof value != 'string') {
        return value;
    }

    return value
        .replace(/[\0\n\r\b\\\'\"]/g, function(s) {
            switch (s) {
                // @formatter:off
            case '\0': return '\\0';
            case '\n': return '\\n';
            case '\r': return '\\r';
            case '\b': return '\\b';
            default:   return '\\' + s;
            // @formatter:off
            }
        })
        // uglify compliant
        .replace(/\t/g, '\\t')
        .replace(/\x1a/g, '\\Z');
};

/**
 * Escapes a string for use in regex
 * @param {string} str
 * @returns {string}
 */
Utils.escapeRegExp = function(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
};

/**
 * Escapes a string for use in HTML element id
 * @param {string} str
 * @returns {string}
 */
Utils.escapeElementId = function(str) {
    // Regex based on that suggested by:
    // https://learn.jquery.com/using-jquery-core/faq/how-do-i-select-an-element-by-an-id-that-has-characters-used-in-css-notation/
    // - escapes : . [ ] ,
    // - avoids escaping already escaped values
    return (str) ? str.replace(/(\\)?([:.\[\],])/g,
            function( $0, $1, $2 ) { return $1 ? $0 : '\\' + $2; }) : str;
};

/**
 * Sorts objects by grouping them by `key`, preserving initial order when possible
 * @param {object[]} items
 * @param {string} key
 * @returns {object[]}
 */
Utils.groupSort = function(items, key) {
    var optgroups = [];
    var newItems = [];

    items.forEach(function(item) {
        var idx;

        if (item[key]) {
            idx = optgroups.lastIndexOf(item[key]);

            if (idx == -1) {
                idx = optgroups.length;
            }
            else {
                idx++;
            }
        }
        else {
            idx = optgroups.length;
        }

        optgroups.splice(idx, 0, item[key]);
        newItems.splice(idx, 0, item);
    });

    return newItems;
};

/**
 * Defines properties on an Node prototype with getter and setter.<br>
 *     Update events are emitted in the setter through root Model (if any).<br>
 *     The object must have a `__` object, non enumerable property to store values.
 * @param {function} obj
 * @param {string[]} fields
 */
Utils.defineModelProperties = function(obj, fields) {
    fields.forEach(function(field) {
        Object.defineProperty(obj.prototype, field, {
            enumerable: true,
            get: function() {
                return this.__[field];
            },
            set: function(value) {
                var previousValue = (this.__[field] !== null && typeof this.__[field] == 'object') ?
                    $.extend({}, this.__[field]) :
                    this.__[field];

                this.__[field] = value;

                if (this.model !== null) {
                    /**
                     * After a value of the model changed
                     * @event model:update
                     * @memberof Model
                     * @param {Node} node
                     * @param {string} field
                     * @param {*} value
                     * @param {*} previousValue
                     */
                    this.model.trigger('update', this, field, value, previousValue);
                }
            }
        });
    });
};


/**
 * Main object storing data model and emitting model events
 * @constructor
 */
function Model() {
    /**
     * @member {Group}
     * @readonly
     */
    this.root = null;

    /**
     * Base for event emitting
     * @member {jQuery}
     * @readonly
     * @private
     */
    this.$ = $(this);
}

$.extend(Model.prototype, /** @lends Model.prototype */ {
    /**
     * Triggers an event on the model
     * @param {string} type
     * @returns {$.Event}
     */
    trigger: function(type) {
        var event = new $.Event(type);
        this.$.triggerHandler(event, Array.prototype.slice.call(arguments, 1));
        return event;
    },

    /**
     * Attaches an event listener on the model
     * @param {string} type
     * @param {function} cb
     * @returns {Model}
     */
    on: function() {
        this.$.on.apply(this.$, Array.prototype.slice.call(arguments));
        return this;
    },

    /**
     * Removes an event listener from the model
     * @param {string} type
     * @param {function} [cb]
     * @returns {Model}
     */
    off: function() {
        this.$.off.apply(this.$, Array.prototype.slice.call(arguments));
        return this;
    },

    /**
     * Attaches an event listener called once on the model
     * @param {string} type
     * @param {function} cb
     * @returns {Model}
     */
    once: function() {
        this.$.one.apply(this.$, Array.prototype.slice.call(arguments));
        return this;
    }
});


/**
 * Root abstract object
 * @constructor
 * @param {Node} [parent]
 * @param {jQuery} $el
 */
var Node = function(parent, $el) {
    if (!(this instanceof Node)) {
        return new Node(parent, $el);
    }

    Object.defineProperty(this, '__', { value: {} });

    $el.data('queryBuilderModel', this);

    /**
     * @name level
     * @member {int}
     * @memberof Node
     * @instance
     * @readonly
     */
    this.__.level = 1;

    /**
     * @name error
     * @member {string}
     * @memberof Node
     * @instance
     */
    this.__.error = null;

    /**
     * @name flags
     * @member {object}
     * @memberof Node
     * @instance
     * @readonly
     */
    this.__.flags = {};

    /**
     * @name data
     * @member {object}
     * @memberof Node
     * @instance
     */
    this.__.data = undefined;

    /**
     * @member {jQuery}
     * @readonly
     */
    this.$el = $el;

    /**
     * @member {string}
     * @readonly
     */
    this.id = $el[0].id;

    /**
     * @member {Model}
     * @readonly
     */
    this.model = null;

    /**
     * @member {Group}
     * @readonly
     */
    this.parent = parent;
};

Utils.defineModelProperties(Node, ['level', 'error', 'data', 'flags']);

Object.defineProperty(Node.prototype, 'parent', {
    enumerable: true,
    get: function() {
        return this.__.parent;
    },
    set: function(value) {
        this.__.parent = value;
        this.level = value === null ? 1 : value.level + 1;
        this.model = value === null ? null : value.model;
    }
});

/**
 * Checks if this Node is the root
 * @returns {boolean}
 */
Node.prototype.isRoot = function() {
    return (this.level === 1);
};

/**
 * Returns the node position inside its parent
 * @returns {int}
 */
Node.prototype.getPos = function() {
    if (this.isRoot()) {
        return -1;
    }
    else {
        return this.parent.getNodePos(this);
    }
};

/**
 * Deletes self
 * @fires Model.model:drop
 */
Node.prototype.drop = function() {
    var model = this.model;

    if (!!this.parent) {
        this.parent.removeNode(this);
    }

    this.$el.removeData('queryBuilderModel');

    if (model !== null) {
        /**
         * After a node of the model has been removed
         * @event model:drop
         * @memberof Model
         * @param {Node} node
         */
        model.trigger('drop', this);
    }
};

/**
 * Moves itself after another Node
 * @param {Node} target
 * @fires Model.model:move
 */
Node.prototype.moveAfter = function(target) {
    if (!this.isRoot()) {
        this.move(target.parent, target.getPos() + 1);
    }
};

/**
 * Moves itself at the beginning of parent or another Group
 * @param {Group} [target]
 * @fires Model.model:move
 */
Node.prototype.moveAtBegin = function(target) {
    if (!this.isRoot()) {
        if (target === undefined) {
            target = this.parent;
        }

        this.move(target, 0);
    }
};

/**
 * Moves itself at the end of parent or another Group
 * @param {Group} [target]
 * @fires Model.model:move
 */
Node.prototype.moveAtEnd = function(target) {
    if (!this.isRoot()) {
        if (target === undefined) {
            target = this.parent;
        }

        this.move(target, target.length() === 0 ? 0 : target.length() - 1);
    }
};

/**
 * Moves itself at specific position of Group
 * @param {Group} target
 * @param {int} index
 * @fires Model.model:move
 */
Node.prototype.move = function(target, index) {
    if (!this.isRoot()) {
        if (typeof target === 'number') {
            index = target;
            target = this.parent;
        }

        this.parent.removeNode(this);
        target.insertNode(this, index, false);

        if (this.model !== null) {
            /**
             * After a node of the model has been moved
             * @event model:move
             * @memberof Model
             * @param {Node} node
             * @param {Node} target
             * @param {int} index
             */
            this.model.trigger('move', this, target, index);
        }
    }
};


/**
 * Group object
 * @constructor
 * @extends Node
 * @param {Group} [parent]
 * @param {jQuery} $el
 */
var Group = function(parent, $el) {
    if (!(this instanceof Group)) {
        return new Group(parent, $el);
    }

    Node.call(this, parent, $el);

    /**
     * @member {object[]}
     * @readonly
     */
    this.rules = [];

    /**
     * @name condition
     * @member {string}
     * @memberof Group
     * @instance
     */
    this.__.condition = null;
};

Group.prototype = Object.create(Node.prototype);
Group.prototype.constructor = Group;

Utils.defineModelProperties(Group, ['condition']);

/**
 * Removes group's content
 */
Group.prototype.empty = function() {
    this.each('reverse', function(rule) {
        rule.drop();
    }, function(group) {
        group.drop();
    });
};

/**
 * Deletes self
 */
Group.prototype.drop = function() {
    this.empty();
    Node.prototype.drop.call(this);
};

/**
 * Returns the number of children
 * @returns {int}
 */
Group.prototype.length = function() {
    return this.rules.length;
};

/**
 * Adds a Node at specified index
 * @param {Node} node
 * @param {int} [index=end]
 * @param {boolean} [trigger=false] - fire 'add' event
 * @returns {Node} the inserted node
 * @fires Model.model:add
 */
Group.prototype.insertNode = function(node, index, trigger) {
    if (index === undefined) {
        index = this.length();
    }

    this.rules.splice(index, 0, node);
    node.parent = this;

    if (trigger && this.model !== null) {
        /**
         * After a node of the model has been added
         * @event model:add
         * @memberof Model
         * @param {Node} parent
         * @param {Node} node
         * @param {int} index
         */
        this.model.trigger('add', this, node, index);
    }

    return node;
};

/**
 * Adds a new Group at specified index
 * @param {jQuery} $el
 * @param {int} [index=end]
 * @returns {Group}
 * @fires Model.model:add
 */
Group.prototype.addGroup = function($el, index) {
    return this.insertNode(new Group(this, $el), index, true);
};

/**
 * Adds a new Rule at specified index
 * @param {jQuery} $el
 * @param {int} [index=end]
 * @returns {Rule}
 * @fires Model.model:add
 */
Group.prototype.addRule = function($el, index) {
    return this.insertNode(new Rule(this, $el), index, true);
};

/**
 * Deletes a specific Node
 * @param {Node} node
 */
Group.prototype.removeNode = function(node) {
    var index = this.getNodePos(node);
    if (index !== -1) {
        node.parent = null;
        this.rules.splice(index, 1);
    }
};

/**
 * Returns the position of a child Node
 * @param {Node} node
 * @returns {int}
 */
Group.prototype.getNodePos = function(node) {
    return this.rules.indexOf(node);
};

/**
 * @callback Model#GroupIteratee
 * @param {Node} node
 * @returns {boolean} stop the iteration
 */

/**
 * Iterate over all Nodes
 * @param {boolean} [reverse=false] - iterate in reverse order, required if you delete nodes
 * @param {Model#GroupIteratee} cbRule - callback for Rules (can be `null` but not omitted)
 * @param {Model#GroupIteratee} [cbGroup] - callback for Groups
 * @param {object} [context] - context for callbacks
 * @returns {boolean} if the iteration has been stopped by a callback
 */
Group.prototype.each = function(reverse, cbRule, cbGroup, context) {
    if (typeof reverse !== 'boolean' && typeof reverse !== 'string') {
        context = cbGroup;
        cbGroup = cbRule;
        cbRule = reverse;
        reverse = false;
    }
    context = context === undefined ? null : context;

    var i = reverse ? this.rules.length - 1 : 0;
    var l = reverse ? 0 : this.rules.length - 1;
    var c = reverse ? -1 : 1;
    var next = function() {
        return reverse ? i >= l : i <= l;
    };
    var stop = false;

    for (; next(); i += c) {
        if (this.rules[i] instanceof Group) {
            if (!!cbGroup) {
                stop = cbGroup.call(context, this.rules[i]) === false;
            }
        }
        else if (!!cbRule) {
            stop = cbRule.call(context, this.rules[i]) === false;
        }

        if (stop) {
            break;
        }
    }

    return !stop;
};

/**
 * Checks if the group contains a particular Node
 * @param {Node} node
 * @param {boolean} [recursive=false]
 * @returns {boolean}
 */
Group.prototype.contains = function(node, recursive) {
    if (this.getNodePos(node) !== -1) {
        return true;
    }
    else if (!recursive) {
        return false;
    }
    else {
        // the loop will return with false as soon as the Node is found
        return !this.each(function() {
            return true;
        }, function(group) {
            return !group.contains(node, true);
        });
    }
};


/**
 * Rule object
 * @constructor
 * @extends Node
 * @param {Group} parent
 * @param {jQuery} $el
 */
var Rule = function(parent, $el) {
    if (!(this instanceof Rule)) {
        return new Rule(parent, $el);
    }

    Node.call(this, parent, $el);

    this._updating_value = false;
    this._updating_input = false;

    /**
     * @name filter
     * @member {QueryBuilder.Filter}
     * @memberof Rule
     * @instance
     */
    this.__.filter = null;

    /**
     * @name operator
     * @member {QueryBuilder.Operator}
     * @memberof Rule
     * @instance
     */
    this.__.operator = null;

    /**
     * @name value
     * @member {*}
     * @memberof Rule
     * @instance
     */
    this.__.value = undefined;
};

Rule.prototype = Object.create(Node.prototype);
Rule.prototype.constructor = Rule;

Utils.defineModelProperties(Rule, ['filter', 'operator', 'value']);

/**
 * Checks if this Node is the root
 * @returns {boolean} always false
 */
Rule.prototype.isRoot = function() {
    return false;
};


/**
 * @member {function}
 * @memberof QueryBuilder
 * @see Group
 */
QueryBuilder.Group = Group;

/**
 * @member {function}
 * @memberof QueryBuilder
 * @see Rule
 */
QueryBuilder.Rule = Rule;


/**
 * The {@link http://learn.jquery.com/plugins/|jQuery Plugins} namespace
 * @external "jQuery.fn"
 */

/**
 * Instanciates or accesses the {@link QueryBuilder} on an element
 * @function
 * @memberof external:"jQuery.fn"
 * @param {*} option - initial configuration or method name
 * @param {...*} args - method arguments
 *
 * @example
 * $('#builder').queryBuilder({ /** configuration object *\/ });
 * @example
 * $('#builder').queryBuilder('methodName', methodParam1, methodParam2);
 */
$.fn.queryBuilder = function(option) {
    if (this.length === 0) {
        Utils.error('Config', 'No target defined');
    }
    if (this.length > 1) {
        Utils.error('Config', 'Unable to initialize on multiple target');
    }

    var data = this.data('queryBuilder');
    var options = (typeof option == 'object' && option) || {};

    if (!data && option == 'destroy') {
        return this;
    }
    if (!data) {
        var builder = new QueryBuilder(this, options);
        this.data('queryBuilder', builder);
        builder.init(options.rules);
    }
    if (typeof option == 'string') {
        return data[option].apply(data, Array.prototype.slice.call(arguments, 1));
    }

    return this;
};

/**
 * @function
 * @memberof external:"jQuery.fn"
 * @see QueryBuilder
 */
$.fn.queryBuilder.constructor = QueryBuilder;

/**
 * @function
 * @memberof external:"jQuery.fn"
 * @see QueryBuilder.defaults
 */
$.fn.queryBuilder.defaults = QueryBuilder.defaults;

/**
 * @function
 * @memberof external:"jQuery.fn"
 * @see QueryBuilder.defaults
 */
$.fn.queryBuilder.extend = QueryBuilder.extend;

/**
 * @function
 * @memberof external:"jQuery.fn"
 * @see QueryBuilder.define
 */
$.fn.queryBuilder.define = QueryBuilder.define;

/**
 * @function
 * @memberof external:"jQuery.fn"
 * @see QueryBuilder.regional
 */
$.fn.queryBuilder.regional = QueryBuilder.regional;


/*!
 * jQuery QueryBuilder 2.5.0
 * Locale: English (en)
 * Author: Damien "Mistic" Sorel, http://www.strangeplanet.fr
 * Licensed under MIT (http://opensource.org/licenses/MIT)
 */

QueryBuilder.regional['en'] = {
  "__locale": "English (en)",
  "__author": "Damien \"Mistic\" Sorel, http://www.strangeplanet.fr",
  "add_rule": "Add rule",
  "add_group": "Add group",
  "delete_rule": "Delete",
  "delete_group": "Delete",
  "conditions": {
    "AND": "AND",
    "OR": "OR"
  },
  "operators": {
    "equal": "equal",
    "not_equal": "not equal",
    "in": "in",
    "not_in": "not in",
    "less": "less",
    "less_or_equal": "less or equal",
    "greater": "greater",
    "greater_or_equal": "greater or equal",
    "between": "between",
    "not_between": "not between",
    "begins_with": "begins with",
    "not_begins_with": "doesn't begin with",
    "contains": "contains",
    "not_contains": "doesn't contain",
    "ends_with": "ends with",
    "not_ends_with": "doesn't end with",
    "is_empty": "is empty",
    "is_not_empty": "is not empty",
    "is_null": "is null",
    "is_not_null": "is not null"
  },
  "errors": {
    "no_filter": "No filter selected",
    "empty_group": "The group is empty",
    "radio_empty": "No value selected",
    "checkbox_empty": "No value selected",
    "select_empty": "No value selected",
    "string_empty": "Empty value",
    "string_exceed_min_length": "Must contain at least {0} characters",
    "string_exceed_max_length": "Must not contain more than {0} characters",
    "string_invalid_format": "Invalid format ({0})",
    "number_nan": "Not a number",
    "number_not_integer": "Not an integer",
    "number_not_double": "Not a real number",
    "number_exceed_min": "Must be greater than {0}",
    "number_exceed_max": "Must be lower than {0}",
    "number_wrong_step": "Must be a multiple of {0}",
    "datetime_empty": "Empty value",
    "datetime_invalid": "Invalid date format ({0})",
    "datetime_exceed_min": "Must be after {0}",
    "datetime_exceed_max": "Must be before {0}",
    "boolean_not_valid": "Not a boolean",
    "operator_not_multiple": "Operator \"{1}\" cannot accept multiple values"
  }
};

QueryBuilder.defaults({ lang_code: 'en' });