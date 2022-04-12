'use strict';

/**
 * Pattern service.
 */

/**
 * Get all fields from a pattern.
 *
 * @param {string} pattern - The pattern.
 *
 * @returns {array} The fields.
 */
const getFieldsFromPattern = (pattern) => {
    let fields = pattern.match(/[[\w\d\.]+]/g); // Get all substrings between [] as array.
    fields = fields.map((field) => RegExp(/(?<=\[)(.*?)(?=\])/).exec(field)[0]); // Strip [] from string.
    return fields;
};

const getFieldsFromPatternPrime = (pattern) => {
    let fields = pattern.match(/[{\w\d\.\$\[\]\:]+}/g); // Get all substrings between {} as array.
    if(fields)
    fields = fields.map((field) => RegExp(/(?<=\{)(.*?)(?=\})/).exec(field)[0]); // Strip {} from string.
    return fields;
};



/**
 * Resolve a pattern string from pattern to path for a single entity.
 *
 * @param {string} pattern - The pattern.
 * @param {object} entity - The entity.
 *
 * @returns {string} The path.
 */
const resolvePattern = async (pattern, entity) => {
    const fields = getFieldsFromPattern(pattern);

    fields.map((field) => {
        let key = field
        let replaceWith = entity[field.split('.')[0]]
        while (key.includes('.')) {
            key = key.substr(key.indexOf('.') + 1)
            replaceWith = replaceWith[key.split('.')[0]]
        }
        if (typeof replaceWith !== 'string') replaceWith = pattern
        pattern = pattern.replace(`[${field}]`, replaceWith || '');
    });

    const fieldsPrime = getFieldsFromPatternPrime(pattern)

    const promises = fieldsPrime.map(async (field) => {
        const split = field.split("$")
        if (split.length < 3) return
        const queryModel = split[0]
        const queryAttribute = split[split.length - 1]
        const query = {}

        split.slice(1, split.length - 1).map((queries) => {
            const split = queries.split(":");
            if (split.length < 2) return
            query[split[0]] = split[1]
        })

        let res = await strapi.query(queryModel).findOne(query);
        let key = queryAttribute
        let replaceWith = res[queryAttribute.split('.')[0]]
        while (key.includes('.')) {
            key = key.substr(key.indexOf('.') + 1)
            replaceWith = replaceWith[key.split('.')[0]]
        }
        if (typeof replaceWith !== 'string') replaceWith = pattern
        strapi.log.debug("~before", pattern, field);
        pattern = pattern.replace(`{${field}}`, replaceWith || '');
        strapi.log.debug("~after", pattern, replaceWith);
    })

    await Promise.all(promises)

    pattern = pattern.replace(/([^:]\/)\/+/g, "$1"); // Remove duplicate forward slashes.
    pattern = pattern.startsWith('/') ? pattern : `/${pattern}`; // Add a starting slash.
    return pattern;
};

// let test = await strapi.query('pages').findOne({ page_type: 'blog'});

/**
 * Validate if a pattern is correctly structured.
 *
 * @param {string} pattern - The pattern.
 * @param {array} allowedFieldNames - Fields allowed in this pattern.
 *
 * @returns {object} object.
 * @returns {boolean} object.valid Validation boolean.
 * @returns {string} object.message Validation string.
 */
const validatePattern = (pattern) => {
    if (!pattern) {
        return {
            valid: false,
            message: "Pattern can not be empty",
        };
    }

    const preCharCount = pattern.split("[").length - 1;
    const postCharount = pattern.split("]").length - 1;

    if (preCharCount < 1 || postCharount < 1) {
        return {
            valid: false,
            message: "Pattern should contain at least one field",
        };
    }

    if (preCharCount !== postCharount) {
        return {
            valid: false,
            message: "Fields in the pattern are not escaped correctly",
        };
    }

    return {
        valid: true,
        message: "Valid pattern",
    };
};

module.exports = {
    getFieldsFromPattern,
    resolvePattern,
    validatePattern,
};