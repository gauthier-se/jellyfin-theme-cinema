// Standard rules, minus the naming patterns: the selectors follow Jellyfin's
// and its plugins' class names, which are camelCase.
export default {
    extends: ["stylelint-config-standard"],
    rules: {
        "selector-class-pattern": null,
        "selector-id-pattern": null,
        // Jellyfin's own variables (--jf-palette-primary-mainChannel...) are
        // camelCase; the theme's are --cn-* in kebab-case.
        "custom-property-pattern": [
            "^(cn-[a-z0-9-]+|jf-[a-zA-Z0-9-]+|slideshow-[a-z0-9-]+)$",
            { message: "Use the --cn- prefix for theme tokens" },
        ],
        // A theme overrides rules from many sources; their order is the
        // cascade, not a specificity ladder.
        "no-descending-specificity": null,
        // System font keywords keep their usual casing; quoting them would
        // turn BlinkMacSystemFont into an ordinary, missing family name.
        "value-keyword-case": [
            "lower",
            { ignoreKeywords: ["BlinkMacSystemFont", "Roboto", "Arial"] },
        ],
    },
};
